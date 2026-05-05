(function () {
  "use strict";

  const Capacitor = window.Capacitor || {};
  const AdMob = Capacitor.Plugins?.AdMob || null;

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

  let ready = false;
  let rewardedReady = false;
  let interReady = false;
  let showing = false;
  let lastInterTs = 0;
  let interFailCount = 0;

  function platform() { try { return Capacitor.getPlatform?.() || Capacitor.platform || "web"; } catch (_) { return "web"; } }
  function isNative() { return platform() === "android" || platform() === "ios"; }
  function isIOS() { return platform() === "ios"; }
  function rewardedId() { return DEV_ADS ? (isIOS() ? IDS.rewardIosTest : IDS.rewardAndroidTest) : (isIOS() ? IDS.rewardIosProd : IDS.rewardAndroidProd); }
  function interId() { return DEV_ADS ? (isIOS() ? IDS.interIosTest : IDS.interAndroidTest) : (isIOS() ? IDS.interIosProd : IDS.interAndroidProd); }

  async function init() { if (ready) return true; if (!AdMob || !isNative()) { ready = true; return true; } try { await AdMob.initialize({ initializeForTesting: DEV_ADS }); ready = true; await prepareRewarded(); await prepareInterstitial(); return true; } catch (error) { console.warn("[VMSAds] init failed", error); ready = true; return false; } }
  async function prepareRewarded() { if (!AdMob || !isNative()) return false; try { await AdMob.prepareRewardVideoAd({ adId: rewardedId() }); rewardedReady = true; return true; } catch (error) { console.warn("[VMSAds] rewarded prepare failed", error); rewardedReady = false; return false; } }
  async function prepareInterstitial() { if (!AdMob || !isNative()) return false; if (VMSEconomy?.noAds) return false; try { await AdMob.prepareInterstitial({ adId: interId() }); interReady = true; return true; } catch (error) { console.warn("[VMSAds] inter prepare failed", error); interReady = false; return false; } }

  async function showRewarded(reason = "rewarded") { await init(); if (showing) return false; showing = true; window.__ads_active = true; try { if (!AdMob || !isNative()) { await new Promise((resolve) => setTimeout(resolve, 350)); return true; } if (!rewardedReady) { const ok = await prepareRewarded(); if (!ok) return false; } const result = await AdMob.showRewardVideoAd(); rewardedReady = false; prepareRewarded(); return !!result; } catch (error) { console.warn("[VMSAds] rewarded show failed", error); return false; } finally { showing = false; window.__ads_active = false; } }
  async function showInterstitial(reason = "interstitial") { await init(); if (VMSEconomy?.noAds) return false; if (showing) return false; const now = Date.now(); if (now - lastInterTs < 120000) return false; showing = true; window.__ads_active = true; try { if (!AdMob || !isNative()) { await new Promise((resolve) => setTimeout(resolve, 180)); lastInterTs = Date.now(); return true; } if (!interReady) { const ok = await prepareInterstitial(); if (!ok) return false; } await AdMob.showInterstitial(); interReady = false; lastInterTs = Date.now(); interFailCount = 0; prepareInterstitial(); return true; } catch (error) { console.warn("[VMSAds] inter show failed", error); interReady = false; interFailCount += 1; prepareInterstitial(); return false; } finally { showing = false; window.__ads_active = false; } }

  function maybeShowInterstitial(reason = "auto") { if (VMSEconomy?.noAds) return; interFailCount += 1; if (interFailCount < 3) return; interFailCount = 0; showInterstitial(reason); }

  let _umpConsentInfo = null;

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

window.VMSAds = {
  init,
  showRewarded,
  showInterstitial,
  maybeShowInterstitial,
  prepareRewarded,
  prepareInterstitial,
  refreshGoogleConsentInfo,
  getGoogleConsentInfo,
  openGooglePrivacyOptionsForm
};
})();
