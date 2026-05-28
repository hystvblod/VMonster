window.VMSUserData = {
  ready: false,
  online: false,
  profile: null,

  localKeys: {
    coins: "coins",
    tokens: "tokens",
    ownedSkins: "ownedSkins",
    activeSkin: "activeSkin",
    unlockedInfiniteWorlds: "unlockedInfiniteWorlds",
    noAds: "noAds",
    currentLevel: "currentLevel",
    bestScore: "bestScore"
  },

  async init() {
    this.loadLocal();

    try {
      const profile = await VMSSupabaseBootstrap.bootstrapVMonsterAuth();
      if (profile && profile.id) {
        this.online = true;
        this.applyRemoteProfile(profile);
      }
    } catch (error) {
      console.warn("[VMSUserData] init remote failed", error);
      this.online = false;
    }

    this.ready = true;
    this.saveLocal();
    VMSEconomy.refreshHud?.();
  },

  loadLocal() {
    VMSEconomy.coins = VMSStorage.get(this.localKeys.coins, window.VMS_CONFIG.startCoins || 250);
    VMSEconomy.tokens = VMSStorage.get(this.localKeys.tokens, 3);
    VMSEconomy.ownedSkins = VMSStorage.get(this.localKeys.ownedSkins, ["slime_default"]);
    VMSEconomy.activeSkin = VMSStorage.get(this.localKeys.activeSkin, "slime_default");
    VMSEconomy.unlockedInfiniteWorlds = VMSStorage.get(this.localKeys.unlockedInfiniteWorlds, ["lab"]);
    VMSEconomy.noAds = VMSStorage.get(this.localKeys.noAds, false);

    const currentLevel = VMSStorage.get(this.localKeys.currentLevel, 1);
    if (window.VMSGame) VMSGame.levelIndex = Math.max(1, Number(currentLevel || 1));
  },

  applyRemoteProfile(profile) {
    this.profile = profile;

    if (typeof profile.vcoins === "number") VMSEconomy.coins = profile.vcoins;
    if (typeof profile.jetons === "number") VMSEconomy.tokens = profile.jetons;
    if (typeof profile.no_ads === "boolean") VMSEconomy.noAds = profile.no_ads;
    if (Array.isArray(profile.owned_skins)) VMSEconomy.ownedSkins = profile.owned_skins;
    if (typeof profile.active_skin === "string") VMSEconomy.activeSkin = profile.active_skin;
    if (Array.isArray(profile.unlocked_infinite_worlds)) {
      VMSEconomy.unlockedInfiniteWorlds = profile.unlocked_infinite_worlds;
    }

    if (typeof profile.current_level === "number" && window.VMSGame) {
      VMSGame.levelIndex = Math.max(1, profile.current_level);
    }

    if (typeof profile.best_score === "number") {
      VMSStorage.set(this.localKeys.bestScore, profile.best_score);
    }

    this.saveLocal();
    window.VMSSettings?.refreshPlayerId?.();
  },

  saveLocal() {
    VMSStorage.set(this.localKeys.coins, VMSEconomy.coins);
    VMSStorage.set(this.localKeys.tokens, VMSEconomy.tokens || 0);
    VMSStorage.set(this.localKeys.ownedSkins, VMSEconomy.ownedSkins || ["slime_default"]);
    VMSStorage.set(this.localKeys.activeSkin, VMSEconomy.activeSkin || "slime_default");
    VMSStorage.set(this.localKeys.unlockedInfiniteWorlds, VMSEconomy.unlockedInfiniteWorlds || ["lab"]);
    VMSStorage.set(this.localKeys.noAds, !!VMSEconomy.noAds);

    if (window.VMSGame?.levelIndex) {
      VMSStorage.set(this.localKeys.currentLevel, VMSGame.levelIndex);
    }
  },

  async rpc(name, args = {}) {
    if (!window.sb || typeof window.sb.rpc !== "function") return null;

    try {
      const result = await window.sb.rpc(name, args);
      if (result?.error) throw result.error;

      if (result?.data) {
        this.online = true;
        this.applyRemoteProfile(result.data);
        VMSEconomy.refreshHud?.();
        return result.data;
      }
    } catch (error) {
      console.warn(`[VMSUserData] RPC failed: ${name}`, error);
      this.online = false;
    }

    return null;
  },

  async refreshRemote() {
    const remote = await this.rpc("vmonster_get_me");
    return !!remote;
  },

  async creditVCoins(amount) {
    const value = Math.max(0, Number(amount || 0));
    if (value <= 0) return false;

    if (this.ready && window.sb) {
      const remote = await this.rpc("vmonster_credit_vcoins", { amount: value });
      return !!remote;
    }

    VMSEconomy.coins += value;
    this.saveLocal();
    VMSEconomy.refreshHud?.();
    return true;
  },

  async spendVCoins(amount) {
    const value = Math.max(0, Number(amount || 0));
    if (value <= 0) return false;
    if (VMSEconomy.coins < value) return false;

    if (this.ready && window.sb) {
      const remote = await this.rpc("vmonster_spend_vcoins", { amount: value });
      return !!remote;
    }

    VMSEconomy.coins -= value;
    this.saveLocal();
    VMSEconomy.refreshHud?.();
    return true;
  },

  async creditJetons(amount) {
    const value = Math.max(0, Number(amount || 0));
    if (value <= 0) return false;

    if (this.ready && window.sb) {
      const remote = await this.rpc("vmonster_credit_jetons", { amount: value });
      return !!remote;
    }

    VMSEconomy.tokens += value;
    this.saveLocal();
    VMSEconomy.refreshHud?.();
    return true;
  },

  async spendJetons(amount) {
    const value = Math.max(0, Number(amount || 0));
    if (value <= 0) return false;
    if (VMSEconomy.tokens < value) return false;

    if (this.ready && window.sb) {
      const remote = await this.rpc("vmonster_spend_jetons", { amount: value });
      return !!remote;
    }

    VMSEconomy.tokens -= value;
    this.saveLocal();
    VMSEconomy.refreshHud?.();
    return true;
  },

  async unlockInfiniteWorld(worldId) {
    VMSEconomy.unlockInfiniteWorldLocal(worldId);
    this.saveLocal();

    await this.rpc("vmonster_unlock_infinite_world", { world_id: worldId });
  },

  async activateNoAds() {
    VMSEconomy.noAds = true;
    this.saveLocal();
    await this.rpc("vmonster_activate_no_ads");
  },

  async saveProgress() {
    const level = Math.max(1, Number(VMSGame?.levelIndex || VMSStorage.get("currentLevel", 1)));
    const best = Math.max(0, Number(VMSStorage.get("bestScore", 0)));

    this.saveLocal();

    await this.rpc("vmonster_set_progress", {
      new_current_level: level,
      new_best_score: best
    });
  },

  async claimCrossPromo() {
    const remote = await this.rpc("vmonster_claim_crosspromo");

    if (remote) return true;

    return false;
  }
};
