/**
 * theme.js - Theme switcher for Trading Journal
 * Supports: trading-dark, trading-light, pure-white
 */

const THEMES = ['trading-dark', 'trading-light', 'pure-white'];
const THEME_LABELS = {
  'trading-dark': 'Dark Terminal',
  'trading-light': 'Trading Light',
  'pure-white': 'Pure White',
};

const ThemeManager = {
  current: 'trading-dark',

  init() {
    const storageKey = this._storageKey();
    const saved = localStorage.getItem(storageKey) || localStorage.getItem('tj-theme') || 'trading-dark';
    this.apply(saved, { silent: true });
    this._bindButton();
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
    if (btn) btn.textContent = THEME_LABELS[this.current];
  },

  _bindButton() {
    const btn = document.getElementById('theme-btn');
    if (!btn || btn.dataset.boundTheme === '1') return;

    btn.dataset.boundTheme = '1';
    btn.addEventListener('click', () => this.cycle());
  },

  _storageKey() {
    if (window.Auth && typeof window.Auth.getThemeStorageKey === 'function') {
      return window.Auth.getThemeStorageKey();
    }
    return 'tj-theme:guest';
  },
};
