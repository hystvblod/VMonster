window.VMSCrossPromo = {
  rewardAmount: 1000,
  cooldownMs: 2 * 24 * 60 * 60 * 1000,
  lastClaimKey: "vmonster_crosspromo_last_claim",

  showManual() {
    VMSModals.show({
      title: VMSI18n.t("crosspromo_title"),
      text: VMSI18n.t("crosspromo_text", { coins: this.rewardAmount }),
      primaryText: VMSI18n.t("crosspromo_open"),
      secondaryText: VMSI18n.t("btn_close"),
      onPrimary: () => this.claimLocalPreview(),
      onSecondary: () => {}
    });
  },

  claimLocalPreview() {
    const last = Number(VMSStorage.get(this.lastClaimKey, 0));
    const now = Date.now();

    if (last && now - last < this.cooldownMs) {
      VMSModals.show({
        title: VMSI18n.t("crosspromo_wait_title"),
        text: VMSI18n.t("crosspromo_wait_text"),
        primaryText: VMSI18n.t("btn_ok"),
        secondaryText: VMSI18n.t("btn_close"),
        onPrimary: () => {},
        onSecondary: () => {}
      });
      return;
    }

    VMSStorage.set(this.lastClaimKey, now);
    VMSEconomy.addCoins(this.rewardAmount);

    VMSModals.show({
      title: VMSI18n.t("crosspromo_reward_title"),
      text: VMSI18n.t("crosspromo_reward_text", { coins: this.rewardAmount }),
      rewardAmount: this.rewardAmount,
      rewardIcon: "./assets/ui/icon_vcoins.webp",
      primaryText: VMSI18n.t("btn_ok"),
      secondaryText: VMSI18n.t("btn_close"),
      onPrimary: () => {},
      onSecondary: () => {}
    });
  }
};
