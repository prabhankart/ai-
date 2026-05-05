const API_BASE = 'http://127.0.0.1:5000/api/analyze';

// ---------- TAB SWITCH ----------
// Use mousedown instead of click so file-picker events don't interfere
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('mousedown', (e) => {
    e.preventDefault(); // prevents focus steal / blur cascade
    e.stopPropagation();

    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(s => s.classList.remove('active'));

    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
    document.getElementById('result-section').classList.add('hidden');
  });
});

// ---------- DROP ZONE SETUP ----------
['image', 'audio', 'video'].forEach(type => {
  const zone  = document.getElementById(`${type}-drop`);
  const input = document.getElementById(`${type}-file`);
  const label = document.getElementById(`${type}-name`);

  // Hide the raw <input> — users click the zone itself
  input.style.display = 'none';

  zone.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    input.click();
  });

  input.addEventListener('change', (e) => {
    e.stopPropagation();
    if (input.files[0]) label.textContent = '📎 ' + input.files[0].name;
  });

  zone.addEventListener('dragover', e => {
    e.preventDefault();
    e.stopPropagation();
  });

  zone.addEventListener('drop', e => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    label.textContent = '📎 ' + file.name;
  });
});

// ---------- BUTTON WIRING ----------
document.getElementById('btn-text').addEventListener('click',  (e) => { e.stopPropagation(); analyzeText(); });
document.getElementById('btn-image').addEventListener('click', (e) => { e.stopPropagation(); analyzeFile('image'); });
document.getElementById('btn-audio').addEventListener('click', (e) => { e.stopPropagation(); analyzeFile('audio'); });
document.getElementById('btn-video').addEventListener('click', (e) => { e.stopPropagation(); analyzeFile('video'); });

// ---------- FILE SIZE ----------
function validateFile(file) {
  if (file.size > 100 * 1024 * 1024) {
    alert('File too large! Max 100MB allowed.');
    return false;
  }
  return true;
}

// ---------- UI HELPERS ----------
function showLoading() {
  document.getElementById('result-section').classList.remove('hidden');
  document.getElementById('loading-spinner').classList.remove('hidden');
  document.getElementById('result-body').classList.add('hidden');
  document.getElementById('result-error').classList.add('hidden');
}

function showError(msg) {
  document.getElementById('loading-spinner').classList.add('hidden');
  document.getElementById('result-body').classList.add('hidden');
  const err = document.getElementById('result-error');
  err.textContent = '⚠️ ' + msg;
  err.classList.remove('hidden');
}

function showResult(data) {
  if (data.error) { showError(data.error); return; }

  document.getElementById('loading-spinner').classList.add('hidden');
  document.getElementById('result-error').classList.add('hidden');
  document.getElementById('result-body').classList.remove('hidden');

  document.getElementById('result-summary').textContent          = data.summary || '—';
  document.getElementById('result-sentiment-reason').textContent = data.sentiment_reason || '—';
  document.getElementById('result-stance').textContent           = data.speaker_stance || '—';

  const badge = document.getElementById('sentiment-badge');
  badge.textContent = data.sentiment || '—';
  badge.className = 'sentiment-badge';
  const s = (data.sentiment || '').toUpperCase();
  if (s.includes('POSITIVE'))      badge.classList.add('POSITIVE');
  else if (s.includes('NEGATIVE')) badge.classList.add('NEGATIVE');
  else                              badge.classList.add('NEUTRAL');

  const argsList = document.getElementById('result-arguments');
  argsList.innerHTML = '';
  (data.key_arguments || []).forEach(a => {
    const li = document.createElement('li');
    li.textContent = a;
    argsList.appendChild(li);
  });

  const topicsDiv = document.getElementById('result-topics');
  topicsDiv.innerHTML = '';
  (data.key_topics || []).forEach(t => {
    const span = document.createElement('span');
    span.className = 'topic-tag';
    span.textContent = t;
    topicsDiv.appendChild(span);
  });
}

// ---------- ANALYZE TEXT ----------
async function analyzeText() {
  const text = document.getElementById('text-input').value.trim();
  if (!text) return alert('Please enter some text first.');
  showLoading();
  try {
    const res = await fetch(`${API_BASE}/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    showResult(await res.json());
  } catch (err) {
    showError('Network error: ' + err.message);
  }
}

// ---------- ANALYZE FILE ----------
async function analyzeFile(type) {
  const input = document.getElementById(`${type}-file`);
  const file  = input.files[0];
  if (!file)               return alert('Please select a file first.');
  if (!validateFile(file)) return;
  showLoading();
  const formData = new FormData();
  formData.append('file', file);
  try {
    const res = await fetch(`${API_BASE}/${type}`, {
      method: 'POST',
      body: formData
    });
    showResult(await res.json());
  } catch (err) {
    showError('Upload failed: ' + err.message);
  }
}