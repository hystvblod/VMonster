window.VMSAssets = {
  images: {},

  async loadImage(key, src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        this.images[key] = img;
        resolve(img);
      };
      img.onerror = () => {
        this.images[key] = null;
        resolve(null);
      };
      img.src = src;
    });
  },

  async init() {
    const paths = window.VMS_CONFIG.assetPaths;
    await Promise.all(Object.entries(paths).map(([key, src]) => this.loadImage(key, src)));
  },

  get(key) {
    return this.images[key] || null;
  }
};
