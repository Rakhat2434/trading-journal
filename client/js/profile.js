let profileUser = null;
let completedTasks = [];
let achievements = [];

const profileName = document.getElementById('profile-name');
const profileEmail = document.getElementById('profile-email');
const profileLoading = document.getElementById('profile-loading');
const profileError = document.getElementById('profile-error');
const achievementsList = document.getElementById('achievements-list');
const achievementsEmpty = document.getElementById('achievements-empty');
const achievementsCount = document.getElementById('achievements-count');

document.addEventListener('DOMContentLoaded', async () => {
  if (window.I18n && I18n.ready) {
    await I18n.ready;
  }

  const authorized = await Auth.requireAuth();
  if (!authorized) return;

  ThemeManager.init();
  Auth.renderNavbarUser();
  bindProfileEvents();
  await loadProfile();
});

async function loadProfile() {
  showLoading(true);
  setProfileError('');

  try {
    const [meRes, tasksRes, achievementsRes] = await Promise.all([
      AuthAPI.me(),
      TasksAPI.getAll({ status: 'completed' }),
      AchievementsAPI.getAll(),
    ]);

    profileUser = meRes.user || Auth.getUser();
    completedTasks = tasksRes.data || [];
    achievements = achievementsRes.data || [];
    renderProfile();
  } catch (err) {
    const message = translateMessage(err.message || tProfile('profile.errorLoad'));
    setProfileError(message);
    showToast(message, 'error');
  } finally {
    showLoading(false);
  }
}

function bindProfileEvents() {
  document.addEventListener('i18n:changed', () => {
    renderProfile();
  });
}

function renderProfile() {
  renderUser();
  renderStats();
  renderAchievements();
}

function renderUser() {
  const user = profileUser || Auth.getUser() || {};
  profileName.textContent = user.username || tProfile('profile.anonymous');
  profileEmail.textContent = user.email || '';
}

function renderStats() {
  const today = dateKey(new Date());
  const currentWeek = weekDates(new Date()).map(dateKey);
  const todayCount = completedTasks.filter((task) => taskDateKey(task) === today).length;
  const weekCount = completedTasks.filter((task) => currentWeek.includes(taskDateKey(task))).length;

  setText('stat-total-completed', completedTasks.length);
  setText('stat-today-completed', todayCount);
  setText('stat-week-completed', weekCount);
}

function renderAchievements() {
  achievementsCount.textContent = achievements.length;

  if (!achievements.length) {
    achievementsList.innerHTML = '';
    achievementsEmpty.style.display = 'block';
    return;
  }

  achievementsEmpty.style.display = 'none';
  achievementsList.innerHTML = achievements.map((achievement, index) => `
    <article class="achievement-card" style="--item-index:${index};">
      <div class="achievement-icon" aria-hidden="true">${achievementIcon(achievement.type)}</div>
      <div>
        <h3>${escHtml(achievementTitle(achievement))}</h3>
        <p>${escHtml(achievementDescription(achievement))}</p>
        <time>${escHtml(formatDate(achievement.unlockedAt))}</time>
      </div>
    </article>
  `).join('');
}

function achievementIcon(type) {
  const icons = {
    first_task_completed: '1',
    productive_day: '3',
    three_tasks_completed: '3',
    strong_week: '7',
    stability: '3d',
  };

  return icons[type] || '*';
}

function achievementTitle(achievement) {
  const key = `achievement.${achievement.type}.title`;
  const translated = tProfile(key);
  return translated === key ? achievement.title : translated;
}

function achievementDescription(achievement) {
  const key = `achievement.${achievement.type}.description`;
  const translated = tProfile(key);
  return translated === key ? achievement.description : translated;
}

function weekDates(anchor) {
  const start = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, index) => {
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

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function setProfileError(message) {
  profileError.hidden = !message;
  profileError.textContent = message || '';
}

function showLoading(show) {
  profileLoading.style.display = show ? 'flex' : 'none';
}

function translateMessage(message) {
  return window.I18n ? I18n.translateApiMessage(message) : message;
}

function tProfile(key, vars) {
  return window.I18n ? I18n.t(key, vars) : key;
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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
