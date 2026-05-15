window.VMSLevels = {
  levels: [],
  monsters: [],
  worlds: [],
  currentWorld: null,

  async init() {
    const [campaignRes, worldsRes, monstersRes] = await Promise.all([
      fetch("./data/campaign_levels.json"),
      fetch("./data/worlds.json"),
      fetch("./data/monsters.json")
    ]);

    const campaignData = await campaignRes.json();
    const worldsData = await worldsRes.json();
    const monstersData = await monstersRes.json();

    this.levels = this.normalizeLevels(campaignData.levels || []);
    this.worlds = worldsData.worlds || [];
    this.monsters = monstersData.monsters || [];
  },

  normalizeLevels(rawLevels) {
    return rawLevels.map((row) => {
      if (!Array.isArray(row)) return row;

      return {
        id: row[0],
        worldId: row[1],
        wave: row[2],
        wavesPerWorld: 20,
        rewardVCoins: row[3],
        spawnPoolMaxLevel: row[4],
        dangerGraceMs: row[5],
        friction: row[6],
        wallBounce: row[7],
        monsterBounce: row[8],
        orders: (row[9] || []).map((order) => ({
          monsterLevel: order[0],
          amount: order[1]
        }))
      };
    });
  },

  getLevel(index) {
    const safeIndex = Math.max(1, Math.min(Number(index || 1), 100));
    const level = this.levels.find((item) => item.id === safeIndex) || this.levels[0];

    const world = this.getWorldById(level.worldId);
    this.currentWorld = world;

    return {
      ...level,
      theme: world.id,
      nameKey: world.nameKey,
      background: world.background,
      themeColor: world.themeColor,
      worldId: world.id,
      worldNumber: this.worlds.findIndex((item) => item.id === world.id) + 1
    };
  },

  getWorldById(worldId) {
    return this.worlds.find((world) => world.id === worldId) || this.worlds[0] || {
      id: "lab",
      nameKey: "world_lab_name",
      background: "./assets/environment/backgrounds/bg_lab_main_01.webp",
      themeColor: "#7ce7ff",
      monstersFolder: "lab"
    };
  },

  getCurrentWorld() {
    return this.currentWorld || this.worlds[0] || this.getWorldById("lab");
  },

  getMonsterByLevel(level) {
    const world = this.getCurrentWorld();
    const base = this.monsters.find((monster) => monster.level === level) || this.monsters[0];

    if (!base) {
      return {
        id: "monster_fallback",
        level: 1,
        nameKey: "monster_fallback",
        radius: 20,
        drawRadius: 21,
        score: 10,
        color: "#7ce7ff",
        asset: "./assets/monsters/monster_01.webp"
      };
    }

    const fileName = `monster_${String(base.level).padStart(2, "0")}.webp`;
    const classicAsset = `./assets/monsters/${world.monstersFolder}/${fileName}`;
    let asset = classicAsset;

    const activeSkinId = window.VMSShop?.getActiveMonsterSkin?.();

    if (activeSkinId) {
      const activeMatch = String(activeSkinId).match(/^(.+?)_(.+?)_monster_(\d+)$/);

      if (activeMatch) {
        const activeWorldId = activeMatch[1];
        const activeStyleId = activeMatch[2];
        const activeMonsterNumber = activeMatch[3];

        if (activeWorldId === world.id && activeMonsterNumber === String(base.level).padStart(2, "0")) {
          asset = `./assets/shop/skins/${world.id}/${activeStyleId}/monster_${activeMonsterNumber}.webp`;
        }
      }
    }

    return {
      ...base,
      id: `${world.id}_monster_${String(base.level).padStart(2, "0")}`,
      nameKey: `${world.id}_monster_${String(base.level).padStart(2, "0")}`,
      asset
    };
  },

  getInfiniteLevel(worldId) {
  const world = this.getWorldById(worldId);
  this.currentWorld = world;

  return {
    id: `infinite_${world.id}`,
    worldId: world.id,
    worldNumber: this.worlds.findIndex((item) => item.id === world.id) + 1,
    wave: null,
    wavesPerWorld: null,
    nameKey: world.nameKey,
    background: world.background,
    themeColor: world.themeColor,
    spawnPoolMaxLevel: world.id === "lab" ? 3 : world.id === "ocean" ? 3 : world.id === "volcano" ? 4 : 5,
    dangerGraceMs: world.id === "secret" ? 3300 : 3900,
    friction: 0.989,
    wallBounce: 0.34,
    monsterBounce: 0.18,
    rewardVCoins: 0,
    orders: [],
    isInfinite: true
  };
},

getMaxMonsterLevel() {
    return 15;
  },

  getRandomSpawnLevel(maxLevel = 3) {
    const cappedMax = Math.max(1, Math.min(Number(maxLevel || 3), 5));
    const roll = Math.random();

    if (cappedMax >= 5 && roll > 0.985) return 5;
    if (cappedMax >= 4 && roll > 0.965) return 4;
    if (cappedMax >= 3 && roll > 0.93) return 3;
    if (cappedMax >= 2 && roll > 0.70) return 2;

    return 1;
  }
};
