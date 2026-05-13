window.VMSEconomy = {
  coins: 0,
  tokens: 0,
  ownedSkins: [],
  activeSkin: "slime_default",
  unlockedInfiniteWorlds: ["lab"],
  noAds: false,

  init() {
    this.coins = VMSStorage.get("coins", window.VMS_CONFIG.startCoins || 250);
    this.tokens = VMSStorage.get("tokens", 3);
    this.ownedSkins = VMSStorage.get("ownedSkins", ["slime_default"]);
    this.activeSkin = VMSStorage.get("activeSkin", "slime_default");
    this.unlockedInfiniteWorlds = VMSStorage.get("unlockedInfiniteWorlds", ["lab"]);
    this.noAds = VMSStorage.get("noAds", false);
    this.refreshHud();
  },

  async addCoins(amount) {
    const value = Math.max(0, Number(amount || 0));
    if (value <= 0) return false;

    if (window.VMSUserData?.ready) {
      return await VMSUserData.creditVCoins(value);
    }

    this.coins += value;
    VMSStorage.set("coins", this.coins);
    this.refreshHud();
    return true;
  },

  async spendCoins(amount) {
    const value = Math.max(0, Number(amount || 0));
    if (value <= 0) return false;
    if (this.coins < value) return false;

    if (window.VMSUserData?.ready) {
      return await VMSUserData.spendVCoins(value);
    }

    this.coins -= value;
    VMSStorage.set("coins", this.coins);
    this.refreshHud();
    return true;
  },

  async addTokens(amount) {
    const value = Math.max(0, Number(amount || 0));
    if (value <= 0) return false;

    if (window.VMSUserData?.ready) {
      return await VMSUserData.creditJetons(value);
    }

    this.tokens += value;
    VMSStorage.set("tokens", this.tokens);
    this.refreshHud();
    return true;
  },

  async spendToken(amount = 1) {
    const value = Math.max(1, Number(amount || 1));
    if (this.tokens < value) return false;

    if (window.VMSUserData?.ready) {
      return await VMSUserData.spendJetons(value);
    }

    this.tokens -= value;
    VMSStorage.set("tokens", this.tokens);
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

  unlockInfiniteWorldLocal(worldId) {
    if (!this.isInfiniteWorldUnlocked(worldId)) {
      this.unlockedInfiniteWorlds.push(worldId);
      VMSStorage.set("unlockedInfiniteWorlds", this.unlockedInfiniteWorlds);
    }
  },

  unlockInfiniteWorld(worldId) {
    if (window.VMSUserData?.ready) {
      VMSUserData.unlockInfiniteWorld(worldId);
      return;
    }

    this.unlockInfiniteWorldLocal(worldId);
  },

  activateNoAds() {
    this.noAds = true;
    VMSStorage.set("noAds", true);

    if (window.VMSUserData?.ready) {
      VMSUserData.activateNoAds();
    }
  },

  refreshHud() {
    const node = document.getElementById("hudCoins");
    if (node) node.textContent = String(this.coins);

    const tokenNode = document.getElementById("hudTokens");
    if (tokenNode) tokenNode.textContent = String(this.tokens || 0);

    const shopCoinsNode = document.getElementById("shopCoins");
    if (shopCoinsNode) shopCoinsNode.textContent = String(this.coins || 0);

    const shopTokensNode = document.getElementById("shopTokens");
    if (shopTokensNode) shopTokensNode.textContent = String(this.tokens || 0);
  }
};
