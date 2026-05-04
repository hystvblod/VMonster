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

      const img = document.createElement("div");
      img.className = "shop-img";

      const body = document.createElement("div");

      const title = document.createElement("h3");
      title.textContent = VMSI18n.t(item.titleKey);

      const desc = document.createElement("p");
      desc.textContent = VMSI18n.t(item.descKey);

      const btn = document.createElement("button");
      btn.className = "shop-buy";
      btn.type = "button";
      btn.textContent = item.priceType === "coins"
        ? `${item.price} ${VMSI18n.t("currency_coins")}`
        : VMSI18n.t("shop_buy");

      btn.addEventListener("click", () => this.buy(item));

      body.append(title, desc, btn);
      card.append(img, body);
      list.appendChild(card);
    });
  },

  buy(item) {
    if (item.priceType === "coins") {
      const ok = VMSEconomy.spendCoins(item.price);
      if (!ok) {
        VMSModals.show({
          title: VMSI18n.t("modal_no_coins_title"),
          text: VMSI18n.t("modal_no_coins_text"),
          primaryText: VMSI18n.t("btn_ok"),
          secondaryText: VMSI18n.t("btn_close")
        });
        return;
      }

      if (item.reward?.coins) VMSEconomy.addCoins(item.reward.coins);
    }

    VMSModals.show({
      title: VMSI18n.t("modal_purchase_title"),
      text: VMSI18n.t("modal_purchase_text"),
      primaryText: VMSI18n.t("btn_ok"),
      secondaryText: VMSI18n.t("btn_close")
    });
  }
};
