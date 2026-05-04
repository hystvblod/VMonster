window.VMSGame = {
  running: false,
  raf: 0,

  levelIndex: 1,
  score: 0,
  bestScore: 0,
  maxMonsterReached: 1,

  lastTime: 0,
  spawnCooldown: 0,
  dangerTimer: 0,
  gameOver: false,

  currentMonster: null,
  nextMonsterLevel: 1,

  state: {
    delta: 16,
    monsters: [],
    particles: [],
    aim: {
      active: false,
      startX: 0,
      startY: 0,
      x: 0,
      y: 0,
      power: 0,
      vx: 0,
      vy: 0
    },
    dangerY: 0,
    dangerRatio: 0,
    level: null
  },

  start() {
    this.running = true;
    this.gameOver = false;
    this.score = 0;
    this.maxMonsterReached = 1;
    this.spawnCooldown = 0;
    this.dangerTimer = 0;

    this.state.monsters = [];
    this.state.particles = [];
    this.state.aim.active = false;

    this.state.level = VMSLevels.getLevel(this.levelIndex);
    this.bestScore = VMSStorage.get("bestScore", 0);

    this.nextMonsterLevel = VMSLevels.getRandomSpawnLevel(this.state.level.spawnPoolMaxLevel || 3);
    this.spawnCurrentMonster();

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
    this.updateSpawnCooldown(delta);
    this.updatePhysics(delta);
    this.updateParticles(delta);
    this.updateDanger(delta);
  },

  updateSpawnCooldown(delta) {
    if (this.currentMonster) return;

    this.spawnCooldown -= delta;

    if (this.spawnCooldown <= 0) {
      this.spawnCurrentMonster();
    }
  },

  spawnCurrentMonster() {
    const level = this.nextMonsterLevel || 1;
    const meta = VMSLevels.getMonsterByLevel(level);
    const spawn = VMSRenderer.getSpawnPoint();

    this.currentMonster = {
      id: this.createId(),
      level,
      x: spawn.x,
      y: spawn.y,
      vx: 0,
      vy: 0,
      radius: meta.radius,
      mass: meta.radius * meta.radius,
      launched: false,
      age: 0,
      merging: false,
      color: meta.color,
      asset: meta.asset
    };

    this.nextMonsterLevel = VMSLevels.getRandomSpawnLevel(this.state.level.spawnPoolMaxLevel || 3);
    this.refreshHud();
    this.spawnParticles(spawn.x, spawn.y, "#9cecff", 10);
  },

  startAim(clientX, clientY) {
    if (!this.currentMonster || this.currentMonster.launched || this.gameOver) return;

    this.state.aim.active = true;
    this.state.aim.startX = this.currentMonster.x;
    this.state.aim.startY = this.currentMonster.y;
    this.updateAim(clientX, clientY);
  },

  updateAim(clientX, clientY) {
    if (!this.state.aim.active || !this.currentMonster) return;

    const aim = this.state.aim;
    const dx = clientX - this.currentMonster.x;
    const dy = clientY - this.currentMonster.y;

    let vx = dx;
    let vy = dy;

    if (vy > -40) {
      vy = -140;
    }

    const length = Math.max(1, Math.sqrt(vx * vx + vy * vy));
    const power = VMSUtils.clamp(length, 80, 260);
    const normalizedX = vx / length;
    const normalizedY = vy / length;

    aim.x = clientX;
    aim.y = clientY;
    aim.power = power;
    aim.vx = normalizedX * power * 3.2;
    aim.vy = normalizedY * power * 3.2;

    if (aim.vy > -260) {
      aim.vy = -260;
    }
  },

  releaseAim(clientX, clientY) {
    if (!this.state.aim.active || !this.currentMonster || this.gameOver) return;

    this.updateAim(clientX, clientY);

    const monster = this.currentMonster;
    monster.vx = this.state.aim.vx;
    monster.vy = this.state.aim.vy;
    monster.launched = true;
    monster.age = 0;

    this.state.monsters.push(monster);
    this.currentMonster = null;
    this.spawnCooldown = 420;
    this.state.aim.active = false;

    VMSSettings.vibrate(14);
  },

  cancelAim() {
    this.state.aim.active = false;
  },

  updatePhysics(delta) {
    const dt = delta / 1000;
    const level = this.state.level;
    const track = VMSRenderer.getTrackRect();

    for (const monster of this.state.monsters) {
      monster.age += delta;

      monster.x += monster.vx * dt;
      monster.y += monster.vy * dt;

      const friction = Math.pow(level.friction || 0.992, delta / 16.67);
      monster.vx *= friction;
      monster.vy *= friction;

      if (Math.abs(monster.vx) < 6) monster.vx = 0;
      if (Math.abs(monster.vy) < 6) monster.vy = 0;

      this.resolveWall(monster, track, level.wallBounce || 0.55);
    }

    this.resolveMonsterCollisions(level.monsterBounce || 0.35);
  },

  resolveWall(monster, track, bounce) {
    if (monster.x - monster.radius < track.left) {
      monster.x = track.left + monster.radius;
      monster.vx = Math.abs(monster.vx) * bounce;
    }

    if (monster.x + monster.radius > track.right) {
      monster.x = track.right - monster.radius;
      monster.vx = -Math.abs(monster.vx) * bounce;
    }

    if (monster.y - monster.radius < track.top) {
      monster.y = track.top + monster.radius;
      monster.vy = Math.abs(monster.vy) * bounce;
    }

    if (monster.y + monster.radius > track.bottom) {
      monster.y = track.bottom - monster.radius;
      monster.vy = -Math.abs(monster.vy) * bounce;
    }
  },

  resolveMonsterCollisions(bounce) {
    const monsters = this.state.monsters;

    for (let i = 0; i < monsters.length; i++) {
      for (let j = i + 1; j < monsters.length; j++) {
        const a = monsters[i];
        const b = monsters[j];

        if (!a || !b || a.merging || b.merging) continue;

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distSq = dx * dx + dy * dy;
        const minDist = a.radius + b.radius;

        if (distSq >= minDist * minDist) continue;

        if (a.level === b.level) {
          this.mergeMonsters(a, b);
          return;
        }

        const dist = Math.max(0.001, Math.sqrt(distSq));
        const nx = dx / dist;
        const ny = dy / dist;
        const overlap = minDist - dist;

        a.x -= nx * overlap * 0.5;
        a.y -= ny * overlap * 0.5;
        b.x += nx * overlap * 0.5;
        b.y += ny * overlap * 0.5;

        const relativeVx = b.vx - a.vx;
        const relativeVy = b.vy - a.vy;
        const impulse = relativeVx * nx + relativeVy * ny;

        if (impulse < 0) {
          const force = impulse * bounce;
          a.vx += force * nx;
          a.vy += force * ny;
          b.vx -= force * nx;
          b.vy -= force * ny;
        }
      }
    }
  },

  mergeMonsters(a, b) {
    a.merging = true;
    b.merging = true;

    const maxLevel = VMSLevels.getMaxMonsterLevel();
    const newLevel = Math.min(a.level + 1, maxLevel);
    const meta = VMSLevels.getMonsterByLevel(newLevel);

    const x = (a.x + b.x) / 2;
    const y = (a.y + b.y) / 2;
    const vx = (a.vx + b.vx) * 0.18;
    const vy = (a.vy + b.vy) * 0.18;

    this.state.monsters = this.state.monsters.filter((monster) => {
      return monster.id !== a.id && monster.id !== b.id;
    });

    const merged = {
      id: this.createId(),
      level: newLevel,
      x,
      y,
      vx,
      vy,
      radius: meta.radius,
      mass: meta.radius * meta.radius,
      launched: true,
      age: 1200,
      merging: false,
      color: meta.color,
      asset: meta.asset
    };

    this.state.monsters.push(merged);

    this.maxMonsterReached = Math.max(this.maxMonsterReached, newLevel);
    this.score += meta.score || newLevel * 100;

    this.spawnParticles(x, y, meta.color, 26);
    VMSSettings.vibrate(24);
    this.refreshHud();
  },

  updateParticles(delta) {
    for (const p of this.state.particles) {
      p.x += p.vx * delta;
      p.y += p.vy * delta;
      p.life -= delta * 0.0022;
      p.size *= 0.985;
    }

    this.state.particles = this.state.particles.filter((p) => p.life > 0);
  },

  updateDanger(delta) {
    const dangerY = VMSRenderer.getDangerY();
    const grace = this.state.level.dangerGraceMs || 1200;

    this.state.dangerY = dangerY;

    const danger = this.state.monsters.some((monster) => {
      if (!monster.launched) return false;
      if (monster.age < 900) return false;
      return monster.y + monster.radius > dangerY;
    });

    if (danger) {
      this.dangerTimer += delta;
    } else {
      this.dangerTimer = Math.max(0, this.dangerTimer - delta * 1.8);
    }

    this.state.dangerRatio = VMSUtils.clamp(this.dangerTimer / grace, 0, 1);

    if (this.dangerTimer >= grace) {
      this.endGame();
    }
  },

  endGame() {
    if (this.gameOver) return;

    this.gameOver = true;
    this.stop();

    const coins = Math.max(5, Math.floor(this.score / 120));
    VMSEconomy.addCoins(coins);

    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      VMSStorage.set("bestScore", this.bestScore);
    }

    VMSModals.show({
      title: VMSI18n.t("modal_game_over_title"),
      text: VMSI18n.t("modal_game_over_text", {
        score: this.score,
        coins
      }),
      primaryText: VMSI18n.t("btn_restart"),
      secondaryText: VMSI18n.t("btn_home"),
      onPrimary: () => this.start(),
      onSecondary: () => VMSRouter.home()
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
      onPrimary: () => {
        this.running = true;
        this.lastTime = performance.now();
        this.raf = requestAnimationFrame((time) => this.loop(time));
      },
      onSecondary: () => VMSRouter.home()
    });
  },

  spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.04 + Math.random() * 0.18;

      this.state.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 4 + Math.random() * 8,
        color,
        life: 1
      });
    }
  },

  refreshHud() {
    const levelNode = document.getElementById("hudLevel");
    const scoreNode = document.getElementById("hudScore");
    const bestNode = document.getElementById("hudBest");
    const nextNode = document.getElementById("hudNext");

    if (levelNode) levelNode.textContent = String(this.levelIndex);
    if (scoreNode) scoreNode.textContent = String(this.score);
    if (bestNode) bestNode.textContent = String(this.bestScore || 0);
    if (nextNode) nextNode.textContent = String(this.nextMonsterLevel || 1);
  },

  createId() {
    if (crypto && crypto.randomUUID) return crypto.randomUUID();
    return `monster_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }
};
