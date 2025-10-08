// ============================
// ============================
// Mobile nav toggle (drawer)
// ============================
const headerWrap = document.querySelector('.site-header .container');
const toggle = document.querySelector('.nav__toggle');
const menu = document.querySelector('.nav__menu');

if (toggle) {
  const closeMenu = () => {
    toggle.setAttribute('aria-expanded', 'false');
    headerWrap.classList.remove('nav--open');
    // ❌ removed body scroll lock
    // document.body.classList.remove('no-scroll');
  };

  const openMenu = () => {
    toggle.setAttribute('aria-expanded', 'true');
    headerWrap.classList.add('nav--open');
    // ❌ removed body scroll lock
    // document.body.classList.add('no-scroll');
  };

  toggle.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    if (expanded) closeMenu(); else openMenu();
  });

  // Close when clicking a link
  menu?.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', closeMenu, { passive: true });
  });

  // Close on ESC
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu();
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!headerWrap.classList.contains('nav--open')) return;
    const isInsideMenu = menu && menu.contains(e.target);
    const isToggle = toggle.contains(e.target);
    if (!isInsideMenu && !isToggle) closeMenu();
  });
}

// ============================
// Smooth scroll for in-page links
// ============================
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', e => {
    const id = link.getAttribute('href');
    if (id && id.length > 1) {
      const el = document.querySelector(id);
      if (el) {
        e.preventDefault();
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, { passive: false });
});

// Footer year
const y = document.getElementById('year');
if (y) y.textContent = new Date().getFullYear();


// =====================================================
// Generic Carousel with SWIPE (Pointer Events)
// - Works for How It Works & Why Choose Us sections
// - Supports mouse/touch, with direction lock
// - No need for CSS changes; we set touch-action in JS
// =====================================================
function initCarousel(root){
  const viewport = root.querySelector('.carousel__viewport');
  const track = root.querySelector('.carousel__track');
  if (!viewport || !track) return;

  // Improve scrolling interaction on touch devices:
  // allow page to scroll vertically while we capture horizontal drags.
  viewport.style.touchAction = 'pan-y';
  track.style.userSelect = 'none';   // avoid text/image selection while dragging
  track.style.cursor = 'grab';

  const slides = Array.from(track.children);
  const prevBtn = root.querySelector('.carousel__btn--prev'); // might be null
  const nextBtn = root.querySelector('.carousel__btn--next'); // might be null
  const dotsWrap = root.querySelector('.carousel__dots');

  const cfg = {
    phone: parseInt(root.dataset.phone || '1', 10),
    tablet: parseInt(root.dataset.tablet || '2', 10),
    desktop: parseInt(root.dataset.desktop || '4', 10),
    staticDesktop: root.dataset.staticDesktop === 'true'
  };

  let itemsPerView = 1, page = 0, pages = 1, slideW = 0, isStatic = false;
  const desktopBp = 1024;
  const isDesktopWidth = () => (root.clientWidth || window.innerWidth) >= desktopBp;

  const calcItemsPerView = () => {
    const w = root.clientWidth || window.innerWidth;
    if (w >= desktopBp) return cfg.desktop;
    if (w >= 980)       return cfg.tablet;
    return cfg.phone;
  };

  function setStaticMode(on){
    isStatic = !!on;
    root.classList.toggle('is-static', isStatic);
    if (isStatic) {
      track.style.transition = 'none';
      track.style.transform = 'none';
      slides.forEach(s => { s.style.width = ''; });
      if (prevBtn) prevBtn.style.display = 'none';
      if (nextBtn) nextBtn.style.display = 'none';
      if (dotsWrap) dotsWrap.style.display = 'none';
    } else {
      if (prevBtn) prevBtn.style.display = '';
      if (dotsWrap) dotsWrap.style.display = '';
      // nextBtn may exist only on Pricing; keep its display as is
    }
  }

  function layout(){
    setStaticMode(cfg.staticDesktop && isDesktopWidth());
    if (isStatic) return;

    itemsPerView = calcItemsPerView();
    const vpW = viewport.clientWidth;
    const gap = 16;
    slideW = (vpW - ((itemsPerView - 1) * gap)) / itemsPerView;
    slides.forEach(s => { s.style.width = `${slideW}px`; });

    pages = Math.ceil(slides.length / itemsPerView);
    page = ((page % pages) + pages) % pages;
    buildDots();
    goTo(page, false);
  }

  function goTo(p, animate = true){
    if (isStatic) return;
    p = ((p % pages) + pages) % pages;
    const gap = 16;
    const x = p * (itemsPerView * (slideW + gap));
    if (!animate) track.style.transition = 'none';
    track.style.transform = `translateX(${-x}px)`;
    if (!animate) { void track.offsetWidth; track.style.transition = 'transform .35s ease'; }
    page = p;
    updateDots();
  }

  function buildDots(){
    if (!dotsWrap) return;
    dotsWrap.innerHTML = '';
    if (isStatic) return;
    for (let i = 0; i < pages; i++){
      const b = document.createElement('button');
      b.className = 'carousel__dot';
      b.type = 'button';
      if (i === page) b.setAttribute('aria-current', 'true');
      b.setAttribute('aria-label', `Go to group ${i+1}`);
      b.addEventListener('click', () => goTo(i));
      dotsWrap.appendChild(b);
    }
  }
  function updateDots(){
    if (!dotsWrap || isStatic) return;
    const kids = Array.from(dotsWrap.children);
    kids.forEach((k,i) => {
      if (i === page) k.setAttribute('aria-current', 'true');
      else k.removeAttribute('aria-current');
    });
  }

  // Buttons (if present)
  prevBtn?.addEventListener('click', () => goTo(page - 1));
  nextBtn?.addEventListener('click', () => goTo(page + 1));

  // -----------------------------
  // Swipe / Drag (Pointer Events)
  // -----------------------------
  let startX = 0, startY = 0, curX = 0;
  let dragging = false;
  let startTransform = 0;
  let lockDir = null; // 'x' or 'y'
  const LOCK_THRESHOLD = 8; // px to decide direction

  function getTranslateX(){
    const style = getComputedStyle(track).transform;
    if (style && style !== 'none') {
      const m = style.match(/matrix\(([^)]+)\)/);
      if (m) {
        const parts = m[1].split(',').map(v => parseFloat(v.trim()));
        return parts[4] || 0;
      }
    }
    return 0;
  }

  function onPointerDown(e){
    // Only left mouse button or primary touch/pen
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    dragging = true;
    lockDir = null;
    startX = e.clientX;
    startY = e.clientY;
    curX = startX;
    startTransform = getTranslateX();
    track.style.transition = 'none';
    track.style.cursor = 'grabbing';
    viewport.setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e){
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    // lock direction once movement is significant
    if (lockDir === null) {
      if (Math.abs(dx) > LOCK_THRESHOLD) lockDir = 'x';
      else if (Math.abs(dy) > LOCK_THRESHOLD) lockDir = 'y';
    }

    if (lockDir === 'x') {
      e.preventDefault(); // keep the page from scrolling while swiping horizontally
      curX = e.clientX;
      track.style.transform = `translateX(${startTransform + dx}px)`;
    }
    // if 'y', let the page scroll normally
  }

  function onPointerUp(e){
    if (!dragging) return;
    dragging = false;
    track.style.transition = 'transform .35s ease';
    track.style.cursor = 'grab';
    viewport.releasePointerCapture?.(e.pointerId);

    const dx = (curX || startX) - startX;
    const threshold = Math.max(40, slideW * 0.15);
    if (lockDir === 'x') {
      if (dx < -threshold) goTo(page + 1);
      else if (dx > threshold) goTo(page - 1);
      else goTo(page);
    } else {
      // no horizontal intent -> snap back
      goTo(page);
    }
    startX = startY = curX = 0;
    lockDir = null;
  }

  // Bind to the viewport only (not window)
  viewport.addEventListener('pointerdown', onPointerDown, { passive: true });
  viewport.addEventListener('pointermove', onPointerMove, { passive: false });
  viewport.addEventListener('pointerup', onPointerUp, { passive: true });
  viewport.addEventListener('pointercancel', onPointerUp, { passive: true });
  viewport.addEventListener('pointerleave', onPointerUp, { passive: true });

  // Resize/layout
  let resizeTimer;
  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(layout, 120);
  };
  window.addEventListener('resize', onResize, { passive: true });

  // init
  layout();
}

// Initialize all carousels
document.querySelectorAll('.carousel').forEach(initCarousel);
// ====== FAQ: accordion (only one open at a time) ======
const faqRoot = document.querySelector('.faq');
if (faqRoot) {
  const items = Array.from(faqRoot.querySelectorAll('details'));

  items.forEach(item => {
    item.addEventListener('toggle', () => {
      if (item.open) {
        // close all others
        items.forEach(other => {
          if (other !== item) other.open = false;
        });
      }
    });
  });
}
/* ===============================
   FAQ – Smooth, single-open accordion
   =============================== */
(function () {
  const detailsEls = Array.from(document.querySelectorAll('.faq details'));
  if (!detailsEls.length) return;

  // Wrap non-summary nodes into a .faq__content container (no HTML edits needed)
  detailsEls.forEach(d => {
    if (!d.querySelector('.faq__content')) {
      const wrapper = document.createElement('div');
      wrapper.className = 'faq__content';
      const kids = Array.from(d.children).filter(n => n.tagName?.toLowerCase() !== 'summary');
      kids.forEach(n => wrapper.appendChild(n));
      d.appendChild(wrapper);
    }
    // ensure collapsed height is 0 initially
    const c = d.querySelector('.faq__content');
    c.style.height = d.hasAttribute('open') ? 'auto' : '0px';
  });

  // Helpers
  const openItem = (d) => {
    const content = d.querySelector('.faq__content');
    d.setAttribute('open', '');
    // from 0 → measured height
    content.style.height = '0px';
    requestAnimationFrame(() => {
      content.style.height = content.scrollHeight + 'px';
    });
    content.addEventListener('transitionend', function te(e) {
      if (e.propertyName !== 'height') return;
      content.removeEventListener('transitionend', te);
      content.style.height = 'auto'; // lock to content height after anim
    });
  };

  const closeItem = (d) => {
    const content = d.querySelector('.faq__content');
    // from current auto/height → px → 0
    const start = content.scrollHeight;
    content.style.height = start + 'px';
    requestAnimationFrame(() => {
      content.style.height = '0px';
    });
    content.addEventListener('transitionend', function te(e) {
      if (e.propertyName !== 'height') return;
      content.removeEventListener('transitionend', te);
      d.removeAttribute('open');
    });
  };

  // Single-open behavior + smooth animation on click
  detailsEls.forEach(d => {
    const summary = d.querySelector('summary');
    summary?.addEventListener('click', (ev) => {
      ev.preventDefault(); // take over the default instant toggle

      if (d.hasAttribute('open')) {
        // close current
        closeItem(d);
      } else {
        // close any other open item first
        detailsEls.forEach(other => {
          if (other !== d && other.hasAttribute('open')) closeItem(other);
        });
        // open clicked item
        openItem(d);
      }
    });
  });
})();
