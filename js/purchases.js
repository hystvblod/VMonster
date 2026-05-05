(function () {
  "use strict";

  const DEBUG = true;
  const log = (...args) => { if (DEBUG) console.log("[VMSPurchases]", ...args); };
  const warn = (...args) => { if (DEBUG) console.warn("[VMSPurchases]", ...args); };

  const SKU = {
    vmonster_vcoins_3000: { kind: "coins", coins: 3000 },
    vmonster_vcoins_10000: { kind: "coins", coins: 10000 },

    vmonster_jetons_12: { kind: "tokens", tokens: 12 },
    vmonster_jetons_30: { kind: "tokens", tokens: 30 },

    vmonster_no_ads: { kind: "noads" },
    vmonster_ultimate_pack: { kind: "ultimate" },

    vmonster_world_ocean: { kind: "world", worldId: "ocean" },
    vmonster_world_volcano: { kind: "world", worldId: "volcano" },
    vmonster_world_nuclear: { kind: "world", worldId: "nuclear" },
    vmonster_world_secret: { kind: "world", worldId: "secret" },

    vmonster_skinpack_lab_girly: { kind: "skinpack", worldId: "lab", styleId: "girly" },
    vmonster_skinpack_lab_nature: { kind: "skinpack", worldId: "lab", styleId: "nature" },
    vmonster_skinpack_lab_adventure: { kind: "skinpack", worldId: "lab", styleId: "adventure" },

    vmonster_skinpack_ocean_girly: { kind: "skinpack", worldId: "ocean", styleId: "girly" },
    vmonster_skinpack_ocean_nature: { kind: "skinpack", worldId: "ocean", styleId: "nature" },
    vmonster_skinpack_ocean_adventure: { kind: "skinpack", worldId: "ocean", styleId: "adventure" },

    vmonster_skinpack_volcano_girly: { kind: "skinpack", worldId: "volcano", styleId: "girly" },
    vmonster_skinpack_volcano_nature: { kind: "skinpack", worldId: "volcano", styleId: "nature" },
    vmonster_skinpack_volcano_adventure: { kind: "skinpack", worldId: "volcano", styleId: "adventure" },

    vmonster_skinpack_nuclear_girly: { kind: "skinpack", worldId: "nuclear", styleId: "girly" },
    vmonster_skinpack_nuclear_nature: { kind: "skinpack", worldId: "nuclear", styleId: "nature" },
    vmonster_skinpack_nuclear_adventure: { kind: "skinpack", worldId: "nuclear", styleId: "adventure" },

    vmonster_skinpack_secret_girly: { kind: "skinpack", worldId: "secret", styleId: "girly" },
    vmonster_skinpack_secret_nature: { kind: "skinpack", worldId: "secret", styleId: "nature" },
    vmonster_skinpack_secret_adventure: { kind: "skinpack", worldId: "secret", styleId: "adventure" }
  };

  const prices = {};
  let ready = false;
  let store = null;

  function getStore() {
    if (window.CdvPurchase?.store) return window.CdvPurchase.store;
    if (window.store) return window.store;
    return null;
  }

  function getPrice(productId) {
    if (!productId) return "";
    return prices[productId] || "";
  }

  function hasRealPrice(productId) {
    return !!getPrice(productId);
  }

  function isNativeStoreAvailable() {
    return !!getStore();
  }

  async function init() {
    if (ready) return;
    ready = true;

    store = getStore();

    if (!store) {
      warn("Store plugin absent. Aucun prix réel disponible.");
      window.dispatchEvent(new CustomEvent("vms:store_unavailable"));
      return;
    }

    try {
      const productIds = Object.keys(SKU);

      productIds.forEach((id) => {
        try {
          const type = id === "vmonster_no_ads" || id.startsWith("vmonster_world_") || id.startsWith("vmonster_skinpack_")
            ? store.NON_CONSUMABLE || "non consumable"
            : store.CONSUMABLE || "consumable";

          const product = { id, type };

          if (window.CdvPurchase?.Platform?.GOOGLE_PLAY) {
            product.platform = window.CdvPurchase.Platform.GOOGLE_PLAY;
          }

          store.register([product]);
        } catch (error) {
          warn("register failed", id, error);
        }
      });

      store.when()
        .productUpdated((product) => {
          try {
            const id = product.id;
            const offer = product.getOffer?.();
            const pricing = offer?.pricingPhases?.[0];

            const realPrice = pricing?.price || pricing?.priceMicrosFormatted || product.pricing?.price || product.price || "";

            if (id && realPrice) {
              prices[id] = realPrice;
              log("prix store chargé", id, realPrice);
              window.dispatchEvent(new CustomEvent("vms:price_updated", { detail: { productId: id, price: realPrice } }));
              VMSShop?.render?.();
              VMSInfinite?.render?.();
            }
          } catch (error) {
            warn("productUpdated parse failed", error);
          }
        })
        .approved((transaction) => {
          try {
            transaction.verify();
          } catch (error) {
            warn("verify failed, credit direct fallback transaction", error);
            const productId = transaction?.products?.[0]?.id || transaction?.id;
            creditPurchase(productId);
          }
        })
        .verified((receipt) => {
          const productId = receipt?.id || receipt?.products?.[0]?.id;

          creditPurchase(productId);

          try {
            receipt.finish();
          } catch (error) {
            warn("receipt finish failed", error);
          }
        });

      await store.initialize();

      log("Store initialisé");
      VMSShop?.render?.();
      VMSInfinite?.render?.();
    } catch (error) {
      warn("init failed", error);
      window.dispatchEvent(new CustomEvent("vms:store_unavailable"));
    }
  }

  function creditPurchase(productId) {
    const sku = SKU[productId];
    if (!sku) {
      warn("produit inconnu", productId);
      return false;
    }

    if (sku.kind === "coins") VMSEconomy.addCoins(sku.coins);
    if (sku.kind === "tokens") VMSEconomy.addTokens(sku.tokens);
    if (sku.kind === "noads") VMSEconomy.activateNoAds();
    if (sku.kind === "world") VMSEconomy.unlockInfiniteWorld(sku.worldId);

    if (sku.kind === "skinpack") {
      VMSShop?.unlockSkinPack?.(sku.worldId, sku.styleId);
    }

    if (sku.kind === "ultimate") {
      VMSShop?.unlockUltimatePack?.();
    }

    VMSUserData?.saveLocal?.();

    VMSModals.show({ title: VMSI18n.t("modal_purchase_title"), text: VMSI18n.t("modal_purchase_text"), primaryText: VMSI18n.t("btn_ok"), secondaryText: VMSI18n.t("btn_close"), onPrimary: () => {}, onSecondary: () => {} });

    return true;
  }

  async function buy(productId) {
    const sku = SKU[productId];

    if (!sku) {
      warn("unknown product", productId);
      return false;
    }

    if (!isNativeStoreAvailable()) {
      VMSModals.show({ title: VMSI18n.t("store_not_connected_title"), text: VMSI18n.t("store_not_connected_text"), primaryText: VMSI18n.t("btn_ok"), secondaryText: VMSI18n.t("btn_close"), onPrimary: () => {}, onSecondary: () => {} });
      return false;
    }

    if (!hasRealPrice(productId)) {
      VMSModals.show({ title: VMSI18n.t("store_price_missing_title"), text: VMSI18n.t("store_price_missing_text"), primaryText: VMSI18n.t("btn_ok"), secondaryText: VMSI18n.t("btn_close"), onPrimary: () => {}, onSecondary: () => {} });
      return false;
    }

    try {
      const product = store.get(productId);
      if (!product) throw new Error("product_not_found");

      const offer = product.getOffer?.();
      if (offer?.order) { await offer.order(); return true; }
      if (product.order) { await product.order(); return true; }

      throw new Error("order_not_available");
    } catch (error) {
      warn("buy failed", productId, error);

      VMSModals.show({ title: VMSI18n.t("modal_purchase_error_title"), text: VMSI18n.t("modal_purchase_error_text"), primaryText: VMSI18n.t("btn_ok"), secondaryText: VMSI18n.t("btn_close"), onPrimary: () => {}, onSecondary: () => {} });

      return false;
    }
  }

  async function buyNoAds() { return buy("vmonster_no_ads"); }
  async function buyWorld(worldId, productId) { const id = productId || `vmonster_world_${worldId}`; return buy(id); }

  async function restore() {
    if (!isNativeStoreAvailable()) {
      VMSModals.show({ title: VMSI18n.t("store_not_connected_title"), text: VMSI18n.t("store_not_connected_text"), primaryText: VMSI18n.t("btn_ok"), secondaryText: VMSI18n.t("btn_close"), onPrimary: () => {}, onSecondary: () => {} });
      return;
    }

    try { await store.restorePurchases?.(); } catch (error) { warn("restore failed", error); }

    VMSModals.show({ title: VMSI18n.t("modal_restore_title"), text: VMSI18n.t("modal_restore_text"), primaryText: VMSI18n.t("btn_ok"), secondaryText: VMSI18n.t("btn_close"), onPrimary: () => {}, onSecondary: () => {} });
  }

  window.VMSPurchases = { init, buy, buyNoAds, buyWorld, restore, getPrice, hasRealPrice, creditPurchase };
})();
