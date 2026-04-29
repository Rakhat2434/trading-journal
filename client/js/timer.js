let timerDurationMinutes = 45;
let remainingSeconds = timerDurationMinutes * 60;
let timerInterval = null;
let currentSessionId = null;
let currentSessionStartedAt = null;
let isRunning = false;
let isFinishing = false;
let focusSessions = [];
let timerStatusKey = 'status.ready';
let startButtonKey = 'action.start';
let motivationKey = 'timer.motivation.ready';

const timerDisplay = document.getElementById('timer-display');
const timerRing = document.getElementById('timer-ring');
const timerStatus = document.getElementById('timer-status');
const timerDurationLabel = document.getElementById('timer-duration-label');
const timerMotivation = document.getElementById('timer-motivation');
const startBtn = document.getElementById('timer-start');
const pauseBtn = document.getElementById('timer-pause');
const resetBtn = document.getElementById('timer-reset');
const finishBtn = document.getElementById('timer-finish');
const customMinutesInput = document.getElementById('custom-minutes');
const durationBtns = document.querySelectorAll('.duration-btn');
const historyEl = document.getElementById('timer-history');
const historyEmptyEl = document.getElementById('timer-history-empty');
const historyLoadingEl = document.getElementById('timer-history-loading');
const completedCountEl = document.getElementById('focus-completed-count');
const minutesCountEl = document.getElementById('focus-minutes-count');

const RING_RADIUS = 96;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const MOTIVATION_KEYS = [
  'timer.motivation.ready',
  'timer.motivation.one',
  'timer.motivation.two',
  'timer.motivation.three',
  'timer.motivation.four',
];

document.addEventListener('DOMContentLoaded', async () => {
  if (window.I18n && I18n.ready) {
    await I18n.ready;
  }

  const authorized = await Auth.requireAuth();
  if (!authorized) return;

  ThemeManager.init();
  Auth.renderNavbarUser();
  setupRing();
  bindTimerEvents();
  updateTimerView();
  await loadSessions();
});

function setupRing() {
  timerRing.style.strokeDasharray = String(RING_CIRCUMFERENCE);
  timerRing.style.strokeDashoffset = String(RING_CIRCUMFERENCE);
}

function bindTimerEvents() {
  startBtn.addEventListener('click', startTimer);
  pauseBtn.addEventListener('click', pauseTimer);
  resetBtn.addEventListener('click', resetTimer);
  finishBtn.addEventListener('click', finishSession);

  durationBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      setDuration(Number(btn.dataset.minutes));
      customMinutesInput.value = '';
      durationBtns.forEach((item) => item.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  customMinutesInput.addEventListener('change', () => {
    const minutes = Number(customMinutesInput.value);
    if (!minutes || minutes < 1 || minutes > 600) {
      showTimerToast(tTimer('timer.toast.durationInvalid'), 'error');
      customMinutesInput.value = '';
      return;
    }

    durationBtns.forEach((btn) => btn.classList.remove('active'));
    setDuration(minutes);
  });
}

function setDuration(minutes) {
  if (isRunning) {
    showTimerToast(tTimer('timer.toast.changeWhileRunning'), 'info');
    return;
  }

  timerDurationMinutes = minutes;
  remainingSeconds = minutes * 60;
  currentSessionId = null;
  currentSessionStartedAt = null;
  updateTimerView();
}

async function startTimer() {
  if (isRunning) return;

  try {
    if (!currentSessionId) {
      currentSessionStartedAt = new Date().toISOString();
      const res = await TimerAPI.createSession({
        durationMinutes: timerDurationMinutes,
        startedAt: currentSessionStartedAt,
        completed: false,
      });
      currentSessionId = res.data._id;
      await loadSessions();
    }

    isRunning = true;
    setTimerStatus('status.focusing');
    motivationKey = MOTIVATION_KEYS[Math.floor(Math.random() * MOTIVATION_KEYS.length)];
    timerMotivation.textContent = tTimer(motivationKey);
    startButtonKey = 'action.resume';
    startBtn.textContent = tTimer(startButtonKey);
    startBtn.disabled = true;
    pauseBtn.disabled = false;

    timerInterval = setInterval(tickTimer, 1000);
  } catch (err) {
    showTimerToast(translateMessage(err.message), 'error');
  }
}

function pauseTimer() {
  if (!isRunning) return;

  clearInterval(timerInterval);
  timerInterval = null;
  isRunning = false;
  setTimerStatus('status.paused');
  startBtn.disabled = false;
  pauseBtn.disabled = true;
}

async function resetTimer() {
  pauseTimer();

  if (currentSessionId) {
    try {
      await TimerAPI.updateSession(currentSessionId, {
        endedAt: new Date().toISOString(),
        completed: false,
      });
      await loadSessions();
    } catch (err) {
      showTimerToast(translateMessage(err.message), 'error');
    }
  }

  currentSessionId = null;
  currentSessionStartedAt = null;
  remainingSeconds = timerDurationMinutes * 60;
  setTimerStatus('status.ready');
  startButtonKey = 'action.start';
  startBtn.textContent = tTimer(startButtonKey);
  startBtn.disabled = false;
  pauseBtn.disabled = true;
  updateTimerView();
}

async function tickTimer() {
  remainingSeconds = Math.max(remainingSeconds - 1, 0);
  updateTimerView();

  if (remainingSeconds <= 0) {
    await finishSession();
  }
}

async function finishSession() {
  if (isFinishing) return;
  isFinishing = true;
  pauseTimer();

  try {
    const payload = {
      durationMinutes: timerDurationMinutes,
      startedAt: currentSessionStartedAt || new Date().toISOString(),
      endedAt: new Date().toISOString(),
      completed: true,
    };

    let response;
    if (currentSessionId) {
      response = await TimerAPI.updateSession(currentSessionId, payload);
    } else {
      response = await TimerAPI.createSession(payload);
    }

    showTimerToast(tTimer('timer.toast.completed'), 'success');
    showAchievementToasts(response.achievements || []);

    currentSessionId = null;
    currentSessionStartedAt = null;
    remainingSeconds = timerDurationMinutes * 60;
    setTimerStatus('status.complete');
    startButtonKey = 'action.start';
    startBtn.textContent = tTimer(startButtonKey);
    startBtn.disabled = false;
    pauseBtn.disabled = true;
    updateTimerView();
    await loadSessions();
  } catch (err) {
    showTimerToast(translateMessage(err.message), 'error');
  } finally {
    isFinishing = false;
  }
}

async function loadSessions() {
  historyLoadingEl.style.display = 'flex';

  try {
    const res = await TimerAPI.getSessions();
    focusSessions = res.data || [];
    renderStats();
    renderHistory();
  } catch (err) {
    showTimerToast(translateMessage(err.message), 'error');
  } finally {
    historyLoadingEl.style.display = 'none';
  }
}

function renderStats() {
  const completed = focusSessions.filter((session) => session.completed);
  const totalMinutes = completed.reduce((sum, session) => sum + Number(session.durationMinutes || 0), 0);

  completedCountEl.textContent = completed.length;
  minutesCountEl.textContent = totalMinutes;
}

function renderHistory() {
  const recent = focusSessions.slice(0, 8);

  if (!recent.length) {
    historyEl.innerHTML = '';
    historyEmptyEl.style.display = 'block';
    return;
  }

  historyEmptyEl.style.display = 'none';
  historyEl.innerHTML = recent.map(sessionCard).join('');

  historyEl.querySelectorAll('.session-delete-btn').forEach((btn) => {
    btn.addEventListener('click', () => deleteSession(btn.dataset.id));
  });
}

function sessionCard(session) {
  const date = formatDateTime(session.startedAt || session.createdAt);
  const status = session.completed ? tTimer('status.completed') : tTimer('status.incomplete');
  const statusClass = session.completed ? 'completed' : 'pending';

  return `
    <article class="session-card">
      <div>
        <strong>${Number(session.durationMinutes || 0)} ${tTimer('common.min')}</strong>
        <span>${date}</span>
      </div>
      <div class="session-card-actions">
        <span class="session-status ${statusClass}">${status}</span>
        <button class="btn-icon session-delete-btn" data-id="${session._id}" title="${tTimer('action.delete')}" type="button">${tTimer('action.delete')}</button>
      </div>
    </article>
  `;
}

async function deleteSession(id) {
  if (!confirm(tTimer('timer.confirm.delete'))) return;

  try {
    await TimerAPI.deleteSession(id);
    showTimerToast(tTimer('timer.toast.deleted'), 'success');
    await loadSessions();
  } catch (err) {
    showTimerToast(translateMessage(err.message), 'error');
  }
}

function updateTimerView() {
  const totalSeconds = timerDurationMinutes * 60;
  const progress = totalSeconds > 0 ? 1 - remainingSeconds / totalSeconds : 0;
  const offset = RING_CIRCUMFERENCE * (1 - progress);

  timerDisplay.textContent = formatTime(remainingSeconds);
  timerDurationLabel.textContent = `${timerDurationMinutes} ${tTimer('common.min')}`;
  timerRing.style.strokeDashoffset = String(offset);
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function showAchievementToasts(achievements) {
  achievements.forEach((achievement) => {
    showTimerToast(tTimer('timer.toast.achievementUnlocked', { title: achievement.title }), 'success');
  });
}

function showTimerToast(message, type = 'info') {
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

function setTimerStatus(key) {
  timerStatusKey = key;
  timerStatus.textContent = tTimer(key);
}

function updateLocalizedTimerText() {
  setTimerStatus(timerStatusKey);
  startBtn.textContent = tTimer(startButtonKey);
  pauseBtn.textContent = tTimer('action.pause');
  resetBtn.textContent = tTimer('action.reset');
  finishBtn.textContent = tTimer('action.finishSession');
  timerMotivation.textContent = tTimer(motivationKey);
  updateTimerView();
  renderHistory();
}

function tTimer(key, vars) {
  return window.I18n ? I18n.t(key, vars) : key;
}

function translateMessage(message) {
  return window.I18n ? I18n.translateApiMessage(message) : message;
}

function formatDateTime(dateInput) {
  return window.I18n ? I18n.formatDateTime(dateInput) : new Date(dateInput).toLocaleString('en-US');
}

document.addEventListener('i18n:changed', () => {
  updateLocalizedTimerText();
});
