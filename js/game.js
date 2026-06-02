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

  mode: "campaign",
  infiniteWorldId: null,

  currentMonster: null,
  nextMonsterLevel: 1,

  state: {
    delta: 16,
    monsters: [],
    particles: [],
    orders: [],
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

  getMonsterFootprint(monster) {
    const meta = VMSLevels.getMonsterByLevel(Number(monster.level || 1)) || {};
    const level = Number(monster.level || 1);
    const worldScale = VMSRenderer.getWorldScale ? VMSRenderer.getWorldScale() : 1;

    const baseVisualRadius = Number(
      monster.baseDrawRadius ||
      monster.drawRadius ||
      meta.drawRadius ||
      monster.radius ||
      meta.radius ||
      40
    );

    const visualRadius = baseVisualRadius * worldScale;
    const info = VMSRenderer.getMonsterDrawInfo ? VMSRenderer.getMonsterDrawInfo(monster) : null;

    if (!info) {
      const size = visualRadius * 2.35;
      const half = size / 2;

      return {
        x: monster.x,
        y: monster.y + half,
        rx: Math.round(half),
        ry: Math.round(half),
        offsetY: half,
        radius: Math.round(half),
        visualRadius,
        level,
        left: monster.x - half,
        right: monster.x + half,
        top: monster.y - half,
        bottom: monster.y + half
      };
    }

    const left = info.drawX;
    const right = info.drawX + info.drawW;
    const top = info.drawY;
    const bottom = info.drawY + info.drawH;

    const rx = info.drawW / 2;
    const ry = info.drawH / 2;

    return {
      x: monster.x,
      y: bottom,
      rx: Math.round(rx),
      ry: Math.round(ry),
      offsetY: bottom - monster.y,
      radius: Math.round(Math.max(rx, ry)),
      visualRadius,
      level,
      left,
      right,
      top,
      bottom
    };
  },

  getCollisionAlphaThreshold() {
    // Ignore les halos/lueurs faibles autour des monstres.
    return 95;
  },

  getFusionPaddingPx() {
    // Fusion un peu plus permissive : vrais pixels + petit contour.
    return 8;
  },

  getPixelCollisionStep() {
    // 1 = précis. 2 = plus léger si beaucoup de monstres.
    return this.state?.monsters?.length > 12 ? 2 : 1;
  },

  getSpriteOverlapRect(spriteA, spriteB, paddingA = 0, paddingB = 0) {
    const left = Math.max(spriteA.drawX - paddingA, spriteB.drawX - paddingB);
    const top = Math.max(spriteA.drawY - paddingA, spriteB.drawY - paddingB);
    const right = Math.min(spriteA.drawX + spriteA.drawW + paddingA, spriteB.drawX + spriteB.drawW + paddingB);
    const bottom = Math.min(spriteA.drawY + spriteA.drawH + paddingA, spriteB.drawY + spriteB.drawH + paddingB);

    if (right <= left || bottom <= top) return null;

    return { left, top, right, bottom, width: right - left, height: bottom - top };
  },

  isSpriteOpaqueAtScreenPoint(sprite, mask, screenX, screenY, alphaThreshold, paddingPx = 0) {
    const rawX = ((screenX - sprite.drawX) / sprite.drawW) * mask.width;
    const rawY = ((screenY - sprite.drawY) / sprite.drawH) * mask.height;

    const padX = Math.max(0, Math.ceil((paddingPx / sprite.drawW) * mask.width));
    const padY = Math.max(0, Math.ceil((paddingPx / sprite.drawH) * mask.height));

    if (rawX < -padX || rawX > mask.width - 1 + padX) return false;
    if (rawY < -padY || rawY > mask.height - 1 + padY) return false;

    const centerX = Math.max(0, Math.min(mask.width - 1, Math.round(rawX)));
    const centerY = Math.max(0, Math.min(mask.height - 1, Math.round(rawY)));

    const minX = Math.max(0, centerX - padX);
    const maxX = Math.min(mask.width - 1, centerX + padX);
    const minY = Math.max(0, centerY - padY);
    const maxY = Math.min(mask.height - 1, centerY + padY);

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const alpha = mask.data[(y * mask.width + x) * 4 + 3];
        if (alpha > alphaThreshold) return true;
      }
    }

    return false;
  },

  monstersOpaqueTouch(a, b, options = {}) {
    const spriteA = VMSRenderer.getMonsterDrawInfo ? VMSRenderer.getMonsterDrawInfo(a) : null;
    const spriteB = VMSRenderer.getMonsterDrawInfo ? VMSRenderer.getMonsterDrawInfo(b) : null;

    if (!spriteA || !spriteB) {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const fa = this.getMonsterFootprint(a);
      const fb = this.getMonsterFootprint(b);
      const minDist = fa.radius + fb.radius;
      return dx * dx + dy * dy <= minDist * minDist;
    }

    const maskA = VMSRenderer.getImageOpaqueMask ? VMSRenderer.getImageOpaqueMask(spriteA.img) : null;
    const maskB = VMSRenderer.getImageOpaqueMask ? VMSRenderer.getImageOpaqueMask(spriteB.img) : null;

    if (!maskA || !maskB) {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const fa = this.getMonsterFootprint(a);
      const fb = this.getMonsterFootprint(b);
      const minDist = fa.radius + fb.radius;
      return dx * dx + dy * dy <= minDist * minDist;
    }

    const alphaThreshold = Number(options.alphaThreshold ?? this.getCollisionAlphaThreshold());
    const paddingPx = Number(options.paddingPx || 0);
    const step = Math.max(1, Number(options.step || this.getPixelCollisionStep()));

    const overlap = this.getSpriteOverlapRect(spriteA, spriteB, paddingPx, paddingPx);
    if (!overlap) return false;

    const startX = Math.floor(overlap.left);
    const endX = Math.ceil(overlap.right);
    const startY = Math.floor(overlap.top);
    const endY = Math.ceil(overlap.bottom);

    for (let y = startY; y < endY; y += step) {
      const screenY = y + 0.5;

      for (let x = startX; x < endX; x += step) {
        const screenX = x + 0.5;

        const opaqueA = this.isSpriteOpaqueAtScreenPoint(
          spriteA,
          maskA,
          screenX,
          screenY,
          alphaThreshold,
          paddingPx
        );

        if (!opaqueA) continue;

        const opaqueB = this.isSpriteOpaqueAtScreenPoint(
          spriteB,
          maskB,
          screenX,
          screenY,
          alphaThreshold,
          paddingPx
        );

        if (opaqueB) return true;
      }
    }

    return false;
  },

  getMonsterPhysicsCollider(monster) {
    const meta = VMSLevels.getMonsterByLevel(Number(monster.level || 1)) || {};
    const info = VMSRenderer.getMonsterDrawInfo ? VMSRenderer.getMonsterDrawInfo(monster) : null;
    const worldScale = VMSRenderer.getWorldScale ? VMSRenderer.getWorldScale() : 1;

    if (!info) {
      const visualRadius = Number(
        monster.baseDrawRadius ||
        monster.drawRadius ||
        meta.drawRadius ||
        monster.radius ||
        meta.radius ||
        40
      ) * worldScale;

      return {
        x: monster.x,
        y: monster.y,
        radius: visualRadius * 0.82
      };
    }

    return {
      x: monster.x,
      y: info.drawY + info.drawH * 0.62,
      radius: Math.max(info.drawW * 0.34, info.drawH * 0.28)
    };
  },

  getMonsterTrackFootprint(monster) {
    const meta = VMSLevels.getMonsterByLevel(Number(monster.level || 1)) || {};
    const info = VMSRenderer.getMonsterDrawInfo ? VMSRenderer.getMonsterDrawInfo(monster) : null;
    const worldScale = VMSRenderer.getWorldScale ? VMSRenderer.getWorldScale() : 1;

    if (!info) {
      const visualRadius = Number(
        monster.baseDrawRadius ||
        monster.drawRadius ||
        meta.drawRadius ||
        monster.radius ||
        meta.radius ||
        40
      ) * worldScale;

      const rx = visualRadius * 0.42;
      const ry = visualRadius * 0.16;
      const y = monster.y + visualRadius * 0.72;

      return {
        x: monster.x,
        y,
        rx,
        ry,
        left: monster.x - rx,
        right: monster.x + rx,
        top: y - ry,
        bottom: y + ry,
        offsetY: y - monster.y
      };
    }

    const rx = Math.max(10 * worldScale, info.drawW * 0.27);
    const ry = Math.max(5 * worldScale, info.drawH * 0.09);
    const y = info.drawY + info.drawH * 0.86;

    return {
      x: monster.x,
      y,
      rx,
      ry,
      left: monster.x - rx,
      right: monster.x + rx,
      top: y - ry,
      bottom: y + ry,
      offsetY: y - monster.y
    };
  },

  getActiveShopBackgroundForCurrentWorld() {
    const worldId = this.state?.level?.worldId;
    if (!worldId) return null;

    const activeId = window.VMSShop?.getActiveBackground?.();
    if (!activeId || activeId === "default_background") return null;

    const baseMap = {
      lab: "./assets/environment/backgrounds/bg_lab_main_01.webp",
      ocean: "./assets/environment/backgrounds/bg_ocean_main_01.webp",
      volcano: "./assets/environment/backgrounds/bg_volcano_main_01.webp",
      nuclear: "./assets/environment/backgrounds/bg_nuclear_main_01.webp",
      secret: "./assets/environment/backgrounds/bg_secret_main_01.webp"
    };

    if (activeId === `${worldId}_base_background`) {
      return baseMap[worldId] || baseMap.lab;
    }

    const match = String(activeId).match(/^(.+)_bg_([a-z0-9_-]+)$/i);
    if (!match) return null;

    const activeWorldId = match[1];
    const bgId = match[2];

    if (activeWorldId !== worldId) return null;

    return `./assets/shop/backgrounds/${worldId}/bg_${bgId}.webp`;
  },

  startInfinite(worldId) {
    this.mode = "infinite";
    this.infiniteWorldId = worldId || "lab";
    this.start({
      mode: "infinite",
      worldId: this.infiniteWorldId
    });
  },

  async start(options = {}) {
    await VMSUserData?.refreshRemote?.();

    this.mode = options.mode || "campaign";
    this.infiniteWorldId = options.worldId || null;

    if (this.mode !== "infinite" && (!this.levelIndex || this.levelIndex < 1)) {
      this.levelIndex = VMSStorage.get("currentLevel", 1);
    }

    this.running = true;
    this.gameOver = false;
    this.score = 0;
    this.maxMonsterReached = 1;
    this.spawnCooldown = 0;
    this.dangerTimer = 0;

    this.state.monsters = [];
    this.state.particles = [];
    this.state.orders = [];
    this.state.aim.active = false;

    this.state.level = this.mode === "infinite"
      ? VMSLevels.getInfiniteLevel(this.infiniteWorldId || "lab")
      : VMSLevels.getLevel(this.levelIndex);

    this.state.orders = this.mode === "infinite"
      ? []
      : this.createOrdersForLevel(this.state.level);
    this.bestScore = VMSStorage.get("bestScore", 0);

    const activeBackground = this.getActiveShopBackgroundForCurrentWorld();

    if (activeBackground) {
      VMSRenderer.setBackground(activeBackground);
    } else if (this.state.level.background) {
      VMSRenderer.setBackground(this.state.level.background);
    }

    /*
      On attend le chargement réel des monstres avant de lancer la partie.
      Comme ça, plus de ronds placeholder visibles pendant le jeu.
    */
    await VMSRenderer.preloadForLevel(this.state);

    this.nextMonsterLevel = VMSLevels.getRandomSpawnLevel(this.state.level.spawnPoolMaxLevel || 3);
    this.spawnCurrentMonster();

    this.refreshHud();

    this.lastTime = performance.now();
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame((time) => this.loop(time));
  },

  createOrdersForLevel(level) {
    const rawOrders = Array.isArray(level.orders) ? level.orders : [];

    return rawOrders.map((order, index) => {
      return {
        id: `order_${level.id}_${index}`,
        monsterLevel: Number(order.monsterLevel || 1),
        amount: Math.max(1, Number(order.amount || 1)),
        done: 0
      };
    });
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
    this.updateCollectedMonsters(delta);
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

    const monster = {
      id: this.createId(),
      level,
      x: spawn.x,
      y: spawn.y,
      vx: 0,
      vy: 0,
      baseRadius: meta.radius,
      baseDrawRadius: meta.drawRadius || meta.radius,
      radius: meta.radius,
      drawRadius: meta.drawRadius || meta.radius,
      mass: meta.radius * meta.radius,
      launched: false,
      age: 0,
      merging: false,
      color: meta.color,
      asset: meta.asset
    };

    /*
      IMPORTANT :
      Le point de lancement correspond à l'ellipse au sol du monstre,
      pas au centre de l'image.
      Comme ça, petit monstre ou dragon énorme : leur base est placée pareil.
    */
    const footprint = this.getMonsterTrackFootprint
      ? this.getMonsterTrackFootprint(monster)
      : this.getMonsterFootprint(monster);

    monster.y = spawn.y - footprint.offsetY;

    this.currentMonster = monster;

    this.nextMonsterLevel = VMSLevels.getRandomSpawnLevel(this.state.level.spawnPoolMaxLevel || 3);
    this.refreshHud();
    this.spawnParticles(monster.x, spawn.y, "#9cecff", 10);
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

    window.VMSGameTools?.createUndoSnapshot?.();

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
    const level = this.state.level || {};
    const track = VMSRenderer.getTrackRect();

    for (const monster of this.state.monsters) {
      monster.age += delta;

      monster.x += monster.vx * dt;
      monster.y += monster.vy * dt;

      const friction = Math.pow(level.friction || 0.992, delta / 16.67);
      monster.vx *= friction;
      monster.vy *= friction;

      // On garde le lancer fluide, mais on évite que les monstres reviennent trop fort vers le joueur.
      if (monster.vy > 0) {
        monster.vy *= 0.74;
      }

      const dangerY = VMSRenderer.getDangerY();
      const footprint = this.getMonsterTrackFootprint
        ? this.getMonsterTrackFootprint(monster)
        : this.getMonsterFootprint(monster);

      if (monster.age > 700 && footprint.bottom > dangerY - 8 && monster.vy > 0) {
        monster.vy *= 0.35;
      }

      if (Math.abs(monster.vx) < 6) monster.vx = 0;
      if (Math.abs(monster.vy) < 6) monster.vy = 0;

      this.resolveWall(monster, track, level.wallBounce || 0.55);
    }

    this.resolveMonsterCollisions(level.monsterBounce || 0.35);
  },

  resolveWall(monster, track, bounce = 0.55) {
    const rect = VMSRenderer.getTrackRect();

    /*
      Pour la piste, on n'utilise PAS les pixels du haut, les cornes ou les ailes.
      On utilise une petite ellipse au sol : la base du monstre.
    */
    let fp = this.getMonsterTrackFootprint
      ? this.getMonsterTrackFootprint(monster)
      : this.getMonsterFootprint(monster);

    const boundsAtBase = VMSRenderer.getTrackBoundsAt(fp.y, 0);

    if (fp.left < boundsAtBase.left) {
      monster.x += boundsAtBase.left - fp.left;
      monster.vx = Math.abs(monster.vx) * bounce * 0.45;
    } else if (fp.right > boundsAtBase.right) {
      monster.x -= fp.right - boundsAtBase.right;
      monster.vx = -Math.abs(monster.vx) * bounce * 0.45;
    }

    fp = this.getMonsterTrackFootprint
      ? this.getMonsterTrackFootprint(monster)
      : this.getMonsterFootprint(monster);

    if (fp.top < rect.top) {
      monster.y += rect.top - fp.top;
      monster.vy = Math.max(0, monster.vy) * 0.08;
      monster.vx *= 0.82;
    }

    fp = this.getMonsterTrackFootprint
      ? this.getMonsterTrackFootprint(monster)
      : this.getMonsterFootprint(monster);

    if (fp.bottom > rect.bottom) {
      monster.y -= fp.bottom - rect.bottom;
      monster.vy = -Math.abs(monster.vy) * 0.12;
      monster.vx *= 0.82;
    }
  },

  resolveMonsterCollisions(bounce) {
    const monsters = this.state.monsters;

    for (let i = 0; i < monsters.length; i++) {
      for (let j = i + 1; j < monsters.length; j++) {
        const a = monsters[i];
        const b = monsters[j];

        if (!a || !b || a.merging || b.merging || a.collecting || b.collecting) continue;

        /*
          Même niveau :
          la fusion utilise les vrais pixels de l'image,
          avec une petite marge propre autour.
        */
        if (a.level === b.level) {
          const fusionTouch = this.monstersOpaqueTouch(a, b, {
            paddingPx: this.getFusionPaddingPx ? this.getFusionPaddingPx() : 8,
            alphaThreshold: this.getCollisionAlphaThreshold ? this.getCollisionAlphaThreshold() : 95,
            step: Math.max(2, this.getPixelCollisionStep ? this.getPixelCollisionStep() : 1)
          });

          if (fusionTouch) {
            this.mergeMonsters(a, b);
            return;
          }

          continue;
        }

        /*
          Niveaux différents :
          les pixels servent seulement à confirmer le vrai contact visuel.
          Si les pixels ne se touchent pas, il n'y a aucune collision.
        */
        const collisionTouch = this.monstersOpaqueTouch(a, b, {
          paddingPx: 0,
          alphaThreshold: this.getCollisionAlphaThreshold ? this.getCollisionAlphaThreshold() : 95,
          step: this.getPixelCollisionStep ? this.getPixelCollisionStep() : 1
        });

        if (!collisionTouch) continue;

        /*
          À partir d'ici, on revient à l'ancienne physique stable :
          direction centre à centre, séparation douce, rebond selon la force,
          amortissement à 0.96.
        */
        const ca = this.getMonsterPhysicsCollider
          ? this.getMonsterPhysicsCollider(a)
          : this.getMonsterFootprint(a);

        const cb = this.getMonsterPhysicsCollider
          ? this.getMonsterPhysicsCollider(b)
          : this.getMonsterFootprint(b);

        const dx = cb.x - ca.x;
        const dy = cb.y - ca.y;
        const distSq = dx * dx + dy * dy;

        const minDist = ca.radius + cb.radius;
        const dist = Math.max(0.001, Math.sqrt(distSq));

        const nx = dx / dist;
        const ny = dy / dist;

        /*
          Si les pixels se touchent mais que les cercles physiques ne sont pas encore
          assez enfoncés, on donne une petite profondeur minimum.
          Ça évite le contact qui clignote : colle / sépare / recolle.
        */
        const overlap = Math.max(2.5, minDist - dist);

        /*
          Ancienne séparation stable.
        */
        a.x -= nx * overlap * 0.52;
        a.y -= ny * overlap * 0.52;

        b.x += nx * overlap * 0.52;
        b.y += ny * overlap * 0.52;

        const relativeVx = b.vx - a.vx;
        const relativeVy = b.vy - a.vy;
        const impulse = relativeVx * nx + relativeVy * ny;

        /*
          Ancien rebond selon la force d'arrivée.
        */
        if (impulse < 0) {
          const force = impulse * bounce;

          a.vx += force * nx;
          a.vy += force * ny;

          b.vx -= force * nx;
          b.vy -= force * ny;
        }

        /*
          Ancien amortissement.
        */
        a.vx *= 0.96;
        a.vy *= 0.96;

        b.vx *= 0.96;
        b.vy *= 0.96;
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
      baseRadius: meta.radius,
      baseDrawRadius: meta.drawRadius || meta.radius,
      radius: meta.radius,
      drawRadius: meta.drawRadius || meta.radius,
      mass: meta.radius * meta.radius,
      launched: true,
      age: 1200,
      merging: false,
      color: meta.color,
      asset: meta.asset
    };

    this.state.monsters.push(merged);

    this.maxMonsterReached = Math.max(this.maxMonsterReached, newLevel);

    const bestiaryWorldId = this.state?.level?.worldId || VMSLevels.getCurrentWorld?.()?.id || "lab";
    VMSBestiary?.discover?.(bestiaryWorldId, newLevel, { popup: true });

    this.score += meta.score || newLevel * 100;

    this.spawnParticles(x, y, meta.color, 26);
    this.tryCompleteOrderWithMonster(merged);
    VMSSettings.vibrate(24);
    this.refreshHud();
  },

  tryCompleteOrderWithMonster(monster) {
  if (!monster || !Array.isArray(this.state.orders)) return false;

  const order = this.state.orders.find((item) => {
    return item.monsterLevel === monster.level && item.done < item.amount;
  });

  if (!order) return false;

  order.done += 1;

  const slot = VMSRenderer.getOrderSlotPosition(this.state, order.id);
  const meta = VMSLevels.getMonsterByLevel(monster.level);

  monster.collecting = true;
  monster.collectTimer = 0;
  monster.collectDuration = 560;
  monster.collectAlpha = 1;
  monster.collectFromX = monster.x;
  monster.collectFromY = monster.y;
  monster.collectToX = slot ? slot.x : monster.x;
  monster.collectToY = slot ? slot.y : monster.y;
  monster.vx = 0;
  monster.vy = 0;

  this.spawnParticles(monster.x, monster.y, meta.color || "#9cecff", 22);

  if (slot) {
    this.spawnParticles(slot.x, slot.y, meta.color || "#9cecff", 20);
  }

  this.score += 100 * monster.level;

  if (this.areAllOrdersCompleted()) {
    setTimeout(() => {
      if (!this.gameOver) this.completeLevel();
    }, 650);
  }

  return true;
},

updateCollectedMonsters(delta) {
  for (const monster of this.state.monsters) {
    if (!monster.collecting) continue;

    monster.collectTimer += delta;

    const t = VMSUtils.clamp(monster.collectTimer / monster.collectDuration, 0, 1);
    const eased = 1 - Math.pow(1 - t, 3);

    monster.x = monster.collectFromX + (monster.collectToX - monster.collectFromX) * eased;
    monster.y = monster.collectFromY + (monster.collectToY - monster.collectFromY) * eased;
    monster.collectAlpha = 1 - eased;
    monster.radius *= 0.992;
    monster.drawRadius *= 0.992;
  }

  this.state.monsters = this.state.monsters.filter((monster) => {
    return !monster.collecting || monster.collectTimer < monster.collectDuration;
  });
},

areAllOrdersCompleted() {
  if (!Array.isArray(this.state.orders) || !this.state.orders.length) return false;

  return this.state.orders.every((order) => {
    return order.done >= order.amount;
  });
},

completeLevel() {
  if (this.mode === "infinite") return;
  if (this.gameOver) return;

  this.gameOver = true;
  this.stop();

  const rewardVCoins = Math.max(20, Number(this.state.level.rewardVCoins || 80));
  VMSEconomy.addCoins(rewardVCoins);

  if (this.score > this.bestScore) {
    this.bestScore = this.score;
    VMSStorage.set("bestScore", this.bestScore);
  }

  const completedWave = this.state.level.wave || 1;
  const completedWorld = this.state.level.worldNumber || 1;
  const wavesInCurrentWorld = this.state.level.wavesPerWorld || 20;
  const isWorldComplete = completedWave >= wavesInCurrentWorld;

  const maxCampaignLevel = VMSLevels.getTotalLevels();
  this.levelIndex += 1;
  if (this.levelIndex > maxCampaignLevel) this.levelIndex = maxCampaignLevel;

  VMSStorage.set("currentLevel", this.levelIndex);
    VMSUserData?.saveProgress?.();

  const nextText = isWorldComplete
    ? VMSI18n.t("btn_next_world")
    : VMSI18n.t("btn_next_wave");

  VMSModals.show({
    title: isWorldComplete
      ? VMSI18n.t("modal_world_complete_title")
      : VMSI18n.t("modal_order_complete_title"),
    text: isWorldComplete
      ? VMSI18n.t("modal_world_complete_text", {
          world: completedWorld,
          coins: rewardVCoins
        })
      : VMSI18n.t("modal_order_complete_text", {
          wave: completedWave,
          coins: rewardVCoins
        }),
    rewardAmount: rewardVCoins,
    rewardIcon: window.VMSAsset("ui", "vcoins"),
    primaryText: VMSI18n.t("btn_double_reward"),
    secondaryText: nextText,
    tertiaryText: VMSI18n.t("btn_home"),
    onPrimary: async () => {
      const watched = await VMSAds.showRewarded("double_reward");

      if (watched) {
        VMSEconomy.addCoins(rewardVCoins);

        VMSModals.show({
          title: VMSI18n.t("modal_reward_doubled_title"),
          text: VMSI18n.t("modal_reward_doubled_text", {
            coins: rewardVCoins * 2
          }),
          rewardAmount: rewardVCoins * 2,
          rewardIcon: window.VMSAsset("ui", "vcoins"),
          primaryText: nextText,
          secondaryText: VMSI18n.t("btn_home"),
          onPrimary: () => this.start(),
          onSecondary: () => VMSRouter.home()
        });

        return;
      }

      this.start();
    },
    onSecondary: () => this.start(),
    onTertiary: () => VMSRouter.home()
  });
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

    // Minimum 2800ms pour éviter le game over instant.
    const grace = Math.max(2800, this.state.level?.dangerGraceMs || 2800);

    this.state.dangerY = dangerY;

    const danger = this.state.monsters.some((monster) => {
      if (!monster.launched) return false;

      // Le monstre qui vient d’être lancé ne compte pas.
      if (monster.age < 2500) return false;

      const speed = Math.sqrt(monster.vx * monster.vx + monster.vy * monster.vy);

      // Tant qu’il bouge encore vraiment, on ne déclenche pas la mort.
      if (speed > 95) return false;

      const footprint = this.getMonsterFootprint(monster);

      // Game over basé sur la base au sol, pas sur le haut du sprite.
      return footprint.y + footprint.ry > dangerY;
    });

    if (danger) {
      this.dangerTimer += delta;
    } else {
      this.dangerTimer = Math.max(0, this.dangerTimer - delta * 1.4);
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

    const isInfiniteMode = this.mode === "infinite";

    const coins = isInfiniteMode
      ? Math.min(500, Math.max(10, Math.floor(this.score / 100)))
      : Math.max(5, Math.floor(this.score / 120));

    VMSEconomy.addCoins(coins);

    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      VMSStorage.set("bestScore", this.bestScore);
    }

    VMSReferral?.registerCompletedRun?.();
    VMSReferral?.maybeQueueIndexSharePrompt?.();
    VMSUserData?.saveProgress?.();
    VMSUserData?.refreshRemote?.();
    VMSAds?.maybeShowInterstitial?.("game_over");

    if (isInfiniteMode) {
      VMSModals.show({
        title: VMSI18n.t("modal_game_over_title"),
        text: VMSI18n.t("modal_game_over_text", {
          score: this.score,
          coins
        }),
        rewardAmount: coins,
        rewardIcon: window.VMSAsset("ui", "vcoins"),
        primaryText: VMSI18n.t("btn_double_reward"),
        secondaryText: VMSI18n.t("btn_restart"),
        tertiaryText: VMSI18n.t("btn_home"),
        onPrimary: async () => {
          const watched = await VMSAds.showRewarded("infinite_double_reward");

          if (watched) {
            VMSEconomy.addCoins(coins);

            VMSModals.show({
              title: VMSI18n.t("modal_reward_doubled_title"),
              text: VMSI18n.t("modal_reward_doubled_text", {
                coins: coins * 2
              }),
              rewardAmount: coins * 2,
              rewardIcon: window.VMSAsset("ui", "vcoins"),
              primaryText: VMSI18n.t("btn_restart"),
              secondaryText: VMSI18n.t("btn_home"),
              onPrimary: () => this.start(),
              onSecondary: () => VMSRouter.home()
            });

            VMSUserData?.saveProgress?.();
            return;
          }

          this.start();
        },
        onSecondary: () => this.start(),
        onTertiary: () => VMSRouter.home()
      });

      return;
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

    if (levelNode) {
  const level = this.state.level;
  if (level) {
    levelNode.textContent = `${level.worldNumber}.${level.wave}`;
  } else {
    levelNode.textContent = String(this.levelIndex);
  }
}
    if (scoreNode) scoreNode.textContent = String(this.score);
    if (bestNode) bestNode.textContent = String(this.bestScore || 0);
    if (nextNode) nextNode.textContent = String(this.nextMonsterLevel || 1);
  },

  createId() {
    if (crypto && crypto.randomUUID) return crypto.randomUUID();
    return `monster_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }
};
