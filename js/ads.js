(function () {
  "use strict";

  const Capacitor = window.Capacitor || {};
  const Plugins = Capacitor.Plugins || {};
  const AdMob = Plugins.AdMob || Plugins.Admob || Plugins.admob || window.AdMob || null;

  /*
    VMonster Ads - principe VUniverse adapté VMonster
    - DEV_ADS true  = IDs test Google
    - DEV_ADS false = IDs prod VMonster
  */
  const DEV_ADS = true;

  const IDS = {
    interAndroidTest: "ca-app-pub-3940256099942544/1033173712",
    interIosTest: "ca-app-pub-3940256099942544/4411468910",
    rewardAndroidTest: "ca-app-pub-3940256099942544/5224354917",
    rewardIosTest: "ca-app-pub-3940256099942544/1712485313",

    interAndroidProd: "REMPLACE_PAR_INTER_ANDROID_VMONSTER",
    interIosProd: "REMPLACE_PAR_INTER_IOS_VMONSTER",
    rewardAndroidProd: "REMPLACE_PAR_REWARDED_ANDROID_VMONSTER",
    rewardIosProd: "REMPLACE_PAR_REWARDED_IOS_VMONSTER"
  };

  const LAST_INTER_KEY = "vmonster_ads_last_inter_ts_v1";
  const WEIGHTED_TIME_KEY = "vmonster_ads_weighted_time_ms_v1";
  const RETURN_INDEX_KEY = "vmonster_ads_return_index_ts_v1";

  const INTERSTITIAL_MIN_MS = 120000;
  const INTERSTITIAL_MIN_WEIGHTED_MS = 90000;
  const REWARDED_PRELOAD_RETRY_MS = 15000;
  const INTER_PRELOAD_RETRY_MS = 20000;

  let initPromise = null;
  let initialized = false;
  let rewardedReady = false;
  let interReady = false;
  let rewardedPreparing = false;
  let interPreparing = false;
  let rewardedShowing = false;
  let interShowing = false;
  let _weightedTimerStartedAt = 0;
  let _umpConsentInfo = null;

  function log(...args) {
    if (DEV_ADS) {
      try { console.log("[VMSAds]", ...args); } catch (_) {}
    }
  }

  function warn(...args) {
    try { console.warn("[VMSAds]", ...args); } catch (_) {}
  }

  function readNumber(key, fallback = 0) {
    try {
      const n = Number(localStorage.getItem(key));
      return Number.isFinite(n) ? n : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function writeNumber(key, value) {
    try { localStorage.setItem(key, String(Number(value || 0))); } catch (_) {}
  }

  function addNumber(key, amount) {
    writeNumber(key, readNumber(key, 0) + Number(amount || 0));
  }

  function getPlatform() {
    try {
      if (typeof Capacitor.getPlatform === "function") return Capacitor.getPlatform();
      return Capacitor.platform || "web";
    } catch (_) {
      return "web";
    }
  }

  function isNative() {
    const p = getPlatform();
    return p === "android" || p === "ios";
  }

  function isIOS() {
    return getPlatform() === "ios";
  }

  function getRewardedId() {
    return DEV_ADS
      ? (isIOS() ? IDS.rewardIosTest : IDS.rewardAndroidTest)
      : (isIOS() ? IDS.rewardIosProd : IDS.rewardAndroidProd);
  }

  function getInterstitialId() {
    return DEV_ADS
      ? (isIOS() ? IDS.interIosTest : IDS.interAndroidTest)
      : (isIOS() ? IDS.interIosProd : IDS.interAndroidProd);
  }

  function setAdsActive(value) {
    window.__ads_active = !!value;
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function noAdsActive() {
    return !!window.VMSEconomy?.noAds || !!window.VMSStorage?.get?.("noAds", false);
  }

  function getWeightedFactor() {
    const path = String(location.pathname || "").toLowerCase();
    if (path.includes("game")) return 1.25;
    if (path.includes("index") || path === "/" || path.endsWith("/")) return 0.75;
    return 1;
  }

  function startWeightedTimer() {
    if (_weightedTimerStartedAt > 0) return;
    _weightedTimerStartedAt = Date.now();
  }

  function stopWeightedTimer() {
    if (_weightedTimerStartedAt <= 0) return 0;
    const elapsed = Math.max(0, Date.now() - _weightedTimerStartedAt);
    _weightedTimerStartedAt = 0;
    const weighted = Math.floor(elapsed * getWeightedFactor());
    if (weighted > 0) addNumber(WEIGHTED_TIME_KEY, weighted);
    return weighted;
  }

  function getWeightedAccumulatedMs() {
    const stored = readNumber(WEIGHTED_TIME_KEY, 0);
    if (_weightedTimerStartedAt <= 0) return stored;
    return stored + Math.floor((Date.now() - _weightedTimerStartedAt) * getWeightedFactor());
  }

  function resetWeightedAccumulatedMs() {
    writeNumber(WEIGHTED_TIME_KEY, 0);
    _weightedTimerStartedAt = Date.now();
  }

  async function logAdEvent(kind, placement) {
    try {
      if (window.sb?.rpc) {
        await window.sb.rpc("secure_log_ad_event", {
          p_kind: kind,
          p_placement: placement || "auto"
        });
      }
    } catch (error) {
      log("secure_log_ad_event absent ou refusé", error?.message || error);
    }
  }

  async function init() {
    if (initialized) return true;
    if (initPromise) return initPromise;

    initPromise = (async () => {
      startWeightedTimer();

      if (!AdMob || !isNative()) {
        initialized = true;
        return true;
      }

      try {
        if (typeof AdMob.initialize === "function") {
          await AdMob.initialize({ initializeForTesting: DEV_ADS });
        }
      } catch (error) {
        warn("initialize failed", error);
      }

      initialized = true;

      try { await refreshGoogleConsentInfo(); } catch (_) {}

      scheduleRewardedPreload(0);
      scheduleInterstitialPreload(700);

      return true;
    })();

    return initPromise;
  }

  async function prepareRewarded() {
    await init();

    if (!AdMob || !isNative()) return false;
    if (rewardedReady || rewardedPreparing) return rewardedReady;

    rewardedPreparing = true;

    try {
      const adId = getRewardedId();
      if (!adId || adId.includes("REMPLACE_PAR")) {
        rewardedReady = false;
        warn("rewarded id manquant");
        return false;
      }

      if (typeof AdMob.prepareRewardVideoAd === "function") {
        await AdMob.prepareRewardVideoAd({ adId });
      } else if (typeof AdMob.prepareRewarded === "function") {
        await AdMob.prepareRewarded({ adId });
      } else {
        throw new Error("rewarded_prepare_not_available");
      }

      rewardedReady = true;
      return true;
    } catch (error) {
      rewardedReady = false;
      warn("prepare rewarded failed", error);
      scheduleRewardedPreload(REWARDED_PRELOAD_RETRY_MS);
      return false;
    } finally {
      rewardedPreparing = false;
    }
  }

  async function prepareInterstitial() {
    await init();

    if (!AdMob || !isNative()) return false;
    if (noAdsActive()) return false;
    if (interReady || interPreparing) return interReady;

    interPreparing = true;

    try {
      const adId = getInterstitialId();
      if (!adId || adId.includes("REMPLACE_PAR")) {
        interReady = false;
        warn("interstitial id manquant");
        return false;
      }

      await AdMob.prepareInterstitial({ adId });
      interReady = true;
      return true;
    } catch (error) {
      interReady = false;
      warn("prepare interstitial failed", error);
      scheduleInterstitialPreload(INTER_PRELOAD_RETRY_MS);
      return false;
    } finally {
      interPreparing = false;
    }
  }

  function scheduleRewardedPreload(delay = 0) {
    if (!AdMob || !isNative()) return;

    setTimeout(() => {
      prepareRewarded().catch((error) => warn("rewarded preload failed", error));
    }, Math.max(0, Number(delay || 0)));
  }

  function scheduleInterstitialPreload(delay = 0) {
    if (!AdMob || !isNative()) return;
    if (noAdsActive()) return;

    setTimeout(() => {
      prepareInterstitial().catch((error) => warn("inter preload failed", error));
    }, Math.max(0, Number(delay || 0)));
  }

  function postAdCleanup() {
    rewardedShowing = false;
    interShowing = false;
    setAdsActive(false);
    startWeightedTimer();
  }

  function isAdBusy() {
    return rewardedShowing || interShowing || !!window.__ads_active;
  }

  function rewardResultLooksOk(result) {
    if (result === false) return false;

    if (result && typeof result === "object") {
      if (result.rewarded === false) return false;
      if (result.value === false) return false;
      if (result.cancelled === true) return false;
      if (result.canceled === true) return false;
    }

    return true;
  }

  async function showRewarded(reason = "rewarded") {
    await init();

    if (isAdBusy()) return false;

    rewardedShowing = true;
    setAdsActive(true);
    stopWeightedTimer();

    try {
      if (!AdMob || !isNative()) {
        await sleep(350);
        await logAdEvent("rewarded", reason);
        return true;
      }

      if (!rewardedReady) {
        const ok = await prepareRewarded();
        if (!ok) return false;
      }

      let result = null;

      if (typeof AdMob.showRewardVideoAd === "function") {
        result = await AdMob.showRewardVideoAd();
      } else if (typeof AdMob.showRewarded === "function") {
        result = await AdMob.showRewarded();
      } else {
        throw new Error("rewarded_show_not_available");
      }

      rewardedReady = false;
      scheduleRewardedPreload(1000);

      const ok = rewardResultLooksOk(result);
      if (ok) await logAdEvent("rewarded", reason);

      return ok;
    } catch (error) {
      rewardedReady = false;
      warn("show rewarded failed", error);
      scheduleRewardedPreload(REWARDED_PRELOAD_RETRY_MS);
      return false;
    } finally {
      postAdCleanup();
    }
  }

  function canShowInterstitialNow() {
    if (noAdsActive()) return false;
    if (isAdBusy()) return false;

    const now = Date.now();
    const last = readNumber(LAST_INTER_KEY, 0);
    if (now - last < INTERSTITIAL_MIN_MS) return false;

    const weighted = getWeightedAccumulatedMs();
    if (weighted < INTERSTITIAL_MIN_WEIGHTED_MS) return false;

    return true;
  }

  async function showInterstitial(reason = "interstitial") {
    await init();

    if (!canShowInterstitialNow()) return false;

    interShowing = true;
    setAdsActive(true);
    stopWeightedTimer();

    try {
      if (!AdMob || !isNative()) {
        await sleep(180);
        writeNumber(LAST_INTER_KEY, Date.now());
        resetWeightedAccumulatedMs();
        await logAdEvent("interstitial", reason);
        return true;
      }

      if (!interReady) {
        const ok = await prepareInterstitial();
        if (!ok) return false;
      }

      await AdMob.showInterstitial();

      interReady = false;
      writeNumber(LAST_INTER_KEY, Date.now());
      resetWeightedAccumulatedMs();
      scheduleInterstitialPreload(1200);
      await logAdEvent("interstitial", reason);

      return true;
    } catch (error) {
      interReady = false;
      warn("show interstitial failed", error);
      scheduleInterstitialPreload(INTER_PRELOAD_RETRY_MS);
      return false;
    } finally {
      postAdCleanup();
    }
  }

  function maybeShowInterstitial(reason = "auto") {
    if (!canShowInterstitialNow()) return false;
    showInterstitial(reason).catch((error) => warn("maybe inter failed", error));
    return true;
  }

  function markReturnIndex() {
    writeNumber(RETURN_INDEX_KEY, Date.now());
  }

  function shouldShowReturnInterstitial() {
    if (!canShowInterstitialNow()) return false;

    const last = readNumber(RETURN_INDEX_KEY, 0);
    if (Date.now() - last < 120000) return false;

    return true;
  }

  function maybeShowReturnInterstitial(reason = "return_index") {
    if (!shouldShowReturnInterstitial()) return false;
    markReturnIndex();
    showInterstitial(reason).catch((error) => warn("return inter failed", error));
    return true;
  }

  function emptyConsentInfo() {
    return {
      status: "UNKNOWN",
      isConsentFormAvailable: false,
      canRequestAds: false,
      privacyOptionsRequirementStatus: "UNKNOWN"
    };
  }

  async function refreshGoogleConsentInfo(opts = {}) {
    try {
      if (!AdMob || !isNative()) {
        _umpConsentInfo = {
          status: "NOT_REQUIRED",
          isConsentFormAvailable: false,
          canRequestAds: true,
          privacyOptionsRequirementStatus: "NOT_REQUIRED"
        };
        return _umpConsentInfo;
      }

      if (typeof AdMob.requestConsentInfo !== "function") {
        _umpConsentInfo = emptyConsentInfo();
        return _umpConsentInfo;
      }

      _umpConsentInfo = await AdMob.requestConsentInfo(opts);
      return _umpConsentInfo || emptyConsentInfo();
    } catch (_) {
      return _umpConsentInfo || emptyConsentInfo();
    }
  }

  function getGoogleConsentInfo() {
    return _umpConsentInfo || emptyConsentInfo();
  }

  async function openGooglePrivacyOptionsForm() {
    try {
      if (!AdMob || !isNative()) return false;
      if (typeof AdMob.requestConsentInfo !== "function") return false;
      if (typeof AdMob.showPrivacyOptionsForm !== "function") return false;

      const info = await refreshGoogleConsentInfo();

      if (info.privacyOptionsRequirementStatus !== "REQUIRED") {
        return false;
      }

      await AdMob.showPrivacyOptionsForm();
      await refreshGoogleConsentInfo();

      return true;
    } catch (_) {
      return false;
    }
  }

  try {
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        stopWeightedTimer();
      } else {
        startWeightedTimer();
        if (!rewardedShowing && !interShowing) {
          setAdsActive(false);
        }
      }
    });
  } catch (_) {}

  try {
    const App = Capacitor.App || Plugins.App || null;
    if (App?.addListener) {
      App.addListener("resume", () => {
        startWeightedTimer();
        if (!rewardedShowing && !interShowing) setAdsActive(false);
        scheduleRewardedPreload(800);
        scheduleInterstitialPreload(1500);
      });

      App.addListener("pause", () => {
        stopWeightedTimer();
      });
    }
  } catch (_) {}

  window.VMSAds = {
    init,
    showRewarded,
    showInterstitial,
    maybeShowInterstitial,
    maybeShowReturnInterstitial,
    prepareRewarded,
    prepareInterstitial,
    scheduleRewardedPreload,
    scheduleInterstitialPreload,
    canShowInterstitialNow,
    refreshGoogleConsentInfo,
    getGoogleConsentInfo,
    openGooglePrivacyOptionsForm
  };

  window.showRewarded = showRewarded;
  window.showInterstitial = showInterstitial;
  window.maybeShowInterstitial = maybeShowInterstitial;
})();