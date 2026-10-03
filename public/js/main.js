// Shared page behaviour: navbar, global sidebar, scroll reveal, counters, toasts, formatting.
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

// Stored file paths are either relative (disk: "photos/x.jpg") or full URLs
// (Vercel Blob). This turns either into a usable src.
function fileUrl(storedPath) {
  if (!storedPath) return null;
  if (/^https?:\/\//.test(storedPath)) return storedPath;
  return `/uploads/${storedPath}`;
}

function avatarHtml(name, photoPath, size = 34) {
  const src = fileUrl(photoPath);
  if (src) {
    return `<span class="avatar" style="width:${size}px;height:${size}px"><img src="${escapeHtml(src)}" alt="" style="width:100%;height:100%;object-fit:cover"></span>`;
  }
  return `<span class="avatar" style="width:${size}px;height:${size}px">${escapeHtml(initials(name))}</span>`;
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

// ---------- sidebar icons (lucide-style strokes) ----------
const ICONS = {
  home: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
  overview: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>',
  gigs: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>',
  applications: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.7 4H7.3a2 2 0 0 0-1.8 1.1z"/></svg>',
  contracts: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h6"/></svg>',
  rentals: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',
  wallet: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/></svg>',
  board: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
  profile: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  admin: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  about: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',
  pricing: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
  create: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>',
};

let _activeNav = undefined;

function renderNavbar(active) {
  _activeNav = active;
  const user = session.user;
  const link = (href, label, key) =>
    `<a href="${href}" class="${active === key ? 'active' : ''}">${label}</a>`;

  document.querySelectorAll('header.navbar').forEach((el) => {
    el.innerHTML = `
      <div class="navbar-inner">
        <button class="btn secondary sm hamburger" aria-label="Menu" onclick="document.body.classList.toggle('sidebar-open')">☰</button>
        <a class="logo" href="/pages/index.html">${LOGO_SVG}<span>Studio<span class="dot">X</span></span></a>
        <nav class="nav-links">
          ${link('/pages/index.html', 'Home', 'home')}
          ${link('/pages/gigs.html', 'Gig board', 'gigs')}
          ${link('/pages/equipment.html', 'Equipment', 'equipment')}
          ${link('/pages/about.html', 'About', 'about')}
          ${link('/pages/pricing.html', 'Pricing', 'pricing')}
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

  renderGlobalSidebar();
}

// ---------- Global sidebar (every page except the landing + login) ----------
function renderGlobalSidebar() {
  const page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const user = session.user;

  // The sidebar holds only the workspace section, so it exists just for
  // logged-in pages. The landing and login pages never get one.
  const skip = page === '' || page === 'index.html' || page === 'login.html' || page === 'about.html' || page === 'pricing.html' || !user;
  if (skip) {
    document.body.classList.remove('has-sidebar', 'sidebar-open');
    document.getElementById('global-sidebar')?.remove();
    return;
  }

  const persona = getPersona() === 'organizer' ? 'organizer' : 'talent';
  const dashTab = new URLSearchParams(location.search).get('tab') || 'overview';
  const A = (href, icon, text, active) =>
    `<a href="${href}" class="${active ? 'active' : ''}">${icon}<span>${text}</span></a>`;
  const onDash = (tab) => page === 'dashboard.html' && dashTab === tab;

  document.body.classList.add('has-sidebar');
  let aside = document.getElementById('global-sidebar');
  if (!aside) {
    aside = document.createElement('aside');
    aside.id = 'global-sidebar';
    aside.className = 'sidebar';
    const header = document.querySelector('header.navbar');
    if (header && header.parentNode) header.after(aside);
    else document.body.prepend(aside);
  }
  // Workspace items depend on the persona: organizers hire, talent works.
  const isOrganizer = persona === 'organizer';
  const workItems = isOrganizer
    ? A('/pages/create-gig.html', ICONS.create, 'Post a gig', page === 'create-gig.html') +
      A('/pages/dashboard.html?tab=gigs', ICONS.gigs, 'My gigs', onDash('gigs')) +
      A('/pages/dashboard.html?tab=rentals', ICONS.rentals, 'My gear rentals', onDash('rentals'))
    : A('/pages/gigs.html', ICONS.board, 'Find work', page === 'gigs.html') +
      A('/pages/dashboard.html?tab=applications', ICONS.applications, 'My applications', onDash('applications')) +
      A('/pages/dashboard.html?tab=rentals', ICONS.rentals, 'Rentals', onDash('rentals'));

  aside.innerHTML = `
    <button class="side-close" aria-label="Close menu" onclick="document.body.classList.remove('sidebar-open')">✕</button>
    <p class="side-label">${isOrganizer ? 'Hiring' : 'Working'}</p>
    ${A('/pages/dashboard.html?tab=overview', ICONS.overview, 'Overview', onDash('overview'))}
    ${workItems}
    ${A('/pages/dashboard.html?tab=contracts', ICONS.contracts, 'Contracts', onDash('contracts'))}
    ${A('/pages/dashboard.html?tab=wallet', ICONS.wallet, 'Wallet', onDash('wallet'))}
    <div class="sep"></div>
    ${A('/pages/profile.html?id=' + user.id, ICONS.profile, 'My profile', page === 'profile.html')}
    ${user.role === 'ADMIN' ? A('/pages/admin.html', ICONS.admin, 'Admin panel', page === 'admin.html') : ''}
    <div class="side-foot">
      <p class="side-label">Viewing as</p>
      ${personaSwitchHtml(persona)}
      <button class="btn secondary sm block" onclick="logout()">Log out</button>
    </div>`;

  aside.querySelectorAll('.persona-switch button').forEach((btn) => {
    btn.addEventListener('click', () => {
      setPersona(btn.dataset.persona);
      renderNavbar(_activeNav);
      toast(`Viewing as ${btn.dataset.persona === 'talent' ? 'Talent' : 'Organizer'}.`, 'success');
      window.dispatchEvent(new CustomEvent('persona-changed', { detail: btn.dataset.persona }));
    });
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
// A UI-only mode: StudioX accounts can always do both (PRD: giver/taker are not
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

// Segmented Talent/Organizer switch, used in the dashboard header + sidebar.
function personaSwitchHtml(current) {
  return `
    <div class="persona-switch" role="group" aria-label="Viewing mode">
      <button data-persona="talent" class="${current === 'talent' ? 'active' : ''}">🎨 Talent</button>
      <button data-persona="organizer" class="${current === 'organizer' ? 'active' : ''}">📋 Organizer</button>
    </div>`;
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
