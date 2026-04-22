/**
 * app.js - Journal page logic
 * Handles form submission, entry list rendering, edit/delete, and candle modal.
 */

let allEntries = [];
let chartEntries = [];
let editingId = null;
let currentFilter = 'all';
let currentSort = 'desc';

const entryForm = document.getElementById('entry-form');
const formTitle = document.getElementById('form-title');
const dateInput = document.getElementById('entry-date');
const titleInput = document.getElementById('entry-title');
const noteInput = document.getElementById('entry-note');
const scoreInput = document.getElementById('entry-score');
const scoreDisplay = document.getElementById('score-display');
const tagsInput = document.getElementById('entry-tags');
const submitBtn = document.getElementById('submit-btn');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const todayBtn = document.getElementById('today-btn');
const filterBtns = document.querySelectorAll('.filter-btn');
const sortBtn = document.getElementById('sort-btn');
const entriesList = document.getElementById('entries-list');
const emptyState = document.getElementById('empty-state');
const loadingState = document.getElementById('loading-state');
const totalGreenEl = document.getElementById('total-green');
const totalRedEl = document.getElementById('total-red');
const streakEl = document.getElementById('current-streak');
const avgScoreEl = document.getElementById('avg-score');
const candleModal = document.getElementById('candle-modal');
const candleClose = document.getElementById('candle-modal-close');
const candleOverlay = document.getElementById('candle-modal-overlay');

function getSelectedType() {
  const checked = document.querySelector('input[name="entry-type"]:checked');
  return checked ? checked.value : 'green';
}

function setSelectedType(value) {
  const radio = document.querySelector(`input[name="entry-type"][value="${value}"]`);
  if (radio) radio.checked = true;
}

function toInputDate(dateStr) {
  const d = new Date(dateStr);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function setTodayDate() {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  dateInput.value = `${yyyy}-${mm}-${dd}`;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showLoading(show) {
  loadingState.style.display = show ? 'flex' : 'none';
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 350);
  }, 3500);
}

document.addEventListener('DOMContentLoaded', async () => {
  const authorized = await Auth.requireAuth();
  if (!authorized) return;

  ThemeManager.init();
  Auth.renderNavbarUser();
  CandleChart.init('candle-chart', openCandleModal);
  setTodayDate();
  bindEvents();
  await loadEntries();
});

async function loadEntries() {
  showLoading(true);
  try {
    const params = { sort: currentSort };
    if (currentFilter !== 'all') params.type = currentFilter;

    const [filteredRes, allRes] = await Promise.all([
      JournalAPI.getAll(params),
      JournalAPI.getAll({ sort: 'asc' }),
    ]);

    allEntries = filteredRes.data || [];
    chartEntries = allRes.data || [];

    renderEntries();
    renderSummary(chartEntries);
    CandleChart.render(chartEntries);
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    showLoading(false);
  }
}

function renderSummary(data) {
  const green = data.filter((e) => e.type === 'green').length;
  const red = data.filter((e) => e.type === 'red').length;
  totalGreenEl.textContent = green;
  totalRedEl.textContent = red;

  const sorted = [...data].sort((a, b) => new Date(b.date) - new Date(a.date));
  let streak = 0;
  for (const e of sorted) {
    if (e.type === 'green') streak += 1;
    else break;
  }
  streakEl.textContent = streak;

  const avg = data.length ? (data.reduce((s, e) => s + e.score, 0) / data.length).toFixed(1) : '-';
  avgScoreEl.textContent = avg;
}

function renderEntries() {
  if (!allEntries.length) {
    entriesList.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';
  entriesList.innerHTML = allEntries.map(entryCard).join('');

  entriesList.querySelectorAll('.edit-btn').forEach((btn) =>
    btn.addEventListener('click', () => startEdit(btn.dataset.id))
  );
  entriesList.querySelectorAll('.delete-btn').forEach((btn) =>
    btn.addEventListener('click', () => confirmDelete(btn.dataset.id))
  );
}

function entryCard(entry) {
  const dateStr = new Date(entry.date).toLocaleDateString('en-US', {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC',
  });
  const tagsHtml = entry.tags && entry.tags.length
    ? `<div class="entry-tags">${entry.tags.map((t) => `<span class="tag">${escHtml(t)}</span>`).join('')}</div>`
    : '';
  const cls = entry.type === 'green' ? 'entry-green' : 'entry-red';
  const icon = entry.type === 'green' ? '+' : '-';

  return `
    <div class="entry-card ${cls}">
      <div class="entry-header">
        <div class="entry-date-row">
          <span class="entry-type-icon">${icon}</span>
          <span class="entry-date">${dateStr}</span>
          <span class="entry-score-badge score-${entry.score}">Score: ${entry.score}</span>
        </div>
        <div class="entry-actions">
          <button class="btn-icon edit-btn" data-id="${entry._id}" title="Edit">Edit</button>
          <button class="btn-icon delete-btn" data-id="${entry._id}" title="Delete">Delete</button>
        </div>
      </div>
      <h3 class="entry-title">${escHtml(entry.title)}</h3>
      <p class="entry-note">${escHtml(entry.note)}</p>
      ${tagsHtml}
    </div>`;
}

function bindEvents() {
  entryForm.addEventListener('submit', handleSubmit);
  cancelEditBtn.addEventListener('click', cancelEdit);
  todayBtn.addEventListener('click', setTodayDate);

  scoreInput.addEventListener('input', () => {
    scoreDisplay.textContent = scoreInput.value;
  });

  filterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      filterBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      loadEntries();
    });
  });

  sortBtn.addEventListener('click', () => {
    currentSort = currentSort === 'desc' ? 'asc' : 'desc';
    sortBtn.textContent = currentSort === 'desc' ? 'Newest' : 'Oldest';
    loadEntries();
  });

  candleClose.addEventListener('click', closeCandleModal);
  candleOverlay.addEventListener('click', closeCandleModal);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeCandleModal();
  });

  document.addEventListener('theme:changed', () => {
    CandleChart.render(chartEntries);
  });

  window.addEventListener('resize', () => {
    CandleChart.render(chartEntries);
  });
}

async function handleSubmit(e) {
  e.preventDefault();

  const data = {
    date: dateInput.value,
    type: getSelectedType(),
    title: titleInput.value.trim(),
    note: noteInput.value.trim(),
    score: Number(scoreInput.value),
    tags: tagsInput.value.split(',').map((t) => t.trim()).filter(Boolean),
  };

  if (!data.date || !data.title || !data.note) {
    showToast('Please fill in all required fields.', 'error');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Saving...';

  try {
    if (editingId) {
      await JournalAPI.update(editingId, data);
      showToast('Entry updated!', 'success');
      cancelEdit();
    } else {
      await JournalAPI.create(data);
      showToast('Entry created!', 'success');
      entryForm.reset();
      scoreDisplay.textContent = '5';
      scoreInput.value = '5';
      setTodayDate();
      setSelectedType('green');
    }

    await loadEntries();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = editingId ? 'Update Entry' : 'Add Entry';
  }
}

async function startEdit(id) {
  try {
    const res = await JournalAPI.getById(id);
    const entry = res.data;
    editingId = id;

    formTitle.textContent = 'Edit Entry';
    submitBtn.textContent = 'Update Entry';
    cancelEditBtn.style.display = 'inline-flex';

    dateInput.value = toInputDate(entry.date);
    setSelectedType(entry.type);
    titleInput.value = entry.title;
    noteInput.value = entry.note;
    scoreInput.value = entry.score;
    scoreDisplay.textContent = entry.score;
    tagsInput.value = (entry.tags || []).join(', ');

    document.getElementById('entry-form-section').scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function cancelEdit() {
  editingId = null;
  formTitle.textContent = 'New Day Entry';
  submitBtn.textContent = 'Add Entry';
  cancelEditBtn.style.display = 'none';
  entryForm.reset();
  scoreDisplay.textContent = '5';
  scoreInput.value = '5';
  setTodayDate();
  setSelectedType('green');
}

async function confirmDelete(id) {
  if (!confirm('Delete this entry? This cannot be undone.')) return;

  try {
    await JournalAPI.delete(id);
    showToast('Entry deleted.', 'success');
    await loadEntries();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function openCandleModal(entry) {
  const dateStr = new Date(entry.date).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
  });
  const isGreen = entry.type === 'green';
  const typeLabel = isGreen ? 'UP Green Day' : 'DOWN Red Day';
  const typeClass = isGreen ? 'modal-green' : 'modal-red';
  const tagsHtml = entry.tags && entry.tags.length
    ? `<div class="modal-tags">${entry.tags.map((t) => `<span class="tag">${escHtml(t)}</span>`).join('')}</div>`
    : '';

  document.getElementById('candle-modal-content').innerHTML = `
    <div class="modal-header-row ${typeClass}">
      <span class="modal-type">${typeLabel}</span>
      <span class="modal-score">Score: ${entry.score}/10</span>
    </div>
    <div class="modal-date">${dateStr}</div>
    <h3 class="modal-entry-title">${escHtml(entry.title)}</h3>
    <p class="modal-note">${escHtml(entry.note)}</p>
    ${tagsHtml}
  `;

  candleModal.classList.add('open');
  candleOverlay.classList.add('open');
}

function closeCandleModal() {
  candleModal.classList.remove('open');
  candleOverlay.classList.remove('open');
}
