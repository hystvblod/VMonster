window.VMSEconomy = {
  coins: 0,
  ownedSkins: [],
  activeSkin: "slime_default",
  unlockedInfiniteWorlds: ["lab"],
  noAds: false,

  init() {
    this.coins = VMSStorage.get("coins", window.VMS_CONFIG.startCoins);
    this.ownedSkins = VMSStorage.get("ownedSkins", ["slime_default"]);
    this.activeSkin = VMSStorage.get("activeSkin", "slime_default");
    this.unlockedInfiniteWorlds = VMSStorage.get("unlockedInfiniteWorlds", ["lab"]);
    this.noAds = VMSStorage.get("noAds", false);
    this.refreshHud();
  },

  addCoins(amount) {
    this.coins += Math.max(0, Number(amount || 0));
    VMSStorage.set("coins", this.coins);
    this.refreshHud();
  },

  spendCoins(amount) {
    const value = Math.max(0, Number(amount || 0));
    if (this.coins < value) return false;
    this.coins -= value;
    VMSStorage.set("coins", this.coins);
    this.refreshHud();
    return true;
  },

  ownsSkin(id) {
    return this.ownedSkins.includes(id);
  },

  unlockSkin(id) {
    if (!this.ownsSkin(id)) {
      this.ownedSkins.push(id);
      VMSStorage.set("ownedSkins", this.ownedSkins);
    }
  },

  equipSkin(id) {
    if (!this.ownsSkin(id)) return false;
    this.activeSkin = id;
    VMSStorage.set("activeSkin", id);
    return true;
  },

  isInfiniteWorldUnlocked(worldId) {
    return this.unlockedInfiniteWorlds.includes(worldId);
  },

  unlockInfiniteWorld(worldId) {
    if (!this.isInfiniteWorldUnlocked(worldId)) {
      this.unlockedInfiniteWorlds.push(worldId);
      VMSStorage.set("unlockedInfiniteWorlds", this.unlockedInfiniteWorlds);
    }
  },

  activateNoAds() {
    this.noAds = true;
    VMSStorage.set("noAds", true);
  },

  refreshHud() {
    const node = document.getElementById("hudCoins");
    if (node) node.textContent = String(this.coins);
  }
};
