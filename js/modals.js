window.VMSModals = {
  layer: null,
  title: null,
  text: null,
  reward: null,
  rewardIcon: null,
  rewardAmount: null,
  primary: null,
  secondary: null,
  tertiary: null,

  init() {
    this.layer = document.getElementById("modalLayer");
    this.title = document.getElementById("modalTitle");
    this.text = document.getElementById("modalText");
    this.reward = document.getElementById("modalReward");
    this.rewardIcon = document.getElementById("modalRewardIcon");
    this.rewardAmount = document.getElementById("modalRewardAmount");
    this.primary = document.getElementById("modalPrimary");
    this.secondary = document.getElementById("modalSecondary");
    this.tertiary = document.getElementById("modalTertiary");
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

    if (this.reward) {
      if (options.rewardAmount) {
        this.reward.classList.remove("hidden");
        this.rewardAmount.textContent = `+${options.rewardAmount}`;

        if (this.rewardIcon && options.rewardIcon) {
          this.rewardIcon.src = options.rewardIcon;
          this.rewardIcon.classList.remove("hidden");
        }
      } else {
        this.reward.classList.add("hidden");
        this.rewardAmount.textContent = "";

        if (this.rewardIcon) {
          this.rewardIcon.src = "";
        }
      }
    }

    if (this.tertiary) {
      if (options.tertiaryText) {
        this.tertiary.textContent = options.tertiaryText;
        this.tertiary.classList.remove("hidden");
        this.tertiary.onclick = () => {
          this.hide();
          options.onTertiary?.();
        };
      } else {
        this.tertiary.textContent = "";
        this.tertiary.onclick = null;
        this.tertiary.classList.add("hidden");
      }
    }

    this.layer.classList.remove("hidden");
  },

  hide() {
    this.layer.classList.add("hidden");
  }
};
