(function () {
  "use strict";

  const SUPABASE_URL = "COLLE_ICI_LA_MEME_URL_QUE_VUNIVERSE";
  const SUPABASE_ANON_KEY = "COLLE_ICI_LA_MEME_ANON_KEY_QUE_VUNIVERSE";

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
