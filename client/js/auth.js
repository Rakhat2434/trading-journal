const Auth = (() => {
  const TOKEN_KEY = 'tj-token';
  const USER_KEY = 'tj-user';
  const PUBLIC_PAGES = ['/login', '/register', '/login.html', '/register.html'];
  let currentAuthMessage = { key: null, isError: true };

  const normalizePath = (path) => {
    if (!path) return '/';
    if (path.length > 1 && path.endsWith('/')) return path.slice(0, -1);
    return path;
  };

  const isPublicPage = () => {
    const path = normalizePath(window.location.pathname);
    return PUBLIC_PAGES.includes(path);
  };

  const getToken = () => localStorage.getItem(TOKEN_KEY);

  const getUser = () => {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch (_error) {
      localStorage.removeItem(USER_KEY);
      return null;
    }
  };

  const setSession = (token, user) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  };

  const clearSession = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  };

  const redirectTo = (url) => {
    const current = normalizePath(window.location.pathname);
    const target = normalizePath(url);
    if (current !== target) {
      window.location.href = url;
    }
  };

  const validateSession = async () => {
    const token = getToken();
    if (!token) return { ok: false, reason: 'no-token' };

    try {
      const response = await AuthAPI.me();
      setSession(token, response.user);
      return { ok: true, user: response.user };
    } catch (_error) {
      clearSession();
      return { ok: false, reason: 'invalid-token' };
    }
  };

  const requireAuth = async () => {
    const result = await validateSession();
    if (!result.ok) {
      redirectTo('/login.html');
      return false;
    }

    renderNavbarUser(result.user);
    return true;
  };

  const redirectIfAuthenticated = async () => {
    const token = getToken();
    if (!token) return false;

    const result = await validateSession();
    if (result.ok) {
      redirectTo('/index.html');
      return true;
    }

    return false;
  };

  const logout = () => {
    clearSession();
    redirectTo('/login.html');
  };

  const renderNavbarUser = (user = getUser()) => {
    const usernameEl = document.getElementById('nav-username');
    if (usernameEl) {
      usernameEl.textContent = user && user.username ? user.username : '';
      usernameEl.title = user && user.username ? user.username : '';
    }

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.onclick = () => logout();
    }
  };

  const getThemeStorageKey = () => {
    const user = getUser();
    const scope = user && user._id ? user._id : 'guest';
    return `tj-theme:${scope}`;
  };

  const showAuthMessage = (message, isError = true, key = null) => {
    const messageEl = document.getElementById('auth-message');
    if (!messageEl) return;

    currentAuthMessage = { key, isError };
    messageEl.textContent = message ? translateMessage(message) : '';
    if (!message) {
      messageEl.className = 'auth-message';
      return;
    }

    messageEl.className = isError ? 'auth-message error' : 'auth-message success';
  };

  const bindLoginForm = () => {
    const form = document.getElementById('login-form');
    if (!form) return;

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      showAuthMessage('');

      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;

      if (!email || !password) {
        showAuthMessage(tAuth('auth.validation.fillAll'), true, 'auth.validation.fillAll');
        return;
      }

      const submitBtn = document.getElementById('login-submit-btn');
      submitBtn.disabled = true;
      submitBtn.textContent = tAuth('auth.signingIn');

      try {
        const response = await AuthAPI.login({ email, password });
        setSession(response.token, response.user);
        window.location.href = '/index.html';
      } catch (error) {
        showAuthMessage(translateMessage(error.message || tAuth('auth.error.invalidCredentials')));
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = tAuth('auth.login.title');
      }
    });
  };

  const bindRegisterForm = () => {
    const form = document.getElementById('register-form');
    if (!form) return;

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      showAuthMessage('');

      const username = document.getElementById('register-username').value.trim();
      const email = document.getElementById('register-email').value.trim();
      const password = document.getElementById('register-password').value;
      const confirmPassword = document.getElementById('register-confirm-password').value;

      if (!username || !email || !password || !confirmPassword) {
        showAuthMessage(tAuth('auth.validation.fillAll'), true, 'auth.validation.fillAll');
        return;
      }

      if (password.length < 6) {
        showAuthMessage(tAuth('auth.validation.passwordShort'), true, 'auth.validation.passwordShort');
        return;
      }

      if (password !== confirmPassword) {
        showAuthMessage(tAuth('auth.validation.passwordMismatch'), true, 'auth.validation.passwordMismatch');
        return;
      }

      const submitBtn = document.getElementById('register-submit-btn');
      submitBtn.disabled = true;
      submitBtn.textContent = tAuth('auth.creatingAccount');

      try {
        const response = await AuthAPI.register({ username, email, password });
        setSession(response.token, response.user);
        window.location.href = '/index.html';
      } catch (error) {
        showAuthMessage(translateMessage(error.message || tAuth('auth.error.registrationFailed')));
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = tAuth('auth.register.title');
      }
    });
  };

  const initAuthPages = async () => {
    if (!isPublicPage()) return;

    if (window.I18n && I18n.ready) {
      await I18n.ready;
    }

    if (window.ThemeManager && typeof window.ThemeManager.init === 'function') {
      window.ThemeManager.init();
    }

    const redirected = await redirectIfAuthenticated();
    if (redirected) return;

    bindLoginForm();
    bindRegisterForm();
    document.addEventListener('i18n:changed', () => {
      if (currentAuthMessage.key) {
        showAuthMessage(tAuth(currentAuthMessage.key), currentAuthMessage.isError, currentAuthMessage.key);
      }
    });
  };

  return {
    isPublicPage,
    getToken,
    getUser,
    setSession,
    clearSession,
    validateSession,
    requireAuth,
    redirectIfAuthenticated,
    logout,
    renderNavbarUser,
    getThemeStorageKey,
    initAuthPages,
  };

  function tAuth(key, vars) {
    return window.I18n ? I18n.t(key, vars) : key;
  }

  function translateMessage(message) {
    return window.I18n ? I18n.translateApiMessage(message) : message;
  }
})();

window.Auth = Auth;

document.addEventListener('DOMContentLoaded', async () => {
  if (window.I18n && I18n.ready) {
    await I18n.ready;
  }
  Auth.initAuthPages();
});
