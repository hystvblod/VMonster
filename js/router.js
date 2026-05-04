window.VMSRouter = {
  current: "screen-home",
  previous: "screen-home",

  show(id) {
    this.previous = this.current;
    this.current = id;

    document.querySelectorAll(".screen").forEach((screen) => {
      screen.classList.toggle("active", screen.id === id);
    });

    if (id !== "screen-game") {
      window.VMSGame?.stop?.();
    }
  },

  home() {
    this.show("screen-home");
  }
};
