let goals = [];
let tasks = [];
let achievements = [];
let editingGoalId = null;
let editingTaskId = null;
let currentGoalStatusFilter = 'all';
let scheduleView = 'today';
let scheduleAnchorDate = startOfLocalDay(new Date());
let lastFocusedElement = null;
let createdGoalIds = new Set();
let createdTaskIds = new Set();
const MOTION_MS = 260;

const goalForm = document.getElementById('goal-form');
const goalModal = document.getElementById('goal-modal');
const goalFormTitle = document.getElementById('goal-form-title');
const goalTitleInput = document.getElementById('goal-title');
const goalDescInput = document.getElementById('goal-desc');
const goalDateInput = document.getElementById('goal-date');
const goalStatusSelect = document.getElementById('goal-status');
const goalProgressInput = document.getElementById('goal-progress');
const goalProgressDisplay = document.getElementById('goal-progress-display');
const goalPrioritySelect = document.getElementById('goal-priority');
const goalCategoryInput = document.getElementById('goal-category');
const goalSubmitBtn = document.getElementById('goal-submit-btn');
const goalCancelBtn = document.getElementById('goal-cancel-btn');
const goalsGrid = document.getElementById('goals-grid');
const goalsEmpty = document.getElementById('goals-empty');

const taskForm = document.getElementById('task-form');
const taskModal = document.getElementById('task-modal');
const taskFormTitle = document.getElementById('task-form-title');
const taskTitleInput = document.getElementById('task-title');
const taskDescriptionInput = document.getElementById('task-description');
const taskDateInput = document.getElementById('task-date');
const taskStartInput = document.getElementById('task-start');
const taskEndInput = document.getElementById('task-end');
const taskGoalSelect = document.getElementById('task-goal');
const taskPrioritySelect = document.getElementById('task-priority');
const taskStatusSelect = document.getElementById('task-status');
const taskColorInput = document.getElementById('task-color');
const taskSubmitBtn = document.getElementById('task-submit-btn');
const taskCancelBtn = document.getElementById('task-cancel-btn');

const loadingState = document.getElementById('loading-state');
const dashboardError = document.getElementById('dashboard-error');
const scheduleBoard = document.getElementById('schedule-board');
const scheduleEmpty = document.getElementById('schedule-empty');
const scheduleRangeLabel = document.getElementById('schedule-range-label');

document.addEventListener('DOMContentLoaded', async () => {
  if (window.I18n && I18n.ready) {
    await I18n.ready;
  }

  const authorized = await Auth.requireAuth();
  if (!authorized) return;

  ThemeManager.init();
  Auth.renderNavbarUser();
  taskDateInput.value = dateKey(new Date());
  bindEvents();
  syncScheduleTabIndicator();
  await loadDashboard();
});

async function loadDashboard() {
  showLoading(true);
  setDashboardError('');

  try {
    const [goalsRes, tasksRes, achievementsRes] = await Promise.all([
      GoalsAPI.getAll(),
      TasksAPI.getAll(),
      AchievementsAPI.getAll(),
    ]);

    goals = goalsRes.data || [];
    tasks = tasksRes.data || [];
    achievements = achievementsRes.data || [];

    renderDashboard();
  } catch (err) {
    const message = translateMessage(err.message || t('common.loading'));
    setDashboardError(message);
    showToastG(message, 'error');
  } finally {
    showLoading(false);
  }
}

function renderDashboard() {
  renderStats();
  renderGoalOptions();
  renderGoals();
  renderSchedule();
}

function renderStats() {
  const todayKey = dateKey(new Date());
  const activeGoals = goals.filter((goal) => goal.status === 'active');
  const completedGoals = goals.filter((goal) => goal.status === 'completed');
  const todayTasks = tasks.filter((task) => taskDateKey(task) === todayKey);

  setText('stat-active-goals', activeGoals.length);
  setText('stat-completed-goals', completedGoals.length);
  setText('stat-today-tasks', todayTasks.length);
  setText('stat-current-streak', currentTaskStreak());
}

function renderGoalOptions() {
  const selected = taskGoalSelect.value;
  const options = goals
    .filter((goal) => goal.status !== 'failed')
    .map((goal) => `<option value="${goal._id}">${escHtml(goal.title)}</option>`)
    .join('');

  taskGoalSelect.innerHTML = `<option value="">${t('goals.taskGoalNone')}</option>${options}`;
  taskGoalSelect.value = [...taskGoalSelect.options].some((option) => option.value === selected) ? selected : '';
}

function renderGoals() {
  const filtered = goals.filter((goal) => currentGoalStatusFilter === 'all' || goal.status === currentGoalStatusFilter);

  if (!filtered.length) {
    goalsGrid.innerHTML = '';
    goalsEmpty.style.display = 'block';
    const heading = goals.length
      ? t('goals.empty.filtered', { status: t(`status.${currentGoalStatusFilter}`) })
      : t('goals.empty.title');
    goalsEmpty.querySelector('h3').textContent = heading;
    return;
  }

  goalsEmpty.style.display = 'none';
  goalsGrid.innerHTML = filtered.map((goal, index) => goalCard(goal, index)).join('');
  setTimeout(() => {
    createdGoalIds.clear();
  }, MOTION_MS + 180);
}

function goalCard(goal, index = 0) {
  const targetDateStr = goal.targetDate ? formatDate(goal.targetDate) : t('goals.noTargetDate');
  const statusClass = `status-${goal.status}`;
  const priorityClass = `priority-${goal.priority || 'medium'}`;
  const progress = clampProgress(goal.progress);
  const progressColor = progress >= 80 ? 'progress-high' : progress >= 40 ? 'progress-mid' : 'progress-low';
  const statusLabel = goal.status === 'completed' ? t('status.done') : t(`status.${goal.status}`);
  const newClass = createdGoalIds.has(goal._id) ? ' is-new' : '';

  return `
    <article class="goal-card ${statusClass}${newClass}" data-goal-id="${goal._id}" style="--item-index:${index};">
      <div class="goal-card-header">
        <div class="goal-title-stack">
          <h3 class="goal-title">${escHtml(goal.title)}</h3>
          <div class="goal-card-meta">
            <span class="goal-status-badge ${statusClass}">${escHtml(statusLabel)}</span>
            <span class="priority-pill ${priorityClass}">${escHtml(t(`priority.${goal.priority || 'medium'}`))}</span>
          </div>
        </div>
        <details class="card-menu">
          <summary class="btn-icon menu-trigger" aria-label="${t('goals.goalActions')}" data-tooltip="${t('goals.goalActions')}">...</summary>
          <div class="card-menu-list">
            <button data-goal-action="edit" data-id="${goal._id}" type="button">${t('action.edit')}</button>
            ${goal.status !== 'active' ? `<button data-goal-action="status" data-status="active" data-id="${goal._id}" type="button">${t('action.setActive')}</button>` : ''}
            ${goal.status !== 'completed' ? `<button data-goal-action="status" data-status="completed" data-id="${goal._id}" type="button">${t('action.complete')}</button>` : ''}
            ${goal.status !== 'failed' ? `<button data-goal-action="status" data-status="failed" data-id="${goal._id}" type="button">${t('action.markFailed')}</button>` : ''}
            <button class="danger-menu-item" data-goal-action="delete" data-id="${goal._id}" type="button">${t('action.delete')}</button>
          </div>
        </details>
      </div>
      <div class="goal-progress-block" aria-label="${t('goals.progressAria', { progress })}">
        <div class="progress-bar-wrapper">
          <div class="progress-bar-track">
            <div class="progress-bar-fill ${progressColor}" style="width:${progress}%"></div>
          </div>
          <span class="progress-val">${progress}%</span>
        </div>
      </div>
      <div class="goal-footer">
        <span class="goal-target-date">${escHtml(t('goals.targetPrefix', { date: targetDateStr }))}</span>
      </div>
    </article>`;
}

function renderSchedule() {
  scheduleBoard.classList.remove('schedule-enter');

  if (scheduleView === 'week') {
    renderWeekSchedule();
  } else if (scheduleView === 'calendar') {
    renderCalendarSchedule();
  } else {
    renderTodaySchedule();
  }

  requestAnimationFrame(() => {
    scheduleBoard.classList.add('schedule-enter');
  });
  setTimeout(() => {
    createdTaskIds.clear();
  }, MOTION_MS + 180);
}

function renderTodaySchedule() {
  const key = dateKey(scheduleAnchorDate);
  const dayTasks = tasks
    .filter((task) => taskDateKey(task) === key)
    .sort(compareTaskTime);
  const groups = [
    { status: 'pending', title: t('goals.pending'), empty: t('goals.noPending') },
    { status: 'completed', title: t('goals.done'), empty: t('goals.noDone') },
    { status: 'missed', title: t('goals.missed'), empty: t('goals.noMissed') },
  ];

  scheduleBoard.className = 'schedule-board today-view';
  scheduleRangeLabel.textContent = formatLongDate(scheduleAnchorDate);
  setScheduleEmpty(
    t('goals.noTasksToday'),
    key === dateKey(new Date()) ? t('goals.noTasksTodayText') : t('goals.noTasksDayText')
  );

  scheduleBoard.innerHTML = dayTasks.length
    ? groups.map((group) => {
      const list = dayTasks.filter((task) => task.status === group.status);
      return `
        <section class="today-task-group ${group.status}" style="--item-index:${groups.indexOf(group)};">
          <div class="task-group-header">
            <h3>${group.title}</h3>
            <span>${list.length}</span>
          </div>
          <div class="today-task-list">
            ${list.length ? list.map((task, index) => taskCard(task, { hideDate: true, index })).join('') : `<div class="lane-empty">${group.empty}</div>`}
          </div>
        </section>`;
    }).join('')
    : '';

  scheduleEmpty.style.display = dayTasks.length ? 'none' : 'block';
}

function renderWeekSchedule() {
  const dates = weekDates(scheduleAnchorDate);
  let taskCount = 0;

  scheduleBoard.className = 'schedule-board week-view';
  scheduleRangeLabel.textContent = `${formatDate(dateKey(dates[0]))} - ${formatDate(dateKey(dates[dates.length - 1]))}`;
  setScheduleEmpty(t('goals.noTasksWeek'), t('goals.noTasksWeekText'));

  scheduleBoard.innerHTML = dates.map((date, index) => {
    const key = dateKey(date);
    const dayTasks = tasks
      .filter((task) => taskDateKey(task) === key)
      .sort(compareTaskTime);
    taskCount += dayTasks.length;
    const isToday = key === dateKey(new Date());

    return `
      <section class="schedule-day ${isToday ? 'today' : ''}" style="--item-index:${index};">
        <header class="schedule-day-header">
          <span>${weekdayLabel(date)}</span>
          <strong>${dayNumberLabel(date)}</strong>
        </header>
        <div class="schedule-day-tasks">
          ${dayTasks.length ? dayTasks.map((task, taskIndex) => taskCard(task, { compact: true, hideDate: true, index: taskIndex })).join('') : `<div class="schedule-day-empty">${t('common.noTasks')}</div>`}
        </div>
      </section>`;
  }).join('');

  scheduleEmpty.style.display = taskCount ? 'none' : 'block';
}

function renderCalendarSchedule() {
  const dates = calendarDates(scheduleAnchorDate);
  const month = scheduleAnchorDate.getMonth();
  let taskCount = 0;

  scheduleBoard.className = 'schedule-board calendar-view';
  scheduleRangeLabel.textContent = monthLabel(scheduleAnchorDate);
  setScheduleEmpty(t('goals.noTasksMonth'), t('goals.noTasksMonthText'));

  scheduleBoard.innerHTML = dates.map((date, index) => {
    const key = dateKey(date);
    const dayTasks = tasks
      .filter((task) => taskDateKey(task) === key)
      .sort(compareTaskTime);
    const isToday = key === dateKey(new Date());
    const isMuted = date.getMonth() !== month;
    taskCount += dayTasks.length;

    return `
      <section class="calendar-day ${isToday ? 'today' : ''} ${isMuted ? 'muted' : ''}" style="--item-index:${index};">
        <header class="calendar-day-header">
          <span>${weekdayLabel(date)}</span>
          <strong>${dayNumberLabel(date)}</strong>
        </header>
        <div class="calendar-task-list">
          ${dayTasks.slice(0, 3).map((task, taskIndex) => taskMiniCard(task, taskIndex)).join('')}
          ${dayTasks.length > 3 ? `<span class="calendar-more">${t('goals.calendarMore', { count: dayTasks.length - 3 })}</span>` : ''}
        </div>
      </section>`;
  }).join('');

  scheduleEmpty.style.display = taskCount ? 'none' : 'block';
}

function taskCard(task, options = {}) {
  const time = task.startTime || task.endTime ? `${task.startTime || '--:--'}${task.endTime ? ` - ${task.endTime}` : ''}` : t('common.anyTime');
  const goalTitle = task.goal && task.goal.title ? task.goal.title : '';
  const color = safeColor(task.color) || priorityColor(task.priority);
  const statusClass = `task-${task.status}`;
  const priorityClass = `priority-${task.priority || 'medium'}`;
  const compactClass = options.compact ? ' compact' : '';
  const dateLabel = options.hideDate ? '' : `<span>${formatDate(task.date)}</span>`;
  const statusLabel = task.status === 'completed' ? t('status.done') : t(`status.${task.status}`);
  const newClass = createdTaskIds.has(task._id) ? ' is-new' : '';
  const index = Number.isFinite(options.index) ? options.index : 0;

  return `
    <article class="task-card ${statusClass}${compactClass}${newClass}" data-task-id="${task._id}" style="--task-color:${color}; --item-index:${index};">
      <span class="task-checkmark ${task.status === 'completed' ? 'checked' : ''}" aria-hidden="true"></span>
      <div class="task-card-main">
        <div class="task-card-meta">
          <span>${escHtml(time)}</span>
          ${dateLabel}
          <span class="task-status-pill ${statusClass}">${escHtml(statusLabel)}</span>
          <span class="priority-pill ${priorityClass}">${escHtml(t(`priority.${task.priority || 'medium'}`))}</span>
        </div>
        <h3>${escHtml(task.title)}</h3>
        ${task.description ? `<p>${escHtml(task.description)}</p>` : ''}
        ${goalTitle ? `<span class="task-goal-link">${escHtml(goalTitle)}</span>` : ''}
      </div>
      <details class="card-menu task-menu">
        <summary class="btn-icon menu-trigger" aria-label="${t('goals.taskActions')}" data-tooltip="${t('goals.taskActions')}">...</summary>
        <div class="card-menu-list">
          <button data-task-action="edit" data-id="${task._id}" type="button">${t('action.edit')}</button>
          ${task.status !== 'pending' ? `<button data-task-action="status" data-status="pending" data-id="${task._id}" type="button">${t('action.setPending')}</button>` : ''}
          ${task.status !== 'completed' ? `<button data-task-action="status" data-status="completed" data-id="${task._id}" type="button">${t('action.markDone')}</button>` : ''}
          ${task.status !== 'missed' ? `<button data-task-action="status" data-status="missed" data-id="${task._id}" type="button">${t('action.markMissed')}</button>` : ''}
          <button class="danger-menu-item" data-task-action="delete" data-id="${task._id}" type="button">${t('action.delete')}</button>
        </div>
      </details>
    </article>`;
}

function taskMiniCard(task, index = 0) {
  const color = safeColor(task.color) || priorityColor(task.priority);
  return `
    <article class="calendar-task-mini task-${task.status}" data-task-id="${task._id}" style="--task-color:${color}; --item-index:${index};">
      <span>${escHtml(task.startTime || t('common.anyTime'))}</span>
      <strong>${escHtml(task.title)}</strong>
      <details class="card-menu task-menu mini-menu">
        <summary class="btn-icon menu-trigger" aria-label="${t('goals.taskActions')}" data-tooltip="${t('goals.taskActions')}">...</summary>
        <div class="card-menu-list">
          <button data-task-action="edit" data-id="${task._id}" type="button">${t('action.edit')}</button>
          ${task.status !== 'completed' ? `<button data-task-action="status" data-status="completed" data-id="${task._id}" type="button">${t('action.markDone')}</button>` : ''}
          ${task.status !== 'missed' ? `<button data-task-action="status" data-status="missed" data-id="${task._id}" type="button">${t('action.markMissed')}</button>` : ''}
          <button class="danger-menu-item" data-task-action="delete" data-id="${task._id}" type="button">${t('action.delete')}</button>
        </div>
      </details>
    </article>`;
}

function bindEvents() {
  document.getElementById('open-goal-modal-btn').addEventListener('click', () => openGoalModalForCreate());
  document.getElementById('open-task-modal-btn').addEventListener('click', () => openTaskModalForCreate());
  document.querySelectorAll('[data-open-goal-modal]').forEach((btn) => btn.addEventListener('click', () => openGoalModalForCreate()));
  document.querySelectorAll('[data-open-task-modal]').forEach((btn) => btn.addEventListener('click', () => openTaskModalForCreate()));

  document.querySelectorAll('[data-close-goal-modal]').forEach((btn) => btn.addEventListener('click', closeGoalModal));
  document.querySelectorAll('[data-close-task-modal]').forEach((btn) => btn.addEventListener('click', closeTaskModal));

  goalForm.addEventListener('submit', handleGoalSubmit);
  goalCancelBtn.addEventListener('click', closeGoalModal);
  goalProgressInput.addEventListener('input', () => {
    goalProgressDisplay.textContent = `${goalProgressInput.value}%`;
  });
  goalTitleInput.addEventListener('input', () => clearFieldError('goal-title'));

  taskForm.addEventListener('submit', handleTaskSubmit);
  taskCancelBtn.addEventListener('click', closeTaskModal);
  taskTitleInput.addEventListener('input', () => clearFieldError('task-title'));
  taskDateInput.addEventListener('input', () => clearFieldError('task-date'));

  document.querySelectorAll('.goal-filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.goal-filter-btn').forEach((item) => item.classList.remove('active'));
      btn.classList.add('active');
      currentGoalStatusFilter = btn.dataset.filter;
      renderGoals();
    });
  });

  document.querySelectorAll('[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => setScheduleView(btn.dataset.view));
  });

  document.getElementById('schedule-prev-btn').addEventListener('click', () => moveSchedule(-1));
  document.getElementById('schedule-next-btn').addEventListener('click', () => moveSchedule(1));
  document.getElementById('schedule-today-btn').addEventListener('click', () => {
    scheduleAnchorDate = startOfLocalDay(new Date());
    renderSchedule();
  });
  document.getElementById('achievement-check-btn').addEventListener('click', checkAchievements);

  goalsGrid.addEventListener('click', handleGoalCardAction);
  scheduleBoard.addEventListener('click', handleTaskCardAction);

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (!goalModal.hidden) closeGoalModal();
    if (!taskModal.hidden) closeTaskModal();
  });

  document.addEventListener('i18n:changed', () => {
    updateLocalizedDashboard();
  });
}

function handleGoalCardAction(event) {
  const btn = event.target.closest('[data-goal-action]');
  if (!btn) return;

  const menu = btn.closest('details');
  if (menu) menu.open = false;

  if (btn.dataset.goalAction === 'edit') {
    startEditGoal(btn.dataset.id);
    return;
  }

  if (btn.dataset.goalAction === 'delete') {
    confirmDeleteGoal(btn.dataset.id);
    return;
  }

  if (btn.dataset.goalAction === 'status') {
    quickStatusChange(btn.dataset.id, btn.dataset.status);
  }
}

function handleTaskCardAction(event) {
  const btn = event.target.closest('[data-task-action]');
  if (!btn) return;

  const menu = btn.closest('details');
  if (menu) menu.open = false;

  if (btn.dataset.taskAction === 'edit') {
    startEditTask(btn.dataset.id);
    return;
  }

  if (btn.dataset.taskAction === 'delete') {
    confirmDeleteTask(btn.dataset.id);
    return;
  }

  if (btn.dataset.taskAction === 'status') {
    markTaskStatus(btn.dataset.id, btn.dataset.status);
  }
}

async function handleGoalSubmit(event) {
  event.preventDefault();

  if (!validateGoalForm()) return;

  const wasEditing = Boolean(editingGoalId);
  const data = {
    title: goalTitleInput.value.trim(),
    description: goalDescInput.value.trim(),
    targetDate: goalDateInput.value || null,
    status: goalStatusSelect.value,
    progress: Number(goalProgressInput.value),
    priority: goalPrioritySelect.value,
    category: goalCategoryInput.value.trim(),
  };

  goalSubmitBtn.disabled = true;
  goalSubmitBtn.textContent = t('action.saving');

  try {
    const response = wasEditing
      ? await GoalsAPI.update(editingGoalId, data)
      : await GoalsAPI.create(data);

    showToastG(wasEditing ? t('goals.toast.goalUpdated') : t('goals.toast.goalCreated'), 'success');
    showAchievementToasts(response.achievements || []);
    if (!wasEditing && response.data && response.data._id) {
      createdGoalIds.add(response.data._id);
    }
    closeGoalModal();
    await loadDashboard();
  } catch (err) {
    showToastG(translateMessage(err.message), 'error');
  } finally {
    goalSubmitBtn.disabled = false;
    goalSubmitBtn.textContent = editingGoalId ? t('goals.goalModal.editTitle') : t('goals.goalModal.addTitle');
  }
}

function openGoalModalForCreate() {
  resetGoalForm();
  openModal(goalModal, goalTitleInput);
}

function startEditGoal(id) {
  const goal = goals.find((item) => item._id === id);
  if (!goal) return;

  editingGoalId = id;
  goalFormTitle.textContent = t('goals.goalModal.editTitle');
  goalSubmitBtn.textContent = t('goals.goalModal.editTitle');
  goalTitleInput.value = goal.title;
  goalDescInput.value = goal.description || '';
  goalDateInput.value = goal.targetDate ? goal.targetDate.slice(0, 10) : '';
  goalStatusSelect.value = goal.status;
  goalPrioritySelect.value = goal.priority || 'medium';
  goalCategoryInput.value = goal.category || '';
  goalProgressInput.value = clampProgress(goal.progress);
  goalProgressDisplay.textContent = `${goalProgressInput.value}%`;
  clearGoalErrors();
  openModal(goalModal, goalTitleInput);
}

function closeGoalModal() {
  closeModal(goalModal, resetGoalForm);
}

function resetGoalForm() {
  editingGoalId = null;
  goalFormTitle.textContent = t('goals.goalModal.addTitle');
  goalSubmitBtn.textContent = t('goals.goalModal.addTitle');
  goalSubmitBtn.disabled = false;
  goalForm.reset();
  goalPrioritySelect.value = 'medium';
  goalStatusSelect.value = 'active';
  goalProgressInput.value = 0;
  goalProgressDisplay.textContent = '0%';
  clearGoalErrors();
}

async function quickStatusChange(id, status) {
  const card = findGoalElement(id);
  if (card) {
    card.classList.add('is-status-changing');
    if (status === 'completed') {
      animateGoalProgress(card, 100);
    }
  }

  try {
    const response = await GoalsAPI.update(id, { status, progress: status === 'completed' ? 100 : undefined });
    await waitForMotion(120);
    showToastG(t('goals.toast.goalMarked', { status: t(status === 'completed' ? 'status.done' : `status.${status}`) }), 'success');
    showAchievementToasts(response.achievements || []);
    await loadDashboard();
  } catch (err) {
    if (card) card.classList.remove('is-status-changing');
    showToastG(translateMessage(err.message), 'error');
  }
}

async function confirmDeleteGoal(id) {
  if (!confirm(t('goals.confirm.deleteGoal'))) return;
  const card = findGoalElement(id);

  try {
    await GoalsAPI.delete(id);
    showToastG(t('goals.toast.goalDeleted'), 'success');
    if (card) {
      await animateElementOut(card);
    }
    await loadDashboard();
  } catch (err) {
    if (card) card.classList.remove('is-removing');
    showToastG(translateMessage(err.message), 'error');
  }
}

async function handleTaskSubmit(event) {
  event.preventDefault();

  if (!validateTaskForm()) return;

  const wasEditing = Boolean(editingTaskId);
  const data = {
    title: taskTitleInput.value.trim(),
    description: taskDescriptionInput.value.trim(),
    date: taskDateInput.value,
    startTime: taskStartInput.value,
    endTime: taskEndInput.value,
    goal: taskGoalSelect.value || null,
    priority: taskPrioritySelect.value,
    status: taskStatusSelect.value,
    color: taskColorInput.value,
  };

  taskSubmitBtn.disabled = true;
  taskSubmitBtn.textContent = t('action.saving');

  try {
    const response = wasEditing
      ? await TasksAPI.update(editingTaskId, data)
      : await TasksAPI.create(data);

    showToastG(wasEditing ? t('goals.toast.taskUpdated') : t('goals.toast.taskCreated'), 'success');
    showAchievementToasts(response.achievements || []);
    if (!wasEditing && response.data && response.data._id) {
      createdTaskIds.add(response.data._id);
    }
    closeTaskModal();
    await loadDashboard();
  } catch (err) {
    showToastG(translateMessage(err.message), 'error');
  } finally {
    taskSubmitBtn.disabled = false;
    taskSubmitBtn.textContent = editingTaskId ? t('goals.taskModal.editTitle') : t('goals.taskModal.addTitle');
  }
}

function openTaskModalForCreate() {
  resetTaskForm();
  taskDateInput.value = dateKey(scheduleView === 'today' ? scheduleAnchorDate : new Date());
  openModal(taskModal, taskTitleInput);
}

function startEditTask(id) {
  const task = tasks.find((item) => item._id === id);
  if (!task) return;

  editingTaskId = id;
  taskFormTitle.textContent = t('goals.taskModal.editTitle');
  taskSubmitBtn.textContent = t('goals.taskModal.editTitle');
  taskTitleInput.value = task.title;
  taskDescriptionInput.value = task.description || '';
  taskDateInput.value = taskDateKey(task);
  taskStartInput.value = task.startTime || '';
  taskEndInput.value = task.endTime || '';
  taskGoalSelect.value = task.goal && task.goal._id ? task.goal._id : task.goal || '';
  taskPrioritySelect.value = task.priority || 'medium';
  taskStatusSelect.value = task.status || 'pending';
  taskColorInput.value = safeColor(task.color) || '#58a6ff';
  clearTaskErrors();
  openModal(taskModal, taskTitleInput);
}

function closeTaskModal() {
  closeModal(taskModal, resetTaskForm);
}

function resetTaskForm() {
  editingTaskId = null;
  taskFormTitle.textContent = t('goals.taskModal.addTitle');
  taskSubmitBtn.textContent = t('goals.taskModal.addTitle');
  taskSubmitBtn.disabled = false;
  taskForm.reset();
  taskDateInput.value = dateKey(new Date());
  taskPrioritySelect.value = 'medium';
  taskStatusSelect.value = 'pending';
  taskColorInput.value = '#58a6ff';
  clearTaskErrors();
}

async function markTaskStatus(id, status) {
  const taskEls = findTaskElements(id);
  const motionClass = status === 'completed'
    ? 'is-completing'
    : status === 'missed'
      ? 'is-missing'
      : 'is-status-changing';
  taskEls.forEach((el) => el.classList.add(motionClass));

  try {
    const motionDone = waitForMotion(180);

    if (status === 'completed') {
      const response = await TasksAPI.complete(id);
      showRewardToast(response.reward);
      showAchievementToasts(response.achievements || []);
    } else {
      const response = await TasksAPI.update(id, { status });
      showToastG(t('goals.toast.taskMarked', { status: t(`status.${status}`) }), 'success');
      showAchievementToasts(response.achievements || []);
    }

    await motionDone;
    await loadDashboard();
  } catch (err) {
    taskEls.forEach((el) => el.classList.remove(motionClass));
    showToastG(translateMessage(err.message), 'error');
  }
}

async function confirmDeleteTask(id) {
  if (!confirm(t('goals.confirm.deleteTask'))) return;
  const taskEls = findTaskElements(id);

  try {
    await TasksAPI.delete(id);
    showToastG(t('goals.toast.taskDeleted'), 'success');
    if (taskEls.length) {
      await Promise.all(taskEls.map((el) => animateElementOut(el)));
    }
    await loadDashboard();
  } catch (err) {
    taskEls.forEach((el) => el.classList.remove('is-removing'));
    showToastG(translateMessage(err.message), 'error');
  }
}

async function checkAchievements() {
  try {
    const response = await AchievementsAPI.check();
    achievements = response.data || achievements;
    showAchievementToasts(response.unlocked || []);
    showToastG(response.message ? translateMessage(response.message) : t('goals.toast.achievementsChecked'), response.unlocked && response.unlocked.length ? 'success' : 'info');
  } catch (err) {
    showToastG(translateMessage(err.message), 'error');
  }
}

function setScheduleView(view) {
  scheduleView = view;
  document.querySelectorAll('[data-view]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });
  syncScheduleTabIndicator();
  renderSchedule();
}

function moveSchedule(direction) {
  const next = new Date(scheduleAnchorDate);
  const amount = scheduleView === 'calendar' ? 0 : direction * (scheduleView === 'week' ? 7 : 1);

  if (scheduleView === 'calendar') {
    next.setMonth(next.getMonth() + direction);
  } else {
    next.setDate(next.getDate() + amount);
  }

  scheduleAnchorDate = startOfLocalDay(next);
  renderSchedule();
}

function validateGoalForm() {
  clearGoalErrors();
  if (!goalTitleInput.value.trim()) {
    setFieldError('goal-title', t('goals.validation.goalTitle'));
    goalTitleInput.focus();
    return false;
  }

  return true;
}

function validateTaskForm() {
  clearTaskErrors();
  let valid = true;

  if (!taskTitleInput.value.trim()) {
    setFieldError('task-title', t('goals.validation.taskTitle'));
    valid = false;
  }

  if (!taskDateInput.value) {
    setFieldError('task-date', t('goals.validation.taskDate'));
    valid = false;
  }

  if (!valid) {
    (taskTitleInput.value.trim() ? taskDateInput : taskTitleInput).focus();
  }

  return valid;
}

function clearGoalErrors() {
  clearFieldError('goal-title');
}

function clearTaskErrors() {
  clearFieldError('task-title');
  clearFieldError('task-date');
}

function setFieldError(fieldId, message) {
  const field = document.getElementById(fieldId);
  const errorEl = document.getElementById(`${fieldId}-error`);
  if (field) field.setAttribute('aria-invalid', 'true');
  if (errorEl) errorEl.textContent = message;
}

function clearFieldError(fieldId) {
  const field = document.getElementById(fieldId);
  const errorEl = document.getElementById(`${fieldId}-error`);
  if (field) field.removeAttribute('aria-invalid');
  if (errorEl) errorEl.textContent = '';
}

function openModal(modal, focusEl) {
  lastFocusedElement = document.activeElement;
  modal.classList.remove('closing');
  modal.hidden = false;
  document.body.classList.add('modal-open');
  requestAnimationFrame(() => {
    modal.classList.add('open');
    if (focusEl) focusEl.focus();
  });
}

function closeModal(modal, afterClose) {
  if (modal.hidden || modal.classList.contains('closing')) return;
  modal.classList.remove('open');
  modal.classList.add('closing');

  setTimeout(() => {
    modal.hidden = true;
    modal.classList.remove('closing');

    if (goalModal.hidden && taskModal.hidden) {
      document.body.classList.remove('modal-open');
    }

    if (typeof afterClose === 'function') afterClose();
    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
      lastFocusedElement.focus();
    }
  }, prefersReducedMotion() ? 0 : 190);
}

function findGoalElement(id) {
  return [...goalsGrid.querySelectorAll('[data-goal-id]')]
    .find((el) => el.dataset.goalId === id) || null;
}

function findTaskElements(id) {
  return [...scheduleBoard.querySelectorAll('[data-task-id]')]
    .filter((el) => el.dataset.taskId === id);
}

function animateGoalProgress(card, progress) {
  const fill = card.querySelector('.progress-bar-fill');
  const value = card.querySelector('.progress-val');
  if (!fill) return;

  requestAnimationFrame(() => {
    fill.style.width = `${clampProgress(progress)}%`;
    if (value) value.textContent = `${clampProgress(progress)}%`;
  });
}

function animateElementOut(el) {
  if (!el || prefersReducedMotion()) return Promise.resolve();

  el.style.maxHeight = `${el.scrollHeight}px`;
  el.style.overflow = 'hidden';

  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      el.classList.add('is-removing');
    });
    setTimeout(resolve, MOTION_MS + 80);
  });
}

function syncScheduleTabIndicator() {
  const tabs = document.querySelector('.view-tabs');
  if (!tabs) return;

  const indexMap = { today: 0, week: 1, calendar: 2 };
  tabs.style.setProperty('--active-index', indexMap[scheduleView] || 0);
}

function updateLocalizedDashboard() {
  renderStats();
  renderGoalOptions();
  renderGoals();
  renderSchedule();

  goalFormTitle.textContent = editingGoalId ? t('goals.goalModal.editTitle') : t('goals.goalModal.addTitle');
  goalSubmitBtn.textContent = editingGoalId ? t('goals.goalModal.editTitle') : t('goals.goalModal.addTitle');
  taskFormTitle.textContent = editingTaskId ? t('goals.taskModal.editTitle') : t('goals.taskModal.addTitle');
  taskSubmitBtn.textContent = editingTaskId ? t('goals.taskModal.editTitle') : t('goals.taskModal.addTitle');
}

function waitForMotion(ms = MOTION_MS) {
  return new Promise((resolve) => setTimeout(resolve, prefersReducedMotion() ? 0 : ms));
}

function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function currentTaskStreak() {
  const doneDays = new Set(
    tasks
      .filter((task) => task.status === 'completed')
      .map(taskDateKey)
      .filter(Boolean)
  );
  const cursor = startOfLocalDay(new Date());
  let streak = 0;

  while (doneDays.has(dateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function compareTaskTime(a, b) {
  return String(a.startTime || '99:99').localeCompare(String(b.startTime || '99:99'));
}

function weekDates(anchor) {
  const start = startOfLocalDay(anchor);
  const day = start.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + mondayOffset);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function calendarDates(anchor) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = startOfLocalDay(first);
  start.setDate(first.getDate() - first.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function startOfLocalDay(dateInput) {
  const date = new Date(dateInput);
  date.setHours(0, 0, 0, 0);
  return date;
}

function dateKey(dateInput) {
  const date = new Date(dateInput);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function taskDateKey(task) {
  return task.date ? String(task.date).slice(0, 10) : '';
}

function formatDate(dateInput) {
  return window.I18n ? I18n.formatDate(dateInput) : dateKey(dateInput);
}

function formatLongDate(dateInput) {
  return window.I18n ? I18n.formatDate(dateInput) : dateKey(dateInput);
}

function monthLabel(dateInput) {
  return window.I18n ? I18n.formatDate(dateInput, { monthYear: true }) : dateKey(dateInput).slice(0, 7);
}

function weekdayLabel(dateInput) {
  return window.I18n ? I18n.formatDate(dateInput, { weekdayOnly: true, short: true }) : new Date(dateInput).toLocaleDateString('en-US', { weekday: 'short' });
}

function dayNumberLabel(dateInput) {
  return new Date(dateInput).toLocaleDateString('en-US', { day: '2-digit' });
}

function priorityColor(priority) {
  if (priority === 'high') return '#f85149';
  if (priority === 'low') return '#26a641';
  return '#58a6ff';
}

function safeColor(color) {
  return /^#[0-9a-fA-F]{6}$/.test(String(color || '')) ? color : '';
}

function clampProgress(progress) {
  return Math.max(0, Math.min(100, Number(progress || 0)));
}

function setScheduleEmpty(title, message) {
  if (!scheduleEmpty) return;
  const titleEl = scheduleEmpty.querySelector('h3');
  const messageEl = scheduleEmpty.querySelector('p');
  if (titleEl) titleEl.textContent = title;
  if (messageEl) messageEl.textContent = message;
}

function setDashboardError(message) {
  if (!dashboardError) return;
  dashboardError.hidden = !message;
  dashboardError.textContent = message || '';
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function showLoading(show) {
  if (loadingState) loadingState.style.display = show ? 'flex' : 'none';
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showRewardToast(reward) {
  showToastG(t('goals.toast.taskReward'), 'success');
}

function showAchievementToasts(newAchievements) {
  newAchievements.forEach((achievement) => {
    showToastG(t('goals.toast.achievementUnlocked', { title: achievement.title }), 'success');
  });
}

function translateMessage(message) {
  return window.I18n ? I18n.translateApiMessage(message) : message;
}

function showToastG(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 4200);
}
