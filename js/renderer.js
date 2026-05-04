window.VMSRenderer = {
  canvas: null,
  ctx: null,
  width: 0,
  height: 0,
  dpr: 1,
  imageCache: {},

  bgSrc: "./assets/environment/backgrounds/bg_lab_main_01.webp",

  bgDraw: {
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    scale: 1,
    imgW: 928,
    imgH: 1536
  },

  // Coordonnées basées sur TON image.
  // Si un jour l’image change un peu, c’est ici qu’on ajuste.
  labMap: {
    trackLeft: 0.205,
    trackRight: 0.795,
    trackTop: 0.265,
    trackBottom: 0.895,

    dangerY: 0.805,

    spawnX: 0.5,
    spawnY: 0.855
  },

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

    const scale = Math.max(this.width / imgW, this.height / imgH);
    const w = imgW * scale;
    const h = imgH * scale;
    const x = (this.width - w) / 2;
    const y = (this.height - h) / 2;

    this.bgDraw.x = x;
    this.bgDraw.y = y;
    this.bgDraw.w = w;
    this.bgDraw.h = h;
    this.bgDraw.scale = scale;
  },

  render(state) {
    this.updateBackgroundCover();

    this.drawBackground();
    this.drawDangerLine(state);
    this.drawSpawnZone(state);
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

    ctx.fillStyle = "#090716";
    ctx.fillRect(0, 0, this.width, this.height);

    if (img) {
      ctx.drawImage(img, this.bgDraw.x, this.bgDraw.y, this.bgDraw.w, this.bgDraw.h);
      return;
    }

    const grd = ctx.createLinearGradient(0, 0, 0, this.height);
    grd.addColorStop(0, "#24174d");
    grd.addColorStop(0.55, "#17142b");
    grd.addColorStop(1, "#080611");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, this.width, this.height);

    const rect = this.getTrackRect();

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,.55)";
    ctx.shadowBlur = 34;
    ctx.fillStyle = "#302262";
    this.roundRect(ctx, rect.left, rect.top, rect.width, rect.height, 38);
    ctx.fill();

    ctx.strokeStyle = "rgba(119, 86, 255, .9)";
    ctx.lineWidth = 6;
    this.roundRect(ctx, rect.left + 4, rect.top + 4, rect.width - 8, rect.height - 8, 34);
    ctx.stroke();
    ctx.restore();
  },

  drawDangerLine(state) {
    const ctx = this.ctx;
    const rect = this.getTrackRect();
    const y = this.getDangerY();
    const dangerRatio = state?.dangerRatio || 0;

    ctx.save();

    const pulse = 0.45 + dangerRatio * 0.55;

    ctx.globalAlpha = pulse;
    ctx.shadowColor = "#ff3b25";
    ctx.shadowBlur = 18 + dangerRatio * 28;

    const lineH = Math.max(7, rect.width * 0.018);
    const lineW = rect.width * 0.86;
    const x = rect.left + (rect.width - lineW) / 2;

    ctx.fillStyle = "#ff4a2e";
    this.roundRect(ctx, x, y - lineH / 2, lineW, lineH, lineH);
    ctx.fill();

    ctx.globalAlpha = 0.9;
    ctx.fillStyle = "rgba(255, 210, 120, .9)";
    this.roundRect(ctx, x + lineW * 0.08, y - lineH / 2, lineW * 0.84, Math.max(2, lineH * 0.28), lineH);
    ctx.fill();

    ctx.restore();
  },

  drawSpawnZone(state) {
    const ctx = this.ctx;
    const spawn = this.getSpawnPoint();
    const rect = this.getTrackRect();

    const w = rect.width * 0.42;
    const h = Math.max(54, rect.width * 0.16);
    const dangerRatio = state?.dangerRatio || 0;

    ctx.save();

    ctx.shadowColor = dangerRatio > 0 ? "#ff4a2e" : "#75e9ff";
    ctx.shadowBlur = dangerRatio > 0 ? 28 : 20;

    const grd = ctx.createLinearGradient(spawn.x - w / 2, spawn.y - h / 2, spawn.x + w / 2, spawn.y + h / 2);
    grd.addColorStop(0, "rgba(104, 232, 255, .22)");
    grd.addColorStop(0.5, "rgba(123, 89, 255, .26)");
    grd.addColorStop(1, "rgba(255,255,255,.12)");

    ctx.fillStyle = grd;
    this.roundRect(ctx, spawn.x - w / 2, spawn.y - h / 2, w, h, h * 0.42);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = dangerRatio > 0 ? "rgba(255, 90, 50, .95)" : "rgba(155, 238, 255, .7)";
    ctx.lineWidth = Math.max(2, rect.width * 0.006);
    this.roundRect(ctx, spawn.x - w / 2, spawn.y - h / 2, w, h, h * 0.42);
    ctx.stroke();

    ctx.globalAlpha = 0.5;
    ctx.fillStyle = "#ffffff";
    this.roundRect(ctx, spawn.x - w * 0.25, spawn.y - h * 0.28, w * 0.5, h * 0.08, h);
    ctx.fill();

    ctx.restore();
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
    const size = monster.radius * 2.35;

    ctx.save();
    ctx.translate(monster.x, monster.y);

    ctx.globalAlpha = 0.24;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(0, monster.radius * 0.82, monster.radius * 0.9, monster.radius * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 1;

    if (isCurrent) {
      ctx.shadowColor = monster.color || meta.color;
      ctx.shadowBlur = 24;
    }

    if (img) {
      ctx.drawImage(img, -size / 2, -size / 2, size, size);
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

    ctx.fillStyle = "rgba(255,255,255,.9)";
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
    const rect = this.getTrackRect();

    const endX = monster.x + aim.vx * 0.18;
    const endY = monster.y + aim.vy * 0.18;

    ctx.save();

    ctx.strokeStyle = "rgba(143,232,255,.92)";
    ctx.lineWidth = Math.max(4, rect.width * 0.018);
    ctx.lineCap = "round";
    ctx.shadowColor = "#8fe8ff";
    ctx.shadowBlur = 18;

    ctx.beginPath();
    ctx.moveTo(monster.x, monster.y);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    const angle = Math.atan2(endY - monster.y, endX - monster.x);
    const arrowSize = Math.max(18, rect.width * 0.055);

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

  getTrackRect() {
    const leftTop = this.imageToScreen(this.labMap.trackLeft, this.labMap.trackTop);
    const rightBottom = this.imageToScreen(this.labMap.trackRight, this.labMap.trackBottom);

    return {
      left: leftTop.x,
      right: rightBottom.x,
      top: leftTop.y,
      bottom: rightBottom.y,
      width: rightBottom.x - leftTop.x,
      height: rightBottom.y - leftTop.y
    };
  },

  getSpawnPoint() {
    return this.imageToScreen(this.labMap.spawnX, this.labMap.spawnY);
  },

  getDangerY() {
    return this.imageToScreen(0.5, this.labMap.dangerY).y;
  },

  getImage(src) {
    if (!src) return null;

    if (this.imageCache[src] === false) return null;

    if (this.imageCache[src]) {
      const img = this.imageCache[src];
      return img.complete && img.naturalWidth > 0 ? img : null;
    }

    const img = new Image();

    img.onload = () => {
      this.imageCache[src] = img;
      this.updateBackgroundCover();
    };

    img.onerror = () => {
      this.imageCache[src] = false;
    };

    img.src = src;
    this.imageCache[src] = img;

    return null;
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