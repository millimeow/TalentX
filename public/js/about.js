// About page — simple, reliable animations.
// Hero words rise on load; everything else fades up once as it enters the
// viewport (ScrollTrigger.batch). No pinning, no scrubbing, no smooth-scroll
// wrapper — nothing that can get stuck. If GSAP fails to load, the page is
// fully visible with no animations at all.
renderNavbar('about');
initNavbarScroll();

(function () {
  // classic scripts can't use a top-level `return`, hence the IIFE wrapper
  if (!window.gsap || !window.ScrollTrigger) return;

  gsap.registerPlugin(ScrollTrigger);
  gsap.defaults({ ease: 'power3.out', duration: 0.7 });

  // Respect users who prefer reduced motion — leave everything as-is.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // ---------- Hero: words rise on load ----------
  const title = document.getElementById('about-title');
  splitWords(title);
  const words = title.querySelectorAll('.word');
  gsap.set(words, { yPercent: 110, autoAlpha: 0 });
  gsap.timeline({ delay: 0.1 })
    .to(words, { yPercent: 0, autoAlpha: 1, stagger: 0.04, duration: 0.75, ease: 'power4.out' })
    .from('.about-sub', { y: 24, autoAlpha: 0, duration: 0.5 }, '-=0.45')
    .from('.hero-cta', { y: 16, autoAlpha: 0, duration: 0.45 }, '-=0.4')
    .from('.scroll-cue', { autoAlpha: 0, duration: 0.4 }, '-=0.2');

  // ---------- Marquee: seamless infinite loop ----------
  const track = document.querySelector('.marquee-track');
  if (track) gsap.to(track, { xPercent: -50, ease: 'none', duration: 26, repeat: -1 });

  // ---------- Fade-up helper: reveal once, 88% down the viewport ----------
  const fadeUp = (selector, stagger = 0.1) => {
    const els = gsap.utils.toArray(selector);
    if (!els.length) return;
    gsap.set(els, { autoAlpha: 0, y: 40 });
    ScrollTrigger.batch(els, {
      start: 'top 88%',
      once: true,
      onEnter: (batch) => gsap.to(batch, { autoAlpha: 1, y: 0, stagger }),
    });
  };

  // ---------- Story: rail grows with scroll, lines slide in ----------
  gsap.fromTo('.story-rail-fill', { scaleY: 0 }, {
    scaleY: 1, ease: 'none',
    scrollTrigger: { trigger: '.story-lines', start: 'top 72%', end: 'bottom 58%', scrub: true },
  });
  gsap.utils.toArray('.story-line').forEach((line) => {
    gsap.set(line, { autoAlpha: 0, x: -36 });
    ScrollTrigger.create({
      trigger: line, start: 'top 86%', once: true,
      onEnter: () => gsap.to(line, { autoAlpha: 1, x: 0, duration: 0.6 }),
    });
  });
  const punch = document.querySelector('.story-line .big-line');
  if (punch) {
    gsap.set(punch, { autoAlpha: 0, scale: 0.85 });
    ScrollTrigger.create({
      trigger: punch, start: 'top 86%', once: true,
      onEnter: () => gsap.to(punch, { autoAlpha: 1, scale: 1, duration: 0.55, ease: 'back.out(2)' }),
    });
  }
  fadeUp('.section-title');
  fadeUp('.section-sub');
  fadeUp('.ghost-step', 0.14);
  fadeUp('.num-card', 0.12);
  fadeUp('.straw-text p', 0.12);
  fadeUp('.compare-row', 0.12);
  fadeUp('.value-card', 0.12);
  fadeUp('.flow p');

  // ---------- UNPAID stamp: one firm slam ----------
  const stamp = document.querySelector('.stamp');
  if (stamp) {
    gsap.set(stamp, { autoAlpha: 0, scale: 2.6, rotation: -30 });
    ScrollTrigger.create({
      trigger: stamp,
      start: 'top 88%',
      once: true,
      onEnter: () => gsap.to(stamp, { autoAlpha: 1, scale: 1, rotation: -8, duration: 0.45, ease: 'back.out(2.2)' }),
    });
  }

  // ---------- Numbers: count up on first sight ----------
  document.querySelectorAll('.num[data-count]').forEach((el) => {
    const target = parseFloat(el.dataset.count);
    const prefix = el.dataset.prefix || '';
    const suffix = el.dataset.suffix || '';
    const state = { v: 0 };
    ScrollTrigger.create({
      trigger: el,
      start: 'top 88%',
      once: true,
      onEnter: () => gsap.to(state, {
        v: target,
        duration: 1.6,
        ease: 'power2.out',
        snap: { v: 1 },
        onUpdate: () => { el.textContent = prefix + state.v.toLocaleString('en-IN') + suffix; },
      }),
    });
  });

  // fonts shift layout — recalculate once everything is ready
  window.addEventListener('load', () => ScrollTrigger.refresh());
})();
