// ClawCamp Supabase Form Handler — Unified CRM
(function () {
  var SUPABASE_URL = 'https://mrnccntqmkxjazznejfc.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ybmNjbnRxbWt4amF6em5lamZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMDA3NTksImV4cCI6MjA5MDc3Njc1OX0.T6oFTtYiFTsx6ojuogpZFXAS7tN5-dPzwvmY5V2xFGI';

  function normalizeUrl(val) {
    if (!val) return val;
    val = val.trim();
    if (!val) return val;
    if (!/^https?:\/\//i.test(val)) val = 'https://' + val;
    return val;
  }

  function submitToSupabase(data, form) {
    // Auto-prepend https:// to URL fields
    ['website', 'linkedin', 'event_link'].forEach(function(k) {
      if (data[k]) data[k] = normalizeUrl(data[k]);
    });
    var submitBtn = form.querySelector('.form-submit');
    var originalText = submitBtn.textContent;
    submitBtn.textContent = 'Submitting...';
    submitBtn.disabled = true;

    fetch(SUPABASE_URL + '/rest/v1/contacts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
        // return=minimal so the insert response body is EMPTY. The row's
        // verification_token / magic_link_token must NEVER cross the wire to
        // an anon client (this was the live token-leak — see
        // supabase/migrations/0001_baseline.sql).
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(data)
    })
    .then(function (res) {
      if (res.ok) {
        // return=minimal -> no body to read. The verification email is now
        // sent SERVER-SIDE: the send-verification edge function triggers off
        // the INSERT and reads verification_token from the row inside the DB,
        // so the token is never exposed to the browser. (Edge function source
        // lives Supabase-side, not in this repo.)
        window.location.href = '/welcome';
      } else {
        return res.text().then(function (text) { throw new Error(text); });
      }
    })
    .catch(function (err) {
      console.error('Form submission error:', err);
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
      var errorMsg = form.querySelector('.form-error');
      if (!errorMsg) {
        errorMsg = document.createElement('p');
        errorMsg.className = 'form-error';
        errorMsg.style.cssText = 'color:#b22;font-size:14px;margin-top:8px;';
        submitBtn.parentNode.insertBefore(errorMsg, submitBtn.nextSibling);
      }
      errorMsg.textContent = 'Something went wrong. Please try again or email hello@claw.camp.';
    });
  }

  document.addEventListener('DOMContentLoaded', function () {

    // Host a Camp form
    var hostForm = document.getElementById('host-form');
    if (hostForm) {
      hostForm.addEventListener('submit', function (e) {
        e.preventDefault();
        submitToSupabase({
          form_type: 'host',
          name: hostForm.querySelector('[name="name"]').value,
          email: hostForm.querySelector('[name="email"]').value,
          phone: hostForm.querySelector('[name="phone"]').value,
          city: hostForm.querySelector('[name="city"]').value,
          format: hostForm.querySelector('[name="format"]').value,
          proposed_date: hostForm.querySelector('[name="proposed_date"]').value || null,
          venue: hostForm.querySelector('[name="venue"]').value,
          about: hostForm.querySelector('[name="about"]').value,
          event_details: hostForm.querySelector('[name="event_details"]').value,
          email_opt_in: hostForm.querySelector('[name="email_opt_in"]') ? hostForm.querySelector('[name="email_opt_in"]').checked : null
        }, hostForm);
      });
    }

    // Sponsor inquiry form
    var sponsorForm = document.getElementById('sponsor-form');
    if (sponsorForm) {
      sponsorForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var data = { form_type: 'sponsor' };
        var fields = ['contact_name','email','phone','company','tier','event','website','linkedin','bio','offers','message'];
        fields.forEach(function(f) {
          var el = sponsorForm.querySelector('[name="' + f + '"]');
          if (el) data[f === 'contact_name' ? 'name' : f] = el.value;
        });
        var optIn = sponsorForm.querySelector('[name="email_opt_in"]');
        if (optIn) data.email_opt_in = optIn.checked;
        submitToSupabase(data, sponsorForm);
      });
    }

    // Staff / Leadership application form
    var crewForm = document.getElementById('crew-form');
    if (crewForm) {
      crewForm.addEventListener('submit', function (e) {
        e.preventDefault();
        submitToSupabase({
          form_type: 'staff',
          name: crewForm.querySelector('[name="name"]').value,
          email: crewForm.querySelector('[name="email"]').value,
          phone: crewForm.querySelector('[name="phone"]').value,
          city: crewForm.querySelector('[name="city"]').value,
          role: crewForm.querySelector('[name="role"]').value,
          linkedin: crewForm.querySelector('[name="linkedin"]').value,
          experience: crewForm.querySelector('[name="experience"]').value,
          why: crewForm.querySelector('[name="why"]').value,
          email_opt_in: crewForm.querySelector('[name="email_opt_in"]') ? crewForm.querySelector('[name="email_opt_in"]').checked : null
        }, crewForm);
      });
    }

    // Speaker application form
    var speakerForm = document.getElementById('speaker-form');
    if (speakerForm) {
      speakerForm.addEventListener('submit', function (e) {
        e.preventDefault();
        submitToSupabase({
          form_type: 'speaker',
          name: speakerForm.querySelector('[name="name"]').value,
          email: speakerForm.querySelector('[name="email"]').value,
          phone: speakerForm.querySelector('[name="phone"]').value,
          company: speakerForm.querySelector('[name="company"]').value,
          title: speakerForm.querySelector('[name="title"]').value,
          event: speakerForm.querySelector('[name="event"]').value,
          format: speakerForm.querySelector('[name="format"]').value,
          linkedin: speakerForm.querySelector('[name="linkedin"]').value,
          topic: speakerForm.querySelector('[name="topic"]').value,
          bio: speakerForm.querySelector('[name="bio"]').value,
          offers: speakerForm.querySelector('[name="offers"]').value,
          email_opt_in: speakerForm.querySelector('[name="email_opt_in"]') ? speakerForm.querySelector('[name="email_opt_in"]').checked : null
        }, speakerForm);
      });
    }

    // Submit an Event form
    var eventForm = document.getElementById('event-form');
    if (eventForm) {
      eventForm.addEventListener('submit', function (e) {
        e.preventDefault();
        submitToSupabase({
          form_type: 'event',
          name: eventForm.querySelector('[name="name"]').value,
          email: eventForm.querySelector('[name="email"]').value,
          phone: eventForm.querySelector('[name="phone"]').value,
          city: eventForm.querySelector('[name="city"]').value,
          format: eventForm.querySelector('[name="format"]').value,
          proposed_date: eventForm.querySelector('[name="proposed_date"]').value || null,
          venue: eventForm.querySelector('[name="venue"]').value,
          event_link: eventForm.querySelector('[name="event_link"]').value,
          event_details: eventForm.querySelector('[name="event_details"]').value,
          email_opt_in: eventForm.querySelector('[name="email_opt_in"]') ? eventForm.querySelector('[name="email_opt_in"]').checked : null
        }, eventForm);
      });
    }

    // Camper Registration form
    var camperForm = document.getElementById('camper-form');
    if (camperForm) {
      camperForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var interests = [];
        camperForm.querySelectorAll('[name^="interest_"]:checked').forEach(function (cb) {
          interests.push(cb.name.replace('interest_', ''));
        });
        submitToSupabase({
          form_type: 'camper',
          name: camperForm.querySelector('[name="name"]').value,
          email: camperForm.querySelector('[name="email"]').value,
          phone: camperForm.querySelector('[name="phone"]').value,
          city: camperForm.querySelector('[name="city"]').value,
          role: camperForm.querySelector('[name="role"]').value,
          experience_level: camperForm.querySelector('[name="experience_level"]').value,
          interests: interests.join(', '),
          preferred_event: camperForm.querySelector('[name="preferred_event"]').value,
          about: camperForm.querySelector('[name="about"]').value,
          email_opt_in: camperForm.querySelector('[name="email_opt_in"]').checked
        }, camperForm);
      });
    }

    // Startup Program application form
    var startupForm = document.getElementById('startup-form');
    if (startupForm) {
      startupForm.addEventListener('submit', function (e) {
        e.preventDefault();
        submitToSupabase({
          form_type: 'startup',
          name: startupForm.querySelector('[name="name"]').value,
          email: startupForm.querySelector('[name="email"]').value,
          company: startupForm.querySelector('[name="company"]').value,
          website: startupForm.querySelector('[name="website"]').value,
          stage: startupForm.querySelector('[name="stage"]').value,
          city: startupForm.querySelector('[name="city"]').value,
          description: startupForm.querySelector('[name="description"]').value,
          pitch: startupForm.querySelector('[name="pitch"]').value,
          preferred_event: startupForm.querySelector('[name="preferred_event"]').value,
          linkedin: startupForm.querySelector('[name="linkedin"]').value,
          email_opt_in: startupForm.querySelector('[name="email_opt_in"]') ? startupForm.querySelector('[name="email_opt_in"]').checked : null
        }, startupForm);
      });
    }

    // Startup Showcase form
    var showcaseForm = document.getElementById('showcase-form');
    if (showcaseForm) {
      showcaseForm.addEventListener('submit', function (e) {
        e.preventDefault();
        submitToSupabase({
          form_type: 'showcase',
          name: showcaseForm.querySelector('[name="name"]').value,
          email: showcaseForm.querySelector('[name="email"]').value,
          phone: showcaseForm.querySelector('[name="phone"]').value,
          company: showcaseForm.querySelector('[name="company"]').value,
          website: showcaseForm.querySelector('[name="website"]').value,
          stage: showcaseForm.querySelector('[name="stage"]').value,
          event: showcaseForm.querySelector('[name="event"]').value,
          demo_ready: showcaseForm.querySelector('[name="demo_ready"]').value,
          description: showcaseForm.querySelector('[name="description"]').value,
          pitch: showcaseForm.querySelector('[name="pitch"]').value,
          email_opt_in: showcaseForm.querySelector('[name="email_opt_in"]') ? showcaseForm.querySelector('[name="email_opt_in"]').checked : null
        }, showcaseForm);
      });
    }

    // Mentor application form
    var mentorForm = document.getElementById('mentor-form');
    if (mentorForm) {
      mentorForm.addEventListener('submit', function (e) {
        e.preventDefault();
        submitToSupabase({
          form_type: 'mentor',
          name: mentorForm.querySelector('[name="name"]').value,
          email: mentorForm.querySelector('[name="email"]').value,
          phone: mentorForm.querySelector('[name="phone"]').value,
          company: mentorForm.querySelector('[name="company"]').value,
          title: mentorForm.querySelector('[name="title"]').value,
          linkedin: mentorForm.querySelector('[name="linkedin"]').value,
          event: mentorForm.querySelector('[name="event"]').value,
          expertise: mentorForm.querySelector('[name="expertise"]').value,
          bio: mentorForm.querySelector('[name="bio"]').value,
          offers: mentorForm.querySelector('[name="offers"]').value,
          email_opt_in: mentorForm.querySelector('[name="email_opt_in"]') ? mentorForm.querySelector('[name="email_opt_in"]').checked : null
        }, mentorForm);
      });
    }

    // Partner inquiry form
    var partnerForm = document.getElementById('partner-form');
    if (partnerForm) {
      partnerForm.addEventListener('submit', function (e) {
        e.preventDefault();
        submitToSupabase({
          form_type: 'partner',
          name: partnerForm.querySelector('[name="name"]').value,
          email: partnerForm.querySelector('[name="email"]').value,
          phone: partnerForm.querySelector('[name="phone"]').value,
          company: partnerForm.querySelector('[name="company"]').value,
          website: partnerForm.querySelector('[name="website"]').value,
          linkedin: partnerForm.querySelector('[name="linkedin"]').value,
          partnership_type: partnerForm.querySelector('[name="partnership_type"]').value,
          bio: partnerForm.querySelector('[name="bio"]').value,
          offers: partnerForm.querySelector('[name="offers"]').value,
          message: partnerForm.querySelector('[name="message"]').value,
          email_opt_in: partnerForm.querySelector('[name="email_opt_in"]') ? partnerForm.querySelector('[name="email_opt_in"]').checked : null
        }, partnerForm);
      });
    }

    // Tutorial submission form
    var tutorialForm = document.getElementById('tutorial-form');
    if (tutorialForm) {
      tutorialForm.addEventListener('submit', function (e) {
        e.preventDefault();
        submitToSupabase({
          form_type: 'tutorial',
          name: tutorialForm.querySelector('[name="name"]').value,
          email: tutorialForm.querySelector('[name="email"]').value,
          website: tutorialForm.querySelector('[name="url"]').value,
          title: tutorialForm.querySelector('[name="title"]').value,
          bio: tutorialForm.querySelector('[name="description"]').value,
          email_opt_in: tutorialForm.querySelector('[name="email_opt_in"]') ? tutorialForm.querySelector('[name="email_opt_in"]').checked : null
        }, tutorialForm);
      });
    }

  });
})();
