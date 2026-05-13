window.VMSRenderer = {
  canvas: null,
  ctx: null,
  width: 0,
  height: 0,
  dpr: 1,
  imageCache: {},
  trimCache: {},

  bgSrc: "./assets/environment/backgrounds/bg_lab_main_01.webp",
  backgroundMode: "cover",

setBackground(src) {
  if (!src || this.bgSrc === src) return;
  this.bgSrc = src;
  this.updateBackgroundCover();
},

  bgDraw: {
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    imgW: 928,
    imgH: 1536
  },

  // Réglage précis pour TON image.
  // La piste est en trapèze, donc on ne fait plus un simple rectangle.
labMap: {
  trackTopY: 0.198,
  trackBottomY: 0.905,

  trackTopLeftX: 0.290,
  trackTopRightX: 0.710,

  trackBottomLeftX: 0.020,
  trackBottomRightX: 0.980,

  dangerY: 0.815,

  spawnX: 0.5,
  spawnY: 0.865
},


  // Mets false quand tout est bien calé.
  debugZones: true,

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.resize();
    window.addEventListener("resize", () => this.resize());
  },

  resize() {
    this.dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
    this.width = Math.floor(window.innerWidth);
    this.height = Math.floor(window.innerHeight);

    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;

    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.updateBackgroundCover();
  },

  updateBackgroundCover() {
    const img = this.getImage(this.bgSrc);

    const imgW = img?.naturalWidth || this.bgDraw.imgW || 928;
    const imgH = img?.naturalHeight || this.bgDraw.imgH || 1536;

    this.bgDraw.imgW = imgW;
    this.bgDraw.imgH = imgH;

    // STRETCH : l'image prend toujours tout l'écran.
    // Pas de vide, pas de découpe.
    this.bgDraw.x = 0;
    this.bgDraw.y = 0;
    this.bgDraw.w = this.width;
    this.bgDraw.h = this.height;
  },

  render(state) {
    this.updateBackgroundCover();

    this.drawBackground();

    if (this.debugZones) {
      this.drawDebugZones();
    }

    this.drawWorldHeader(state);
    this.drawDangerLine(state);
    this.drawSpawnZone(state);
    this.drawOrders(state);
    this.drawMonsters(state);
    this.drawCurrentMonster();
    this.drawAim(state);
    this.drawParticles(state);
    this.drawDangerWarning(state);
  },

  imageToScreen(nx, ny) {
    return {
      x: this.bgDraw.x + this.bgDraw.w * nx,
      y: this.bgDraw.y + this.bgDraw.h * ny
    };
  },

  drawBackground() {
    const ctx = this.ctx;
    const img = this.getImage(this.bgSrc);

    ctx.fillStyle = "#05030c";
    ctx.fillRect(0, 0, this.width, this.height);

    if (img) {
      ctx.drawImage(img, this.bgDraw.x, this.bgDraw.y, this.bgDraw.w, this.bgDraw.h);
      return;
    }

    const grd = ctx.createLinearGradient(0, 0, 0, this.height);
    grd.addColorStop(0, "#261957");
    grd.addColorStop(0.55, "#17142b");
    grd.addColorStop(1, "#080611");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, this.width, this.height);
  },

  drawDebugZones() {
    const ctx = this.ctx;
    const p = this.getTrackPolygonPoints();
    const spawn = this.getSpawnPoint();
    const dangerY = this.getDangerY();
    const bounds = this.getTrackBoundsAt(dangerY);

    ctx.save();

    // Zone logique de piste.
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = "#35ff8d";
    ctx.beginPath();
    ctx.moveTo(p.topLeft.x, p.topLeft.y);
    ctx.lineTo(p.topRight.x, p.topRight.y);
    ctx.lineTo(p.bottomRight.x, p.bottomRight.y);
    ctx.lineTo(p.bottomLeft.x, p.bottomLeft.y);
    ctx.closePath();
    ctx.fill();

    ctx.globalAlpha = 0.75;
    ctx.strokeStyle = "#35ff8d";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(p.topLeft.x, p.topLeft.y);
    ctx.lineTo(p.topRight.x, p.topRight.y);
    ctx.lineTo(p.bottomRight.x, p.bottomRight.y);
    ctx.lineTo(p.bottomLeft.x, p.bottomLeft.y);
    ctx.closePath();
    ctx.stroke();

    // Ligne danger debug.
    ctx.globalAlpha = 0.95;
    ctx.strokeStyle = "#ff3b25";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(bounds.left, dangerY);
    ctx.lineTo(bounds.right, dangerY);
    ctx.stroke();

    // Zone spawn debug.
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = "#61eaff";
    ctx.lineWidth = 4;
    this.roundRect(ctx, spawn.x - 70, spawn.y - 36, 140, 72, 26);
    ctx.stroke();

    ctx.restore();
  },

  drawDangerLine(state) {
    const ctx = this.ctx;
    const y = this.getDangerY();
    const bounds = this.getTrackBoundsAt(y);
    const dangerRatio = state?.dangerRatio || 0;

    const lineW = (bounds.right - bounds.left) * 0.88;
    const lineX = bounds.left + ((bounds.right - bounds.left) - lineW) / 2;
    const lineH = Math.max(7, lineW * 0.025);

    ctx.save();

    ctx.globalAlpha = 0.55 + dangerRatio * 0.45;
    ctx.shadowColor = "#ff3b25";
    ctx.shadowBlur = 18 + dangerRatio * 32;

    ctx.fillStyle = "#ff412e";
    this.roundRect(ctx, lineX, y - lineH / 2, lineW, lineH, lineH);
    ctx.fill();

    ctx.globalAlpha = 0.85;
    ctx.fillStyle = "rgba(255,220,130,.9)";
    this.roundRect(ctx, lineX + lineW * 0.08, y - lineH / 2, lineW * 0.84, Math.max(2, lineH * 0.28), lineH);
    ctx.fill();

    ctx.restore();
  },

  drawSpawnZone(state) {
    const ctx = this.ctx;
    const spawn = this.getSpawnPoint();
    const dangerRatio = state?.dangerRatio || 0;
    const bounds = this.getTrackBoundsAt(spawn.y);

    const w = (bounds.right - bounds.left) * 0.42;
    const h = Math.max(56, w * 0.38);

    ctx.save();

    ctx.shadowColor = dangerRatio > 0 ? "#ff4a2e" : "#75e9ff";
    ctx.shadowBlur = dangerRatio > 0 ? 26 : 18;

    const grd = ctx.createLinearGradient(spawn.x - w / 2, spawn.y - h / 2, spawn.x + w / 2, spawn.y + h / 2);
    grd.addColorStop(0, "rgba(104,232,255,.22)");
    grd.addColorStop(0.5, "rgba(123,89,255,.30)");
    grd.addColorStop(1, "rgba(255,255,255,.12)");

    ctx.fillStyle = grd;
    this.roundRect(ctx, spawn.x - w / 2, spawn.y - h / 2, w, h, h * 0.42);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = dangerRatio > 0 ? "rgba(255,90,50,.95)" : "rgba(155,238,255,.72)";
    ctx.lineWidth = Math.max(2, w * 0.018);
    this.roundRect(ctx, spawn.x - w / 2, spawn.y - h / 2, w, h, h * 0.42);
    ctx.stroke();

    ctx.restore();
  },

  drawWorldHeader(state) {
    const level = state?.level;
    if (!level) return;

    const ctx = this.ctx;
    const title = VMSI18n.t(level.nameKey || "world_lab_name");
    const waveText = level.isInfinite
      ? VMSI18n.t("hud_infinite_mode")
      : VMSI18n.t("hud_wave_progress", {
          wave: level.wave || 1,
          total: level.wavesPerWorld || 20
        });

    const boxW = Math.min(this.width * 0.56, 220);
    const boxH = 42;
    const x = this.width / 2 - boxW / 2;
    const y = 8;

    ctx.save();

    const grd = ctx.createLinearGradient(x, y, x, y + boxH);
    grd.addColorStop(0, "rgba(10,18,48,.88)");
    grd.addColorStop(1, "rgba(9,12,32,.78)");

    ctx.fillStyle = grd;
    this.roundRect(ctx, x, y, boxW, boxH, 14);
    ctx.fill();

    ctx.strokeStyle = "rgba(140,235,255,.28)";
    ctx.lineWidth = 1.4;
    this.roundRect(ctx, x, y, boxW, boxH, 14);
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = `900 ${Math.max(14, this.width * 0.035)}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(title, this.width / 2, y + 15);

    ctx.fillStyle = "rgba(212,245,255,.86)";
    ctx.font = `800 ${Math.max(10, this.width * 0.025)}px Arial`;
    ctx.fillText(waveText, this.width / 2, y + 31);

    ctx.restore();
  },

  drawOrders(state) {
    const orders = state?.orders || [];
    if (!orders.length) return;

    const ctx = this.ctx;
    const layout = this.getOrderSlots(state);
    const panel = layout.panel;
    const slots = layout.items;

    ctx.save();

    if (panel) {
      const grd = ctx.createLinearGradient(panel.x, panel.y, panel.x, panel.y + panel.h);
      grd.addColorStop(0, "rgba(232, 238, 242, 0.72)");
      grd.addColorStop(1, "rgba(168, 178, 188, 0.54)");

      ctx.fillStyle = grd;
      this.roundRect(ctx, panel.x, panel.y, panel.w, panel.h, panel.r);
      ctx.fill();

      ctx.strokeStyle = "rgba(255, 255, 255, 0.62)";
      ctx.lineWidth = 1.6;
      this.roundRect(ctx, panel.x, panel.y, panel.w, panel.h, panel.r);
      ctx.stroke();

      ctx.strokeStyle = "rgba(55, 70, 86, 0.28)";
      ctx.lineWidth = 1;
      this.roundRect(ctx, panel.x + 2, panel.y + 2, panel.w - 4, panel.h - 4, panel.r - 2);
      ctx.stroke();
    }

    for (let i = 0; i < orders.length; i++) {
      const order = orders[i];
      const slot = slots[i];
      if (!slot) continue;

      const meta = VMSLevels.getMonsterByLevel(order.monsterLevel);
      const img = this.getImage(meta.asset);
      const completed = order.done >= order.amount;
      const fillRatio = VMSUtils.clamp(order.done / order.amount, 0, 1);

      ctx.save();
      ctx.translate(slot.x, slot.y);

      const imgSize = slot.size;

      if (img) {
        ctx.globalAlpha = completed ? 1 : 0.34;
        this.drawTrimmedImage(ctx, img, -imgSize / 2, -imgSize / 2, imgSize, imgSize);

        if (!completed) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(
            -imgSize / 2,
            -imgSize / 2 + imgSize * (1 - fillRatio),
            imgSize,
            imgSize * fillRatio
          );
          ctx.clip();

          ctx.globalAlpha = 1;
          this.drawTrimmedImage(ctx, img, -imgSize / 2, -imgSize / 2, imgSize, imgSize);
          ctx.restore();
        }
      } else {
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = meta.color || "#8fe8ff";
        ctx.beginPath();
        ctx.arc(0, 0, imgSize * 0.25, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      ctx.shadowColor = "rgba(0,0,0,.85)";
      ctx.shadowBlur = 7;
      ctx.fillStyle = completed ? "#d7ffe4" : "#ffffff";
      ctx.font = `900 ${Math.max(10, this.width * 0.026)}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${order.done}/${order.amount}`, 0, imgSize * 0.60);

      ctx.restore();
    }

    ctx.restore();
  },
  getOrderSlots(state) {
    const orders = state?.orders || [];
    const count = orders.length;

    if (!count) {
      return {
        panel: null,
        items: []
      };
    }

    const isVeryNarrow = this.width <= 360;

    const size = isVeryNarrow
      ? Math.max(34, Math.min(40, this.width * 0.112))
      : Math.max(40, Math.min(50, this.width * 0.126));

    const gap = isVeryNarrow ? size + 9 : size + 12;

    const panelW = isVeryNarrow ? 56 : 64;
    const panelH = Math.max(size + 42, count * size + (count - 1) * 12 + 36);

    const panelX = this.width - panelW - (isVeryNarrow ? 9 : 13);
    const panelY = isVeryNarrow ? 54 : 58;

    const startY = panelY + 28;

    return {
      panel: {
        x: panelX,
        y: panelY,
        w: panelW,
        h: panelH,
        r: 23
      },
      items: orders.map((order, index) => ({
        id: order.id,
        x: panelX + panelW / 2,
        y: startY + index * gap,
        w: size,
        h: size,
        size,
        radius: 999
      }))
    };
  },
  getOrderSlotPosition(state, orderId) {
  const layout = this.getOrderSlots(state);
  const slot = layout.items.find((item) => item.id === orderId);
  return slot ? { x: slot.x, y: slot.y } : null;
},

drawMonsters(state) {
    if (!state?.monsters) return;

    for (const monster of state.monsters) {
      this.drawMonster(monster);
    }
  },

  drawCurrentMonster() {
    if (!window.VMSGame || !VMSGame.currentMonster) return;
    this.drawMonster(VMSGame.currentMonster, true);
  },

  drawMonster(monster, isCurrent = false) {
    const ctx = this.ctx;
    const meta = VMSLevels.getMonsterByLevel(monster.level);
    const img = this.getImage(monster.asset || meta.asset);
    const visualRadius = monster.drawRadius || meta.drawRadius || monster.radius;
    const size = visualRadius * 2.35;

    ctx.save();
    ctx.translate(monster.x, monster.y);

    const alpha = typeof monster.collectAlpha === "number"
      ? VMSUtils.clamp(monster.collectAlpha, 0, 1)
      : 1;

    ctx.globalAlpha = 0.24 * alpha;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(
      0,
      visualRadius * 0.82,
      visualRadius * 0.9,
      visualRadius * 0.26,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();

    ctx.globalAlpha = 1;

    if (isCurrent) {
      ctx.shadowColor = monster.color || meta.color;
      ctx.shadowBlur = 24;
    }

    if (img) {
      this.drawTrimmedImage(ctx, img, -size / 2, -size / 2, size, size);
    } else {
      this.drawFallbackMonster(monster, meta);
    }

    ctx.restore();
  },

  drawFallbackMonster(monster, meta) {
    const ctx = this.ctx;
    const color = monster.color || meta.color || "#8fe8ff";
    const r = monster.radius;

    ctx.shadowColor = color;
    ctx.shadowBlur = 18;

    const grd = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
    grd.addColorStop(0, "#ffffff");
    grd.addColorStop(0.25, color);
    grd.addColorStop(1, "#1a1239");

    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;

    ctx.fillStyle = "rgba(255,255,255,.95)";
    ctx.beginPath();
    ctx.arc(-r * 0.32, -r * 0.18, r * 0.18, 0, Math.PI * 2);
    ctx.arc(r * 0.32, -r * 0.18, r * 0.18, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#17122a";
    ctx.beginPath();
    ctx.arc(-r * 0.28, -r * 0.15, r * 0.08, 0, Math.PI * 2);
    ctx.arc(r * 0.36, -r * 0.15, r * 0.08, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,.92)";
    ctx.font = `900 ${Math.max(11, r * 0.42)}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(monster.level), 0, r * 0.38);
  },

  drawAim(state) {
    const aim = state?.aim;
    const monster = window.VMSGame?.currentMonster;

    if (!aim?.active || !monster) return;

    const ctx = this.ctx;
    const endX = monster.x + aim.vx * 0.18;
    const endY = monster.y + aim.vy * 0.18;

    ctx.save();

    ctx.strokeStyle = "rgba(143,232,255,.92)";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.shadowColor = "#8fe8ff";
    ctx.shadowBlur = 18;

    ctx.beginPath();
    ctx.moveTo(monster.x, monster.y);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    const angle = Math.atan2(endY - monster.y, endX - monster.x);
    const arrowSize = 22;

    ctx.translate(endX, endY);
    ctx.rotate(angle);

    ctx.fillStyle = "#8fe8ff";
    ctx.beginPath();
    ctx.moveTo(arrowSize, 0);
    ctx.lineTo(-arrowSize * 0.65, -arrowSize * 0.42);
    ctx.lineTo(-arrowSize * 0.35, 0);
    ctx.lineTo(-arrowSize * 0.65, arrowSize * 0.42);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  },

  drawParticles(state) {
    const ctx = this.ctx;
    if (!state?.particles) return;

    for (const p of state.particles) {
      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  },

  drawDangerWarning(state) {
    const ratio = state?.dangerRatio || 0;
    if (ratio <= 0) return;

    const ctx = this.ctx;

    ctx.save();
    ctx.globalAlpha = ratio * 0.22;
    ctx.fillStyle = "#ff2e1c";
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.restore();
  },

  getTrackPolygonPoints() {
    return {
      topLeft: this.imageToScreen(this.labMap.trackTopLeftX, this.labMap.trackTopY),
      topRight: this.imageToScreen(this.labMap.trackTopRightX, this.labMap.trackTopY),
      bottomLeft: this.imageToScreen(this.labMap.trackBottomLeftX, this.labMap.trackBottomY),
      bottomRight: this.imageToScreen(this.labMap.trackBottomRightX, this.labMap.trackBottomY)
    };
  },

  getTrackBoundsAt(screenY, padding = 0) {
    const top = this.imageToScreen(0.5, this.labMap.trackTopY).y;
    const bottom = this.imageToScreen(0.5, this.labMap.trackBottomY).y;

    const t = this.clamp((screenY - top) / Math.max(1, bottom - top), 0, 1);

    const topLeft = this.imageToScreen(this.labMap.trackTopLeftX, this.labMap.trackTopY);
    const topRight = this.imageToScreen(this.labMap.trackTopRightX, this.labMap.trackTopY);
    const bottomLeft = this.imageToScreen(this.labMap.trackBottomLeftX, this.labMap.trackBottomY);
    const bottomRight = this.imageToScreen(this.labMap.trackBottomRightX, this.labMap.trackBottomY);

    const left = this.lerp(topLeft.x, bottomLeft.x, t) + padding;
    const right = this.lerp(topRight.x, bottomRight.x, t) - padding;

    return {
      left,
      right,
      center: (left + right) / 2,
      width: right - left
    };
  },

  getTrackRect() {
    const p = this.getTrackPolygonPoints();

    return {
      left: Math.min(p.topLeft.x, p.bottomLeft.x),
      right: Math.max(p.topRight.x, p.bottomRight.x),
      top: p.topLeft.y,
      bottom: p.bottomLeft.y,
      width: Math.max(p.topRight.x, p.bottomRight.x) - Math.min(p.topLeft.x, p.bottomLeft.x),
      height: p.bottomLeft.y - p.topLeft.y
    };
  },

  getSpawnPoint() {
    return this.imageToScreen(this.labMap.spawnX, this.labMap.spawnY);
  },

  getDangerY() {
    return this.imageToScreen(0.5, this.labMap.dangerY).y;
  },

  drawTrimmedImage(ctx, img, dx, dy, dw, dh) {
    const trim = this.getImageTrim(img);

    if (!trim) {
      ctx.drawImage(img, dx, dy, dw, dh);
      return;
    }

    ctx.drawImage(
      img,
      trim.x,
      trim.y,
      trim.w,
      trim.h,
      dx,
      dy,
      dw,
      dh
    );
  },

  getImageTrim(img) {
    const key = img.src;

    if (this.trimCache[key]) {
      return this.trimCache[key];
    }

    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });

      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;

      ctx.drawImage(img, 0, 0);

      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

      let minX = canvas.width;
      let minY = canvas.height;
      let maxX = -1;
      let maxY = -1;

      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const alpha = data[(y * canvas.width + x) * 4 + 3];

          if (alpha > 12) {
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
          }
        }
      }

      if (maxX < minX || maxY < minY) {
        this.trimCache[key] = null;
        return null;
      }

      const padding = Math.round(Math.max(canvas.width, canvas.height) * 0.025);

      minX = Math.max(0, minX - padding);
      minY = Math.max(0, minY - padding);
      maxX = Math.min(canvas.width - 1, maxX + padding);
      maxY = Math.min(canvas.height - 1, maxY + padding);

      const trim = {
        x: minX,
        y: minY,
        w: maxX - minX + 1,
        h: maxY - minY + 1
      };

      this.trimCache[key] = trim;
      return trim;
    } catch (error) {
      this.trimCache[key] = null;
      return null;
    }
  },

  loadImage(src) {
    if (!src) return Promise.resolve(null);

    if (this.imageCache[src] && this.imageCache[src] !== false) {
      const cached = this.imageCache[src];

      if (cached.complete && cached.naturalWidth > 0) {
        return Promise.resolve(cached);
      }

      return new Promise((resolve) => {
        cached.onload = () => resolve(cached);
        cached.onerror = () => resolve(null);
      });
    }

    if (this.imageCache[src] === false) {
      return Promise.resolve(null);
    }

    return new Promise((resolve) => {
      const img = new Image();

      img.onload = async () => {
        this.imageCache[src] = img;

        try {
          if (img.decode) {
            await img.decode();
          }
        } catch (error) {
          // Pas grave : certains navigateurs peuvent refuser decode alors que l'image est bien utilisable.
        }

        try {
          this.getImageTrim(img);
        } catch (error) {
          // Pas grave non plus : le trim retombera en dessin normal si besoin.
        }

        this.updateBackgroundCover();
        resolve(img);
      };

      img.onerror = () => {
        console.warn("[VMonster] Image introuvable ou non chargée :", src);
        this.imageCache[src] = false;
        resolve(null);
      };

      img.src = src;
      this.imageCache[src] = img;
    });
  },

  async preloadForLevel(state) {
    const sources = new Set();

    if (this.bgSrc) {
      sources.add(this.bgSrc);
    }

    if (state?.level?.background) {
      sources.add(state.level.background);
    }

    const maxLevel = Math.max(12, Number(state?.level?.spawnPoolMaxLevel || 5));

    for (let level = 1; level <= maxLevel; level++) {
      const meta = VMSLevels.getMonsterByLevel(level);
      if (meta?.asset) {
        sources.add(meta.asset);
      }
    }

    const orders = state?.orders || [];
    for (const order of orders) {
      const meta = VMSLevels.getMonsterByLevel(order.monsterLevel);
      if (meta?.asset) {
        sources.add(meta.asset);
      }
    }

    await Promise.all([...sources].map((src) => this.loadImage(src)));
  },

  getImage(src) {
    if (!src) return null;

    if (this.imageCache[src] === false) return null;

    if (this.imageCache[src]) {
      const img = this.imageCache[src];
      return img.complete && img.naturalWidth > 0 ? img : null;
    }

    this.loadImage(src);
    return null;
  },
  lerp(a, b, t) {
    return a + (b - a) * t;
  },

  clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  },

  roundRect(ctx, x, y, w, h, r) {
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      return;
    }

    const radius = Math.min(r, w / 2, h / 2);

    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
  }
};
