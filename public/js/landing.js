// Landing: Sangam-style full-screen section deck.
// Wheel / arrow keys / dots / touch slide between sections; each activation
// re-runs the staggered rise-in animations. Falls back to normal scrolling on mobile.
renderNavbar('home');
initNavbarScroll();

const track = document.getElementById('deck-track');
const sections = [...document.querySelectorAll('.deck-section')];
const dotsBox = document.getElementById('deck-dots');
const deckEl = document.getElementById('deck');
const isDesktop = () => window.matchMedia('(min-width: 901px)').matches;

let current = 0;
let animating = false;

// --- dots ---
sections.forEach((_, i) => {
  const dot = document.createElement('button');
  dot.setAttribute('aria-label', `Go to section ${i + 1}`);
  dot.addEventListener('click', () => goTo(i));
  dotsBox.appendChild(dot);
});
const dots = [...dotsBox.children];

// --- word-by-word hero title ---
const heroTitle = document.getElementById('hero-title');
splitWords(heroTitle);
requestAnimationFrame(() => requestAnimationFrame(() => heroTitle.classList.add('words-in')));

function activate(i) {
  sections.forEach((s, idx) => s.classList.toggle('active', idx === i));
  dots.forEach((d, idx) => d.classList.toggle('active', idx === i));
}

function goTo(i) {
  if (!isDesktop()) return;
  i = Math.max(0, Math.min(sections.length - 1, i));
  if (i === current || animating) return;
  animating = true;
  current = i;
  track.style.transform = `translateY(-${i * 100}%)`;
  activate(i);
  if (i === sections.length - 1) runCounters();
  setTimeout(() => { animating = false; }, 980); // matches the CSS slide duration
}

// --- wheel: one gesture = one section (Sangam behaviour) ---
let wheelCooldown = false;
window.addEventListener('wheel', (e) => {
  if (!isDesktop() || animating || wheelCooldown) return;
  wheelCooldown = true;
  setTimeout(() => { wheelCooldown = false; }, 250);
  if (Math.abs(e.deltaY) < 12) return;
  goTo(current + (e.deltaY > 0 ? 1 : -1));
}, { passive: true });

// --- keyboard ---
window.addEventListener('keydown', (e) => {
  if (!isDesktop()) return;
  if (['ArrowDown', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); goTo(current + 1); }
  if (['ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); goTo(current - 1); }
  if (e.key === 'Home') goTo(0);
  if (e.key === 'End') goTo(sections.length - 1);
});

// --- touch swipe ---
let touchStartY = null;
window.addEventListener('touchstart', (e) => { touchStartY = e.touches[0].clientY; }, { passive: true });
window.addEventListener('touchend', (e) => {
  if (touchStartY === null || !isDesktop()) return;
  const delta = touchStartY - e.changedTouches[0].clientY;
  if (Math.abs(delta) > 48) goTo(current + (delta > 0 ? 1 : -1));
  touchStartY = null;
}, { passive: true });

// --- counters (final screen) ---
function runCounters() {
  document.querySelectorAll('[data-counter]').forEach((el) => {
    const target = Number(el.dataset.counter || 0);
    const start = performance.now();
    const step = (now) => {
      const progress = Math.min((now - start) / 1200, 1);
      el.textContent = Math.floor(target * (1 - Math.pow(1 - progress, 3))).toLocaleString('en-IN');
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

// --- featured cards (screen 3), styled like Sangam's people cards ---
const CHIP_COLORS = ['var(--pink-soft)', 'var(--blue-chip)', 'var(--tan-chip)'];

function personCard(gig, idx) {
  const name = gig.giver.name;
  const tags = [gig.discipline, gig.city].filter(Boolean).slice(0, 2);
  const color = CHIP_COLORS[idx % CHIP_COLORS.length];
  return `
    <div class="card hoverable person-card sticker-hover">
      <div class="top">
        <span class="avatar" style="width:46px;height:46px;background:${color}">${escapeHtml(initials(name))}</span>
        ${gig.giver.plan === 'PRO' ? '<span class="badge PRO">PRO</span>' : ''}
      </div>
      <div class="degree">${escapeHtml(gig.discipline)} · ${escapeHtml(gig.city)}</div>
      <h3><a href="/pages/gig-detail.html?id=${gig.id}">${escapeHtml(name)}</a></h3>
      <p class="muted small line">${escapeHtml(gig.title)} — ${money(gig.budget)}, ${fmtDate(gig.shootDate)}.</p>
      <div class="foot">
        <span class="tag-chips">${tags.map((t) => `<span class="chip">${escapeHtml(t)}</span>`).join('')}</span>
        <span class="small">${stars(gig.giverRating)}</span>
      </div>
    </div>`;
}

(async () => {
  const featured = document.getElementById('featured');
  try {
    const data = await api('/gigs?status=OPEN');
    const picks = data.gigs.slice(0, 3);
    featured.innerHTML = picks.length
      ? picks.map(personCard).join('')
      : '<div class="empty-state">No open gigs right now — be the first to post one.</div>';
  } catch {
    featured.innerHTML = '<div class="empty-state">Could not load the network. Is the server running?</div>';
  }
  activate(0); // start the hero rise-in once content is ready
  // ensure the first screen's cards get their animation too
  document.querySelector('.network-screen').classList.add('active');
})();
