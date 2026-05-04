window.VMSSkins = {
  skins: [],

  async init() {
    const response = await fetch("./data/skins.json");
    const data = await response.json();
    this.skins = data.skins || [];
    this.render();
  },

  render() {
    const list = document.getElementById("skinsList");
    if (!list) return;

    list.innerHTML = "";

    this.skins.forEach((skin) => {
      const card = document.createElement("article");
      card.className = "skin-card";

      const preview = document.createElement("div");
      preview.className = "skin-preview";
      preview.style.background = skin.previewGradient;

      const title = document.createElement("h3");
      title.textContent = VMSI18n.t(skin.nameKey);

      const btn = document.createElement("button");
      btn.type = "button";

      const owned = VMSEconomy.ownsSkin(skin.id);
      const active = VMSEconomy.activeSkin === skin.id;

      btn.textContent = active
        ? VMSI18n.t("skins_equipped")
        : owned
          ? VMSI18n.t("skins_equip")
          : `${skin.price} ${VMSI18n.t("currency_coins")}`;

      btn.addEventListener("click", () => this.handleSkin(skin));

      card.append(preview, title, btn);
      list.appendChild(card);
    });
  },

  handleSkin(skin) {
    if (VMSEconomy.ownsSkin(skin.id)) {
      VMSEconomy.equipSkin(skin.id);
      this.render();
      return;
    }

    const ok = VMSEconomy.spendCoins(skin.price);
    if (!ok) {
      VMSModals.show({
        title: VMSI18n.t("modal_no_coins_title"),
        text: VMSI18n.t("modal_no_coins_text"),
        primaryText: VMSI18n.t("btn_ok"),
        secondaryText: VMSI18n.t("btn_close")
      });
      return;
    }

    VMSEconomy.unlockSkin(skin.id);
    VMSEconomy.equipSkin(skin.id);
    this.render();
  }
};
