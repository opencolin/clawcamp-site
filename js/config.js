// ClawCamp Config — single source of truth for Supabase connection.
// The anon key is a public, RLS-gated JWT (safe to ship to the browser).
// Load this BEFORE any other /js/* script or inline Supabase usage.
(function () {
  window.CLAWCAMP_CONFIG = {
    SUPABASE_URL: 'https://mrnccntqmkxjazznejfc.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ybmNjbnRxbWt4amF6em5lamZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMDA3NTksImV4cCI6MjA5MDc3Njc1OX0.T6oFTtYiFTsx6ojuogpZFXAS7tN5-dPzwvmY5V2xFGI'
  };
})();
