window.VMSShop = {
  items: [],

  async init() {
    const response = await fetch("./data/shop.json");
    const data = await response.json();
    this.items = data.items || [];
    this.render();
  },

  render() {
    const list = document.getElementById("shopList");
    if (!list) return;
    list.innerHTML = "";

    this.items.forEach((item) => {
      const card = document.createElement("article");
      card.className = "shop-card";
      const img = document.createElement("div"); img.className = "shop-img";
      const body = document.createElement("div");
      const title = document.createElement("h3"); title.textContent = VMSI18n.t(item.titleKey);
      const desc = document.createElement("p"); desc.textContent = VMSI18n.t(item.descKey);
      const btn = document.createElement("button"); btn.className = "shop-buy"; btn.type = "button";

      if (item.priceType === "real") {
        const price = VMSPurchases?.getPrice?.(item.iapId) || "";
        if (price) { btn.textContent = price; btn.classList.remove("shop-buy-disabled"); }
        else { btn.textContent = VMSI18n.t("store_not_connected_short"); btn.classList.add("shop-buy-disabled"); }
      } else if (item.priceType === "coins") btn.textContent = `${item.price} ${VMSI18n.t("currency_coins")}`;
      else btn.textContent = VMSI18n.t("shop_buy");

      btn.addEventListener("click", () => this.buy(item));
      body.append(title, desc, btn); card.append(img, body); list.appendChild(card);
    });
  },

  async buy(item) {
    if (item.priceType === "real") {
      const hasPrice = VMSPurchases?.hasRealPrice?.(item.iapId);
      if (!hasPrice) {
        VMSModals.show({ title: VMSI18n.t("store_price_missing_title"), text: VMSI18n.t("store_price_missing_text"), primaryText: VMSI18n.t("btn_ok"), secondaryText: VMSI18n.t("btn_close"), onPrimary: () => {}, onSecondary: () => {} });
        return;
      }
      await VMSPurchases.buy(item.iapId);
      return;
    }

    if (item.priceType === "coins") {
      const ok = VMSEconomy.spendCoins(item.price);
      if (!ok) {
        VMSModals.show({ title: VMSI18n.t("modal_no_coins_title"), text: VMSI18n.t("modal_no_coins_text"), primaryText: VMSI18n.t("btn_ok"), secondaryText: VMSI18n.t("btn_close"), onPrimary: () => {}, onSecondary: () => {} });
        return;
      }
      if (item.reward?.coins) VMSEconomy.addCoins(item.reward.coins);
      if (item.reward?.tokens) VMSEconomy.addTokens(item.reward.tokens);
      if (item.reward?.world) VMSEconomy.unlockInfiniteWorld(item.reward.world);
    }

    VMSModals.show({ title: VMSI18n.t("modal_purchase_title"), text: VMSI18n.t("modal_purchase_text"), primaryText: VMSI18n.t("btn_ok"), secondaryText: VMSI18n.t("btn_close"), onPrimary: () => {}, onSecondary: () => {} });
  }
};

window.addEventListener("vms:price_updated", () => { VMSShop.render?.(); });
window.addEventListener("vms:store_unavailable", () => { VMSShop.render?.(); });
