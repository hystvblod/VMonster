window.VMSRenderer = {
  canvas: null,
  ctx: null,
  width: 0,
  height: 0,
  dpr: 1,
  imageCache: {},

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
  },

  render(state) {
    this.drawBackground();
    this.drawTrack();
    this.drawDangerLine(state);
    this.drawSpawnZone();
    this.drawMonsters(state);
    this.drawCurrentMonster();
    this.drawAim(state);
    this.drawParticles(state);
    this.drawDangerWarning(state);
  },

  drawBackground() {
    const ctx = this.ctx;
    const img = this.getImage("./assets/environment/backgrounds/bg_lab_main_01.webp");

    if (img) {
      ctx.drawImage(img, 0, 0, this.width, this.height);
      return;
    }

    const grd = ctx.createLinearGradient(0, 0, 0, this.height);
    grd.addColorStop(0, "#31205f");
    grd.addColorStop(0.55, "#17142b");
    grd.addColorStop(1, "#0c0918");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = "#8fe8ff";

    for (let i = 0; i < 14; i++) {
      const x = (i * 79 + 37) % this.width;
      const y = (i * 131 + 52) % this.height;
      ctx.beginPath();
      ctx.arc(x, y, 3 + (i % 3), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  },

  drawTrack() {
    const ctx = this.ctx;
    const rect = this.getTrackRect();
    const img = this.getImage("./assets/environment/track/track_merge_main_01.webp");

    ctx.save();

    ctx.shadowColor = "rgba(0,0,0,.46)";
    ctx.shadowBlur = 32;
    ctx.fillStyle = "rgba(0,0,0,.30)";
    this.roundRect(ctx, rect.left - 18, rect.top + 12, rect.width + 36, rect.height, 38);
    ctx.fill();

    ctx.shadowBlur = 0;

    if (img) {
      ctx.drawImage(img, rect.left, rect.top, rect.width, rect.height);
    } else {
      const grd = ctx.createLinearGradient(rect.left, rect.top, rect.right, rect.bottom);
      grd.addColorStop(0, "#33265f");
      grd.addColorStop(0.5, "#5d4aa0");
      grd.addColorStop(1, "#20183d");

      ctx.fillStyle = grd;
      this.roundRect(ctx, rect.left, rect.top, rect.width, rect.height, 36);
      ctx.fill();

      ctx.strokeStyle = "rgba(160,240,255,.26)";
      ctx.lineWidth = 3;
      this.roundRect(ctx, rect.left + 5, rect.top + 5, rect.width - 10, rect.height - 10, 32);
      ctx.stroke();

      ctx.globalAlpha = 0.12;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;

      for (let y = rect.top + 70; y < rect.bottom - 40; y += 70) {
        ctx.beginPath();
        ctx.moveTo(rect.left + 28, y);
        ctx.lineTo(rect.right - 28, y);
        ctx.stroke();
      }
    }

    ctx.restore();
  },

  drawDangerLine(state) {
    const ctx = this.ctx;
    const rect = this.getTrackRect();
    const y = this.getDangerY();
    const img = this.getImage("./assets/environment/track/danger_line_01.webp");

    ctx.save();

    const alpha = 0.45 + (state.dangerRatio || 0) * 0.55;
    ctx.globalAlpha = alpha;

    if (img) {
      ctx.drawImage(img, rect.left + 12, y - 10, rect.width - 24, 20);
    } else {
      ctx.shadowColor = "#ff4d35";
      ctx.shadowBlur = 18;
      ctx.fillStyle = "#ff5b3f";
      this.roundRect(ctx, rect.left + 16, y - 5, rect.width - 32, 10, 8);
      ctx.fill();
    }

    ctx.restore();
  },

  drawSpawnZone() {
    const ctx = this.ctx;
    const spawn = this.getSpawnPoint();
    const img = this.getImage("./assets/environment/track/track_spawn_zone_01.webp");

    ctx.save();

    if (img) {
      ctx.drawImage(img, spawn.x - 86, spawn.y - 42, 172, 84);
    } else {
      ctx.shadowColor = "rgba(0,0,0,.35)";
      ctx.shadowBlur = 18;
      ctx.fillStyle = "rgba(255,255,255,.12)";
      this.roundRect(ctx, spawn.x - 92, spawn.y - 38, 184, 76, 30);
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(255,255,255,.18)";
      ctx.lineWidth = 2;
      this.roundRect(ctx, spawn.x - 92, spawn.y - 38, 184, 76, 30);
      ctx.stroke();
    }

    ctx.restore();
  },

  drawMonsters(state) {
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

    ctx.globalAlpha = 0.22;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(0, monster.radius * 0.86, monster.radius * 0.86, monster.radius * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 1;

    if (isCurrent) {
      ctx.shadowColor = monster.color || meta.color;
      ctx.shadowBlur = 22;
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
    ctx.fillStyle = color;
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
    const aim = state.aim;
    const monster = window.VMSGame?.currentMonster;

    if (!aim.active || !monster) return;

    const ctx = this.ctx;
    const endX = monster.x + aim.vx * 0.18;
    const endY = monster.y + aim.vy * 0.18;

    ctx.save();

    ctx.strokeStyle = "rgba(143,232,255,.9)";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.shadowColor = "#8fe8ff";
    ctx.shadowBlur = 16;

    ctx.beginPath();
    ctx.moveTo(monster.x, monster.y);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    const angle = Math.atan2(endY - monster.y, endX - monster.x);

    ctx.translate(endX, endY);
    ctx.rotate(angle);

    ctx.fillStyle = "#8fe8ff";
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-12, -10);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-12, 10);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  },

  drawParticles(state) {
    const ctx = this.ctx;

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
    if (!state.dangerRatio) return;

    const ctx = this.ctx;

    ctx.save();
    ctx.globalAlpha = state.dangerRatio * 0.28;
    ctx.fillStyle = "#ff3f32";
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.restore();
  },

  getTrackRect() {
    const ratio = window.VMSGame?.state?.level?.trackWidthRatio || 0.72;
    const width = Math.min(this.width * ratio, 430);
    const left = (this.width - width) / 2;
    const top = 92;
    const bottom = this.height - 104;
    const height = bottom - top;

    return {
      left,
      right: left + width,
      top,
      bottom,
      width,
      height
    };
  },

  getSpawnPoint() {
    return {
      x: this.width / 2,
      y: this.height - 66
    };
  },

  getDangerY() {
    return this.height - 214;
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
