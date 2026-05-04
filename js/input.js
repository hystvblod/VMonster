window.VMSInput = {
  pointerDown: false,
  pointerId: null,

  init(canvas) {
    this.canvas = canvas;

    canvas.addEventListener("pointerdown", (event) => {
      if (!window.VMSGame || !VMSGame.running) return;

      this.pointerDown = true;
      this.pointerId = event.pointerId;

      try {
        canvas.setPointerCapture(event.pointerId);
      } catch (error) {}

      VMSGame.startAim(event.clientX, event.clientY);
    });

    canvas.addEventListener("pointermove", (event) => {
      if (!this.pointerDown || event.pointerId !== this.pointerId) return;
      VMSGame.updateAim(event.clientX, event.clientY);
    });

    canvas.addEventListener("pointerup", (event) => {
      if (!this.pointerDown || event.pointerId !== this.pointerId) return;

      this.pointerDown = false;
      this.pointerId = null;

      VMSGame.releaseAim(event.clientX, event.clientY);

      try {
        canvas.releasePointerCapture(event.pointerId);
      } catch (error) {}
    });

    canvas.addEventListener("pointercancel", (event) => {
      if (event.pointerId !== this.pointerId) return;

      this.pointerDown = false;
      this.pointerId = null;
      VMSGame.cancelAim();
    });
  }
};
