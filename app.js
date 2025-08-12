// --- Configure Supabase ---

const SUPABASE_URL = "https://rhzwubraxaxdlcqnudwi.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJoend1YnJheGF4ZGxjcW51ZHdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5Njk2NTIsImV4cCI6MjA3MDU0NTY1Mn0.LewrhXiDuJv08FWK43JdemkSYS5wxcufUM-9T2AVIv0";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Helpers
const $ = (id) => document.getElementById(id);
const nowYear = new Date().getFullYear();
document.addEventListener('DOMContentLoaded', () => { document.getElementById('year').textContent = nowYear; });

function toList(value) {
  if (!value) return [];
  return value.split(',').map(s => s.trim().toLowerCase()).filter(Boolean).slice(0, 20);
}
function hasIntersection(a, b) {
  const setB = new Set(b);
  return a.some(x => setB.has(x));
}
function renderChips(arr) {
  return arr.map(x => `<span class="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs mr-1 mb-1">${escapeHtml(x)}</span>`).join('');
}
function escapeHtml(str) {
  return str.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

// --- Post Trade ---
$('postBtn').addEventListener('click', async (e) => {
  e.preventDefault();
  $('postStatus').textContent = '';

  const handle = $('handle').value.trim();
  const discord = $('discord').value.trim();
  const roblox = $('roblox').value.trim();
  const haves = toList($('haves').value);
  const wants = toList($('wants').value);
  const notes  = $('notes').value.trim();

  if (!handle) return $('postStatus').textContent = 'Please add a display name.';
  if (haves.length === 0 || wants.length === 0) return $('postStatus').textContent = 'Add at least one Have and one Want.';

  $('postBtn').disabled = true;
  $('postStatus').textContent = 'Posting…';

  const { data, error } = await supabaseClient.from('trades').insert([{
    handle, contact_discord: discord || null, contact_roblox: roblox || null,
    notes: notes || null, haves, wants, status: 'open'
  }]).select();

  $('postBtn').disabled = false;
  if (error) {
    console.error(error);
    $('postStatus').textContent = 'Error: ' + error.message;
    return;
  }
  $('postStatus').textContent = 'Posted! It will appear in Browse.';

  // Clear fields
  $('haves').value = '';
  $('wants').value = '';
  $('notes').value = '';
});

// --- Browse ---
async function loadTrades() {
  $('browseStatus').textContent = 'Loading…';
  const { data, error } = await supabaseClient.from('trades')
    .select('*')
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) { $('browseStatus').textContent = 'Error loading.'; console.error(error); return []; }
  $('browseStatus').textContent = `${data.length} open trades`;
  return data;
}

function renderTradeCard(trade) {
  const created = new Date(trade.created_at).toLocaleString();
  return `<article class="border rounded-xl p-4 bg-white shadow-sm">
    <div class="flex items-start justify-between gap-2">
      <div>
        <h3 class="font-medium">${escapeHtml(trade.handle)}</h3>
        <p class="text-xs text-gray-500">${created}</p>
      </div>
      <span class="text-[10px] uppercase px-2 py-1 rounded bg-green-100 text-green-700">${escapeHtml(trade.status)}</span>
    </div>
    <div class="mt-3">
      <div class="text-xs text-gray-500 mb-1">Has</div>
      <div>${renderChips(trade.haves)}</div>
    </div>
    <div class="mt-2">
      <div class="text-xs text-gray-500 mb-1">Wants</div>
      <div>${renderChips(trade.wants)}</div>
    </div>
    ${trade.notes ? `<p class="mt-2 text-sm text-gray-700">${escapeHtml(trade.notes)}</p>` : ''}
    <div class="mt-3 grid grid-cols-2 gap-2 text-sm">
      ${trade.contact_discord ? `<a class="px-3 py-2 rounded-lg border text-center" href="https://discord.com/users" target="_blank" rel="noopener">Discord: ${escapeHtml(trade.contact_discord)}</a>` : ''}
      ${trade.contact_roblox ? `<a class="px-3 py-2 rounded-lg border text-center" href="https://www.roblox.com/users" target="_blank" rel="noopener">Roblox: ${escapeHtml(trade.contact_roblox)}</a>` : ''}
    </div>
  </article>`;
}

let allTrades = [];
async function refreshBrowse() {
  allTrades = await loadTrades();
  applySearch();
}
function applySearch() {
  const q = $('search').value.trim().toLowerCase();
  const container = $('tradeList');
  if (!q) {
    container.innerHTML = allTrades.map(renderTradeCard).join('');
    return;
  }
  const filtered = allTrades.filter(tr => {
    if (tr.handle && tr.handle.toLowerCase().includes(q)) return true;
    const inH = tr.haves && tr.haves.some(x => x.includes(q));
    const inW = tr.wants && tr.wants.some(x => x.includes(q));
    return inH || inW;
  });
  container.innerHTML = filtered.map(renderTradeCard).join('');
}
$('refreshBtn').addEventListener('click', refreshBrowse);
$('search').addEventListener('input', applySearch);
document.addEventListener('DOMContentLoaded', refreshBrowse);

// --- Find Matches ---
$('findBtn').addEventListener('click', async (e) => {
  e.preventDefault();
  const myHave = toList($('findHave').value);
  const myWant = toList($('findWant').value);
  $('findStatus').textContent = 'Searching…';
  if (myHave.length === 0 || myWant.length === 0) {
    $('findStatus').textContent = 'Add at least one Have and one Want.';
    return;
  }
  // Ensure we have the latest trades
  const trades = await loadTrades();
  const matches = trades.filter(tr => hasIntersection(tr.haves, myWant) && hasIntersection(tr.wants, myHave));
  $('findStatus').textContent = matches.length ? `${matches.length} match(es)` : 'No exact matches yet. Try browsing.';
  const container = $('findResults');
  container.innerHTML = matches.map(tr => {
    const aHasBWant = tr.haves.filter(x => myWant.includes(x));
    const bHasAWant = tr.wants.filter(x => myHave.includes(x));
    return `<article class="border rounded-xl p-4 bg-white shadow-sm">
      <div class="flex items-start justify-between gap-2">
        <div>
          <h3 class="font-medium">${escapeHtml(tr.handle)}</h3>
          <p class="text-xs text-gray-500">${new Date(tr.created_at).toLocaleString()}</p>
        </div>
      </div>
      <div class="mt-2 text-sm">
        <div class="text-xs text-gray-500 mb-1">They have (you want)</div>
        <div>${renderChips(aHasBWant)}</div>
        <div class="text-xs text-gray-500 mt-2 mb-1">They want (you have)</div>
        <div>${renderChips(bHasAWant)}</div>
      </div>
      <div class="mt-3 grid grid-cols-2 gap-2 text-sm">
        ${tr.contact_discord ? `<a class="px-3 py-2 rounded-lg border text-center" href="https://discord.com/users" target="_blank" rel="noopener">Discord: ${escapeHtml(tr.contact_discord)}</a>` : ''}
        ${tr.contact_roblox ? `<a class="px-3 py-2 rounded-lg border text-center" href="https://www.roblox.com/users" target="_blank" rel="noopener">Roblox: ${escapeHtml(tr.contact_roblox)}</a>` : ''}
      </div>
    </article>`;
  }).join('');
});

// Initial call to populate browse
refreshBrowse();
