window.VMSSettings = {
  vibration: true,

  init() {
    this.vibration = VMSStorage.get("vibration", true);
    this.refresh();

    const select = document.getElementById("languageSelect");
    select.value = VMSI18n.lang;
    select.addEventListener("change", async () => {
      await VMSI18n.setLanguage(select.value);
      VMSShop.render();
      VMSSkins.render();
    });
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

  refresh() {
    document.getElementById("musicState").textContent = VMSAudio.enabledMusic ? "ON" : "OFF";
    document.getElementById("sfxState").textContent = VMSAudio.enabledSfx ? "ON" : "OFF";
    document.getElementById("vibrationState").textContent = this.vibration ? "ON" : "OFF";
  }
};
