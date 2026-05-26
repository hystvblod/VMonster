window.VMS_CONFIG = {
  storagePrefix: "vmonster_sort_",
  defaultLanguage: "fr",
  startCoins: 250,
  baseLevelDuration: 42000,
  maxLanes: 3,
  designWidth: 390,
  designHeight: 844,

  assets: {
    ui: {
      logo: "./assets/ui/logo.webp",
      back: "./assets/ui/back.webp",

      shop: "./assets/ui/shop.webp",
      settings: "./assets/ui/settings.webp",
      crosspromo: "./assets/ui/crosspromo.webp",

      noads: "./assets/ui/noads.webp",
      diamond: "./assets/ui/diamond.webp",
      vcoins: "./assets/ui/vcoins.webp",
      jeton: "./assets/ui/jeton.webp",
      reward: "./assets/ui/reward.webp",

      worldLab: "./assets/environment/backgrounds/bg_lab_main_01.webp",
      worldOcean: "./assets/environment/backgrounds/bg_ocean_main_01.webp",
      worldVolcano: "./assets/environment/backgrounds/bg_volcano_main_01.webp",
      worldNuclear: "./assets/environment/backgrounds/bg_nuclear_main_01.webp",
      worldSecret: "./assets/environment/backgrounds/bg_secret_main_01.webp",

      fallback: "./assets/ui/shop.webp"
    }
  },

  assetPaths: {
    vcoins: "./assets/ui/vcoins.webp"
  }
};

window.VMSAsset = function VMSAsset(group, key, fallback) {
  return (
    window.VMS_CONFIG &&
    window.VMS_CONFIG.assets &&
    window.VMS_CONFIG.assets[group] &&
    window.VMS_CONFIG.assets[group][key]
  ) || fallback || "";
};
