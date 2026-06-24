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
  trajectoryPreviewCache: null,

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

    const baseRadius = Number(
      monster.baseRadius ||
      monster.radius ||
      meta.radius ||
      40
    );

    const baseVisualRadius = Number(
      monster.baseDrawRadius ||
      monster.drawRadius ||
      meta.drawRadius ||
      baseRadius
    );

    const radius = baseRadius * worldScale;
    const visualRadius = baseVisualRadius * worldScale;

    let rxFactor;
    let ryFactor;
    let offsetFactor;

    if (level <= 3) {
      rxFactor = 0.72;
      ryFactor = 0.24;
      offsetFactor = 0.52;
    } else if (level <= 7) {
      rxFactor = 0.75;
      ryFactor = 0.23;
      offsetFactor = 0.58;
    } else if (level <= 11) {
      rxFactor = 0.78;
      ryFactor = 0.22;
      offsetFactor = 0.64;
    } else {
      rxFactor = 0.80;
      ryFactor = 0.21;
      offsetFactor = 0.70;
    }

    const rx = Math.round(visualRadius * rxFactor);
    const ry = Math.round(visualRadius * ryFactor);
    const offsetY = Math.round(visualRadius * offsetFactor);

    return {
      x: monster.x,
      y: monster.y + offsetY,
      rx,
      ry,
      offsetY,
      radius,
      visualRadius,
      level
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
    this.trajectoryPreviewCache = null;

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
    const footprint = this.getMonsterFootprint(monster);
    monster.y = spawn.y - footprint.offsetY;

    this.currentMonster = monster;

    const bestiaryWorldId = this.state?.level?.worldId || VMSLevels.getCurrentWorld?.()?.id || "lab";
    window.VMSBestiary?.discover?.(bestiaryWorldId, level, { popup: false });

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

    this.trajectoryPreviewCache = null;

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
    this.trajectoryPreviewCache = null;

    window.VMSGameTools
      ?.consumeAdvancedTrajectoryLaunch?.();

    VMSSettings.vibrate(14);
  },

  cancelAim() {
    this.state.aim.active = false;
  },

  getAdvancedTrajectoryPreview() {
    if (
      !window.VMSGameTools
        ?.isAdvancedTrajectoryActive?.()
    ) {
      return null;
    }

    if (
      !this.state?.aim?.active ||
      !this.currentMonster
    ) {
      return null;
    }

    const aim = this.state.aim;
    const now = performance.now();
    const cache = this.trajectoryPreviewCache;

    if (
      cache &&
      now - cache.createdAt < 75 &&
      Math.abs(cache.vx - aim.vx) < 1.5 &&
      Math.abs(cache.vy - aim.vy) < 1.5
    ) {
      return cache.result;
    }

    const result =
      this.simulateAdvancedTrajectory(
        this.currentMonster,
        aim
      );

    this.trajectoryPreviewCache = {
      createdAt: now,
      vx: aim.vx,
      vy: aim.vy,
      result
    };

    return result;
  },

  simulateAdvancedTrajectory(monster, aim) {
    const delta = 16.67;
    const dt = delta / 1000;
    const maxSteps = 420;

    const level = this.state.level || {};
    const track = VMSRenderer.getTrackRect();

    const points = [
      {
        x: monster.x,
        y: monster.y
      }
    ];

    const bounces = [];

    const body = {
      ...monster,

      x: Number(monster.x || 0),
      y: Number(monster.y || 0),

      vx: Number(aim.vx || 0),
      vy: Number(aim.vy || 0),

      age: 0,
      collecting: false,
      merging: false
    };

    const obstacles =
      (this.state.monsters || [])
        .filter((item) => {
          return (
            item &&
            !item.collecting &&
            !item.merging
          );
        })
        .map((item) => ({
          ...item,

          x: Number(item.x || 0),
          y: Number(item.y || 0),

          vx: Number(item.vx || 0),
          vy: Number(item.vy || 0)
        }));

    let stoppedFrames = 0;
    let impact = null;

    for (
      let step = 0;
      step < maxSteps;
      step += 1
    ) {
      body.age += delta;

      body.x += body.vx * dt;
      body.y += body.vy * dt;

      const friction = Math.pow(
        level.friction || 0.992,
        delta / 16.67
      );

      body.vx *= friction;
      body.vy *= friction;

      if (body.vy > 0) {
        body.vy *= 0.74;
      }

      if (Math.abs(body.vx) < 6) {
        body.vx = 0;
      }

      if (Math.abs(body.vy) < 6) {
        body.vy = 0;
      }

      const footprint =
        this.getMonsterFootprint(body);

      const bounds =
        VMSRenderer.getTrackBoundsAt(
          footprint.y,
          0
        );

      let bounced = false;

      if (
        footprint.x - footprint.rx <
        bounds.left
      ) {
        body.x =
          bounds.left + footprint.rx;

        body.vx =
          Math.abs(body.vx) *
          (level.wallBounce || 0.55);

        bounced = true;
      }

      if (
        footprint.x + footprint.rx >
        bounds.right
      ) {
        body.x =
          bounds.right - footprint.rx;

        body.vx =
          -Math.abs(body.vx) *
          (level.wallBounce || 0.55);

        bounced = true;
      }

      if (
        footprint.y - footprint.ry <
        track.top
      ) {
        body.y =
          track.top +
          footprint.ry -
          footprint.offsetY;

        body.vy =
          Math.max(0, body.vy) * 0.08;

        body.vx *= 0.82;
        bounced = true;
      }

      if (
        footprint.y + footprint.ry >
        track.bottom
      ) {
        body.y =
          track.bottom -
          footprint.ry -
          footprint.offsetY;

        body.vy =
          -Math.abs(body.vy) * 0.18;

        body.vx *= 0.82;
        bounced = true;
      }

      for (const obstacle of obstacles) {
        obstacle.x += obstacle.vx * dt;
        obstacle.y += obstacle.vy * dt;

        obstacle.vx *= friction;
        obstacle.vy *= friction;

        if (obstacle.vy > 0) {
          obstacle.vy *= 0.74;
        }

        if (Math.abs(obstacle.vx) < 6) {
          obstacle.vx = 0;
        }

        if (Math.abs(obstacle.vy) < 6) {
          obstacle.vy = 0;
        }
      }

      const movingFootprint =
        this.getMonsterFootprint(body);

      for (const obstacle of obstacles) {
        const obstacleFootprint =
          this.getMonsterFootprint(obstacle);

        const sumRx = Math.max(
          1,
          movingFootprint.rx +
            obstacleFootprint.rx
        );

        const sumRy = Math.max(
          1,
          movingFootprint.ry +
            obstacleFootprint.ry
        );

        const nx =
          (
            movingFootprint.x -
            obstacleFootprint.x
          ) / sumRx;

        const ny =
          (
            movingFootprint.y -
            obstacleFootprint.y
          ) / sumRy;

        if (nx * nx + ny * ny <= 1) {
          impact = {
            x: body.x,
            y: body.y,

            monsterId: obstacle.id,

            sameLevel:
              Number(obstacle.level) ===
              Number(body.level)
          };

          break;
        }
      }

      if (bounced) {
        bounces.push({
          x: body.x,
          y: body.y
        });
      }

      if (
        step % 3 === 0 ||
        bounced ||
        impact
      ) {
        points.push({
          x: body.x,
          y: body.y
        });
      }

      if (impact) {
        break;
      }

      const speed = Math.sqrt(
        body.vx * body.vx +
        body.vy * body.vy
      );

      stoppedFrames =
        speed < 8
          ? stoppedFrames + 1
          : 0;

      if (stoppedFrames >= 18) {
        break;
      }
    }

    const lastPoint =
      points[points.length - 1];

    if (
      !lastPoint ||
      Math.hypot(
        lastPoint.x - body.x,
        lastPoint.y - body.y
      ) > 0.5
    ) {
      points.push({
        x: body.x,
        y: body.y
      });
    }

    const end =
      points[points.length - 1] || {
        x: body.x,
        y: body.y
      };

    return {
      points,
      bounces,
      end,
      impact,

      monster: {
        ...monster,
        x: end.x,
        y: end.y,
        collectAlpha: 0.3
      }
    };
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
      const footprint = this.getMonsterFootprint(monster);

      if (monster.age > 700 && footprint.y + footprint.ry > dangerY - 8 && monster.vy > 0) {
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
    const footprint = this.getMonsterFootprint(monster);

    const bounds = VMSRenderer.getTrackBoundsAt(footprint.y, 0);

    if (footprint.x - footprint.rx < bounds.left) {
      monster.x = bounds.left + footprint.rx;
      monster.vx = Math.abs(monster.vx) * bounce;
    }

    if (footprint.x + footprint.rx > bounds.right) {
      monster.x = bounds.right - footprint.rx;
      monster.vx = -Math.abs(monster.vx) * bounce;
    }

    if (footprint.y - footprint.ry < rect.top) {
      monster.y = rect.top + footprint.ry - footprint.offsetY;

      // Collision en haut basée sur la base au sol, pas sur le haut du sprite.
      monster.vy = Math.max(0, monster.vy) * 0.08;
      monster.vx *= 0.82;
    }

    if (footprint.y + footprint.ry > rect.bottom) {
      monster.y = rect.bottom - footprint.ry - footprint.offsetY;

      // Collision en bas basée sur la base au sol.
      monster.vy = -Math.abs(monster.vy) * 0.18;
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

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distSq = dx * dx + dy * dy;

        /*
          Base physique V17 :
          on utilise l'ellipse/rayon de getMonsterFootprint(), pas les pixels,
          pas getMonsterPhysicsCollider().
        */
        const fa = this.getMonsterFootprint(a);
        const fb = this.getMonsterFootprint(b);
        const minDist = fa.radius + fb.radius;

        /*
          Même niveau :
          fusion sur les vrais pixels de l'image, avec une marge plus large.
          Le pré-test V17 évite de scanner les pixels quand les monstres sont loin.
        */
        if (a.level === b.level) {
          const mergeDist = minDist * 1.08;

          if (distSq <= mergeDist * mergeDist) {
            const fusionTouch = this.monstersOpaqueTouch
              ? this.monstersOpaqueTouch(a, b, {
                  paddingPx: this.getFusionPaddingPx ? this.getFusionPaddingPx() : 8,
                  alphaThreshold: this.getCollisionAlphaThreshold ? this.getCollisionAlphaThreshold() : 95,
                  step: Math.max(2, this.getPixelCollisionStep ? this.getPixelCollisionStep() : 1)
                })
              : true;

            if (fusionTouch) {
              this.mergeMonsters(a, b);
              return;
            }
          }

          continue;
        }

        /*
          Niveaux différents :
          collision seulement si les vrais pixels se touchent.
          La réaction physique reste V17 : direction centre à centre,
          séparation 0.52, rebond bounce, amortissement 0.96.
        */
        const broadDist = minDist * 1.08;
        if (distSq >= broadDist * broadDist) continue;

        const collisionTouch = this.monstersOpaqueTouch
          ? this.monstersOpaqueTouch(a, b, {
              paddingPx: 0,
              alphaThreshold: this.getCollisionAlphaThreshold ? this.getCollisionAlphaThreshold() : 95,
              step: this.getPixelCollisionStep ? this.getPixelCollisionStep() : 1
            })
          : true;

        if (!collisionTouch) continue;

        const dist = Math.max(0.001, Math.sqrt(distSq));
        const nx = dx / dist;
        const ny = dy / dist;

        /*
          Si les pixels se touchent mais que le rayon V17 n'est pas encore très enfoncé,
          on garde une poussée minimum légère pour séparer sans créer de gros tremblement.
        */
        const overlap = Math.max(1.2, minDist - dist);

        a.x -= nx * overlap * 0.52;
        a.y -= ny * overlap * 0.52;

        b.x += nx * overlap * 0.52;
        b.y += ny * overlap * 0.52;

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
