let tasks = [];
let achievements = [];
let editingTaskId = null;
let plannerView = 'week';
let anchorDate = startOfLocalDay(new Date());
let lastFocusedElement = null;
let createdTaskIds = new Set();

const MOTION_MS = 240;
const VALID_VIEWS = ['week', 'month'];

const taskForm = document.getElementById('task-form');
const taskModal = document.getElementById('task-modal');
const taskFormTitle = document.getElementById('task-form-title');
const taskDayInput = document.getElementById('task-day');
const taskTimeInput = document.getElementById('task-time');
const taskTextInput = document.getElementById('task-text');
const taskSubmitBtn = document.getElementById('task-submit-btn');
const taskCancelBtn = document.getElementById('task-cancel-btn');
const weekPlanner = document.getElementById('week-planner');
const weekRangeLabel = document.getElementById('week-range-label');
const weekProgressLabel = document.getElementById('week-progress-label');
const loadingState = document.getElementById('loading-state');
const dashboardError = document.getElementById('dashboard-error');

document.addEventListener('DOMContentLoaded', async () => {
  if (window.I18n && I18n.ready) {
    await I18n.ready;
  }

  const authorized = await Auth.requireAuth();
  if (!authorized) return;

  ThemeManager.init();
  Auth.renderNavbarUser();
  bindEvents();
  syncViewButtons();
  await loadPlanner();
});

async function loadPlanner() {
  showLoading(true);
  setDashboardError('');
  closeTaskMenus();

  try {
    const range = visibleRange();
    const [tasksRes, achievementsRes] = await Promise.all([
      TasksAPI.getAll({ from: dateKey(range.start), to: dateKey(range.end) }),
      AchievementsAPI.getAll(),
    ]);

    tasks = tasksRes.data || [];
    achievements = achievementsRes.data || [];
    renderPlanner();
  } catch (err) {
    const message = translateMessage(err.message || tPlanner('planner.errorLoad'));
    setDashboardError(message);
    showToast(message, 'error');
  } finally {
    showLoading(false);
  }
}

function bindEvents() {
  document.getElementById('open-task-modal-btn').addEventListener('click', () => openTaskModalForCreate());
  document.getElementById('prev-week-btn').addEventListener('click', () => movePeriod(-1));
  document.getElementById('next-week-btn').addEventListener('click', () => movePeriod(1));
  document.getElementById('today-week-btn').addEventListener('click', () => {
    anchorDate = startOfLocalDay(new Date());
    loadPlanner();
  });

  document.querySelectorAll('[data-planner-view]').forEach((btn) => {
    btn.addEventListener('click', () => setPlannerView(btn.dataset.plannerView));
  });

  document.querySelectorAll('[data-close-task-modal]').forEach((btn) => {
    btn.addEventListener('click', closeTaskModal);
  });

  taskForm.addEventListener('submit', handleTaskSubmit);
  taskCancelBtn.addEventListener('click', closeTaskModal);
  taskDayInput.addEventListener('input', () => clearFieldError('task-day'));
  taskTimeInput.addEventListener('input', () => clearFieldError('task-time'));
  taskTextInput.addEventListener('input', () => clearFieldError('task-text'));

  weekPlanner.addEventListener('click', handlePlannerClick);

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.simple-task-menu')) {
      closeTaskMenus();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeTaskMenus();
      if (!taskModal.hidden) closeTaskModal();
    }
  });

  document.addEventListener('i18n:changed', () => {
    renderPlanner();
    updateModalText();
  });
}

function renderPlanner() {
  const range = visibleRange();
  const completedCount = tasks.filter((task) => task.status === 'completed').length;
  const totalCount = tasks.length;

  weekPlanner.className = `week-planner is-${plannerView}-view`;
  weekRangeLabel.textContent = plannerView === 'month'
    ? monthLabel(anchorDate)
    : `${formatDate(range.start)} - ${formatDate(range.end)}`;
  weekProgressLabel.textContent = tPlanner('planner.periodProgress', { done: completedCount, total: totalCount });

  weekPlanner.innerHTML = range.dates.map((date, index) => (
    plannerView === 'month' ? monthDayColumn(date, index) : weekDayColumn(date, index)
  )).join('');

  setTimeout(() => {
    createdTaskIds.clear();
  }, MOTION_MS + 140);
}

function weekDayColumn(date, index) {
  const key = dateKey(date);
  const dayTasks = tasksForDate(key);
  const isToday = key === dateKey(new Date());

  return `
    <section class="planner-day ${isToday ? 'is-today' : ''}" data-date="${key}" style="--item-index:${index};">
      <header class="planner-day-header">
        <div>
          <span class="planner-weekday">${escHtml(weekdayLabel(date))}</span>
          <strong class="planner-date">${escHtml(formatDate(date, { monthDay: true }))}</strong>
        </div>
        <span class="planner-day-count">${dayTasks.length}</span>
      </header>
      <div class="planner-task-list">
        ${dayTasks.length ? dayTasks.map((task, taskIndex) => taskCard(task, taskIndex)).join('') : emptyDay(key)}
      </div>
    </section>`;
}

function monthDayColumn(date, index) {
  const key = dateKey(date);
  const dayTasks = tasksForDate(key);
  const isToday = key === dateKey(new Date());
  const isMuted = date.getMonth() !== anchorDate.getMonth();

  return `
    <section class="planner-day planner-month-day ${isToday ? 'is-today' : ''} ${isMuted ? 'is-muted' : ''}" data-date="${key}" style="--item-index:${index};">
      <header class="planner-day-header">
        <div>
          <span class="planner-weekday">${escHtml(weekdayLabel(date))}</span>
          <strong class="planner-date">${escHtml(formatDate(date, { dayOnly: true }))}</strong>
        </div>
        <span class="planner-day-count">${dayTasks.length}</span>
      </header>
      <div class="planner-task-list">
        ${dayTasks.length ? dayTasks.map((task, taskIndex) => taskCard(task, taskIndex, { compact: true })).join('') : emptyDay(key)}
      </div>
    </section>`;
}

function tasksForDate(key) {
  return tasks
    .filter((task) => taskDateKey(task) === key)
    .sort(compareTaskTime);
}

function taskCard(task, index = 0, options = {}) {
  const isDone = task.status === 'completed';
  const newClass = createdTaskIds.has(task._id) ? ' is-new' : '';
  const compactClass = options.compact ? ' is-compact' : '';

  return `
    <article class="planner-task ${isDone ? 'is-done' : ''}${newClass}${compactClass}" data-task-id="${task._id}" style="--item-index:${index};">
      <button class="task-done-toggle" type="button" data-task-toggle="${task._id}" aria-label="${isDone ? tPlanner('planner.markNotDone') : tPlanner('planner.markDone')}" aria-pressed="${isDone ? 'true' : 'false'}">
        <span aria-hidden="true">${isDone ? '&#10003;' : ''}</span>
      </button>
      <div class="planner-task-content">
        <time class="planner-task-time">${escHtml(task.startTime || tPlanner('common.anyTime'))}</time>
        <p>${escHtml(task.title)}</p>
      </div>
      <div class="simple-task-menu">
        <button class="task-menu-toggle" type="button" data-menu-toggle="${task._id}" aria-label="${tPlanner('planner.taskMenu')}">...</button>
        <div class="task-menu-popover" data-menu-for="${task._id}">
          <button type="button" data-task-action="edit" data-id="${task._id}">${tPlanner('action.edit')}</button>
          <button type="button" data-task-action="delete" data-id="${task._id}">${tPlanner('action.delete')}</button>
        </div>
      </div>
    </article>`;
}

function emptyDay(dateValue) {
  return `
    <button class="planner-empty-day" type="button" data-open-date="${dateValue}">
      <span></span>
      <p>${tPlanner('planner.emptyDay')}</p>
    </button>`;
}

async function handleTaskSubmit(event) {
  event.preventDefault();
  if (!validateTaskForm()) return;

  const wasEditing = Boolean(editingTaskId);
  const data = {
    title: taskTextInput.value.trim(),
    date: taskDayInput.value,
    startTime: taskTimeInput.value,
    endTime: '',
    description: '',
    goal: null,
    status: wasEditing ? (tasks.find((task) => task._id === editingTaskId)?.status || 'pending') : 'pending',
  };

  taskSubmitBtn.disabled = true;
  taskSubmitBtn.textContent = tPlanner('action.saving');

  try {
    const response = wasEditing
      ? await TasksAPI.update(editingTaskId, data)
      : await TasksAPI.create(data);

    anchorDate = startOfLocalDay(data.date);

    if (!wasEditing && response.data && response.data._id) {
      createdTaskIds.add(response.data._id);
    }

    showToast(wasEditing ? tPlanner('planner.toast.updated') : tPlanner('planner.toast.created'), 'success');
    showAchievementToasts(response.achievements || []);
    closeTaskModal();
    await loadPlanner();
  } catch (err) {
    showToast(translateMessage(err.message), 'error');
  } finally {
    taskSubmitBtn.disabled = false;
    updateModalText();
  }
}

function handlePlannerClick(event) {
  const emptyDate = event.target.closest('[data-open-date]');
  if (emptyDate) {
    openTaskModalForCreate(emptyDate.dataset.openDate);
    return;
  }

  const toggle = event.target.closest('[data-task-toggle]');
  if (toggle) {
    event.stopPropagation();
    toggleTaskDone(toggle.dataset.taskToggle);
    return;
  }

  const menuToggle = event.target.closest('[data-menu-toggle]');
  if (menuToggle) {
    event.stopPropagation();
    toggleTaskMenu(menuToggle.dataset.menuToggle);
    return;
  }

  const actionBtn = event.target.closest('[data-task-action]');
  if (actionBtn) {
    event.stopPropagation();
    closeTaskMenus();

    if (actionBtn.dataset.taskAction === 'edit') {
      startEditTask(actionBtn.dataset.id);
      return;
    }

    if (actionBtn.dataset.taskAction === 'delete') {
      confirmDeleteTask(actionBtn.dataset.id);
    }
  }
}

async function toggleTaskDone(id) {
  const task = tasks.find((item) => item._id === id);
  if (!task) return;

  const nextStatus = task.status === 'completed' ? 'pending' : 'completed';
  const taskEl = findTaskElement(id);
  if (taskEl) taskEl.classList.add(nextStatus === 'completed' ? 'is-completing' : 'is-updating');

  try {
    const motionDone = waitForMotion(160);
    const response = nextStatus === 'completed'
      ? await TasksAPI.complete(id)
      : await TasksAPI.update(id, { status: 'pending' });

    if (nextStatus === 'completed') {
      showToast(tPlanner('planner.toast.completed'), 'success');
      showAchievementToasts(response.achievements || []);
      await refreshAchievements();
    } else {
      showToast(tPlanner('planner.toast.pending'), 'info');
    }

    await motionDone;
    await loadPlanner();
  } catch (err) {
    if (taskEl) taskEl.classList.remove('is-completing', 'is-updating');
    showToast(translateMessage(err.message), 'error');
  }
}

function openTaskModalForCreate(defaultDate = dateKey(anchorDate)) {
  resetTaskForm();
  taskDayInput.value = defaultDate;
  openModal(taskModal, taskDayInput);
}

function startEditTask(id) {
  const task = tasks.find((item) => item._id === id);
  if (!task) return;

  editingTaskId = id;
  taskDayInput.value = taskDateKey(task);
  taskTimeInput.value = task.startTime || '';
  taskTextInput.value = task.title || '';
  clearTaskErrors();
  updateModalText();
  openModal(taskModal, taskDayInput);
}

function closeTaskModal() {
  closeModal(taskModal, resetTaskForm);
}

function resetTaskForm() {
  editingTaskId = null;
  taskForm.reset();
  taskDayInput.value = dateKey(anchorDate);
  taskTimeInput.value = '';
  taskTextInput.value = '';
  taskSubmitBtn.disabled = false;
  clearTaskErrors();
  updateModalText();
}

async function confirmDeleteTask(id) {
  if (!confirm(tPlanner('planner.confirmDelete'))) return;
  const taskEl = findTaskElement(id);

  try {
    await TasksAPI.delete(id);
    showToast(tPlanner('planner.toast.deleted'), 'success');
    if (taskEl) {
      await animateElementOut(taskEl);
    }
    await loadPlanner();
  } catch (err) {
    if (taskEl) taskEl.classList.remove('is-removing');
    showToast(translateMessage(err.message), 'error');
  }
}

async function refreshAchievements() {
  try {
    const response = await AchievementsAPI.getAll();
    achievements = response.data || achievements;
  } catch (_error) {
    // The completion flow should stay quiet if only the optional refresh fails.
  }
}

function showAchievementToasts(newAchievements) {
  newAchievements.forEach((achievement) => {
    const title = achievementTitle(achievement);
    showToast(tPlanner('planner.toast.achievement', { title }), 'success');
  });
}

function achievementTitle(achievement) {
  const key = `achievement.${achievement.type}.title`;
  const translated = tPlanner(key);
  return translated === key ? achievement.title : translated;
}

function validateTaskForm() {
  clearTaskErrors();
  let valid = true;

  if (!taskDayInput.value) {
    setFieldError('task-day', tPlanner('planner.validation.day'));
    valid = false;
  }

  if (!taskTimeInput.value) {
    setFieldError('task-time', tPlanner('planner.validation.time'));
    valid = false;
  }

  if (!taskTextInput.value.trim()) {
    setFieldError('task-text', tPlanner('planner.validation.text'));
    valid = false;
  }

  if (!valid) {
    const firstInvalid = taskForm.querySelector('[aria-invalid="true"]');
    if (firstInvalid) firstInvalid.focus();
  }

  return valid;
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

function clearTaskErrors() {
  clearFieldError('task-day');
  clearFieldError('task-time');
  clearFieldError('task-text');
}

function toggleTaskMenu(id) {
  const menu = weekPlanner.querySelector(`[data-menu-for="${cssEscape(id)}"]`);
  const willOpen = menu && !menu.classList.contains('open');
  closeTaskMenus();
  if (menu && willOpen) {
    menu.classList.add('open');
    const parentTask = menu.closest('.planner-task');
    if (parentTask) parentTask.classList.add('menu-open');
  }
}

function closeTaskMenus() {
  weekPlanner.querySelectorAll('.task-menu-popover.open').forEach((menu) => {
    menu.classList.remove('open');
  });
  weekPlanner.querySelectorAll('.planner-task.menu-open').forEach((task) => {
    task.classList.remove('menu-open');
  });
}

function setPlannerView(view) {
  if (!VALID_VIEWS.includes(view) || plannerView === view) return;
  plannerView = view;
  syncViewButtons();
  loadPlanner();
}

function syncViewButtons() {
  document.querySelectorAll('[data-planner-view]').forEach((btn) => {
    const active = btn.dataset.plannerView === plannerView;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function movePeriod(direction) {
  if (plannerView === 'month') {
    anchorDate = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + direction, 1);
  } else {
    anchorDate.setDate(anchorDate.getDate() + direction * 7);
    anchorDate = startOfWeek(anchorDate);
  }

  loadPlanner();
}

function visibleRange() {
  const dates = plannerView === 'month' ? calendarDates(anchorDate) : weekDates(anchorDate);
  return {
    dates,
    start: dates[0],
    end: dates[dates.length - 1],
  };
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
    document.body.classList.remove('modal-open');
    if (typeof afterClose === 'function') afterClose();
    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
      lastFocusedElement.focus();
    }
  }, prefersReducedMotion() ? 0 : 190);
}

function updateModalText() {
  const isEditing = Boolean(editingTaskId);
  if (taskFormTitle) taskFormTitle.textContent = tPlanner(isEditing ? 'planner.editTaskTitle' : 'planner.addTaskTitle');
  if (taskSubmitBtn) taskSubmitBtn.textContent = tPlanner(isEditing ? 'planner.saveTaskTitle' : 'planner.addTaskTitle');
}

function setDashboardError(message) {
  if (!dashboardError) return;
  dashboardError.hidden = !message;
  dashboardError.textContent = message || '';
}

function showLoading(show) {
  if (loadingState) loadingState.style.display = show ? 'flex' : 'none';
}

function findTaskElement(id) {
  return weekPlanner.querySelector(`[data-task-id="${cssEscape(id)}"]`);
}

function animateElementOut(el) {
  if (!el || prefersReducedMotion()) return Promise.resolve();
  el.style.maxHeight = `${el.scrollHeight}px`;
  el.style.overflow = 'hidden';

  return new Promise((resolve) => {
    requestAnimationFrame(() => el.classList.add('is-removing'));
    setTimeout(resolve, MOTION_MS + 80);
  });
}

function waitForMotion(ms = MOTION_MS) {
  return new Promise((resolve) => setTimeout(resolve, prefersReducedMotion() ? 0 : ms));
}

function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function compareTaskTime(a, b) {
  return String(a.startTime || '99:99').localeCompare(String(b.startTime || '99:99'));
}

function weekDates(dateInput) {
  const start = startOfWeek(dateInput);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function calendarDates(dateInput) {
  const first = new Date(dateInput.getFullYear(), dateInput.getMonth(), 1);
  const start = startOfWeek(first);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function startOfWeek(dateInput) {
  const start = startOfLocalDay(dateInput);
  const day = start.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + mondayOffset);
  return start;
}

function startOfLocalDay(dateInput) {
  const date = parseLocalDate(dateInput);
  date.setHours(0, 0, 0, 0);
  return date;
}

function dateKey(dateInput) {
  const date = parseLocalDate(dateInput);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseLocalDate(dateInput) {
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateInput)) {
    const [year, month, day] = dateInput.slice(0, 10).split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  return new Date(dateInput);
}

function taskDateKey(task) {
  return task.date ? String(task.date).slice(0, 10) : '';
}

function formatDate(dateInput, options = {}) {
  return window.I18n ? I18n.formatDate(dateInput, options) : dateKey(dateInput);
}

function weekdayLabel(dateInput) {
  return window.I18n ? I18n.formatDate(dateInput, { weekdayOnly: true, short: true }) : new Date(dateInput).toLocaleDateString('en-US', { weekday: 'short' });
}

function monthLabel(dateInput) {
  return window.I18n ? I18n.formatDate(dateInput, { monthYear: true }) : dateKey(dateInput).slice(0, 7);
}

function translateMessage(message) {
  return window.I18n ? I18n.translateApiMessage(message) : message;
}

function tPlanner(key, vars) {
  return window.I18n ? I18n.t(key, vars) : key;
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function cssEscape(value) {
  if (window.CSS && typeof window.CSS.escape === 'function') {
    return window.CSS.escape(value);
  }

  return String(value).replace(/["\\]/g, '\\$&');
}

function showToast(message, type = 'info') {
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
  }, 3600);
}
