// ClawCamp Auth — Supabase Magic Link
(function () {
  var SUPABASE_URL = window.CLAWCAMP_CONFIG.SUPABASE_URL;
  var SUPABASE_ANON_KEY = window.CLAWCAMP_CONFIG.SUPABASE_ANON_KEY;

  var client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  window.clawAuth = {
    client: client,

    signIn: function (email) {
      return client.auth.signInWithOtp({
        email: email,
        options: {
          emailRedirectTo: window.location.origin + '/dashboard'
        }
      });
    },

    getSession: function () {
      return client.auth.getSession();
    },

    getUser: function () {
      return client.auth.getUser();
    },

    signOut: function () {
      return client.auth.signOut();
    },

    onAuthStateChange: function (callback) {
      return client.auth.onAuthStateChange(callback);
    }
  };
})();
