window.VMSAudio = {
  enabledMusic: true,
  enabledSfx: true,

  init() {
    this.enabledMusic = VMSStorage.get("music", true);
    this.enabledSfx = VMSStorage.get("sfx", true);
  },

  playSfx(name) {
    if (!this.enabledSfx) return;
  },

  setMusic(value) {
    this.enabledMusic = value;
    VMSStorage.set("music", value);
  },

  setSfx(value) {
    this.enabledSfx = value;
    VMSStorage.set("sfx", value);
  }
};
