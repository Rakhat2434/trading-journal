const API_BASE = '/api';
const AUTH_TOKEN_KEY = 'tj-token';
const AUTH_USER_KEY = 'tj-user';

function getStoredToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

function clearStoredSession() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
}

function isAuthPagePath(pathname) {
  return (
    pathname === '/login' ||
    pathname === '/register' ||
    pathname.endsWith('/login.html') ||
    pathname.endsWith('/register.html')
  );
}

async function parseResponseBody(response) {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return null;
  }

  try {
    return await response.json();
  } catch (_error) {
    return null;
  }
}

async function apiFetch(url, options = {}) {
  const requestHeaders = { ...(options.headers || {}) };
  const method = (options.method || 'GET').toUpperCase();

  if (options.body && !requestHeaders['Content-Type']) {
    requestHeaders['Content-Type'] = 'application/json';
  }

  const token = getStoredToken();
  if (token && !options.skipAuth) {
    requestHeaders.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    method,
    headers: requestHeaders,
  });

  const data = await parseResponseBody(response);

  if (!response.ok) {
    if (response.status === 401 && !options.skipAuth) {
      clearStoredSession();
      if (!isAuthPagePath(window.location.pathname)) {
        window.location.href = '/login.html';
      }
    }

    throw new Error((data && data.message) || `HTTP error ${response.status}`);
  }

  return data;
}

const AuthAPI = {
  register: (data) =>
    apiFetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      body: JSON.stringify(data),
      skipAuth: true,
    }),
  login: (data) =>
    apiFetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      body: JSON.stringify(data),
      skipAuth: true,
    }),
  me: () => apiFetch(`${API_BASE}/auth/me`),
};

const JournalAPI = {
  getAll: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiFetch(`${API_BASE}/journal${q ? `?${q}` : ''}`);
  },
  getById: (id) => apiFetch(`${API_BASE}/journal/${id}`),
  create: (data) =>
    apiFetch(`${API_BASE}/journal`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id, data) =>
    apiFetch(`${API_BASE}/journal/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id) =>
    apiFetch(`${API_BASE}/journal/${id}`, {
      method: 'DELETE',
    }),
};

const GoalsAPI = {
  getAll: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiFetch(`${API_BASE}/goals${q ? `?${q}` : ''}`);
  },
  getById: (id) => apiFetch(`${API_BASE}/goals/${id}`),
  create: (data) =>
    apiFetch(`${API_BASE}/goals`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id, data) =>
    apiFetch(`${API_BASE}/goals/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id) =>
    apiFetch(`${API_BASE}/goals/${id}`, {
      method: 'DELETE',
    }),
};
