// Reusable horizontal "Upcoming Events" carousel (arrows + dots).
// window.renderEventCard(ev)   — ev: {name, dateText, location, desc, link, image, ctaText}
// window.buildEventCarousel(container, events) — returns true if it rendered cards.
(function () {
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  window.renderEventCard = function (ev) {
    var a = el('a', 'ev-card');
    a.href = ev.link || '#';
    if (ev.link) { a.target = '_blank'; a.rel = 'noopener'; }
    if (ev.image) {
      var img = el('img', 'ev-card-img');
      img.src = ev.image; img.alt = ev.name || ''; img.loading = 'lazy';
      img.onerror = function () {
        var ph = el('div', 'ev-card-imgph', '🦞');
        if (img.parentNode) img.parentNode.replaceChild(ph, img);
      };
      a.appendChild(img);
    } else {
      a.appendChild(el('div', 'ev-card-imgph', '🦞'));
    }
    var body = el('div', 'ev-card-body');
    body.appendChild(el('div', 'ev-card-title', ev.name || 'Event'));
    if (ev.dateText) body.appendChild(el('div', 'ev-card-meta', '📅 ' + ev.dateText));
    if (ev.location) body.appendChild(el('div', 'ev-card-meta', '📍 ' + ev.location));
    if (ev.desc) body.appendChild(el('div', 'ev-card-desc', ev.desc));
    body.appendChild(el('span', 'ev-card-cta', ev.ctaText || 'View →'));
    a.appendChild(body);
    return a;
  };

  window.buildEventCarousel = function (container, events) {
    if (!container) return false;
    container.textContent = '';
    if (!events || !events.length) return false;

    var wrap = el('div', 'ev-carousel');
    var track = el('div', 'ev-carousel-track');
    events.forEach(function (ev) { track.appendChild(window.renderEventCard(ev)); });
    wrap.appendChild(track);

    var prev = el('button', 'ev-carousel-arrow prev', '‹'); prev.type = 'button';
    prev.setAttribute('aria-label', 'Previous');
    var next = el('button', 'ev-carousel-arrow next', '›'); next.type = 'button';
    next.setAttribute('aria-label', 'Next');
    wrap.appendChild(prev); wrap.appendChild(next);

    var dots = el('div', 'ev-carousel-dots');
    container.appendChild(wrap);
    container.appendChild(dots);

    function pageCount() {
      if (!track.clientWidth) return 1;
      return Math.max(1, Math.round(track.scrollWidth / track.clientWidth));
    }
    function rebuildDots() {
      dots.textContent = '';
      var n = pageCount();
      if (n <= 1) { prev.style.display = 'none'; next.style.display = 'none'; dots.style.display = 'none'; return; }
      prev.style.display = ''; next.style.display = ''; dots.style.display = '';
      for (var i = 0; i < n; i++) {
        (function (i) {
          var b = el('button', 'ev-carousel-dot'); b.type = 'button';
          b.setAttribute('aria-label', 'Page ' + (i + 1));
          b.addEventListener('click', function () { track.scrollTo({ left: i * track.clientWidth, behavior: 'smooth' }); });
          dots.appendChild(b);
        })(i);
      }
    }
    function update() {
      prev.disabled = track.scrollLeft <= 4;
      next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
      var idx = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
      Array.prototype.forEach.call(dots.children, function (d, i) { d.classList.toggle('active', i === idx); });
    }
    prev.addEventListener('click', function () { track.scrollBy({ left: -track.clientWidth, behavior: 'smooth' }); });
    next.addEventListener('click', function () { track.scrollBy({ left: track.clientWidth, behavior: 'smooth' }); });
    track.addEventListener('scroll', function () { window.requestAnimationFrame(update); });
    window.addEventListener('resize', function () { rebuildDots(); update(); });
    // Defer one frame so layout (scrollWidth/clientWidth) is measured.
    window.requestAnimationFrame(function () { rebuildDots(); update(); });
    return true;
  };
})();
