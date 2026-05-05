window.VMSApp = {
  async init() {
    await VMSI18n.init();

    VMSAudio.init();
    VMSEconomy.init();
    VMSModals.init();

    await Promise.all([
      VMSAssets.init(),
      VMSLevels.init(),
      VMSShop.init(),
      VMSSkins.init()
    ]);

    VMSPurchases.init();
    VMSSettings.init();

    const canvas = document.getElementById("gameCanvas");
    VMSRenderer.init(canvas);
    VMSInput.init(canvas);

    this.bindActions();

    VMSI18n.apply();
    VMSShop.render();
    VMSSkins.render();
    VMSInfinite.render?.();
  },

  bindActions() {
    document.body.addEventListener("click", async (event) => {
      const target = event.target.closest("[data-action]");
      if (!target) return;

      const action = target.getAttribute("data-action");

      if (action === "play" || action === "play-campaign") {
        VMSGame.mode = "campaign";
        VMSRouter.show("screen-game");
        VMSGame.start();
      }

      if (action === "open-infinite") {
        VMSInfinite.render();
        VMSRouter.show("screen-infinite");
      }

      if (action === "select-infinite-world") {
        VMSInfinite.selectWorld(target.getAttribute("data-world-id"));
      }

      if (action === "open-shop") VMSRouter.show("screen-shop");

      if (action === "open-noads") {
        VMSPurchases.buyNoAds?.();
      }

      if (action === "open-crosspromo") {
        VMSCrossPromo?.showManual?.();
      }

      if (action === "open-skins") VMSRouter.show("screen-skins");
      if (action === "open-settings") VMSRouter.show("screen-settings");
      if (action === "open-rules") VMSRouter.show("screen-rules");
      if (action === "back-home") VMSRouter.home();
      if (action === "pause") VMSGame.pause();
      if (action === "toggle-music") VMSSettings.toggleMusic();
      if (action === "toggle-sfx") VMSSettings.toggleSfx();
      if (action === "toggle-vibration") VMSSettings.toggleVibration();
      if (action === "restore-purchases") VMSPurchases.restore();
    });
  }
};
