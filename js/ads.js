window.VMSAds = {
  async showRewarded(reason) {
    return new Promise((resolve) => {
      setTimeout(() => resolve(true), 350);
    });
  },

  async showInterstitial() {
    return new Promise((resolve) => {
      setTimeout(() => resolve(true), 150);
    });
  }
};
