/**
 * goals.js - Goals page logic
 */

let allGoals = [];
let allGoalsForStats = [];
let editingGoalId = null;
let currentStatusFilter = 'all';

const goalForm = document.getElementById('goal-form');
const goalFormTitle = document.getElementById('goal-form-title');
const goalTitleInput = document.getElementById('goal-title');
const goalDescInput = document.getElementById('goal-desc');
const goalDateInput = document.getElementById('goal-date');
const goalStatusSelect = document.getElementById('goal-status');
const goalProgressInput = document.getElementById('goal-progress');
const goalProgressDisplay = document.getElementById('goal-progress-display');
const goalSubmitBtn = document.getElementById('goal-submit-btn');
const goalCancelBtn = document.getElementById('goal-cancel-btn');
const goalsGrid = document.getElementById('goals-grid');
const goalsEmpty = document.getElementById('goals-empty');
const filterBtns = document.querySelectorAll('.filter-btn');

document.addEventListener('DOMContentLoaded', async () => {
  const authorized = await Auth.requireAuth();
  if (!authorized) return;

  ThemeManager.init();
  Auth.renderNavbarUser();
  await loadGoals();
  bindEvents();
});

async function loadGoals() {
  showLoading(true);

  try {
    const params = {};
    if (currentStatusFilter !== 'all') params.status = currentStatusFilter;

    const [filteredRes, allRes] = await Promise.all([
      GoalsAPI.getAll(params),
      GoalsAPI.getAll(),
    ]);

    allGoals = filteredRes.data || [];
    allGoalsForStats = allRes.data || [];

    renderGoals();
    renderStats();
  } catch (err) {
    showToastG(err.message, 'error');
  } finally {
    showLoading(false);
  }
}

function renderStats() {
  const active = allGoalsForStats.filter((g) => g.status === 'active').length;
  const completed = allGoalsForStats.filter((g) => g.status === 'completed').length;
  const failed = allGoalsForStats.filter((g) => g.status === 'failed').length;

  const el = document.getElementById('goals-stats');
  if (!el) return;

  el.innerHTML = `
    <span class="stat-item stat-active">${active} Active</span>
    <span class="stat-item stat-completed">${completed} Completed</span>
    <span class="stat-item stat-failed">${failed} Failed</span>
  `;
}

function renderGoals() {
  if (!allGoals.length) {
    goalsGrid.innerHTML = '';
    goalsEmpty.style.display = 'block';
    return;
  }

  goalsEmpty.style.display = 'none';
  goalsGrid.innerHTML = allGoals.map(goalCard).join('');

  goalsGrid.querySelectorAll('.goal-edit-btn').forEach((btn) => {
    btn.addEventListener('click', () => startEditGoal(btn.dataset.id));
  });

  goalsGrid.querySelectorAll('.goal-delete-btn').forEach((btn) => {
    btn.addEventListener('click', () => confirmDeleteGoal(btn.dataset.id));
  });

  goalsGrid.querySelectorAll('.status-btn').forEach((btn) => {
    btn.addEventListener('click', () => quickStatusChange(btn.dataset.id, btn.dataset.status));
  });

  goalsGrid.querySelectorAll('.progress-slider').forEach((slider) => {
    slider.addEventListener('change', async (e) => {
      const id = e.target.dataset.id;
      const val = Number(e.target.value);
      e.target.parentElement.querySelector('.progress-val').textContent = `${val}%`;

      try {
        await GoalsAPI.update(id, { progress: val });
        showToastG('Progress updated!', 'success');
        await loadGoals();
      } catch (err) {
        showToastG(err.message, 'error');
      }
    });

    slider.addEventListener('input', (e) => {
      e.target.parentElement.querySelector('.progress-val').textContent = `${e.target.value}%`;
    });
  });
}

function goalCard(goal) {
  const targetDateStr = goal.targetDate
    ? new Date(goal.targetDate).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC',
    })
    : 'No deadline';

  const statusClass = { active: 'status-active', completed: 'status-completed', failed: 'status-failed' }[goal.status];
  const statusIcon = { active: 'A', completed: 'C', failed: 'F' }[goal.status];
  const progressColor = goal.progress >= 80 ? 'progress-high' : goal.progress >= 40 ? 'progress-mid' : 'progress-low';

  const descHtml = goal.description
    ? `<p class="goal-desc">${escHtml(goal.description)}</p>`
    : '';

  return `
    <div class="goal-card ${statusClass}">
      <div class="goal-card-header">
        <div>
          <span class="goal-status-badge ${statusClass}">${statusIcon} ${goal.status}</span>
          <span class="goal-target-date">${targetDateStr}</span>
        </div>
        <div class="goal-actions">
          <button class="btn-icon goal-edit-btn" data-id="${goal._id}" title="Edit">Edit</button>
          <button class="btn-icon goal-delete-btn" data-id="${goal._id}" title="Delete">Delete</button>
        </div>
      </div>
      <h3 class="goal-title">${escHtml(goal.title)}</h3>
      ${descHtml}
      <div class="goal-progress-row">
        <div class="progress-bar-wrapper">
          <div class="progress-bar-track">
            <div class="progress-bar-fill ${progressColor}" style="width:${goal.progress}%"></div>
          </div>
          <span class="progress-val">${goal.progress}%</span>
        </div>
        <input type="range" class="progress-slider" data-id="${goal._id}" min="0" max="100" value="${goal.progress}">
      </div>
      <div class="goal-quick-status">
        ${goal.status !== 'active' ? `<button class="quick-status-btn btn-active status-btn" data-id="${goal._id}" data-status="active">Set Active</button>` : ''}
        ${goal.status !== 'completed' ? `<button class="quick-status-btn btn-complete status-btn" data-id="${goal._id}" data-status="completed">Complete</button>` : ''}
        ${goal.status !== 'failed' ? `<button class="quick-status-btn btn-fail status-btn" data-id="${goal._id}" data-status="failed">Mark Failed</button>` : ''}
      </div>
    </div>`;
}

function bindEvents() {
  goalForm.addEventListener('submit', handleGoalSubmit);
  goalCancelBtn.addEventListener('click', cancelGoalEdit);

  goalProgressInput.addEventListener('input', () => {
    goalProgressDisplay.textContent = `${goalProgressInput.value}%`;
  });

  filterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      filterBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentStatusFilter = btn.dataset.filter;
      loadGoals();
    });
  });
}

async function handleGoalSubmit(e) {
  e.preventDefault();

  const data = {
    title: goalTitleInput.value.trim(),
    description: goalDescInput.value.trim(),
    targetDate: goalDateInput.value || null,
    status: goalStatusSelect.value,
    progress: Number(goalProgressInput.value),
  };

  if (!data.title) {
    showToastG('Title is required.', 'error');
    return;
  }

  goalSubmitBtn.disabled = true;
  goalSubmitBtn.textContent = 'Saving...';

  try {
    if (editingGoalId) {
      await GoalsAPI.update(editingGoalId, data);
      showToastG('Goal updated!', 'success');
      cancelGoalEdit();
    } else {
      await GoalsAPI.create(data);
      showToastG('Goal created!', 'success');
      goalForm.reset();
      goalProgressDisplay.textContent = '0%';
    }

    await loadGoals();
  } catch (err) {
    showToastG(err.message, 'error');
  } finally {
    goalSubmitBtn.disabled = false;
    goalSubmitBtn.textContent = editingGoalId ? 'Update Goal' : 'Add Goal';
  }
}

async function startEditGoal(id) {
  try {
    const res = await GoalsAPI.getById(id);
    const goal = res.data;

    editingGoalId = id;
    goalFormTitle.textContent = 'Edit Goal';
    goalSubmitBtn.textContent = 'Update Goal';
    goalCancelBtn.style.display = 'inline-flex';

    goalTitleInput.value = goal.title;
    goalDescInput.value = goal.description || '';
    goalDateInput.value = goal.targetDate ? new Date(goal.targetDate).toISOString().split('T')[0] : '';
    goalStatusSelect.value = goal.status;
    goalProgressInput.value = goal.progress;
    goalProgressDisplay.textContent = `${goal.progress}%`;

    document.getElementById('goal-form-section').scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    showToastG(err.message, 'error');
  }
}

function cancelGoalEdit() {
  editingGoalId = null;
  goalFormTitle.textContent = 'New Goal';
  goalSubmitBtn.textContent = 'Add Goal';
  goalCancelBtn.style.display = 'none';
  goalForm.reset();
  goalProgressDisplay.textContent = '0%';
}

async function confirmDeleteGoal(id) {
  if (!confirm('Delete this goal? This cannot be undone.')) return;

  try {
    await GoalsAPI.delete(id);
    showToastG('Goal deleted.', 'success');
    await loadGoals();
  } catch (err) {
    showToastG(err.message, 'error');
  }
}

async function quickStatusChange(id, status) {
  try {
    await GoalsAPI.update(id, { status });
    showToastG(`Goal marked as ${status}!`, 'success');
    await loadGoals();
  } catch (err) {
    showToastG(err.message, 'error');
  }
}

function showLoading(show) {
  const loader = document.getElementById('loading-state');
  if (loader) loader.style.display = show ? 'flex' : 'none';
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showToastG(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
