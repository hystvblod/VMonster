(function () {
  "use strict";

  const DEBUG = true;
  const log = (...args) => { if (DEBUG) console.log("[VMSPurchases]", ...args); };
  const warn = (...args) => { if (DEBUG) console.warn("[VMSPurchases]", ...args); };

  /*
    VMonster Purchases - principe VUniverse adapté VMonster

    Objectif :
    - Store centralisé.
    - Prix réels remontés dans la boutique.
    - Pending purchases.
    - Anti double crédit.
    - Replay au lancement.
    - Crédit terminé AVANT finish transaction.
    - VCoins / jetons / no_ads / mondes via VMSUserData quand Supabase est prêt.
  */

  const SKU = {
    vmonster_vcoins_3000: { kind: "coins", coins: 3000 },
    vmonster_vcoins_10000: { kind: "coins", coins: 10000 },

    vmonster_jetons_12: { kind: "tokens", tokens: 12 },
    vmonster_jetons_30: { kind: "tokens", tokens: 30 },

    vmonster_no_ads: { kind: "noads" },
    vmonster_ultimate_pack: { kind: "ultimate" },
    vmonster_bestiary_reveal_all: { kind: "bestiary_reveal_all" },

    vmonster_world_ocean: { kind: "world", worldId: "ocean" },
    vmonster_world_volcano: { kind: "world", worldId: "volcano" },
    vmonster_world_nuclear: { kind: "world", worldId: "nuclear" },
    vmonster_world_secret: { kind: "world", worldId: "secret" },

    vmonster_skinpack_lab_candy: { kind: "skinpack", worldId: "lab", styleId: "candy" },
    vmonster_skinpack_lab_temple: { kind: "skinpack", worldId: "lab", styleId: "temple" },
    vmonster_skinpack_lab_nature: { kind: "skinpack", worldId: "lab", styleId: "nature" },
    vmonster_skinpack_lab_neon: { kind: "skinpack", worldId: "lab", styleId: "neon" },

    vmonster_skinpack_ocean_candy: { kind: "skinpack", worldId: "ocean", styleId: "candy" },
    vmonster_skinpack_ocean_nature: { kind: "skinpack", worldId: "ocean", styleId: "nature" },
    vmonster_skinpack_ocean_neon: { kind: "skinpack", worldId: "ocean", styleId: "neon" },

    vmonster_skinpack_volcano_candy: { kind: "skinpack", worldId: "volcano", styleId: "candy" },
    vmonster_skinpack_volcano_nature: { kind: "skinpack", worldId: "volcano", styleId: "nature" },
    vmonster_skinpack_volcano_neon: { kind: "skinpack", worldId: "volcano", styleId: "neon" },
    vmonster_skinpack_volcano_cryo: { kind: "skinpack", worldId: "volcano", styleId: "cryo" },

    vmonster_skinpack_nuclear_candy: { kind: "skinpack", worldId: "nuclear", styleId: "candy" },
    vmonster_skinpack_nuclear_cryo: { kind: "skinpack", worldId: "nuclear", styleId: "cryo" },
    vmonster_skinpack_nuclear_neon: { kind: "skinpack", worldId: "nuclear", styleId: "neon" },

    vmonster_skinpack_secret_candy: { kind: "skinpack", worldId: "secret", styleId: "candy" },
    vmonster_skinpack_secret_nature: { kind: "skinpack", worldId: "secret", styleId: "nature" },
    vmonster_skinpack_secret_temple: { kind: "skinpack", worldId: "secret", styleId: "temple" }
  };

  const PENDING_KEY = "vmonster_iap_pending_v2";
  const CREDITED_KEY = "vmonster_iap_credited_v2";
  const PRICE_KEY = "vmonster_iap_prices_v1";

  const prices = Object.create(null);
  const IN_FLIGHT_TX = new Set();
  const FINISHED_TX = new Set();

  let store = null;
  let ready = false;
  let initPromise = null;
  let eventsWired = false;
  let productsRegistered = false;
  let pendingReplayed = false;

  function emit(name, detail = {}) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail }));
    } catch (_) {}
  }

  function readJson(key, fallback = []) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      return value == null ? fallback : value;
    } catch (_) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_) {}
  }

  function loadSavedPrices() {
    const saved = readJson(PRICE_KEY, {});
    if (saved && typeof saved === "object" && !Array.isArray(saved)) {
      Object.keys(saved).forEach((key) => {
        if (typeof saved[key] === "string" && saved[key]) prices[key] = saved[key];
      });
    }
  }

  function savePrices() {
    writeJson(PRICE_KEY, prices);
  }

  function getStore() {
    if (window.CdvPurchase?.store) return window.CdvPurchase.store;
    if (window.store) return window.store;
    return null;
  }

  function getCapacitorPlatform() {
    try {
      const Capacitor = window.Capacitor || {};
      if (typeof Capacitor.getPlatform === "function") return Capacitor.getPlatform();
      return Capacitor.platform || "";
    } catch (_) {
      return "";
    }
  }

  function getPlatform() {
    const S = getStore();
    const p = getCapacitorPlatform();

    if (p === "ios") {
      if (window.CdvPurchase?.Platform?.APPLE_APPSTORE) return window.CdvPurchase.Platform.APPLE_APPSTORE;
      if (S?.Platform?.APPLE_APPSTORE) return S.Platform.APPLE_APPSTORE;
    }

    if (p === "android") {
      if (window.CdvPurchase?.Platform?.GOOGLE_PLAY) return window.CdvPurchase.Platform.GOOGLE_PLAY;
      if (S?.Platform?.GOOGLE_PLAY) return S.Platform.GOOGLE_PLAY;
    }

    if (window.CdvPurchase?.Platform?.GOOGLE_PLAY) return window.CdvPurchase.Platform.GOOGLE_PLAY;
    if (S?.Platform?.GOOGLE_PLAY) return S.Platform.GOOGLE_PLAY;
    if (window.CdvPurchase?.Platform?.APPLE_APPSTORE) return window.CdvPurchase.Platform.APPLE_APPSTORE;
    if (S?.Platform?.APPLE_APPSTORE) return S.Platform.APPLE_APPSTORE;

    return undefined;
  }

  function getProductTypes() {
    const S = getStore();
    return S?.ProductType || window.CdvPurchase?.ProductType || {
      CONSUMABLE: S?.CONSUMABLE || "consumable",
      NON_CONSUMABLE: S?.NON_CONSUMABLE || "non consumable"
    };
  }

  function isNativeStoreAvailable() {
    return !!getStore();
  }

  function getPrice(productId) {
    if (!productId) return "";
    return prices[productId] || "";
  }

  function hasRealPrice(productId) {
    return !!getPrice(productId);
  }

  function refreshScreens() {
    try { window.VMSShop?.render?.(); } catch (_) {}
    try { window.VMSInfinite?.render?.(); } catch (_) {}
    try { window.VMSBestiary?.render?.(); } catch (_) {}
    try { window.VMSEconomy?.refreshHud?.(); } catch (_) {}
  }

  function safeT(key, fallback = "") {
    try {
      return window.VMSI18n?.t?.(key) || fallback || key;
    } catch (_) {
      return fallback || key;
    }
  }

  function showModalSafe(config) {
    try {
      if (window.VMSModals?.show) {
        window.VMSModals.show(config);
      } else {
        console.log("[VMSPurchases modal]", config?.title, config?.text);
      }
    } catch (_) {}
  }

  function parsePrice(product) {
    try {
      const offer = product?.getOffer?.();
      const pricing = offer?.pricingPhases?.[0];

      return String(
        pricing?.price ||
        pricing?.priceMicrosFormatted ||
        product?.pricing?.price ||
        product?.pricing?.formattedPrice ||
        product?.pricing?.priceString ||
        product?.price ||
        product?.priceString ||
        ""
      );
    } catch (_) {
      return "";
    }
  }

  function simpleHash(value) {
    const s = String(value || "");
    let h = 5381;
    let i = s.length;
    while (i) h = (h * 33) ^ s.charCodeAt(--i);
    return (h >>> 0).toString(36);
  }

  function getTxId(obj) {
    try {
      return String(
        obj?.purchaseToken ||
        obj?.transactionId ||
        obj?.orderId ||
        obj?.id ||
        obj?.receiptId ||
        obj?.purchaseId ||
        obj?.nativePurchase?.orderId ||
        obj?.transaction?.transactionId ||
        obj?.transaction?.purchaseToken ||
        obj?.transaction?.orderId ||
        obj?.transaction?.id ||
        ""
      );
    } catch (_) {
      return "";
    }
  }

  function fallbackTxId(obj, productId) {
    return "fallback:" + productId + ":" + simpleHash(JSON.stringify(obj || {}) + ":" + Date.now());
  }

  function extractProductId(obj) {
    if (!obj) return "";

    if (typeof obj.id === "string" && SKU[obj.id]) return obj.id;
    if (typeof obj.productId === "string" && SKU[obj.productId]) return obj.productId;

    if (Array.isArray(obj.productIds)) {
      const found = obj.productIds.find((id) => SKU[id]);
      if (found) return found;
    }

    if (Array.isArray(obj.products)) {
      const found = obj.products.find((p) => SKU[p?.id || p?.productId]);
      if (found) return found.id || found.productId;
    }

    if (Array.isArray(obj.transaction?.products)) {
      const found = obj.transaction.products.find((p) => SKU[p?.id || p?.productId]);
      if (found) return found.id || found.productId;
    }

    if (Array.isArray(obj.transaction?.lineItems)) {
      const found = obj.transaction.lineItems.find((p) => SKU[p?.productId || p?.id]);
      if (found) return found.productId || found.id;
    }

    if (Array.isArray(obj.lineItems)) {
      const found = obj.lineItems.find((p) => SKU[p?.productId || p?.id]);
      if (found) return found.productId || found.id;
    }

    return "";
  }

  function getPendingList() {
    const list = readJson(PENDING_KEY, []);
    return Array.isArray(list) ? list : [];
  }

  function setPendingList(list) {
    writeJson(PENDING_KEY, Array.isArray(list) ? list : []);
  }

  function addPending(txId, productId) {
    if (!txId || !productId || !SKU[productId]) return;

    const list = getPendingList();

    if (!list.some((item) => item.txId === txId)) {
      list.push({
        txId,
        productId,
        savedAt: Date.now()
      });
      setPendingList(list.slice(-80));
    }
  }

  function removePending(txId) {
    if (!txId) return;
    setPendingList(getPendingList().filter((item) => item.txId !== txId));
  }

  function getCreditedList() {
    const list = readJson(CREDITED_KEY, []);
    return Array.isArray(list) ? list : [];
  }

  function isCredited(txId) {
    if (!txId) return false;
    return getCreditedList().includes(txId);
  }

  function markCredited(txId) {
    if (!txId) return;
    const list = getCreditedList();

    if (!list.includes(txId)) {
      list.push(txId);
      writeJson(CREDITED_KEY, list.slice(-250));
    }
  }

  async function waitUserDataReady(timeoutMs = 6000) {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      if (window.VMSUserData?.ready) return true;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return !!window.VMSUserData?.ready;
  }

  async function waitStoreReady(timeoutMs = 6000) {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      if (ready) return true;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return !!ready;
  }

  async function callMaybeAsync(fn) {
    if (typeof fn !== "function") return undefined;
    return await fn();
  }

  async function activateNoAdsSafe() {
    await waitUserDataReady();

    if (window.VMSUserData?.ready && typeof window.VMSUserData.activateNoAds === "function") {
      const remote = await window.VMSUserData.activateNoAds();
      if (remote) return true;
    }

    if (window.VMSEconomy) window.VMSEconomy.noAds = true;
    try { window.VMSStorage?.set?.("noAds", true); } catch (_) {}
    try { window.VMSUserData?.saveLocal?.(); } catch (_) {}
    return true;
  }

  async function unlockWorldSafe(worldId) {
    await waitUserDataReady();

    if (!worldId) return false;

    if (window.VMSUserData?.ready && typeof window.VMSUserData.unlockInfiniteWorld === "function") {
      const remote = await window.VMSUserData.unlockInfiniteWorld(worldId);
      if (remote) return true;
    }

    if (window.VMSEconomy?.unlockInfiniteWorldLocal) {
      window.VMSEconomy.unlockInfiniteWorldLocal(worldId);
      try { window.VMSUserData?.saveLocal?.(); } catch (_) {}
      return true;
    }

    return false;
  }

  async function creditCoinsSafe(amount) {
    await waitUserDataReady();

    if (typeof window.VMSEconomy?.addCoins === "function") {
      return !!(await window.VMSEconomy.addCoins(amount));
    }

    return false;
  }

  async function creditTokensSafe(amount) {
    await waitUserDataReady();

    if (typeof window.VMSEconomy?.addTokens === "function") {
      return !!(await window.VMSEconomy.addTokens(amount));
    }

    return false;
  }

  async function creditPurchase(productId, txId = "") {
    const sku = SKU[productId];

    if (!sku) {
      warn("produit inconnu", productId);
      return false;
    }

    if (txId && isCredited(txId)) {
      log("achat déjà crédité", txId);
      return true;
    }

    if (txId && IN_FLIGHT_TX.has(txId)) {
      log("achat déjà en cours", txId);
      return false;
    }

    if (txId) IN_FLIGHT_TX.add(txId);

    try {
      await waitUserDataReady();

      if (sku.kind === "coins") {
        const ok = await creditCoinsSafe(sku.coins);
        if (!ok) throw new Error("credit_coins_failed");
      }

      if (sku.kind === "tokens") {
        const ok = await creditTokensSafe(sku.tokens);
        if (!ok) throw new Error("credit_tokens_failed");
      }

      if (sku.kind === "noads") {
        const ok = await activateNoAdsSafe();
        if (!ok) throw new Error("activate_no_ads_failed");
      }

      if (sku.kind === "world") {
        const ok = await unlockWorldSafe(sku.worldId);
        if (!ok) throw new Error("unlock_world_failed");
      }

      if (sku.kind === "skinpack") {
        const ok = await callMaybeAsync(() => window.VMSShop?.unlockSkinPack?.(sku.worldId, sku.styleId));
        if (!ok) throw new Error("unlock_skinpack_failed");
      }

      if (sku.kind === "ultimate") {
        const noAdsOk = await activateNoAdsSafe();
        if (!noAdsOk) throw new Error("ultimate_no_ads_failed");

        const shopOk = await callMaybeAsync(() => window.VMSShop?.unlockUltimatePack?.());
        if (!shopOk) throw new Error("ultimate_unlock_failed");

        await callMaybeAsync(() => window.VMSBestiary?.revealAll?.());
      }

      if (sku.kind === "bestiary_reveal_all") {
        const ok = await callMaybeAsync(() => window.VMSBestiary?.revealAll?.());
        if (!ok) throw new Error("bestiary_reveal_all_failed");
      }

      try { window.VMSUserData?.saveLocal?.(); } catch (_) {}
      refreshScreens();

      if (txId) {
        markCredited(txId);
        removePending(txId);
      }

      showModalSafe({
        title: safeT("modal_purchase_title", "Achat validé"),
        text: safeT("modal_purchase_text", "Ton achat a bien été ajouté."),
        primaryText: safeT("btn_ok", "OK"),
        secondaryText: safeT("btn_close", "Fermer"),
        onPrimary: () => {},
        onSecondary: () => {}
      });

      emit("vms:iap_credited", { productId, txId });
      return true;
    } catch (error) {
      warn("creditPurchase failed", productId, error);

      if (txId) {
        addPending(txId, productId);
      }

      emit("vms:iap_credit_failed", {
        productId,
        txId,
        error: String(error?.message || error || "credit_failed")
      });

      return false;
    } finally {
      if (txId) IN_FLIGHT_TX.delete(txId);
    }
  }

  async function replayPendingPurchases() {
    if (pendingReplayed) return;
    pendingReplayed = true;

    const list = getPendingList();
    if (!list.length) return;

    for (const item of list) {
      if (!item?.productId || !item?.txId) continue;

      if (isCredited(item.txId)) {
        removePending(item.txId);
        continue;
      }

      await creditPurchase(item.productId, item.txId);
    }
  }

  function registerProducts() {
    if (productsRegistered) return;

    const S = getStore();
    const P = getProductTypes();
    const platform = getPlatform();

    if (!S || !P) return;

    Object.keys(SKU).forEach((id) => {
      try {
        const sku = SKU[id];
        const isConsumable = sku.kind === "coins" || sku.kind === "tokens";
        const type = isConsumable ? P.CONSUMABLE : P.NON_CONSUMABLE;
        const product = platform ? { id, type, platform } : { id, type };

        S.register(product);
      } catch (error) {
        warn("register failed", id, error);
      }
    });

    productsRegistered = true;
  }

  async function finishObject(obj, txId) {
    if (!obj || !txId) return;
    if (FINISHED_TX.has(txId)) return;

    try {
      if (typeof obj.finish === "function") {
        await obj.finish();
        FINISHED_TX.add(txId);
      }
    } catch (error) {
      warn("finish failed", txId, error);
    }
  }

  async function handleApprovedOrVerified(obj, source = "store") {
    let productId = extractProductId(obj);
    let txId = getTxId(obj);

    if (!productId) {
      warn(source + " without productId");
      try { await store?.update?.(); } catch (_) {}
      return false;
    }

    if (!txId) {
      txId = fallbackTxId(obj, productId);
    }

    if (FINISHED_TX.has(txId)) return true;

    if (isCredited(txId)) {
      await finishObject(obj, txId);
      return true;
    }

    addPending(txId, productId);

    const ok = await creditPurchase(productId, txId);

    if (ok) {
      removePending(txId);
      await finishObject(obj, txId);
      return true;
    }

    return false;
  }

  function wireEvents() {
    if (eventsWired || !store?.when) return;

    try {
      if (typeof store.error === "function") {
        store.error((error) => warn("store error", error?.code, error?.message || error));
      }
    } catch (_) {}

    store.when()
      .productUpdated((product) => {
        try {
          const id = product?.id;
          const realPrice = parsePrice(product);

          if (id && realPrice) {
            prices[id] = realPrice;
            savePrices();
            log("prix store chargé", id, realPrice);
            emit("vms:price_updated", { productId: id, price: realPrice });
            refreshScreens();
          }
        } catch (error) {
          warn("productUpdated parse failed", error);
        }
      })
      .approved(async (transaction) => {
        const productId = extractProductId(transaction);
        let txId = getTxId(transaction);

        if (!productId) {
          warn("approved without productId");
          try { await store.update?.(); } catch (_) {}
          return;
        }

        if (!txId) txId = fallbackTxId(transaction, productId);

        if (isCredited(txId)) {
          await finishObject(transaction, txId);
          return;
        }

        addPending(txId, productId);

        try {
          if (typeof transaction.verify === "function") {
            transaction.verify();
            return;
          }

          await handleApprovedOrVerified(transaction, "approved");
        } catch (error) {
          warn("approved failed", productId, txId, error);
        }
      })
      .verified(async (receipt) => {
        try {
          await handleApprovedOrVerified(receipt, "verified");
        } catch (error) {
          warn("verified failed", error);
        }
      });

    eventsWired = true;
  }

  async function init() {
    if (ready) return true;
    if (initPromise) return initPromise;

    initPromise = (async () => {
      loadSavedPrices();

      store = getStore();

      if (!store) {
        warn("Store plugin absent. Aucun prix réel disponible.");
        emit("vms:store_unavailable");
        return false;
      }

      try {
        registerProducts();
        wireEvents();

        const platform = getPlatform();

        if (typeof store.initialize === "function") {
          if (platform) await store.initialize([platform]);
          else await store.initialize();
        }

        ready = true;

        try {
          if (typeof store.ready === "function") {
            store.ready(async () => {
              ready = true;
              try { await store.update?.(); } catch (_) {}
              refreshScreens();
              await replayPendingPurchases();
            });
          }
        } catch (_) {}

        try { await store.update?.(); } catch (error) { warn("store update failed", error); }

        await replayPendingPurchases();

        log("Store initialisé");
        refreshScreens();
        return true;
      } catch (error) {
        warn("init failed", error);
        emit("vms:store_unavailable");
        return false;
      }
    })();

    return initPromise;
  }

  async function getProduct(productId) {
    const platform = getPlatform();
    const S = getStore();

    if (!S) return null;

    try {
      if (platform && typeof S.get === "function") {
        const p = S.get(productId, platform);
        if (p) return p;
      }
    } catch (_) {}

    try {
      if (typeof S.get === "function") {
        return S.get(productId);
      }
    } catch (_) {}

    return null;
  }

  async function buy(productId) {
    const sku = SKU[productId];

    if (!sku) {
      warn("unknown product", productId);
      return false;
    }

    store = getStore();

    if (!store) {
      await init();
      store = getStore();
    }

    if (!isNativeStoreAvailable()) {
      showModalSafe({
        title: safeT("store_not_connected_title", "Boutique indisponible"),
        text: safeT("store_not_connected_text", "La boutique Google Play n’est pas encore connectée."),
        primaryText: safeT("btn_ok", "OK"),
        secondaryText: safeT("btn_close", "Fermer"),
        onPrimary: () => {},
        onSecondary: () => {}
      });
      return false;
    }

    await waitUserDataReady();

    if (!ready) {
      await init();
      await waitStoreReady();
    }

    if (!hasRealPrice(productId)) {
      try { await store.update?.(); } catch (_) {}

      if (!hasRealPrice(productId)) {
        showModalSafe({
          title: safeT("store_price_missing_title", "Produit indisponible"),
          text: safeT("store_price_missing_text", "Le prix n’est pas encore remonté par Google Play. Réessaie dans un instant."),
          primaryText: safeT("btn_ok", "OK"),
          secondaryText: safeT("btn_close", "Fermer"),
          onPrimary: () => {},
          onSecondary: () => {}
        });
        return false;
      }
    }

    try {
      const product = await getProduct(productId);

      if (!product) {
        throw new Error("product_not_found");
      }

      const offer = product.getOffer?.();

      if (offer?.order) {
        await offer.order();
        return true;
      }

      if (product.order) {
        await product.order();
        return true;
      }

      if (store.order) {
        await store.order(productId);
        return true;
      }

      throw new Error("order_not_available");
    } catch (error) {
      warn("buy failed", productId, error);

      showModalSafe({
        title: safeT("modal_purchase_error_title", "Achat impossible"),
        text: safeT("modal_purchase_error_text", "L’achat n’a pas pu être lancé. Réessaie dans un instant."),
        primaryText: safeT("btn_ok", "OK"),
        secondaryText: safeT("btn_close", "Fermer"),
        onPrimary: () => {},
        onSecondary: () => {}
      });

      return false;
    }
  }

  async function buyNoAds() {
    return buy("vmonster_no_ads");
  }

  async function buyWorld(worldId, productId) {
    const id = productId || `vmonster_world_${worldId}`;
    return buy(id);
  }

  async function restore() {
    store = getStore();

    if (!isNativeStoreAvailable()) {
      showModalSafe({
        title: safeT("store_not_connected_title", "Boutique indisponible"),
        text: safeT("store_not_connected_text", "La boutique Google Play n’est pas encore connectée."),
        primaryText: safeT("btn_ok", "OK"),
        secondaryText: safeT("btn_close", "Fermer"),
        onPrimary: () => {},
        onSecondary: () => {}
      });
      return false;
    }

    try {
      await init();

      if (store?.restorePurchases) {
        await store.restorePurchases();
      }

      if (store?.update) {
        await store.update();
      }

      await replayPendingPurchases();
    } catch (error) {
      warn("restore failed", error);
    }

    showModalSafe({
      title: safeT("modal_restore_title", "Restauration"),
      text: safeT("modal_restore_text", "Les achats disponibles ont été vérifiés."),
      primaryText: safeT("btn_ok", "OK"),
      secondaryText: safeT("btn_close", "Fermer"),
      onPrimary: () => {},
      onSecondary: () => {}
    });

    return true;
  }

  window.VMSPurchases = {
    init,
    buy,
    buyNoAds,
    buyWorld,
    restore,
    getPrice,
    hasRealPrice,
    creditPurchase,
    replayPendingPurchases,
    isNativeStoreAvailable
  };
})();