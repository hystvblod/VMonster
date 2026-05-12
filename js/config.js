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

      shop: "./assets/ui/shop.webp",
      settings: "./assets/ui/settings.webp",
      crosspromo: "./assets/ui/crosspromo.webp",

      noads: "./assets/ui/noads.webp",
      vcoins: "./assets/ui/vcoins.webp",
      jeton: "./assets/ui/jeton.webp",
      reward: "./assets/ui/reward.webp",

      worldLab: "./assets/ui/world_lab.webp",
      worldOcean: "./assets/ui/world_ocean.webp",
      worldVolcano: "./assets/ui/world_volcano.webp",
      worldNuclear: "./assets/ui/world_nuclear.webp",
      worldSecret: "./assets/ui/world_secret.webp",

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
