window.VMSSettings = {
  vibration: true,

  init() {
    this.vibration = VMSStorage.get("vibration", true);

    this.buildLangGrid();
    this.bindSwitches();
    this.refresh();
    this.refreshHelpEmail();
    this.refreshPlayerId();
  },

  buildLangGrid() {
    const grid = document.getElementById("settingsLangGrid");
    if (!grid) return;

    grid.innerHTML = "";

    const langs = window.VMSI18n?.languageChoices || [];
    const flags = window.VMSI18n?.languageFlags || {};

    langs.forEach((lang) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "vr-langBtn";
      btn.dataset.lang = lang.code;
      btn.setAttribute("aria-label", lang.ui);

      const flag = document.createElement("div");
      flag.className = "vr-flagBox";
      flag.innerHTML = flags[lang.code] || flags.en || "";

      const label = document.createElement("div");
      label.className = "vr-langText";
      label.textContent = lang.ui;

      btn.append(flag, label);

      btn.addEventListener("click", async () => {
        await this.setLanguage(lang.code);
      });

      grid.appendChild(btn);
    });

    this.markActiveLang();
  },

  async setLanguage(lang) {
    await VMSI18n.setLanguage(lang);

    VMSShop.render?.();
    VMSSkins.render?.();
    VMSBestiary.render?.();
    VMSInfinite.render?.();
    VMSCrossPromo.render?.();

    this.buildLangGrid();
    this.markActiveLang();
    this.refreshHelpEmail();
    this.refreshPlayerId();

    const msg = document.getElementById("settingsMsg");
    if (msg) msg.textContent = VMSI18n.t("settings_msg_saved");
  },

  refreshHelpEmail() {
    const help = document.getElementById("settingsHelpEmail");
    if (!help) return;

    const email = VMSI18n.t("settings_help_email");
    help.textContent = email;
    help.href = `mailto:${email}`;
  },

  getPlayerIdLabel() {
    const profile = window.VMSUserData?.profile || {};

    if (profile.pseudo && String(profile.pseudo).trim()) {
      return String(profile.pseudo).trim();
    }

    if (profile.id) {
      return `VM-${String(profile.id).replaceAll("-", "").slice(0, 6).toUpperCase()}`;
    }

    return VMSI18n.t("settings_player_id_offline");
  },

  refreshPlayerId() {
    const el = document.getElementById("settingsPlayerPseudo");
    if (!el) return;

    el.textContent = this.getPlayerIdLabel();
  },

  markActiveLang() {
    document.querySelectorAll(".vr-langBtn[data-lang]").forEach((btn) => {
      btn.classList.toggle("isActive", btn.dataset.lang === VMSI18n.lang);
    });
  },

  bindSwitches() {
    const music = document.getElementById("musicEnabled");
    const sfx = document.getElementById("sfxEnabled");
    const vibration = document.getElementById("vibrationEnabled");

    if (music) {
      music.checked = !!VMSAudio.enabledMusic;
      music.addEventListener("change", () => {
        VMSAudio.setMusic(music.checked);
        this.showSaved("settings_music_saved");
      });
    }

    if (sfx) {
      sfx.checked = !!VMSAudio.enabledSfx;
      sfx.addEventListener("change", () => {
        VMSAudio.setSfx(sfx.checked);
        this.showSaved("settings_sfx_saved");
      });
    }

    if (vibration) {
      vibration.checked = !!this.vibration;
      vibration.addEventListener("change", () => {
        this.vibration = vibration.checked;
        VMSStorage.set("vibration", this.vibration);
        this.showSaved("settings_vibration_saved");
      });
    }
  },

  async openPrivacyOptions() {
    let ok = false;

    try {
      ok = !!(await VMSAds?.openGooglePrivacyOptionsForm?.());
    } catch (_) {}

    const msg = document.getElementById("settingsMsg");
    if (msg) {
      msg.textContent = ok
        ? VMSI18n.t("settings_privacy_options_opened")
        : VMSI18n.t("settings_privacy_options_unavailable");
    }
  },

  toggleMusic() {
    VMSAudio.setMusic(!VMSAudio.enabledMusic);
    this.refresh();
  },

  toggleSfx() {
    VMSAudio.setSfx(!VMSAudio.enabledSfx);
    this.refresh();
  },

  toggleVibration() {
    this.vibration = !this.vibration;
    VMSStorage.set("vibration", this.vibration);
    this.refresh();
  },

  vibrate(ms = 20) {
    if (this.vibration && navigator.vibrate) navigator.vibrate(ms);
  },

  showSaved(key) {
    const msg = document.getElementById("settingsMsg");
    if (msg) msg.textContent = VMSI18n.t(key);
  },

  refresh() {
    const music = document.getElementById("musicEnabled");
    const sfx = document.getElementById("sfxEnabled");
    const vibration = document.getElementById("vibrationEnabled");

    if (music) music.checked = !!VMSAudio.enabledMusic;
    if (sfx) sfx.checked = !!VMSAudio.enabledSfx;
    if (vibration) vibration.checked = !!this.vibration;

    this.markActiveLang();
    this.refreshPlayerId();
  }
};
