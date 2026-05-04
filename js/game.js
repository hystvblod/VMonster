window.VMSGame = {
  running: false,
  raf: 0,
  levelIndex: 1,
  score: 0,
  combo: 1,
  lives: 1,
  lastTime: 0,
  spawnTimer: 0,
  state: {
    delta: 16,
    speed: 1,
    monsters: [],
    portals: [],
    particles: []
  },

  start() {
    this.running = true;
    this.score = 0;
    this.combo = 1;
    this.lives = 1;
    this.spawnTimer = 0;
    this.state.monsters = [];
    this.state.particles = [];

    const level = VMSLevels.getLevel(this.levelIndex);
    this.state.speed = level.speed || 1;
    this.state.portals = level.portals.map((type) => VMSLevels.getPortal(type));

    this.refreshHud();
    this.lastTime = performance.now();
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame((time) => this.loop(time));
  },

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  },

  loop(time) {
    if (!this.running) return;

    const delta = Math.min(34, time - this.lastTime);
    this.lastTime = time;
    this.state.delta = delta;

    this.update(delta);
    VMSRenderer.render(this.state);

    this.raf = requestAnimationFrame((nextTime) => this.loop(nextTime));
  },

  update(delta) {
    this.spawnTimer -= delta;

    if (this.spawnTimer <= 0) {
      this.spawnMonster();
      this.spawnTimer = Math.max(520, 1150 - this.levelIndex * 40);
    }

    const endY = window.innerHeight - 116;

    this.state.monsters.forEach((monster) => {
      monster.y += delta * (.105 + this.levelIndex * .004) * this.state.speed;
    });

    const missed = this.state.monsters.filter((monster) => monster.y > endY + 60);
    if (missed.length > 0) {
      this.combo = 1;
      this.refreshHud();
    }

    this.state.monsters = this.state.monsters.filter((monster) => monster.y <= endY + 60);

    this.state.particles.forEach((p) => {
      p.x += p.vx * delta;
      p.y += p.vy * delta;
      p.life -= delta * .0025;
      p.size *= .99;
    });

    this.state.particles = this.state.particles.filter((p) => p.life > 0);
  },

  spawnMonster() {
    const type = VMSUtils.randomFrom(this.state.portals).type;
    const meta = VMSLevels.getMonster(type);
    const lane = Math.floor(Math.random() * 3);

    this.state.monsters.push({
      id: crypto.randomUUID ? crypto.randomUUID() : String(Math.random()),
      type,
      lane,
      y: 80,
      radius: 25,
      color: meta.color
    });
  },

  handleSwipe(dx, dy) {
    if (!this.running) return;

    let targetLane = 1;

    if (Math.abs(dx) > Math.abs(dy)) {
      targetLane = dx < 0 ? 0 : 2;
    } else {
      targetLane = 1;
    }

    this.sortNearestMonster(targetLane);
  },

  sortNearestMonster(targetLane) {
    if (this.state.monsters.length === 0) return;

    const monster = this.state.monsters.reduce((best, item) => {
      if (!best) return item;
      return item.y > best.y ? item : best;
    }, null);

    const portal = this.state.portals[targetLane];

    if (!monster || monster.y < 160) return;

    const correct = monster.type === portal.type;

    this.state.monsters = this.state.monsters.filter((item) => item.id !== monster.id);

    if (correct) {
      this.score += 10 * this.combo;
      this.combo = Math.min(9, this.combo + 1);
      this.burst(monster, portal.color, 12);
      VMSSettings.vibrate(12);
    } else {
      this.combo = 1;
      this.score = Math.max(0, this.score - 10);
      this.burst(monster, "#ff4d6d", 18);
      VMSSettings.vibrate(45);
    }

    this.refreshHud();

    if (this.score >= 220 + this.levelIndex * 50) {
      this.completeLevel();
    }
  },

  burst(monster, color, count) {
    const laneXs = VMSRenderer.getLaneXs();
    const x = laneXs[monster.lane];

    for (let i = 0; i < count; i++) {
      this.state.particles.push({
        x,
        y: monster.y,
        vx: (Math.random() - .5) * .18,
        vy: (Math.random() - .5) * .18,
        size: 4 + Math.random() * 6,
        color,
        life: .9
      });
    }
  },

  completeLevel() {
    this.stop();

    const reward = VMSRewards.levelReward(this.levelIndex, this.score);
    VMSEconomy.addCoins(reward);

    VMSModals.show({
      title: VMSI18n.t("modal_level_complete_title"),
      text: VMSI18n.t("modal_level_complete_text", { coins: reward }),
      primaryText: VMSI18n.t("btn_next_level"),
      secondaryText: VMSI18n.t("btn_home"),
      onPrimary: () => {
        this.levelIndex += 1;
        this.start();
      },
      onSecondary: () => {
        VMSRouter.home();
      }
    });
  },

  pause() {
    if (!this.running) return;
    this.stop();

    VMSModals.show({
      title: VMSI18n.t("modal_pause_title"),
      text: VMSI18n.t("modal_pause_text"),
      primaryText: VMSI18n.t("btn_resume"),
      secondaryText: VMSI18n.t("btn_home"),
      onPrimary: () => this.start(),
      onSecondary: () => VMSRouter.home()
    });
  },

  refreshHud() {
    document.getElementById("hudLevel").textContent = String(this.levelIndex);
    document.getElementById("hudScore").textContent = String(this.score);
    document.getElementById("hudCombo").textContent = String(this.combo);
  }
};
