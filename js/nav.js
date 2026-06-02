(function () {
  var navHTML = '\
<nav>\
  <a href="/" class="logo"><img src="/images/clawcamp-logo.svg" alt="ClawCamp" class="logo-img"></a>\
  <div class="nav-links">\
    <a href="/events" data-nav>Events</a>\
    <a href="/curriculum" data-nav>Learn</a>\
    <a href="/speakers" data-nav>Mentor</a>\
    <a href="/sponsors" data-nav>Sponsor</a>\
    <a href="/host" data-nav>Host</a>\
    <div class="nav-more">\
      <button class="nav-more-label">About <span class="chevron">&#9662;</span></button>\
      <div class="nav-more-dropdown">\
        <a href="/about" data-nav>About ClawCamp</a>\
        <a href="/formats" data-nav>Formats</a>\
        <a href="/staff" data-nav>Leadership</a>\
        <a href="/startups" data-nav>Startup Program</a>\
      </div>\
    </div>\
    <a href="/get-involved" class="nav-cta">Sign Up / Sign In &rarr;</a>\
  </div>\
  <button class="nav-hamburger" aria-label="Menu">&#9776;</button>\
</nav>';

  var footerHTML = '\
<footer class="site-footer">\
  <div class="footer-inner">\
    <div class="footer-brand">\
      <a href="/" class="logo"><img src="/images/clawcamp-logo.svg" alt="ClawCamp" class="logo-img logo-img-footer"></a>\
      <p class="footer-tagline">A global network of AI builder camps &mdash; workshops, demo days, hackathons, and startup showcases for the OpenClaw community.</p>\
    </div>\
    <div class="footer-links">\
      <div class="footer-col">\
        <h4>Pages</h4>\
        <a href="/events">Schedule</a>\
        <a href="/speakers">Speakers</a>\
        <a href="/sponsors">Sponsors</a>\
        <a href="/host">Start a Camp</a>\
        <a href="/startups">Startup Program</a>\
        <a href="/about">About ClawCamp</a>\
        <a href="/formats">Formats</a>\
        <a href="/staff">Leadership</a>\
        <a href="/curriculum">Curriculum</a>\
      </div>\
      <div class="footer-col">\
        <h4>Connect</h4>\
        <a href="mailto:hello@claw.camp">hello@claw.camp</a>\
        <a href="mailto:events@claw.camp">events@claw.camp</a>\
        <a href="https://discord.gg/clawcamp" target="_blank">Discord</a>\
        <a href="https://linkedin.com/company/clawcamp" target="_blank">LinkedIn</a>\
        <a href="https://x.com/clawcamp" target="_blank">X</a>\
      </div>\
    </div>\
  </div>\
  <div class="footer-bottom">\
    <p>&copy; 2026 ClawCamp. Built by <a href="https://dabl.club" target="_blank">Dabl.club</a> and <a href="https://aiify.io" target="_blank">Aiify.io</a>.</p>\
  </div>\
</footer>';

  // If a Supabase magic-link lands on any page other than /dashboard, redirect
  // there so the token can be exchanged properly. This happens when the
  // emailRedirectTo URL doesn't match the whitelisted redirect URLs in
  // Supabase Auth settings, causing Supabase to fall back to the site root.
  (function () {
    var hash = window.location.hash;
    var isDashboard = window.location.pathname.replace(/\/$/, '') === '/dashboard';
    if (!isDashboard && hash && hash.indexOf('access_token=') !== -1) {
      window.location.replace('/dashboard' + hash);
    }
  })();

  document.addEventListener('DOMContentLoaded', function () {
    var navEl = document.getElementById('site-nav');
    var footerEl = document.getElementById('site-footer');
    if (navEl) navEl.innerHTML = navHTML;
    if (footerEl) footerEl.innerHTML = footerHTML;

    // Active state
    var path = window.location.pathname.replace(/\/index\.html$/, '').replace(/\/$/, '') || '/';
    document.querySelectorAll('nav a[data-nav], .nav-more-dropdown a[data-nav]').forEach(function (link) {
      var href = link.getAttribute('href').replace(/\/$/, '');
      if (path === href || (href === '/' && path === '')) {
        link.classList.add('nav-link-active');
        // If active link is inside More dropdown, also highlight the More button
        var moreParent = link.closest('.nav-more');
        if (moreParent) {
          moreParent.querySelector('.nav-more-label').classList.add('nav-link-active');
        }
      }
    });

    // More dropdown toggle
    var moreBtn = document.querySelector('.nav-more-label');
    var moreContainer = document.querySelector('.nav-more');
    if (moreBtn && moreContainer) {
      moreBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        moreContainer.classList.toggle('open');
      });
      document.addEventListener('click', function () {
        moreContainer.classList.remove('open');
      });
    }

    // Transparent nav until scroll
    var navNode = document.querySelector('nav');
    if (navNode) {
      function checkScroll() {
        if (window.scrollY > 10) {
          navNode.classList.add('nav-scrolled');
        } else {
          navNode.classList.remove('nav-scrolled');
        }
      }
      window.addEventListener('scroll', checkScroll, { passive: true });
      checkScroll();
    }

    // Mobile hamburger
    var hamburger = document.querySelector('.nav-hamburger');
    var navLinks = document.querySelector('.nav-links');
    if (hamburger && navLinks) {
      hamburger.addEventListener('click', function () {
        var isOpen = navLinks.classList.toggle('nav-open');
        if (navNode) navNode.classList.toggle('menu-open', isOpen);
        hamburger.textContent = isOpen ? '\u2715' : '\u2630';
        hamburger.setAttribute('aria-label', isOpen ? 'Close menu' : 'Menu');
      });
    }
  });
})();
