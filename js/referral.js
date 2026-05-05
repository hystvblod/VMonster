(function () {
  "use strict";

  const FETCHED_KEY = "vmonster_install_referrer_fetched_v1";
  const PENDING_INVITER_KEY = "vmonster_install_referrer_pending_inviter_v1";
  const PENDING_RAW_KEY = "vmonster_install_referrer_pending_raw_v1";

  const INDEX_SHARE_PROMPT_STATE_KEY = "vmonster_referral_index_share_state_v1";
  const INDEX_SHARE_PROMPT_QUEUE_KEY = "vmonster_referral_index_share_queue_v1";
  const INDEX_SHARE_PROMPT_MIN_RUNS = 12;
  const INDEX_SHARE_PROMPT_MIN_MS = 3 * 24 * 60 * 60 * 1000;
  const INDEX_SHARE_PROMPT_MAX_SHOWS = 2;

  const INVITE_BASE_URL = "https://vboldcompany.github.io/vmonster-invite/invite.html";

  function t(key, vars = {}) {
    let out = "";

    try {
      out = VMSI18n?.t?.(key) || "";
    } catch (_) {}

    if (!out || out === key) {
      out = "";
    }

    Object.keys(vars || {}).forEach((name) => {
      out = String(out).split(`{${name}}`).join(String(vars[name]));
    });

    return out;
  }

  function isNativeAndroid() {
    try {
      return !!window.Capacitor?.isNativePlatform?.() &&
        window.Capacitor?.getPlatform?.() === "android";
    } catch (_) {
      return false;
    }
  }

  function getInstallReferrerPlugin() {
    try {
      if (window.Capacitor?.registerPlugin) {
        return window.Capacitor.registerPlugin("InstallReferrer");
      }

      return window.Capacitor?.Plugins?.InstallReferrer || null;
    } catch (_) {
      return null;
    }
  }

  function getSharePlugin() {
    try {
      if (window.Capacitor?.registerPlugin) {
        return window.Capacitor.registerPlugin("Share");
      }

      return window.Capacitor?.Plugins?.Share || null;
    } catch (_) {
      return null;
    }
  }

  async function getCurrentUid() {
    try {
      await VMSSupabaseBootstrap?.bootstrapVMonsterAuth?.();
    } catch (_) {}

    const sb = window.sb;

    if (!sb?.auth) return "";

    try {
      const sessionResult = await sb.auth.getSession();
      const uid = sessionResult?.data?.session?.user?.id || "";
      if (uid) return uid;
    } catch (_) {}

    try {
      const userResult = await sb.auth.getUser();
      return userResult?.data?.user?.id || "";
    } catch (_) {
      return "";
    }
  }

  function buildInviteUrl(uid) {
    return INVITE_BASE_URL + "?inviter_uuid=" + encodeURIComponent(uid);
  }

  async function shareInvite() {
    const uid = await getCurrentUid();

    if (!uid) {
      VMSModals.show({
        title: t("referral.share_title"),
        text: t("referral.android_only_popup.text"),
        primaryText: t("btn_ok"),
        secondaryText: VMSI18n.t("btn_close"),
        onPrimary: () => {},
        onSecondary: () => {}
      });
      return false;
    }

    const url = buildInviteUrl(uid);
    const text = t("referral.share_text", { url });

    try {
      const Share = getSharePlugin();

      if (Share?.share) {
        await Share.share({
          title: t("referral.share_title"),
          text,
          dialogTitle: t("referral.share_title")
        });

        return true;
      }
    } catch (_) {}

    try {
      if (navigator.share) {
        await navigator.share({
          title: t("referral.share_title"),
          text
        });

        return true;
      }
    } catch (_) {}

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);

        VMSModals.show({
          title: t("referral.share_title"),
          text: t("referral.link_copied"),
          primaryText: t("btn_ok"),
          secondaryText: VMSI18n.t("btn_close"),
          onPrimary: () => {},
          onSecondary: () => {}
        });

        return true;
      }
    } catch (_) {}

    return false;
  }

  function parseInviterUuidFromRawReferrer(rawReferrer) {
    const raw = String(rawReferrer || "").trim();
    if (!raw) return "";

    try {
      const params = new URLSearchParams(raw);
      return String(params.get("inviter_uuid") || "").trim();
    } catch (_) {
      return "";
    }
  }

  async function fetchReferrerOnceFromNative() {
    if (!isNativeAndroid()) return;
    if (localStorage.getItem(FETCHED_KEY) === "1") return;

    const plugin = getInstallReferrerPlugin();

    if (!plugin?.getInstallReferrer) return;

    try {
      const data = await plugin.getInstallReferrer();

      if (data?.canRetry) return;

      const rawReferrer = String(data?.rawReferrer || "").trim();
      let inviterUuid = String(data?.inviterUuid || "").trim();

      if (!inviterUuid && rawReferrer) {
        inviterUuid = parseInviterUuidFromRawReferrer(rawReferrer);
      }

      localStorage.setItem(FETCHED_KEY, "1");

      if (inviterUuid) {
        localStorage.setItem(PENDING_INVITER_KEY, inviterUuid);
        localStorage.setItem(PENDING_RAW_KEY, rawReferrer);
      }
    } catch (_) {}
  }

  async function claimPendingReferral() {
    const pendingInviter = String(localStorage.getItem(PENDING_INVITER_KEY) || "").trim();

    if (!pendingInviter) return false;

    const pendingRaw = String(localStorage.getItem(PENDING_RAW_KEY) || "").trim();

    try {
      await VMSSupabaseBootstrap?.bootstrapVMonsterAuth?.();
    } catch (_) {}

    const sb = window.sb;

    if (!sb?.rpc) return false;

    try {
      const { data, error } = await sb.rpc("vmonster_claim_referral_install", {
        p_inviter: pendingInviter,
        p_raw: pendingRaw || null
      });

      if (error) return false;

      const reason = String(data?.reason || "");

      if (data?.ok && (reason === "claimed" || reason === "already_processed")) {
        localStorage.removeItem(PENDING_INVITER_KEY);
        localStorage.removeItem(PENDING_RAW_KEY);

        try {
          await VMSUserData?.init?.();
        } catch (_) {}

        return true;
      }

      if (
        reason === "self_referral" ||
        reason === "invalid_inviter"
      ) {
        localStorage.removeItem(PENDING_INVITER_KEY);
        localStorage.removeItem(PENDING_RAW_KEY);
      }
    } catch (_) {}

    return false;
  }

  function readIndexSharePromptState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(INDEX_SHARE_PROMPT_STATE_KEY) || "{}");

      return {
        completedRuns: Math.max(0, Number(parsed.completedRuns || 0) || 0),
        lastShownRun: Math.max(0, Number(parsed.lastShownRun || 0) || 0),
        lastShownAt: Math.max(0, Number(parsed.lastShownAt || 0) || 0),
        shownCount: Math.max(0, Number(parsed.shownCount || 0) || 0)
      };
    } catch (_) {
      return {
        completedRuns: 0,
        lastShownRun: 0,
        lastShownAt: 0,
        shownCount: 0
      };
    }
  }

  function writeIndexSharePromptState(state) {
    try {
      localStorage.setItem(INDEX_SHARE_PROMPT_STATE_KEY, JSON.stringify({
        completedRuns: Math.max(0, Number(state?.completedRuns || 0) || 0),
        lastShownRun: Math.max(0, Number(state?.lastShownRun || 0) || 0),
        lastShownAt: Math.max(0, Number(state?.lastShownAt || 0) || 0),
        shownCount: Math.max(0, Number(state?.shownCount || 0) || 0)
      }));
    } catch (_) {}
  }

  function registerCompletedRun() {
    const state = readIndexSharePromptState();
    state.completedRuns += 1;
    writeIndexSharePromptState(state);
    return state;
  }

  function canShowIndexSharePrompt(state) {
    const st = state || readIndexSharePromptState();

    if (Math.max(0, Number(st.shownCount || 0) || 0) >= INDEX_SHARE_PROMPT_MAX_SHOWS) return false;

    if (!st.lastShownRun && !st.lastShownAt) {
      return Math.max(0, Number(st.completedRuns || 0) || 0) >= INDEX_SHARE_PROMPT_MIN_RUNS;
    }

    const enoughRuns =
      Math.max(0, Number(st.completedRuns || 0) || 0) -
      Math.max(0, Number(st.lastShownRun || 0) || 0) >= INDEX_SHARE_PROMPT_MIN_RUNS;

    const enoughTime =
      Date.now() - Math.max(0, Number(st.lastShownAt || 0) || 0) >= INDEX_SHARE_PROMPT_MIN_MS;

    return enoughRuns && enoughTime;
  }

  function maybeQueueIndexSharePrompt() {
    const state = readIndexSharePromptState();

    if (!canShowIndexSharePrompt(state)) return false;

    try {
      sessionStorage.setItem(INDEX_SHARE_PROMPT_QUEUE_KEY, "1");
    } catch (_) {}

    return true;
  }

  function markIndexSharePromptShown() {
    const state = readIndexSharePromptState();

    state.lastShownRun = Math.max(0, Number(state.completedRuns || 0) || 0);
    state.lastShownAt = Date.now();
    state.shownCount += 1;

    writeIndexSharePromptState(state);

    return state;
  }

  function showIndexSharePromptPopup() {
    return new Promise((resolve) => {
      VMSModals.show({
        title: t("referral.share_popup_title"),
        text: t("referral.share_popup_body"),
        primaryText: t("referral.invite_btn"),
        secondaryText: t("referral.later_btn"),
        onPrimary: async () => {
          await shareInvite();
          resolve(true);
        },
        onSecondary: () => {
          resolve(false);
        }
      });
    });
  }

  async function maybeShowQueuedIndexSharePrompt() {
    let queued = false;

    try {
      queued = sessionStorage.getItem(INDEX_SHARE_PROMPT_QUEUE_KEY) === "1";
    } catch (_) {}

    if (!queued) return false;

    try {
      sessionStorage.removeItem(INDEX_SHARE_PROMPT_QUEUE_KEY);
    } catch (_) {}

    const state = readIndexSharePromptState();

    if (!canShowIndexSharePrompt(state)) return false;

    markIndexSharePromptShown();
    await showIndexSharePromptPopup();

    return true;
  }

  function bindInviteButtons() {
    const ids = [
      "cp_invite_btn",
      "vm_invite_btn",
      "vm_invite_top_btn"
    ];

    ids.forEach((id) => {
      const btn = document.getElementById(id);

      if (!btn || btn.dataset.referralBound === "1") return;

      btn.dataset.referralBound = "1";

      btn.addEventListener("click", async () => {
        await shareInvite();
      });
    });
  }

  async function bootReferral() {
    await fetchReferrerOnceFromNative();
    await claimPendingReferral();
    bindInviteButtons();
    await maybeShowQueuedIndexSharePrompt();
  }

  document.addEventListener("DOMContentLoaded", () => {
    bootReferral().catch(() => {});
  });

  window.VMSReferral = {
    shareInvite,
    bootReferral,
    registerCompletedRun,
    maybeQueueIndexSharePrompt,
    showIndexSharePromptPopup,
    claimPendingReferral
  };
})();
