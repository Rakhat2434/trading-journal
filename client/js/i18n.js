const I18n = (() => {
  const STORAGE_KEY = 'tj-language';
  const SUPPORTED = ['en', 'ru'];
  const DEFAULT_LANG = 'en';
  const localeCache = {};

  let currentLanguage = detectLanguage();
  let dictionary = {};
  let fallbackDictionary = {};

  function detectLanguage() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (SUPPORTED.includes(saved)) return saved;

    const browserLanguage = (navigator.languages && navigator.languages[0]) || navigator.language || DEFAULT_LANG;
    const normalized = String(browserLanguage).toLowerCase();
    return normalized.startsWith('ru') ? 'ru' : DEFAULT_LANG;
  }

  async function loadLocale(lang) {
    if (localeCache[lang]) return localeCache[lang];

    const response = await fetch(`/locales/${lang}.json`);
    if (!response.ok) throw new Error(`Unable to load locale: ${lang}`);

    localeCache[lang] = await response.json();
    return localeCache[lang];
  }

  async function init() {
    fallbackDictionary = await loadLocale(DEFAULT_LANG);
    dictionary = currentLanguage === DEFAULT_LANG ? fallbackDictionary : await loadLocale(currentLanguage);
    document.documentElement.lang = currentLanguage;
    localStorage.setItem(STORAGE_KEY, currentLanguage);

    if (document.readyState === 'loading') {
      await new Promise((resolve) => document.addEventListener('DOMContentLoaded', resolve, { once: true }));
    }

    ensureLanguageSwitcher();
    applyTranslations();
    updateLanguageSwitcher();
  }

  function t(key, vars = {}) {
    const template = dictionary[key] ?? fallbackDictionary[key] ?? key;
    return String(template).replace(/\{(\w+)\}/g, (_, name) => (
      Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : `{${name}}`
    ));
  }

  async function setLanguage(lang) {
    if (!SUPPORTED.includes(lang) || lang === currentLanguage) return;

    document.body.classList.add('language-switching');
    currentLanguage = lang;
    dictionary = lang === DEFAULT_LANG ? fallbackDictionary : await loadLocale(lang);
    document.documentElement.lang = lang;
    localStorage.setItem(STORAGE_KEY, lang);

    applyTranslations();
    updateLanguageSwitcher();
    document.dispatchEvent(new CustomEvent('i18n:changed', { detail: { lang } }));

    setTimeout(() => document.body.classList.remove('language-switching'), 180);
  }

  function applyTranslations(root = document) {
    root.querySelectorAll('[data-i18n]').forEach((el) => {
      el.textContent = t(el.dataset.i18n);
    });

    root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      el.setAttribute('placeholder', t(el.dataset.i18nPlaceholder));
    });

    root.querySelectorAll('[data-i18n-title]').forEach((el) => {
      el.setAttribute('title', t(el.dataset.i18nTitle));
    });

    root.querySelectorAll('[data-i18n-aria-label]').forEach((el) => {
      el.setAttribute('aria-label', t(el.dataset.i18nAriaLabel));
    });

    root.querySelectorAll('[data-i18n-tooltip]').forEach((el) => {
      el.setAttribute('data-tooltip', t(el.dataset.i18nTooltip));
    });

    root.querySelectorAll('[data-i18n-content]').forEach((el) => {
      el.setAttribute('content', t(el.dataset.i18nContent));
    });
  }

  function ensureLanguageSwitcher() {
    if (document.getElementById('language-switcher')) return;

    const switcher = document.createElement('div');
    switcher.id = 'language-switcher';
    switcher.className = 'language-switcher';
    switcher.setAttribute('aria-label', t('language'));
    switcher.innerHTML = `
      <button class="lang-option" data-lang="en" type="button">EN</button>
      <button class="lang-option" data-lang="ru" type="button">RU</button>
    `;

    const nav = document.querySelector('.navbar-nav');
    if (nav) {
      const themeBtn = document.getElementById('theme-btn');
      nav.insertBefore(switcher, themeBtn || null);
    } else {
      const themeBtn = document.getElementById('theme-btn');
      if (themeBtn) {
        let actions = document.querySelector('.auth-top-actions');
        if (!actions) {
          actions = document.createElement('div');
          actions.className = 'auth-top-actions';
          themeBtn.parentNode.insertBefore(actions, themeBtn);
          actions.appendChild(themeBtn);
        }
        actions.insertBefore(switcher, actions.firstChild);
      } else {
        document.body.prepend(switcher);
      }
    }

    switcher.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-lang]');
      if (btn) setLanguage(btn.dataset.lang);
    });
  }

  function updateLanguageSwitcher() {
    const switcher = document.getElementById('language-switcher');
    if (!switcher) return;

    switcher.setAttribute('aria-label', t('language'));
    switcher.querySelectorAll('[data-lang]').forEach((btn) => {
      const active = btn.dataset.lang === currentLanguage;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      btn.textContent = t(`lang.${btn.dataset.lang}`);
    });
  }

  function formatDate(dateInput, options = {}) {
    const date = normalizeDate(dateInput, options.utc);
    if (!date) return '';

    const day = String(options.utc ? date.getUTCDate() : date.getDate()).padStart(2, '0');
    const month = String((options.utc ? date.getUTCMonth() : date.getMonth()) + 1).padStart(2, '0');
    const year = options.utc ? date.getUTCFullYear() : date.getFullYear();

    if (options.monthYear) {
      return date.toLocaleDateString(locale(), { month: 'long', year: 'numeric' });
    }

    if (options.weekdayOnly) {
      return date.toLocaleDateString(locale(), { weekday: options.short ? 'short' : 'long' });
    }

    if (options.dayOnly) return day;
    if (options.monthDay) return currentLanguage === 'ru' ? `${day}.${month}` : `${month}/${day}`;

    return currentLanguage === 'ru' ? `${day}.${month}.${year}` : `${month}/${day}/${year}`;
  }

  function formatDateTime(dateInput) {
    const date = normalizeDate(dateInput);
    if (!date) return '';

    return `${formatDate(date)} ${date.toLocaleTimeString(locale(), {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  }

  function normalizeDate(dateInput, utc = false) {
    if (!dateInput) return null;
    if (!utc && typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateInput)) {
      const [year, month, day] = dateInput.slice(0, 10).split('-').map(Number);
      return new Date(year, month - 1, day);
    }

    const date = new Date(dateInput);
    if (Number.isNaN(date.getTime())) return null;

    if (utc) {
      return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    }

    return date;
  }

  function locale() {
    return currentLanguage === 'ru' ? 'ru-RU' : 'en-US';
  }

  function translateApiMessage(message) {
    const normalized = String(message || '').trim().toLowerCase();
    const map = {
      'please fill in all fields': 'auth.validation.fillAll',
      'password too short': 'auth.validation.passwordShort',
      'passwords do not match': 'auth.validation.passwordMismatch',
      'invalid credentials': 'auth.error.invalidCredentials',
      'registration failed': 'auth.error.registrationFailed',
      'title is required': 'planner.validation.text',
      'date is required': 'planner.validation.day',
      'achievements checked.': 'goals.toast.achievementsChecked'
    };

    return map[normalized] ? t(map[normalized]) : message;
  }

  const ready = init().catch((error) => {
    console.error(error);
    dictionary = fallbackDictionary;
  });

  return {
    ready,
    t,
    setLanguage,
    applyTranslations,
    formatDate,
    formatDateTime,
    translateApiMessage,
    get currentLanguage() {
      return currentLanguage;
    },
    get locale() {
      return locale();
    }
  };
})();

window.I18n = I18n;
window.t = (...args) => I18n.t(...args);
