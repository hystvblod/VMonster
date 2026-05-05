window.VMSPurchases = window.VMSPurchases || {};

Object.assign(window.VMSPurchases, {
  init() {},

  getPrice(productId) {
    const prices = {
      vmonster_no_ads: "2,99 €",
      vmonster_world_ocean: "1,99 €",
      vmonster_world_volcano: "1,99 €",
      vmonster_world_nuclear: "2,99 €",
      vmonster_world_secret: "2,99 €"
    };

    return prices[productId] || "";
  },

  async buyNoAds() {
    VMSModals.show({
      title: VMSI18n.t("noads_title"),
      text: VMSI18n.t("noads_text"),
      primaryText: VMSI18n.t("btn_buy_store", { price: this.getPrice("vmonster_no_ads") }),
      secondaryText: VMSI18n.t("btn_close"),
      onPrimary: () => {
        VMSEconomy.activateNoAds();
      },
      onSecondary: () => {}
    });
  },

  async buyWorld(worldId, productId) {
    VMSModals.show({
      title: VMSI18n.t("store_purchase_pending_title"),
      text: VMSI18n.t("store_purchase_pending_text"),
      primaryText: VMSI18n.t("btn_ok"),
      secondaryText: VMSI18n.t("btn_close"),
      onPrimary: () => {},
      onSecondary: () => {}
    });

    return false;
  },

  restore() {}
});
