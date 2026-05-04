window.VMSRenderer = {
  canvas: null,
  ctx: null,
  width: 0,
  height: 0,
  dpr: 1,
  beltOffset: 0,

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

  clear() {
    const ctx = this.ctx;
    const grd = ctx.createLinearGradient(0, 0, 0, this.height);
    grd.addColorStop(0, "#2a1d50");
    grd.addColorStop(.52, "#17142b");
    grd.addColorStop(1, "#0d0b17");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, this.width, this.height);
  },

  render(state) {
    this.clear();
    this.drawBackground();
    this.drawConveyor(state);
    this.drawPortals(state);
    this.drawMonsters(state);
    this.drawParticles(state);
  },

  drawBackground() {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = .22;

    for (let i = 0; i < 9; i++) {
      const x = (i * 73 + 41) % this.width;
      const y = (i * 139 + this.beltOffset * .12) % this.height;
      ctx.beginPath();
      ctx.arc(x, y, 2 + (i % 3), 0, Math.PI * 2);
      ctx.fillStyle = "#9cecff";
      ctx.fill();
    }

    ctx.restore();
  },

  drawConveyor(state) {
    const ctx = this.ctx;
    const w = Math.min(this.width * .62, 300);
    const x = (this.width - w) / 2;
    const y = 80;
    const h = this.height - 160;

    ctx.save();

    ctx.shadowColor = "rgba(0,0,0,.45)";
    ctx.shadowBlur = 28;
    ctx.fillStyle = "rgba(0,0,0,.35)";
    ctx.beginPath();
    ctx.roundRect(x - 24, y + 8, w + 48, h, 34);
    ctx.fill();

    const baseGrad = ctx.createLinearGradient(x, y, x + w, y);
    baseGrad.addColorStop(0, "#372767");
    baseGrad.addColorStop(.5, "#51418f");
    baseGrad.addColorStop(1, "#2b2159");

    ctx.shadowBlur = 0;
    ctx.fillStyle = baseGrad;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 28);
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x + 18, y + 16, w - 36, h - 32, 24);
    ctx.clip();

    this.beltOffset = (this.beltOffset + state.delta * state.speed * .22) % 80;

    for (let yy = y - 80 + this.beltOffset; yy < y + h + 80; yy += 80) {
      const tileGrad = ctx.createLinearGradient(x + 18, yy, x + w - 18, yy + 70);
      tileGrad.addColorStop(0, "#2f264f");
      tileGrad.addColorStop(.5, "#5d4a9a");
      tileGrad.addColorStop(1, "#241d3f");
      ctx.fillStyle = tileGrad;
      ctx.fillRect(x + 18, yy, w - 36, 54);

      ctx.fillStyle = "rgba(255,255,255,.07)";
      ctx.fillRect(x + 28, yy + 8, w - 56, 5);
    }

    ctx.restore();

    ctx.strokeStyle = "rgba(154, 237, 255, .22)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(x + 4, y + 4, w - 8, h - 8, 26);
    ctx.stroke();

    ctx.restore();
  },

  drawPortals(state) {
    const ctx = this.ctx;
    const portalY = this.height - 104;
    const laneXs = this.getLaneXs();

    state.portals.forEach((portal, index) => {
      const x = laneXs[index];
      const color = portal.color;

      ctx.save();
      ctx.translate(x, portalY);

      ctx.shadowColor = color;
      ctx.shadowBlur = 22;
      ctx.fillStyle = color;
      ctx.globalAlpha = .28;
      ctx.beginPath();
      ctx.ellipse(0, 0, 42, 18, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(255,255,255,.12)";
      ctx.beginPath();
      ctx.roundRect(-38, -46, 76, 62, 24);
      ctx.fill();

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, -16, 24, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#fff";
      ctx.font = "900 12px Arial";
      ctx.textAlign = "center";
      ctx.fillText(portal.label, 0, 30);

      ctx.restore();
    });
  },

  drawMonsters(state) {
    const ctx = this.ctx;
    const laneXs = this.getLaneXs();

    state.monsters.forEach((monster) => {
      const x = laneXs[monster.lane];
      const y = monster.y;
      const scale = .75 + (y / this.height) * .45;
      const r = monster.radius * scale;

      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scale, scale);

      ctx.shadowColor = monster.color;
      ctx.shadowBlur = 20;
      ctx.fillStyle = monster.color;
      ctx.beginPath();
      ctx.arc(0, 0, monster.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(255,255,255,.92)";
      ctx.beginPath();
      ctx.arc(-8, -6, 5, 0, Math.PI * 2);
      ctx.arc(8, -6, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#17122a";
      ctx.beginPath();
      ctx.arc(-7, -5, 2, 0, Math.PI * 2);
      ctx.arc(9, -5, 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      ctx.save();
      ctx.globalAlpha = .2;
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.ellipse(x, y + r + 10, r * .85, r * .22, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  },

  drawParticles(state) {
    const ctx = this.ctx;

    state.particles.forEach((p) => {
      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  },

  getLaneXs() {
    const w = Math.min(this.width * .62, 300);
    const x = (this.width - w) / 2;
    return [
      x + w * .2,
      x + w * .5,
      x + w * .8
    ];
  }
};
