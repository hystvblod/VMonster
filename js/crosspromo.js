window.VMSCrossPromo = {
  rewardAmount: 1000,

  apps: {
    vblocks: {
      id: "vblocks",
      packageName: "com.vboldstudio.VBlocks",
      iosScheme: "vblocks://",
      storeUrlAndroid: "https://play.google.com/store/apps/details?id=com.vboldstudio.VBlocks",
      storeUrlIOS: "https://apps.apple.com/app/idXXXXXXXXXX",
      cover: "./assets/crosspromo/vblocks_cover.webp",
      shots: [
        "./assets/crosspromo/vblocks_01.webp",
        "./assets/crosspromo/vblocks_02.webp",
        "./assets/crosspromo/vblocks_03.webp"
      ],
      titleKey: "crosspromo_apps_vblocks_name",
      descKey: "crosspromo_apps_vblocks_desc"
    },

    vchronicles: {
      id: "vchronicles",
      packageName: "com.vboldstudio.vchronicles",
      iosScheme: "vchronicles://",
      storeUrlAndroid: "https://play.google.com/store/apps/details?id=com.vboldstudio.vchronicles",
      storeUrlIOS: "https://apps.apple.com/app/idYYYYYYYYYY",
      cover: "./assets/crosspromo/vchronicles_cover.webp",
      shots: [
        "./assets/crosspromo/vchronicles_01.webp",
        "./assets/crosspromo/vchronicles_02.webp",
        "./assets/crosspromo/vchronicles_03.webp"
      ],
      titleKey: "crosspromo_apps_vchronicles_name",
      descKey: "crosspromo_apps_vchronicles_desc"
    }
  },

  showManual() {
    this.render();
    VMSRouter.show("screen-crosspromo");
  },

  render() {
    const grid = document.getElementById("crosspromoGrid");
    if (!grid) return;

    const reward = document.getElementById("crosspromoRewardAmount");
    if (reward) reward.textContent = String(this.rewardAmount);

    grid.innerHTML = "";

    ["vchronicles", "vblocks"].forEach((id) => {
      const app = this.apps[id];
      const card = document.createElement("article");
      card.className = "vm-crosspromo-card";

      card.innerHTML = `
        <div class="vm-crosspromo-hero">
          <img src="${app.cover}" alt="" />
        </div>

        <div class="vm-crosspromo-content">
          <div class="vm-crosspromo-reward">
            <span>${VMSI18n.t("crosspromo_reward_prefix")}</span>
            <img src="./assets/ui/icon_vcoins.webp" alt="" />
            <strong>${this.rewardAmount}</strong>
          </div>

          <p class="vm-crosspromo-desc">${VMSI18n.t(app.descKey)}</p>

          <div class="vm-crosspromo-gallery">
            ${app.shots.map((src) => `
              <button class="vm-crosspromo-shot" type="button" data-shot="${src}">
                <img src="${src}" alt="" />
              </button>
            `).join("")}
          </div>

          <button class="vm-crosspromo-btn" type="button" data-crosspromo-app="${id}">
            ${VMSI18n.t("crosspromo_cta_install")}
          </button>
        </div>
      `;

      grid.appendChild(card);
    });

    this.bindPageActions();
  },

  bindPageActions() {
    document.querySelectorAll("[data-shot]").forEach((btn) => {
      btn.onclick = () => this.openShot(btn.getAttribute("data-shot"));
    });

    document.querySelectorAll("[data-crosspromo-app]").forEach((btn) => {
      btn.onclick = async () => {
        const appId = btn.getAttribute("data-crosspromo-app");
        await this.openOrClaim(appId);
      };
    });

    const viewer = document.getElementById("crosspromoShotViewer");
    const close = document.getElementById("crosspromoShotClose");

    if (close) close.onclick = () => this.closeShot();
    if (viewer) {
      viewer.onclick = (event) => {
        if (event.target === viewer) this.closeShot();
      };
    }
  },

  openShot(src) {
    const viewer = document.getElementById("crosspromoShotViewer");
    const img = document.getElementById("crosspromoShotImage");

    if (!viewer || !img || !src) return;

    img.src = src;
    viewer.classList.add("is-open");
    viewer.setAttribute("aria-hidden", "false");
  },

  closeShot() {
    const viewer = document.getElementById("crosspromoShotViewer");
    const img = document.getElementById("crosspromoShotImage");

    if (!viewer || !img) return;

    viewer.classList.remove("is-open");
    viewer.setAttribute("aria-hidden", "true");
    img.src = "";
  },

  getPlatform() {
    try {
      if (window.Capacitor?.getPlatform) return window.Capacitor.getPlatform();
      return window.Capacitor?.platform || "web";
    } catch (_) {
      return "web";
    }
  },

  isIOS() {
    return this.getPlatform() === "ios";
  },

  getStoreUrl(app) {
    return this.isIOS() ? app.storeUrlIOS : app.storeUrlAndroid;
  },

  async openStore(app) {
    const url = this.getStoreUrl(app);
    if (!url) return false;

    try {
      const Browser = window.Capacitor?.Plugins?.Browser;
      if (Browser?.open) {
        await Browser.open({ url });
        return true;
      }
    } catch (_) {}

    try {
      window.open(url, "_blank");
      return true;
    } catch (_) {}

    try {
      window.location.href = url;
      return true;
    } catch (_) {}

    return false;
  },

  async openOrClaim(appId) {
    const app = this.apps[appId];
    if (!app) return false;

    await this.openStore(app);

    VMSModals.show({
      title: VMSI18n.t("crosspromo_after_click_title"),
      text: VMSI18n.t("crosspromo_after_click_text", { coins: this.rewardAmount }),
      rewardAmount: this.rewardAmount,
      rewardIcon: "./assets/ui/icon_vcoins.webp",
      primaryText: VMSI18n.t("crosspromo_claim_reward"),
      secondaryText: VMSI18n.t("btn_close"),
      onPrimary: async () => {
        await this.claimReward();
      },
      onSecondary: () => {}
    });

    return true;
  },

  async claimReward() {
    let ok = false;

    try {
      if (window.VMSUserData?.claimCrossPromo) {
        ok = await VMSUserData.claimCrossPromo();
      }
    } catch (_) {
      ok = false;
    }

    if (!ok) {
      VMSModals.show({
        title: VMSI18n.t("crosspromo_wait_title"),
        text: VMSI18n.t("crosspromo_wait_text"),
        primaryText: VMSI18n.t("btn_ok"),
        secondaryText: VMSI18n.t("btn_close"),
        onPrimary: () => {},
        onSecondary: () => {}
      });
      return false;
    }

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

    return true;
  }
};
