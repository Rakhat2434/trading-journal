/**
 * theme.js - Theme switcher for Trading Journal
 * Supports: trading-dark, trading-light, pure-white
 */

const THEMES = ['trading-dark', 'trading-light', 'pure-white'];
const THEME_LABELS = {
  'trading-dark': 'theme.trading-dark',
  'trading-light': 'theme.trading-light',
  'pure-white': 'theme.pure-white',
};

const ThemeManager = {
  current: 'trading-dark',

  init() {
    const storageKey = this._storageKey();
    const saved = localStorage.getItem(storageKey) || localStorage.getItem('tj-theme') || 'trading-dark';
    this.apply(saved, { silent: true });
    this._bindButton();
    this._bindLanguageUpdates();
  },

  apply(theme, options = {}) {
    if (!THEMES.includes(theme)) theme = 'trading-dark';

    document.documentElement.setAttribute('data-theme', theme);
    this.current = theme;
    localStorage.setItem(this._storageKey(), theme);
    this._updateButton();

    if (!options.silent) {
      document.dispatchEvent(new CustomEvent('theme:changed', { detail: { theme } }));
    }
  },

  cycle() {
    const idx = THEMES.indexOf(this.current);
    const next = THEMES[(idx + 1) % THEMES.length];
    this.apply(next);
  },

  _updateButton() {
    const btn = document.getElementById('theme-btn');
    if (btn) btn.textContent = this._label(this.current);
  },

  _bindButton() {
    const btn = document.getElementById('theme-btn');
    if (!btn || btn.dataset.boundTheme === '1') return;

    btn.dataset.boundTheme = '1';
    btn.addEventListener('click', () => this.cycle());
  },

  _bindLanguageUpdates() {
    if (this._languageBound) return;
    this._languageBound = true;
    document.addEventListener('i18n:changed', () => this._updateButton());
  },

  _label(theme) {
    const key = THEME_LABELS[theme] || THEME_LABELS['trading-dark'];
    return window.I18n ? I18n.t(key) : key;
  },

  _storageKey() {
    if (window.Auth && typeof window.Auth.getThemeStorageKey === 'function') {
      return window.Auth.getThemeStorageKey();
    }
    return 'tj-theme:guest';
  },
};
