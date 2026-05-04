window.VMSI18n = {
  lang: window.VMS_CONFIG.defaultLanguage,
  dict: {},

  async init() {
    const saved = VMSStorage.get("language", window.VMS_CONFIG.defaultLanguage);
    await this.setLanguage(saved);
  },

  async setLanguage(lang) {
    try {
      const response = await fetch(`./data/i18n/${lang}.json`);
      if (!response.ok) throw new Error("i18n load failed");
      this.dict = await response.json();
      this.lang = lang;
      VMSStorage.set("language", lang);
      document.documentElement.lang = lang;
      document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
      this.apply();
    } catch (error) {
      if (lang !== "fr") {
        await this.setLanguage("fr");
      }
    }
  },

  t(key, vars = {}) {
    let value = this.dict[key] || key;
    Object.keys(vars).forEach((name) => {
      value = value.replaceAll(`{${name}}`, String(vars[name]));
    });
    return value;
  },

  apply() {
    document.querySelectorAll("[data-i18n]").forEach((node) => {
      const key = node.getAttribute("data-i18n");
      node.textContent = this.t(key);
    });
  }
};
