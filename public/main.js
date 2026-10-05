// 6thzone — interactions
(function () {
  'use strict';

  var C = window.SITE_CONTENT.en;
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- sculpture: clone the template into every slot ---------- */
  var tpl = document.getElementById('sculpture-template');
  document.querySelectorAll('.sculpture-slot').forEach(function (slot) {
    var node = tpl.content.cloneNode(true);
    var svg = node.querySelector('svg');
    slot.appendChild(svg);
    if (slot.classList.contains('always-connected')) slot.classList.add('zones-connected');
  });

  /* ---------- navigation (desktop + footer) ---------- */
  function navLinks(filter) {
    return C.nav.map(function (item) { return '<a href="' + item.href + '">' + item.label + '</a>'; }).join('');
  }
  var mainNav = document.getElementById('main-nav');
  var footerNav = document.getElementById('footer-nav');
  mainNav.innerHTML = navLinks();
  footerNav.innerHTML =
    C.nav.filter(function (i) { return i.href !== '#top'; })
      .map(function (i) { return '<a href="' + i.href + '">' + i.label + '</a>'; }).join('') +
    '<a href="/privacy.html">' + C.footer.privacy + '</a>';

  var menuToggle = document.getElementById('menu-toggle');
  menuToggle.addEventListener('click', function () {
    var open = mainNav.classList.toggle('open');
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.textContent = open ? 'Close' : 'Menu';
  });
  mainNav.addEventListener('click', function (e) {
    if (e.target.tagName === 'A' && mainNav.classList.contains('open')) menuToggle.click();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && mainNav.classList.contains('open')) menuToggle.click();
  });

  /* ---------- hero content ---------- */
  document.getElementById('hero-pill').textContent = C.hero.pill;
  document.getElementById('hero-lede').textContent = C.hero.lede;
  document.getElementById('hero-facts').innerHTML = C.hero.facts.map(function (f) {
    return '<div class="fact"><span class="fact-num">' + f.num + '</span><span class="fact-label">' + f.label + '</span></div>';
  }).join('');

  /* ---------- scroll reveals ---------- */
  var reveals = document.querySelectorAll('.reveal');
  if (reducedMotion || !('IntersectionObserver' in window)) {
    reveals.forEach(function (el) { el.classList.add('in-view'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add('in-view'); io.unobserve(entry.target); }
      });
    }, { threshold: 0.12 });
    reveals.forEach(function (el) { io.observe(el); });
  }

  /* ---------- hero: subtle synchronized parallax on base photo + cutout (one unit, no seams) ---------- */
  var heroMedia = document.querySelector('.hero-media');
  if (!reducedMotion && heroMedia) {
    window.addEventListener('scroll', function () {
      var rect = heroMedia.getBoundingClientRect();
      var shift = Math.max(-24, Math.min(24, -rect.top * 0.04));
      heroMedia.style.setProperty('--py', shift.toFixed(1) + 'px');
    }, { passive: true });
  }

  /* ---------- the sixth zone: zones + connect toggle ---------- */
  var track = document.getElementById('zones-track');
  track.innerHTML = C.zones.map(function (z) {
    return '<button type="button" class="zone" aria-label="' + z.name + ' zone">' +
      '<span class="zone-num">' + z.num + '</span>' +
      '<span class="zone-name">' + z.name + '</span>' +
      '<span class="zone-app">' + z.application + '</span>' +
      '</button>';
  }).join('');
  track.addEventListener('click', function (e) {
    var zone = e.target.closest('.zone');
    if (!zone) return;
    var wasActive = zone.classList.contains('active');
    track.querySelectorAll('.zone.active').forEach(function (z) { z.classList.remove('active'); });
    if (!wasActive) zone.classList.add('active');
  });

  var sixthSection = document.getElementById('sixth-zone');
  var zoneSixth = document.getElementById('zone-sixth');
  var connectBtn = document.getElementById('connect-zone');
  connectBtn.textContent = C.zoneSixth.button;
  connectBtn.addEventListener('click', function () {
    var on = sixthSection.classList.toggle('connected');
    zoneSixth.hidden = !on;
    connectBtn.setAttribute('aria-pressed', String(on));
    connectBtn.textContent = on ? C.zoneSixth.buttonReset : C.zoneSixth.button;
  });

  /* ---------- services ---------- */
  var cardsEl = document.getElementById('service-cards');
  cardsEl.innerHTML = C.services.map(function (s) {
    return '<article class="service-card' + (s.dark ? ' dark' : '') + '" data-service="' + s.id + '">' +
      '<button type="button" class="service-toggle" aria-expanded="false" aria-controls="details-' + s.id + '">' +
      '<span class="service-num">' + s.id + '</span>' +
      '<span class="service-title">' + s.titleHTML + '</span>' +
      '<span class="service-arrow" aria-hidden="true">↗</span>' +
      '</button>' +
      '<p class="service-summary">' + s.summary + '</p>' +
      '<div class="service-details" id="details-' + s.id + '"><p>' + s.details + '</p></div>' +
      '</article>';
  }).join('');

  var servicesLabel = document.getElementById('services-label');
  var servicesVisual = document.querySelector('.services-visual');
  servicesLabel.textContent = C.servicesVisualLabel;
  cardsEl.addEventListener('click', function (e) {
    var toggle = e.target.closest('.service-toggle');
    if (!toggle) return;
    var card = toggle.closest('.service-card');
    var wasExpanded = card.classList.contains('expanded');
    cardsEl.querySelectorAll('.service-card.expanded').forEach(function (c) {
      c.classList.remove('expanded');
      c.querySelector('.service-toggle').setAttribute('aria-expanded', 'false');
    });
    if (!wasExpanded) {
      card.classList.add('expanded');
      toggle.setAttribute('aria-expanded', 'true');
      var s = C.services.find(function (x) { return x.id === card.dataset.service; });
      servicesLabel.textContent = C.servicesVisualSelected + ' — ' + s.id + ' · ' + s.name;
      servicesVisual.setAttribute('data-active', s.id);
    } else {
      servicesLabel.textContent = C.servicesVisualLabel;
      servicesVisual.removeAttribute('data-active');
    }
  });

  /* ---------- why: principles ---------- */
  document.getElementById('principles').innerHTML =
    C.why.principles.map(function (p) { return '<li>' + p + '</li>'; }).join('');

  /* ---------- applications ---------- */
  var ILLUS = {
    website: '<svg viewBox="0 0 240 140" fill="none"><rect x="30" y="26" width="110" height="78" rx="8" stroke="#111" stroke-width="2"/><line x1="30" y1="44" x2="140" y2="44" stroke="#111" stroke-width="2"/><circle cx="40" cy="35" r="2.5" fill="#111"/><circle cx="49" cy="35" r="2.5" fill="#111"/><rect x="42" y="56" width="58" height="6" rx="3" fill="#DADAD6"/><rect x="42" y="68" width="72" height="6" rx="3" fill="#DADAD6"/><rect x="42" y="84" width="40" height="6" rx="3" fill="#F36B32"/><path d="M150 64h34" stroke="#F36B32" stroke-width="2" stroke-dasharray="4 5"/><path d="M180 58l8 6-8 6" stroke="#F36B32" stroke-width="2"/><rect x="192" y="44" width="30" height="40" rx="6" stroke="#111" stroke-width="2"/><circle cx="207" cy="62" r="6" fill="#F36B32"/><line x1="196" y1="76" x2="218" y2="76" stroke="#111" stroke-width="2"/></svg>',
    assistant: '<svg viewBox="0 0 240 140" fill="none"><rect x="34" y="26" width="76" height="92" rx="8" stroke="#111" stroke-width="2"/><line x1="46" y1="46" x2="98" y2="46" stroke="#DADAD6" stroke-width="3"/><line x1="46" y1="60" x2="90" y2="60" stroke="#DADAD6" stroke-width="3"/><line x1="46" y1="74" x2="98" y2="74" stroke="#DADAD6" stroke-width="3"/><circle cx="150" cy="66" r="22" stroke="#F36B32" stroke-width="2.5"/><line x1="166" y1="82" x2="182" y2="98" stroke="#F36B32" stroke-width="2.5" stroke-linecap="round"/><rect x="150" y="106" width="60" height="8" rx="4" fill="#DADAD6"/><rect x="150" y="106" width="38" height="8" rx="4" fill="#111"/></svg>',
    workflow: '<svg viewBox="0 0 240 140" fill="none"><circle cx="48" cy="70" r="14" stroke="#111" stroke-width="2"/><circle cx="120" cy="40" r="14" stroke="#111" stroke-width="2"/><circle cx="120" cy="100" r="14" stroke="#111" stroke-width="2"/><path d="M60 62l48-16M60 78l48 16" stroke="#DADAD6" stroke-width="2"/><path d="M136 40h44" stroke="#F36B32" stroke-width="2" stroke-dasharray="4 5"/><path d="M136 100h44" stroke="#F36B32" stroke-width="2" stroke-dasharray="4 5"/><rect x="184" y="26" width="30" height="28" rx="6" stroke="#111" stroke-width="2"/><rect x="184" y="86" width="30" height="28" rx="6" stroke="#111" stroke-width="2"/><path d="M191 40l4 4 7-8" stroke="#F36B32" stroke-width="2"/></svg>',
  };
  document.getElementById('apps-grid').innerHTML = C.applications.map(function (a) {
    return '<article class="app-card">' +
      '<div class="app-illustration" aria-hidden="true">' + ILLUS[a.illus] + '</div>' +
      '<p class="app-tag">Illustrative application</p>' +
      '<h3>' + a.title + '</h3>' +
      '<p>' + a.body + '</p>' +
      '</article>';
  }).join('');
  document.getElementById('apps-note').textContent = C.applicationsNote;

  /* ---------- approach ---------- */
  document.getElementById('steps').innerHTML = C.approach.steps.map(function (s) {
    return '<li class="step"><span class="step-num">' + s.num + '</span><div><h3>' + s.name + '</h3><p>' + s.body + '</p></div></li>';
  }).join('');

  /* ---------- opportunity explorer ---------- */
  var dialog = document.getElementById('explorer');
  var explorerForm = document.getElementById('explorer-form');
  var explorerError = document.getElementById('explorer-error');
  var resultEl = document.getElementById('explorer-result');
  var resultTitle = document.getElementById('result-title');
  var resultCopy = document.getElementById('result-copy');
  var lastResult = null;

  var IMPROVE_SERVICE = {
    'Website and customer experience': '01',
    'Repetitive tasks': '02',
    'Finding information': '03',
    'Connected workflows': '02',
    'Not sure yet': '04',
  };

  function resetExplorer() {
    explorerForm.hidden = false;
    resultEl.hidden = true;
    explorerError.hidden = true;
    lastResult = null;
  }

  document.querySelectorAll('[data-open-explorer]').forEach(function (btn) {
    btn.addEventListener('click', function () { resetExplorer(); dialog.showModal(); });
  });
  dialog.querySelectorAll('[data-close-explorer]').forEach(function (btn) {
    btn.addEventListener('click', function () { dialog.close(); });
  });
  dialog.addEventListener('close', function () { window.setTimeout(resetExplorer, 150); });

  explorerForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var data = new FormData(explorerForm);
    var area = data.get('area');
    var improve = data.get('improve');
    if (!area || !improve) { explorerError.hidden = false; return; }
    explorerError.hidden = true;

    var serviceId = IMPROVE_SERVICE[improve] || '04';
    var s = C.services.find(function (x) { return x.id === serviceId; });
    lastResult = { serviceId: s.id, area: area, improve: improve, notes: (data.get('notes') || '').trim() };
    resultTitle.textContent = s.id + ' — ' + s.name;
    resultCopy.textContent = 'Because you selected ' + area + ' and want to improve ' + improve.toLowerCase() +
      ', a practical first step is ' + s.name.toLowerCase() + '. ' + s.details;
    explorerForm.hidden = true;
    resultEl.hidden = false;
  });

  document.getElementById('discuss-btn').addEventListener('click', function () {
    if (!lastResult) return;
    var form = document.getElementById('contact-form');
    form.elements.service.value = lastResult.serviceId;
    var context = 'Opportunity explorer — Area: ' + lastResult.area + '. Improvement: ' + lastResult.improve + '.';
    if (lastResult.notes) context += ' Challenge: ' + lastResult.notes;
    if (!form.elements.description.value) form.elements.description.value = context;
    dialog.close();
    document.getElementById('contact').scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
    window.setTimeout(function () { form.elements.name.focus(); }, reducedMotion ? 0 : 600);
  });

  /* ---------- contact form ---------- */
  var contactForm = document.getElementById('contact-form');
  var formStatus = document.getElementById('form-status');

  function setStatus(message, cls) {
    formStatus.textContent = message;
    formStatus.className = 'form-status' + (cls ? ' is-' + cls : '');
  }

  contactForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!contactForm.elements.name.value.trim() || !contactForm.elements.email.value.trim()) {
      setStatus('Please add your name and work email.', 'error');
      return;
    }
    var payload = {};
    ['name', 'email', 'company', 'phone', 'service', 'description'].forEach(function (k) {
      payload[k] = contactForm.elements[k] ? contactForm.elements[k].value.trim() : '';
    });
    setStatus(C.contact.loading, 'loading');
    var submitBtn = contactForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    try {
      var res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      var out = {};
      try { out = await res.json(); } catch (err) { /* non-JSON response */ }
      if (res.ok && out.ok) {
        contactForm.reset();
        setStatus(C.contact.success, 'success');
      } else {
        setStatus(out.error || 'Something went wrong. Please try again.', 'error');
      }
    } catch (err) {
      setStatus('Submission is currently unavailable. Please try again later.', 'error');
    } finally {
      submitBtn.disabled = false;
    }
  });
})();
