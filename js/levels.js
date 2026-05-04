window.VMSLevels = {
  levels: [],
  monsters: [],
  portals: [],

  async init() {
    const [levelsRes, monstersRes, portalsRes] = await Promise.all([
      fetch("./data/levels.json"),
      fetch("./data/monsters.json"),
      fetch("./data/portals.json")
    ]);

    this.levels = (await levelsRes.json()).levels || [];
    this.monsters = (await monstersRes.json()).monsters || [];
    this.portals = (await portalsRes.json()).portals || [];
  },

  getLevel(index) {
    return this.levels[(index - 1) % this.levels.length];
  },

  getMonster(type) {
    return this.monsters.find((monster) => monster.type === type);
  },

  getPortal(type) {
    return this.portals.find((portal) => portal.type === type);
  }
};
