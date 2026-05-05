(function () {
  "use strict";

 const SUPABASE_URL = "https://fbkbqfkgdjkjdfijmggd.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZia2JxZmtnZGpramRmaWptZ2dkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5MTIyOTgsImV4cCI6MjA4MTQ4ODI5OH0.ylBfBeXBWliR13GumJrFazRjP57RyBR3mzaebF7Iy24";

  let _bootstrapPromise = null;

  function getCreateClient() {
    if (window.supabase && typeof window.supabase.createClient === "function") {
      return window.supabase.createClient;
    }
    if (window.supabaseJs && typeof window.supabaseJs.createClient === "function") {
      return window.supabaseJs.createClient;
    }
    return null;
  }

  function initClient() {
    if (window.sb) return window.sb;

    const createClient = getCreateClient();
    if (!createClient) return null;

    window.sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false
      }
    });

    return window.sb;
  }

  async function getUid(sb) {
    try {
      const sessionResult = await sb.auth.getSession();
      const uid = sessionResult?.data?.session?.user?.id || null;
      if (uid) return uid;
    } catch (_) {}

    try {
      const userResult = await sb.auth.getUser();
      const uid = userResult?.data?.user?.id || null;
      if (uid) return uid;
    } catch (_) {}

    return null;
  }

  async function bootstrapVMonsterAuth() {
    if (_bootstrapPromise) return _bootstrapPromise;

    _bootstrapPromise = (async () => {
      const sb = initClient();
      if (!sb) return null;

      let uid = await getUid(sb);

      if (!uid) {
        try {
          const result = await sb.auth.signInAnonymously();
          uid = result?.data?.user?.id || result?.data?.session?.user?.id || null;
        } catch (error) {
          console.warn("[VMonster Supabase] anonymous auth failed", error);
        }
      }

      if (!uid) return null;

      try {
        const profile = await sb.rpc("vmonster_get_me");
        if (!profile?.error && profile?.data) return profile.data;
      } catch (error) {
        console.warn("[VMonster Supabase] vmonster_get_me failed", error);
      }

      return { id: uid };
    })();

    try {
      return await _bootstrapPromise;
    } finally {
      _bootstrapPromise = null;
    }
  }

  window.VMSSupabaseBootstrap = {
    initClient,
    bootstrapVMonsterAuth
  };

  try {
    initClient();
  } catch (_) {}
})();
