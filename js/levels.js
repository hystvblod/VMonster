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
  const normalized = rawLevels.map((row, index) => {
    let level;

    if (!Array.isArray(row)) {
      level = {
        ...row,
        id: index + 1
      };
    } else {
      level = {
        id: index + 1,
        originalId: row[0],
        worldId: row[1],
        wave: row[2],
        wavesPerWorld: null,
        rewardVCoins: row[3],
        spawnPoolMaxLevel: row[4],
        dangerGraceMs: row[5],
        friction: row[6],
        wallBounce: row[7],
        monsterBounce: row[8],
        orders: (row[9] || []).map((order) => ({
          monsterLevel: Number(order[0] || 1),
          amount: Math.max(1, Number(order[1] || 1))
        }))
      };
    }

    const orders = Array.isArray(level.orders)
      ? level.orders.map((order) => ({
          monsterLevel: Number(order.monsterLevel || 1),
          amount: Math.max(1, Number(order.amount || 1))
        }))
      : [];

    return {
      ...level,
      orders,
      spawnPoolMaxLevel: this.getPlayableSpawnMaxLevel(
        orders,
        Number(level.spawnPoolMaxLevel || 2)
      )
    };
  });

  return normalized.map((level) => ({
    ...level,
    wavesPerWorld: normalized.filter((item) => item.worldId === level.worldId).length
  }));
},

  getLevel(index) {
    const totalLevels = this.getTotalLevels();
    const safeIndex = Math.max(1, Math.min(Number(index || 1), totalLevels));
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

  getTotalLevels() {
    return Array.isArray(this.levels) ? this.levels.length : 1;
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

getPlayableSpawnMaxLevel(orders, originalMaxLevel = 2) {
  const safeOrders = Array.isArray(orders) ? orders : [];

  if (!safeOrders.length) {
    return Math.max(
      1,
      Math.min(Number(originalMaxLevel || 2), this.getMaxMonsterLevel())
    );
  }

  const highestOrderLevel = safeOrders.reduce((max, order) => {
    return Math.max(max, Number(order.monsterLevel || 1));
  }, 1);

  const totalOrderAmount = safeOrders.reduce((sum, order) => {
    return sum + Math.max(1, Number(order.amount || 1));
  }, 0);

  /*
    Équilibrage campagne propre :

    - commande simple :
      spawn max = niveau demandé - 4

    - commande double ou multiple :
      spawn max = niveau demandé - 3

    - niveau 11 seulement pour :
      niveau 15 demandé
      ou plusieurs monstres niveau 14

    Exemple important :
    2 monstres niveau 7 => spawn max 4
    Donc le jeu donne 1, 2, 3 ou 4.
    Il ne donne pas niveau 5.
  */

  const isComplexOrder = totalOrderAmount >= 2 || safeOrders.length >= 2;
  const difficultyGap = isComplexOrder ? 3 : 4;

  let autoMaxLevel = highestOrderLevel - difficultyGap;
  autoMaxLevel = Math.max(2, autoMaxLevel);

  const allowLevel11 = highestOrderLevel >= 15 || (
    highestOrderLevel >= 14 &&
    totalOrderAmount >= 2
  );

  if (!allowLevel11) {
    autoMaxLevel = Math.min(autoMaxLevel, 10);
  }

  return Math.max(
    2,
    Math.min(
      Math.max(Number(originalMaxLevel || 2), autoMaxLevel),
      this.getMaxMonsterLevel(),
      allowLevel11 ? 11 : 10
    )
  );
},

getRandomSpawnLevel(maxLevel = 3) {
  const cappedMax = Math.max(
    1,
    Math.min(Number(maxLevel || 2), this.getMaxMonsterLevel(), 11)
  );

  /*
    Fenêtre de 4 niveaux.

    Exemples :
    max 4  => 1, 2, 3, 4
    max 8  => 5, 6, 7, 8
    max 10 => 7, 8, 9, 10
    max 11 => 8, 9, 10, 11
  */
  const minLevel = Math.max(1, cappedMax - 3);
  const pool = [];

  for (let level = minLevel; level <= cappedMax; level += 1) {
    pool.push(level);
  }

  /*
    Chances dans la fenêtre :
    - plus petit niveau : 55 %
    - suivant : 28 %
    - suivant : 12 %
    - niveau max : 5 %
  */
  const baseWeights = [55, 28, 12, 5];
  const weights = baseWeights.slice(0, pool.length);
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

  let roll = Math.random() * totalWeight;

  for (let i = 0; i < pool.length; i += 1) {
    roll -= weights[i];

    if (roll <= 0) {
      return pool[i];
    }
  }

  return pool[pool.length - 1] || 1;
}
};
