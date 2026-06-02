(function () {
  var navHTML = '\
<nav>\
  <a href="/" class="logo"><img src="/images/clawcamp-logo.svg" alt="ClawCamp" class="logo-img"></a>\
  <div class="nav-links">\
    <a href="/events" data-nav>Events</a>\
    <a href="/chapters" data-nav>Chapters</a>\
    <a href="/curriculum" data-nav>Tutorials</a>\
    <a href="/speakers" data-nav>Speakers</a>\
    <a href="/sponsors" data-nav>Sponsors</a>\
    <a href="/host" data-nav>Localhosts</a>\
    <div class="nav-more">\
      <button class="nav-more-label">More <span class="chevron">&#9662;</span></button>\
      <div class="nav-more-dropdown">\
        <a href="/about" data-nav>About ClawCamp</a>\
        <a href="/formats" data-nav>Formats</a>\
        <a href="/staff" data-nav>Leadership</a>\
        <a href="/startups" data-nav>Startup Program</a>\
      </div>\
    </div>\
    <button class="theme-toggle" id="theme-toggle" aria-label="Toggle dark mode" title="Toggle dark mode"></button>\
    <a href="/get-involved" class="nav-cta" id="nav-cta-btn">Sign Up / Sign In &rarr;</a>\
  </div>\
  <button class="nav-hamburger" aria-label="Menu">&#9776;</button>\
</nav>';

  var footerHTML = '\
<div class="newsletter-strip" id="newsletter-strip">\
  <span class="newsletter-label">Subscribe to our Newsletter</span>\
  <form class="newsletter-form" id="newsletter-form" onsubmit="clawNewsletter(event)">\
    <input type="email" class="newsletter-input" placeholder="Enter your email" required id="newsletter-email">\
    <button type="submit" class="newsletter-btn">Subscribe</button>\
  </form>\
  <p class="newsletter-msg" id="newsletter-msg"></p>\
</div>\
<footer class="site-footer">\
  <div class="footer-inner">\
    <div class="footer-brand">\
      <a href="/" class="logo"><img src="/images/clawcamp-logo.svg" alt="ClawCamp" class="logo-img logo-img-footer"></a>\
      <p class="footer-tagline">A global network of AI builder camps &mdash; workshops, demo days, hackathons, and startup showcases for the OpenClaw community.</p>\
    </div>\
    <div class="footer-links">\
      <div class="footer-col">\
        <h4>Explore</h4>\
        <a href="/events">Events Calendar</a>\
        <a href="/chapters">Chapters</a>\
        <a href="/curriculum">Workshops &amp; Guides</a>\
        <a href="/speakers">Speakers &amp; Mentors</a>\
        <a href="/sponsors">Sponsors &amp; Partners</a>\
        <a href="/host">Start a Camp</a>\
        <a href="/startups">Startup Program</a>\
        <a href="/about">About ClawCamp</a>\
      </div>\
      <div class="footer-col">\
        <h4>Connect</h4>\
        <a href="mailto:hello@claw.camp">hello@claw.camp</a>\
        <a href="mailto:events@claw.camp">events@claw.camp</a>\
        <a href="https://discord.gg/clawcamp" target="_blank">Discord</a>\
        <a href="https://linkedin.com/company/clawcamp" target="_blank">LinkedIn</a>\
        <a href="https://x.com/clawcamp" target="_blank">X / Twitter</a>\
        <a href="https://lu.ma/ClawCamp" target="_blank">Luma Calendar</a>\
      </div>\
    </div>\
  </div>\
  <div class="footer-bottom">\
    <p>&copy; 2026 ClawCamp. Built by <a href="https://dabl.club" target="_blank">Dabl.club</a> and <a href="https://aiify.io" target="_blank">Aiify.io</a>.</p>\
  </div>\
</footer>';

  // Magic-link intercept: if any page (other than /dashboard) receives
  // a Supabase auth hash, redirect to /dashboard to exchange the token.
  (function () {
    var hash = window.location.hash;
    var isDashboard = window.location.pathname.replace(/\/$/, '') === '/dashboard';
    if (!isDashboard && hash && hash.indexOf('access_token=') !== -1) {
      window.location.replace('/dashboard' + hash);
    }
  })();

  // ---- Dark / light theme ----
  // First paint is handled by the inline <head> bootstrap (sets data-theme
  // before CSS applies, so there's no flash). These helpers handle toggling
  // and keeping the button icon in sync.
  function clawCurrentTheme() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }
  function clawApplyTheme(theme) {
    if (theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');
    try { localStorage.setItem('claw-theme', theme); } catch (e) {}
    var btn = document.getElementById('theme-toggle');
    if (btn) {
      // Show the icon for the action the click performs.
      btn.textContent = theme === 'dark' ? '☀️' : '\u{1F319}';
      btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
      btn.setAttribute('title', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    }
  }
  window.clawToggleTheme = function () {
    clawApplyTheme(clawCurrentTheme() === 'dark' ? 'light' : 'dark');
  };

  // Newsletter subscribe (uses contacts table sub_newsletter flag)
  window.clawNewsletter = function(e) {
    e.preventDefault();
    var email = document.getElementById('newsletter-email').value.trim();
    var msg = document.getElementById('newsletter-msg');
    var btn = document.querySelector('.newsletter-btn');
    if (!email) return;
    btn.disabled = true;
    btn.textContent = 'Subscribing...';
    var SUPABASE_URL = 'https://mrnccntqmkxjazznejfc.supabase.co';
    var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ybmNjbnRxbWt4amF6em5lamZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMDA3NTksImV4cCI6MjA5MDc3Njc1OX0.T6oFTtYiFTsx6ojuogpZFXAS7tN5-dPzwvmY5V2xFGI';
    // Upsert by email — sets sub_newsletter=true, form_type=newsletter
    fetch(SUPABASE_URL + '/rest/v1/contacts', {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=minimal'
      },
      body: JSON.stringify({ email: email, sub_newsletter: true, form_type: 'newsletter', email_opt_in: true })
    }).then(function(r) {
      if (r.ok || r.status === 201 || r.status === 200) {
        msg.textContent = 'You\'re subscribed! ✓';
        msg.style.color = '#2d4a2f';
        document.getElementById('newsletter-email').value = '';
      } else {
        msg.textContent = 'Something went wrong. Try again.';
        msg.style.color = '#c4500a';
      }
      btn.disabled = false;
      btn.textContent = 'Subscribe';
    }).catch(function() {
      msg.textContent = 'Something went wrong. Try again.';
      msg.style.color = '#c4500a';
      btn.disabled = false;
      btn.textContent = 'Subscribe';
    });
  };

  document.addEventListener('DOMContentLoaded', function () {
    var navEl = document.getElementById('site-nav');
    var footerEl = document.getElementById('site-footer');
    if (navEl) navEl.innerHTML = navHTML;
    if (footerEl) footerEl.innerHTML = footerHTML;

    // Theme toggle: sync the icon to the current theme + wire the click.
    clawApplyTheme(clawCurrentTheme());
    var themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) themeBtn.addEventListener('click', window.clawToggleTheme);

    // Active state
    var path = window.location.pathname.replace(/\/index\.html$/, '').replace(/\/$/, '') || '/';
    document.querySelectorAll('nav a[data-nav], .nav-more-dropdown a[data-nav]').forEach(function (link) {
      var href = link.getAttribute('href').replace(/\/$/, '');
      if (path === href || (href !== '/' && path.startsWith(href))) {
        link.classList.add('nav-link-active');
        var moreParent = link.closest('.nav-more');
        if (moreParent) {
          moreParent.querySelector('.nav-more-label').classList.add('nav-link-active');
        }
      }
    });

    // Update nav CTA if user is logged in (swap to Dashboard link)
    if (window.clawAuth) {
      clawAuth.getSession().then(function(result) {
        if (result && result.data && result.data.session) {
          var btn = document.getElementById('nav-cta-btn');
          if (btn) {
            btn.textContent = 'Dashboard →';
            btn.href = '/dashboard';
          }
        }
      }).catch(function(){});
    }

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
        hamburger.textContent = isOpen ? '✕' : '☰';
        hamburger.setAttribute('aria-label', isOpen ? 'Close menu' : 'Menu');
      });
    }

    // "Happening now" badges — scan all .event-row elements on the page
    (function addLiveBadges() {
      var now = new Date();
      var todayStr = now.getFullYear() + '-' +
        String(now.getMonth() + 1).padStart(2, '0') + '-' +
        String(now.getDate()).padStart(2, '0');
      document.querySelectorAll('.event-row[data-date]').forEach(function(row) {
        if (row.dataset.date !== todayStr) return;
        var meta = row.querySelector('.event-meta');
        if (!meta) return;
        // Check if a live badge already exists
        if (meta.querySelector('.live-badge')) return;
        var badge = document.createElement('span');
        badge.className = 'live-badge';
        badge.innerHTML = '<span class="live-dot"></span>Happening today';
        meta.insertBefore(badge, meta.firstChild);
      });
    })();
  });
})();
