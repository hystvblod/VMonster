window.VMSInput = {
  pointerDown: false,
  startX: 0,
  startY: 0,
  currentX: 0,
  currentY: 0,
  swipeLock: false,

  init(canvas) {
    canvas.addEventListener("pointerdown", (event) => {
      this.pointerDown = true;
      this.startX = event.clientX;
      this.startY = event.clientY;
      this.currentX = event.clientX;
      this.currentY = event.clientY;
      this.swipeLock = false;
    });

    canvas.addEventListener("pointermove", (event) => {
      if (!this.pointerDown) return;
      this.currentX = event.clientX;
      this.currentY = event.clientY;
    });

    canvas.addEventListener("pointerup", (event) => {
      if (!this.pointerDown || this.swipeLock) {
        this.pointerDown = false;
        return;
      }

      const dx = event.clientX - this.startX;
      const dy = event.clientY - this.startY;

      if (Math.abs(dx) > 26 || Math.abs(dy) > 26) {
        VMSGame.handleSwipe(dx, dy);
      }

      this.pointerDown = false;
      this.swipeLock = true;
    });

    canvas.addEventListener("pointercancel", () => {
      this.pointerDown = false;
    });
  }
};
