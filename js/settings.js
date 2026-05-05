window.VMSSettings = {
  vibration: true,

  langs: [
    { code: "fr", label: "Français", ui: "FR" },
    { code: "en-US", label: "English", ui: "EN" },
    { code: "de-DE", label: "Deutsch", ui: "DE" },
    { code: "es-ES", label: "Español", ui: "ES" },
    { code: "es-419", label: "Español LATAM", ui: "LATAM" },
    { code: "it-IT", label: "Italiano", ui: "IT" },
    { code: "pt-PT", label: "Português", ui: "PT" },
    { code: "pt-BR", label: "Português BR", ui: "BR" },
    { code: "ko-KR", label: "한국어", ui: "KO" },
    { code: "ja-JP", label: "日本語", ui: "JP" },
    { code: "id", label: "Bahasa Indonesia", ui: "ID" },
    { code: "ar", label: "العربية", ui: "AR" }
  ],

  flags: {
    fr: `<svg viewBox="0 0 30 20"><rect width="10" height="20" fill="#1f4fbf"/><rect x="10" width="10" height="20" fill="#fff"/><rect x="20" width="10" height="20" fill="#d11f2e"/></svg>`,
    "en-US": `<svg viewBox="0 0 30 20"><rect width="30" height="20" fill="#fff"/><g fill="#b22234"><rect y="0" width="30" height="1.5"/><rect y="3" width="30" height="1.5"/><rect y="6" width="30" height="1.5"/><rect y="9" width="30" height="1.5"/><rect y="12" width="30" height="1.5"/><rect y="15" width="30" height="1.5"/><rect y="18" width="30" height="2"/></g><rect width="13" height="10.5" fill="#3c3b6e"/></svg>`,
    "de-DE": `<svg viewBox="0 0 30 20"><rect width="30" height="6.67" fill="#111"/><rect y="6.67" width="30" height="6.67" fill="#d11f2e"/><rect y="13.34" width="30" height="6.66" fill="#f4c300"/></svg>`,
    "es-ES": `<svg viewBox="0 0 30 20"><rect width="30" height="20" fill="#c60b1e"/><rect y="5" width="30" height="10" fill="#ffc400"/></svg>`,
    "es-419": `<svg viewBox="0 0 30 20"><rect width="30" height="20" fill="#129653"/><circle cx="15" cy="10" r="6" fill="#fff"/><circle cx="15" cy="10" r="4" fill="#d11f2e"/></svg>`,
    "it-IT": `<svg viewBox="0 0 30 20"><rect width="10" height="20" fill="#1a7f3b"/><rect x="10" width="10" height="20" fill="#fff"/><rect x="20" width="10" height="20" fill="#c8102e"/></svg>`,
    "pt-PT": `<svg viewBox="0 0 30 20"><rect width="12" height="20" fill="#1a7f3b"/><rect x="12" width="18" height="20" fill="#c8102e"/><circle cx="12" cy="10" r="4" fill="#f4c300"/></svg>`,
    "pt-BR": `<svg viewBox="0 0 30 20"><rect width="30" height="20" fill="#1a7f3b"/><path d="M15 3 L26 10 L15 17 L4 10 Z" fill="#f4c300"/><circle cx="15" cy="10" r="4" fill="#1f4fbf"/></svg>`,
    "ko-KR": `<svg viewBox="0 0 30 20"><rect width="30" height="20" fill="#fff"/><circle cx="15" cy="10" r="5" fill="#c8102e"/><path d="M15 5a5 5 0 0 0 0 10a2.5 2.5 0 0 1 0-5a2.5 2.5 0 0 0 0-5Z" fill="#0a3a87"/></svg>`,
    "ja-JP": `<svg viewBox="0 0 30 20"><rect width="30" height="20" fill="#fff"/><circle cx="15" cy="10" r="5" fill="#d11f2e"/></svg>`,
    id: `<svg viewBox="0 0 30 20"><rect width="30" height="10" fill="#d11f2e"/><rect y="10" width="30" height="10" fill="#fff"/></svg>`,
    ar: `<svg viewBox="0 0 30 20"><rect width="30" height="20" fill="#0b7a3b"/><text x="15" y="13" text-anchor="middle" font-size="7" fill="#fff" font-family="Arial">AR</text></svg>`
  },

  init() {
    this.vibration = VMSStorage.get("vibration", true);

    this.buildLangGrid();
    this.bindSwitches();
    this.refresh();

    const help = document.getElementById("settingsHelpEmail");
    if (help) {
      const email = VMSI18n.t("settings_help_email");
      help.textContent = email;
      help.href = `mailto:${email}`;
    }
  },

  buildLangGrid() {
    const grid = document.getElementById("settingsLangGrid");
    if (!grid) return;

    grid.innerHTML = "";

    this.langs.forEach((lang) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "vm-lang-btn";
      btn.dataset.lang = lang.code;

      const flag = document.createElement("div");
      flag.className = "vm-flag-box";
      flag.innerHTML = this.flags[lang.code] || this.flags["en-US"];

      const label = document.createElement("div");
      label.textContent = lang.label;

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
    VMSInfinite.render?.();
    VMSCrossPromo.render?.();

    this.markActiveLang();

    const msg = document.getElementById("settingsMsg");
    if (msg) msg.textContent = VMSI18n.t("settings_msg_saved");
  },

  markActiveLang() {
    document.querySelectorAll(".vm-lang-btn[data-lang]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.lang === VMSI18n.lang);
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
  }
};
