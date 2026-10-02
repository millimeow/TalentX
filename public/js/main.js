// Shared page behaviour: navbar, scroll reveal, counters, toasts, formatting.
const money = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const getParam = (name) => new URLSearchParams(window.location.search).get(name);

function stars(avg) {
  if (avg === null || avg === undefined) return '<span class="muted small">No ratings yet</span>';
  const full = Math.round(avg);
  return `<span class="stars">${'★'.repeat(full)}${'☆'.repeat(5 - full)}</span> <span class="small">${avg.toFixed(1)}</span>`;
}

function initials(name) {
  return (name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

function avatarHtml(name, photoPath, size = 34) {
  const src = fileUrl(photoPath);
  if (src) {
    return `<span class="avatar" style="width:${size}px;height:${size}px"><img src="${escapeHtml(src)}" alt="" style="width:100%;height:100%;object-fit:cover"></span>`;
  }
  return `<span class="avatar" style="width:${size}px;height:${size}px">${escapeHtml(initials(name))}</span>`;
}

// Stored file paths are either relative (disk: "photos/x.jpg") or full URLs
// (Vercel Blob). This turns either into a usable src.
function fileUrl(storedPath) {
  if (!storedPath) return null;
  if (/^https?:\/\//.test(storedPath)) return storedPath;
  return `/uploads/${storedPath}`;
}

let toastTimer;
function toast(message, type = '') {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.className = `show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = ''; }, 3200);
}

// ---------- Navbar ----------
const LOGO_SVG = `<svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
  <circle cx="13" cy="13" r="11" stroke="#0f172a" stroke-width="3.4"/>
  <circle cx="13" cy="13" r="4.4" fill="#7f1d3b"/>
</svg>`;

const ARROW = '<span class="arrow">&rarr;</span>';
const ARROW_UP = '<span class="arrow">&#8599;</span>';

function renderNavbar(active) {
  const user = session.user;
  const link = (href, label, key) =>
    `<a href="${href}" class="${active === key ? 'active' : ''}">${label}</a>`;

  document.querySelectorAll('header.navbar').forEach((el) => {
    el.innerHTML = `
      <div class="navbar-inner">
        <a class="logo" href="/pages/index.html">${LOGO_SVG}<span>Talent<span class="dot">X</span></span></a>
        <nav class="nav-links">
          ${link('/pages/gigs.html', 'Gig board', 'gigs')}
          ${link('/pages/equipment.html', 'Equipment', 'equipment')}
          ${link('/pages/about.html', 'About', 'about')}
          ${link('/pages/pricing.html', 'Pricing', 'pricing')}
          ${user ? link('/pages/dashboard.html', 'Dashboard', 'dashboard') : ''}
          ${user && user.role === 'ADMIN' ? link('/pages/admin.html', 'Admin', 'admin') : ''}
        </nav>
        <div class="nav-right" id="nav-right">
          ${user
            ? `<a class="wallet-chip" href="/pages/dashboard.html?tab=wallet" title="Wallet balance">&#9670; ${money(user.walletBalance)}</a>
               <a href="/pages/profile.html?id=${user.id}" title="My profile">${avatarHtml(user.name, user.photoPath)}</a>
               <button class="btn secondary sm" onclick="logout()">Log out</button>`
            : `<a class="btn secondary sm" href="/pages/login.html">Log in</a>
               <a class="btn sm" href="/pages/login.html?mode=register">Get started ${ARROW}</a>`}
        </div>
      </div>`;
  });
}

function initNavbarScroll() {
  const onScroll = () => {
    document.querySelectorAll('header.navbar').forEach((el) => {
      el.classList.toggle('scrolled', window.scrollY > 8);
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

// ---------- Scroll reveal ----------
function initReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
}

// ---------- Landing counters ----------
function initCounters() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(async (entry) => {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      const el = entry.target;
      const target = Number(el.dataset.counter || 0);
      const start = performance.now();
      const step = (now) => {
        const progress = Math.min((now - start) / 1200, 1);
        el.textContent = Math.floor(target * (1 - Math.pow(1 - progress, 3))).toLocaleString('en-IN');
        if (progress < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }, { threshold: 0.4 });
  document.querySelectorAll('[data-counter]').forEach((el) => observer.observe(el));
}

function requireAuth() {
  if (!session.accessToken) {
    window.location.href = '/pages/login.html';
    return false;
  }
  return true;
}

// ---------- Persona (Talent / Organizer) ----------
// A UI-only mode: TalentX accounts can always do both (PRD: giver/taker are not
// stored roles). The switch tailors the dashboard and after-login experience.
function getPersona() {
  return localStorage.getItem('tx_persona');
}

function setPersona(persona) {
  localStorage.setItem('tx_persona', persona); // 'talent' | 'organizer'
}

// After a successful login: pick a persona once, then go to the dashboard.
function afterLoginRedirect() {
  window.location.href = getPersona() ? '/pages/dashboard.html' : '/pages/onboarding.html';
}

// Segmented Talent/Organizer switch, used in the dashboard header.
function personaSwitchHtml(current) {
  return `
    <div class="persona-switch" role="group" aria-label="Viewing mode">
      <button data-persona="talent" class="${current === 'talent' ? 'active' : ''}">🎨 Talent</button>
      <button data-persona="organizer" class="${current === 'organizer' ? 'active' : ''}">📋 Organizer</button>
    </div>`;
}

// Splits an element's text into staggered .word spans for the hero reveal.
// <span class="hl">…</span> children keep their colour emphasis.
function splitWords(el) {
  if (!el) return;
  const process = (node, target) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.TEXT_NODE) {
        for (const word of child.textContent.split(/\s+/).filter(Boolean)) {
          const span = document.createElement('span');
          span.className = 'word';
          span.textContent = word;
          target.appendChild(span);
          target.appendChild(document.createTextNode(' '));
        }
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const clone = child.cloneNode(false);
        target.appendChild(clone);
        process(child, clone);
      }
    }
  };
  const frag = document.createElement('span');
  process(el, frag);
  el.innerHTML = '';
  el.appendChild(frag);
  [...el.querySelectorAll('.word')].forEach((w, i) => {
    w.style.transitionDelay = `${0.15 + i * 0.09}s`;
  });
}

// Refresh the wallet chip + stored user after balance changes
async function refreshStoredUser() {
  try {
    const data = await api('/profile/me');
    session.save({
      user: { ...data.user, photoPath: data.profile ? data.profile.photoPath : null },
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    });
  } catch { /* ignore */ }
}
