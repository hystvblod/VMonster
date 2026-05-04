window.VMSLevels = {
  levels: [],
  monsters: [],

  async init() {
    const [levelsRes, monstersRes] = await Promise.all([
      fetch("./data/levels.json"),
      fetch("./data/monsters.json")
    ]);

    this.levels = (await levelsRes.json()).levels || [];
    this.monsters = (await monstersRes.json()).monsters || [];
  },

  getLevel(index) {
    if (!this.levels.length) {
      return {
        id: 1,
        theme: "lab_classic",
        trackWidthRatio: 0.72,
        spawnPoolMaxLevel: 3,
        dangerGraceMs: 1200,
        friction: 0.992,
        wallBounce: 0.55,
        monsterBounce: 0.35
      };
    }

    return this.levels[(index - 1) % this.levels.length];
  },

  getMonsterByLevel(level) {
    return this.monsters.find((monster) => monster.level === level) || this.monsters[0];
  },

  getMaxMonsterLevel() {
    return this.monsters.reduce((max, monster) => Math.max(max, monster.level), 1);
  },

  getRandomSpawnLevel(maxLevel = 3) {
    const cappedMax = Math.max(1, Math.min(maxLevel, 3));
    const roll = Math.random();

    if (cappedMax >= 3 && roll > 0.93) return 3;
    if (cappedMax >= 2 && roll > 0.70) return 2;
    return 1;
  }
};
