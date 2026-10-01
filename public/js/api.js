// Shared API helper: attaches the JWT, and transparently refreshes it on 401.
const API_BASE = '/api/v1';

const session = {
  get accessToken() { return localStorage.getItem('tx_access'); },
  get refreshToken() { return localStorage.getItem('tx_refresh'); },
  get user() {
    try { return JSON.parse(localStorage.getItem('tx_user')); } catch { return null; }
  },
  save({ accessToken, refreshToken, user }) {
    if (accessToken) localStorage.setItem('tx_access', accessToken);
    if (refreshToken) localStorage.setItem('tx_refresh', refreshToken);
    if (user) localStorage.setItem('tx_user', JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem('tx_access');
    localStorage.removeItem('tx_refresh');
    localStorage.removeItem('tx_user');
  },
};

let refreshPromise = null;

async function refreshSession() {
  if (!session.refreshToken) return false;
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    })
      .then(async (res) => {
        if (!res.ok) return false;
        const data = await res.json();
        session.save(data);
        return true;
      })
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

async function api(path, { method = 'GET', body, formData } = {}) {
  const headers = {};
  if (session.accessToken) headers.Authorization = `Bearer ${session.accessToken}`;
  if (body && !formData) headers['Content-Type'] = 'application/json';

  let res = await fetch(API_BASE + path, {
    method,
    headers,
    body: formData ? formData : body ? JSON.stringify(body) : undefined,
  });

  // Access token expired — refresh once and retry
  if (res.status === 401 && session.refreshToken && !path.startsWith('/auth/')) {
    const ok = await refreshSession();
    if (ok) {
      headers.Authorization = `Bearer ${session.accessToken}`;
      res = await fetch(API_BASE + path, {
        method,
        headers,
        body: formData ? formData : body ? JSON.stringify(body) : undefined,
      });
    }
  }

  let data = null;
  try { data = await res.json(); } catch { /* file downloads etc. */ }

  if (!res.ok) {
    const err = new Error((data && data.error) || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

async function logout() {
  try {
    await api('/auth/logout', { method: 'POST', body: { refreshToken: session.refreshToken } });
  } catch { /* token may already be dead */ }
  session.clear();
  window.location.href = '/pages/login.html';
}
