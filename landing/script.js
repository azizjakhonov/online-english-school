/* =====================================================
   BrightPath Landing Page — Interactive JavaScript
   ===================================================== */

'use strict';

/* ===== NAVBAR: Scroll state & hamburger ===== */
(function initNav() {
  const header    = document.getElementById('site-header');
  const hamburger = document.getElementById('hamburger');
  const nav       = document.getElementById('main-nav');

  // Sticky scroll shadow
  window.addEventListener('scroll', () => {
    header.classList.toggle('scrolled', window.scrollY > 20);
  }, { passive: true });

  // Hamburger toggle
  hamburger.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    hamburger.setAttribute('aria-expanded', String(open));
    hamburger.classList.toggle('active', open);
  });

  // Close nav when a link is clicked
  nav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      nav.classList.remove('open');
      hamburger.classList.remove('active');
    });
  });
})();


/* ===== SCROLL REVEAL ===== */
(function initReveal() {
  const elements = document.querySelectorAll('[data-reveal]');

  if (!elements.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        // Staggered delay within a parent container
        const siblings = Array.from(entry.target.parentElement.querySelectorAll('[data-reveal]:not(.revealed)'));
        const delay = siblings.indexOf(entry.target) * 80;

        setTimeout(() => {
          entry.target.classList.add('revealed');
        }, Math.min(delay, 400));

        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.12,
    rootMargin: '0px 0px -40px 0px',
  });

  elements.forEach(el => observer.observe(el));
})();


/* ===== PLATFORM SHOWCASE TABS ===== */
(function initTabs() {
  const tabBtns   = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;

      // Update buttons
      tabBtns.forEach(b => b.classList.remove('tab-active'));
      btn.classList.add('tab-active');

      // Update panels
      tabPanels.forEach(panel => {
        panel.classList.remove('panel-active');
      });

      const targetPanel = document.getElementById('tab-' + target);
      if (targetPanel) {
        targetPanel.classList.add('panel-active');
      }
    });
  });
})();


/* ===== PRICING TOGGLE (Monthly / Yearly) ===== */
(function initPricing() {
  const toggleBtns = document.querySelectorAll('.pt-btn');
  const amounts    = document.querySelectorAll('.prc-amount');

  toggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const cycle = btn.dataset.cycle;

      toggleBtns.forEach(b => b.classList.remove('pt-active'));
      btn.classList.add('pt-active');

      amounts.forEach(el => {
        const val = el.dataset[cycle];
        if (val) {
          animateValue(el, parseInt(el.textContent, 10), parseInt(val, 10), 400);
        }
      });
    });
  });

  function animateValue(el, from, to, duration) {
    const startTime = performance.now();
    function step(currentTime) {
      const elapsed  = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased    = easeOutCubic(progress);
      el.textContent = Math.round(from + (to - from) * eased);
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }
})();


/* ===== FAQ ACCORDION ===== */
(function initFAQ() {
  const faqItems = document.querySelectorAll('.faq-item');

  faqItems.forEach(item => {
    const question = item.querySelector('.faq-question');
    const answer   = item.querySelector('.faq-answer');

    question.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');

      // Close all
      faqItems.forEach(i => {
        i.classList.remove('open');
      });

      // Open clicked (if it was closed)
      if (!isOpen) {
        item.classList.add('open');
        answer.style.maxHeight = answer.scrollHeight + 'px';
      }

      // Reset heights for closed items
      faqItems.forEach(i => {
        if (!i.classList.contains('open')) {
          i.querySelector('.faq-answer').style.maxHeight = '0';
        }
      });

      if (!isOpen) {
        answer.style.maxHeight = answer.scrollHeight + 'px';
      }
    });
  });
})();


/* ===== ANIMATED COUNTERS ===== */
(function initCounters() {
  const counters = document.querySelectorAll('.stat-count');

  if (!counters.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;

      const el     = entry.target;
      const target = parseInt(el.dataset.target, 10);
      const duration = 1800;
      const startTime = performance.now();

      function step(currentTime) {
        const elapsed  = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased    = easeOutCubic(progress);
        const current  = Math.floor(eased * target);
        el.textContent = formatNumber(current);
        if (progress < 1) requestAnimationFrame(step);
      }

      requestAnimationFrame(step);
      observer.unobserve(el);
    });
  }, { threshold: 0.5 });

  counters.forEach(counter => observer.observe(counter));

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function formatNumber(n) {
    if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'k';
    return n.toString();
  }
})();


/* ===== SMOOTH SCROLL for anchor links ===== */
(function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', e => {
      const href = link.getAttribute('href');
      if (href === '#') return;

      const target = document.querySelector(href);
      if (!target) return;

      e.preventDefault();

      const headerHeight = 68;
      const targetTop = target.getBoundingClientRect().top + window.scrollY - headerHeight - 16;

      window.scrollTo({ top: targetTop, behavior: 'smooth' });
    });
  });
})();


/* ===== HAMBURGER CSS animation helper ===== */
(function() {
  const style = document.createElement('style');
  style.textContent = `
    .hamburger.active span:nth-child(1) { transform: translateY(7px) rotate(45deg); }
    .hamburger.active span:nth-child(2) { opacity: 0; transform: scaleX(0); }
    .hamburger.active span:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }
    .hamburger span { transition: transform 0.25s ease, opacity 0.25s ease; transform-origin: center; }
  `;
  document.head.appendChild(style);
})();


/* ===== LIVE CLASSROOM: animated typing dots (in wb-canvas) ===== */
(function initLiveEffects() {
  // The wb-canvas SVG already has an animated circle via SVG animation.
  // Add a subtle random lesson timer tick
  const timer = document.querySelector('.cu-timer');
  if (!timer) return;

  let [min, sec] = timer.textContent.split(':').map(Number);

  setInterval(() => {
    sec++;
    if (sec >= 60) { sec = 0; min++; }
    timer.textContent = String(min).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
  }, 1000);
})();
