window.VMSStorage = {
  getKey(key) {
    return `${window.VMS_CONFIG.storagePrefix}${key}`;
  },

  get(key, fallback) {
    try {
      const raw = localStorage.getItem(this.getKey(key));
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  },

  set(key, value) {
    localStorage.setItem(this.getKey(key), JSON.stringify(value));
  }
};
