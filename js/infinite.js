window.VMSInfinite = {
  priceVCoins: 3000,
  rewardedCost: 1,

  worlds: [
    {
      id: "lab",
      nameKey: "world_lab_name",
      image: "./assets/environment/backgrounds/bg_lab_main_01.webp",
      productId: null
    },
    {
      id: "ocean",
      nameKey: "world_ocean_name",
      image: "./assets/environment/backgrounds/bg_ocean_main_01.webp",
      productId: "vmonster_world_ocean"
    },
    {
      id: "volcano",
      nameKey: "world_volcano_name",
      image: "./assets/environment/backgrounds/bg_volcano_main_01.webp",
      productId: "vmonster_world_volcano"
    },
    {
      id: "nuclear",
      nameKey: "world_nuclear_name",
      image: "./assets/environment/backgrounds/bg_nuclear_main_01.webp",
      productId: "vmonster_world_nuclear"
    },
    {
      id: "secret",
      nameKey: "world_secret_name",
      image: "./assets/environment/backgrounds/bg_secret_main_01.webp",
      productId: "vmonster_world_secret"
    }
  ],

  render() {
    const root = document.getElementById("infiniteWorldGrid");
    if (!root) return;

    root.innerHTML = "";

    this.worlds.forEach((world) => {
      const unlocked = VMSEconomy.isInfiniteWorldUnlocked(world.id);

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "vm-world-card";
      btn.setAttribute("data-action", "select-infinite-world");
      btn.setAttribute("data-world-id", world.id);

      btn.innerHTML = `
        <img src="${world.image}" alt="" />
        ${unlocked ? "" : `<strong class="vm-world-lock">🔒</strong>`}
        <span>${VMSI18n.t(world.nameKey)}</span>
      `;

      root.appendChild(btn);
    });
  },

  selectWorld(worldId) {
    const world = this.worlds.find((item) => item.id === worldId);
    if (!world) return;

    if (VMSEconomy.isInfiniteWorldUnlocked(worldId)) {
      VMSRouter.show("screen-game");
      VMSGame.startInfinite(worldId);
      return;
    }

    this.showUnlockPopup(world);
  },

  showUnlockPopup(world) {
    const storePrice = VMSPurchases.getPrice?.(world.productId) || VMSI18n.t("store_not_connected_short");

    VMSModals.show({
      title: VMSI18n.t("infinite_unlock_title"),
      text: VMSI18n.t("infinite_unlock_text", {
        world: VMSI18n.t(world.nameKey),
        coins: this.priceVCoins
      }),
      rewardAmount: this.priceVCoins,
      rewardIcon: window.VMSAsset("ui", "vcoins"),
      primaryText: VMSI18n.t("btn_unlock_store", { price: storePrice }),
      secondaryText: VMSI18n.t("btn_unlock_vcoins_rewarded", { coins: this.priceVCoins }),
      tertiaryText: VMSI18n.t("btn_close"),
      onPrimary: async () => {
        const ok = await VMSPurchases.buyWorld?.(world.id, world.productId);
        if (ok) {
          VMSEconomy.unlockInfiniteWorld(world.id);
          this.render();
          VMSRouter.show("screen-game");
          VMSGame.startInfinite(world.id);
        }
      },
      onSecondary: async () => {
        if (VMSEconomy.coins < this.priceVCoins) {
          VMSModals.show({
            title: VMSI18n.t("modal_not_enough_vcoins_title"),
            text: VMSI18n.t("modal_not_enough_vcoins_text", { coins: this.priceVCoins }),
            primaryText: VMSI18n.t("btn_shop"),
            secondaryText: VMSI18n.t("btn_close"),
            onPrimary: () => VMSRouter.show("screen-shop"),
            onSecondary: () => {}
          });
          return;
        }

        const watched = await VMSAds.showRewarded("unlock_infinite_world");
        if (!watched) return;

        const spent = VMSEconomy.spendCoins(this.priceVCoins);
        if (!spent) return;

        VMSEconomy.unlockInfiniteWorld(world.id);
        this.render();

        VMSRouter.show("screen-game");
        VMSGame.startInfinite(world.id);
      },
      onTertiary: () => {}
    });
  }
};
