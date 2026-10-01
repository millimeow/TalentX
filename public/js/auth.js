// Login / register / Google OAuth page
renderNavbar();
initNavbarScroll();

const tabLogin = document.getElementById('tab-login');
const tabRegister = document.getElementById('tab-register');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const eyebrow = document.getElementById('auth-eyebrow');

function showTab(which) {
  const isLogin = which === 'login';
  tabLogin.classList.toggle('active', isLogin);
  tabRegister.classList.toggle('active', !isLogin);
  loginForm.hidden = !isLogin;
  registerForm.hidden = isLogin;
  eyebrow.textContent = isLogin ? 'LOGIN' : 'CREATE ACCOUNT';
}

tabLogin.addEventListener('click', () => showTab('login'));
tabRegister.addEventListener('click', () => showTab('register'));
if (new URLSearchParams(window.location.search).get('mode') === 'register') showTab('register');

// Already logged in? Straight to the (persona-aware) dashboard.
if (session.accessToken) window.location.href = '/pages/dashboard.html';

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const data = await api('/auth/login', {
      method: 'POST',
      body: { email: document.getElementById('login-email').value, password: document.getElementById('login-password').value },
    });
    session.save(data);
    toast('Welcome back!', 'success');
    afterLoginRedirect();
  } catch (err) {
    toast(err.message, 'error');
  }
});

registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const data = await api('/auth/register', {
      method: 'POST',
      body: {
        name: document.getElementById('reg-name').value,
        email: document.getElementById('reg-email').value,
        password: document.getElementById('reg-password').value,
      },
    });
    session.save(data);
    toast('Welcome to TalentX!', 'success');
    afterLoginRedirect();
  } catch (err) {
    toast(err.message, 'error');
  }
});

// ---------- Google OAuth ----------
// The server publishes its public Google client id. When configured, Google's
// official button renders and its ID token is verified by POST /auth/google.
(async () => {
  const slot = document.getElementById('gbutton');
  const fallback = document.getElementById('google-fallback');
  const note = document.getElementById('google-note');

  let clientId = null;
  try {
    const data = await api('/auth/google-client-id');
    clientId = data.clientId;
  } catch { /* server unreachable — handled below */ }

  if (clientId) {
    // Wait for the GIS script (loaded async in the page head)
    const waitForGis = async () => {
      for (let i = 0; i < 40; i++) {
        if (window.google && google.accounts && google.accounts.id) return true;
        await new Promise((r) => setTimeout(r, 150));
      }
      return false;
    };
    if (await waitForGis()) {
      google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response) => {
          try {
            const data = await api('/auth/google', { method: 'POST', body: { credential: response.credential } });
            session.save(data);
            toast(`Signed in as ${data.user.name}`, 'success');
            afterLoginRedirect();
          } catch (err) {
            toast(err.message, 'error');
          }
        },
      });
      google.accounts.id.renderButton(slot, {
        theme: 'outline',
        size: 'large',
        shape: 'pill',
        text: 'continue_with',
        width: 372,
      });
      return;
    }
  }

  // No client id configured on this deployment — show the styled button with
  // a clear note instead of a button that cannot work.
  fallback.hidden = false;
  note.textContent = 'Google sign-in needs a one-time setup: put your OAuth client id in .env as GOOGLE_CLIENT_ID (see README) and restart the server.';
  fallback.addEventListener('click', () => {
    toast('Google sign-in is not configured on this server yet — see the note below.', 'error');
  });
})();
