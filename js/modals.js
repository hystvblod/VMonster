window.VMSModals = {
  layer: null,
  title: null,
  text: null,
  primary: null,
  secondary: null,

  init() {
    this.layer = document.getElementById("modalLayer");
    this.title = document.getElementById("modalTitle");
    this.text = document.getElementById("modalText");
    this.primary = document.getElementById("modalPrimary");
    this.secondary = document.getElementById("modalSecondary");
  },

  show(options) {
    this.title.textContent = options.title || "";
    this.text.textContent = options.text || "";
    this.primary.textContent = options.primaryText || VMSI18n.t("btn_ok");
    this.secondary.textContent = options.secondaryText || VMSI18n.t("btn_close");

    this.primary.onclick = () => {
      this.hide();
      options.onPrimary?.();
    };

    this.secondary.onclick = () => {
      this.hide();
      options.onSecondary?.();
    };

    this.layer.classList.remove("hidden");
  },

  hide() {
    this.layer.classList.add("hidden");
  }
};
