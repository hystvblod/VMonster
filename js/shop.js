(function () {
  "use strict";

  const SHOP_SKIN_PROGRESS_KEY = "shopSkinRewardProgress";
  const SHOP_SKIN_OWNED_KEY = "shopOwnedSkins";
  const REWARD_REQUIRED = 3;

  const UI = {
    vcoins: "./assets/ui/vcoins.webp",
    jeton: "./assets/ui/jeton.webp",
    noads: "./assets/ui/noads.webp",
    reward: "./assets/ui/reward.webp",
    fallback: "./assets/ui/icon_shop.webp"
  };

  const WORLDS = [
    { id: "lab", titleKey: "world_lab_name", fallback: "Laboratoire" },
    { id: "ocean", titleKey: "world_ocean_name", fallback: "Laboratoire océanique" },
    { id: "volcano", titleKey: "world_volcano_name", fallback: "Laboratoire volcanique" },
    { id: "nuclear", titleKey: "world_nuclear_name", fallback: "Laboratoire nucléaire" },
    { id: "secret", titleKey: "world_secret_name", fallback: "Laboratoire secret" }
  ];

  const STYLES = [
    { id: "girly", titleKey: "shop_skin_style_girly", fallback: "Girly" },
    { id: "nature", titleKey: "shop_skin_style_nature", fallback: "Nature" },
    { id: "adventure", titleKey: "shop_skin_style_adventure", fallback: "Aventure" }
  ];

  function tt(key, fallback, vars) {
    const value = window.VMSI18n?.t?.(key, vars || {});
    if (!value || value === key) return fallback || key;
    return value;
  }

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getProgressMap() {
    return window.VMSStorage?.get?.(SHOP_SKIN_PROGRESS_KEY, {}) || {};
  }

  function saveProgressMap(map) {
    window.VMSStorage?.set?.(SHOP_SKIN_PROGRESS_KEY, map || {});
  }

  function getOwnedMap() {
    return window.VMSStorage?.get?.(SHOP_SKIN_OWNED_KEY, {}) || {};
  }

  function saveOwnedMap(map) {
    window.VMSStorage?.set?.(SHOP_SKIN_OWNED_KEY, map || {});
  }

  function isOwned(skinId) {
    const owned = getOwnedMap();
    return !!owned[skinId];
  }

  function markOwned(skinId) {
    if (!skinId) return;
    const owned = getOwnedMap();
    owned[skinId] = true;
    saveOwnedMap(owned);
  }

  function getRewardCount(skinId) {
    const map = getProgressMap();
    return Math.max(0, Math.min(REWARD_REQUIRED, Number(map[skinId] || 0)));
  }

  function setRewardCount(skinId, count) {
    const map = getProgressMap();
    map[skinId] = Math.max(0, Math.min(REWARD_REQUIRED, Number(count || 0)));
    saveProgressMap(map);
  }

  function priceLabel(productId) {
    const price = window.VMSPurchases?.getPrice?.(productId) || "";
    return price || tt("store_not_connected_short", "Store non branché");
  }

  function imageTag(src, className) {
    return `<img class="${className || ""}" src="${esc(src)}" alt="" draggable="false" onerror="this.onerror=null;this.src='${UI.fallback}'">`;
  }

  function cosmeticBasePath(worldId, styleId) {
    return `./assets/shop/skins/${worldId}/${styleId}`;
  }

  function getRowItems(world, style) {
    const base = cosmeticBasePath(world.id, style.id);
    const packId = `pack_${world.id}_${style.id}`;

    const items = [{
      type: "pack",
      id: packId,
      worldId: world.id,
      styleId: style.id,
      productId: `vmonster_skinpack_${world.id}_${style.id}`,
      title: tt("shop_skin_pack_complete", "Pack complet"),
      img: `${base}/pack.webp`
    }];

    for (let i = 1; i <= 3; i += 1) {
      const n = String(i).padStart(2, "0");
      items.push({
        type: "reward_skin",
        id: `${world.id}_${style.id}_bg_${n}`,
        worldId: world.id,
        styleId: style.id,
        title: tt("shop_skin_bg_title", `Skin ${i}`, { n: i }),
        img: `${base}/bg_${n}.webp`
      });
    }

    return items;
  }

  function buildTopProducts() {
    return [
      { id: "reward_vcoins_300", kind: "reward", icon: UI.vcoins, title: "+300 VCoins", rewardIcon: UI.reward, action: "reward_vcoins", amount: 300 },
      { id: "vcoins_3000", kind: "iap", icon: UI.vcoins, title: "3 000 VCoins", productId: "vmonster_vcoins_3000" },
      { id: "vcoins_10000", kind: "iap", icon: UI.vcoins, title: "10 000 VCoins", productId: "vmonster_vcoins_10000" },
      { id: "reward_jeton_1", kind: "reward", icon: UI.jeton, title: "+1 Jeton", rewardIcon: UI.reward, action: "reward_jeton", amount: 1 },
      { id: "jetons_12", kind: "iap", icon: UI.jeton, title: "12 Jetons", productId: "vmonster_jetons_12" },
      { id: "jetons_30", kind: "iap", icon: UI.jeton, title: "30 Jetons", productId: "vmonster_jetons_30" },
      { id: "no_ads", kind: "iap", icon: UI.noads, title: tt("shop_no_ads_title", "No Ads"), productId: "vmonster_no_ads", wide: true }
    ];
  }

  function renderTopProduct(item) {
    const bottom = item.kind === "reward"
      ? imageTag(item.rewardIcon, "shop-price-icon")
      : `<span>${esc(priceLabel(item.productId))}</span>`;

    return `
      <button class="shop-product-card ${item.wide ? "shop-product-card-wide" : ""}" type="button" data-shop-action="${esc(item.kind)}" data-id="${esc(item.id)}" data-product-id="${esc(item.productId || "")}" data-reward-action="${esc(item.action || "")}">
        ${imageTag(item.icon, "shop-product-img")}
        <strong>${esc(item.title)}</strong>
        <span class="shop-product-price">${bottom}</span>
      </button>
    `;
  }

  function renderCosmeticItem(item, index, total) {
    let buttonHtml = "";

    if (item.type === "pack") {
      buttonHtml = `<button class="shop-skin-action" type="button" data-skin-action="buy-pack" data-product-id="${esc(item.productId)}" data-world="${esc(item.worldId)}" data-style="${esc(item.styleId)}">${esc(priceLabel(item.productId))}</button>`;
    } else if (isOwned(item.id)) {
      buttonHtml = `<button class="shop-skin-action is-owned" type="button" data-skin-action="owned" disabled>${esc(tt("shop_skin_unlocked", "Débloqué"))}</button>`;
    } else {
      const count = getRewardCount(item.id);
      buttonHtml = `
        <button class="shop-skin-action" type="button" data-skin-action="reward-skin" data-skin-id="${esc(item.id)}">
          <span class="shop-reward-progress">${imageTag(UI.reward, "shop-reward-small")} ${count}/${REWARD_REQUIRED}</span>
        </button>
      `;
    }

    return `
      <div class="shop-skin-slide" data-index="${index}">
        <article class="shop-skin-card">
          ${imageTag(item.img, "shop-skin-img")}
          <div class="shop-skin-overlay">
            <div class="shop-skin-title">${esc(item.title)}</div>
            <div class="shop-skin-count">${index + 1}/${total}</div>
            ${buttonHtml}
          </div>
        </article>
      </div>
    `;
  }

  function renderCosmeticRow(world, style) {
    const items = getRowItems(world, style);
    return `
      <div class="shop-skin-row" data-index="0">
        <div class="shop-skin-row-title">${esc(tt(style.titleKey, style.fallback))}</div>
        <div class="shop-skin-carousel">
          <button class="shop-skin-arrow shop-skin-prev" type="button" aria-label="${esc(tt("shop_carousel_prev", "Précédent"))}">‹</button>
          <div class="shop-skin-viewport">
            <div class="shop-skin-track">
              ${items.map((item, index) => renderCosmeticItem(item, index, items.length)).join("")}
            </div>
          </div>
          <button class="shop-skin-arrow shop-skin-next" type="button" aria-label="${esc(tt("shop_carousel_next", "Suivant"))}">›</button>
        </div>
        <div class="shop-skin-dots">
          ${items.map((_, index) => `<span class="shop-skin-dot ${index === 0 ? "active" : ""}"></span>`).join("")}
        </div>
      </div>
    `;
  }

  function renderWorldBlock(world) {
    return `
      <section class="shop-world-block" data-world="${esc(world.id)}">
        <h3 class="shop-world-title">${esc(tt(world.titleKey, world.fallback))}</h3>
        ${STYLES.map((style) => renderCosmeticRow(world, style)).join("")}
      </section>
    `;
  }

  function updateCarousel(row, nextIndex) {
    const track = row.querySelector(".shop-skin-track");
    const slides = Array.from(row.querySelectorAll(".shop-skin-slide"));
    if (!track || !slides.length) return;

    const max = slides.length - 1;
    const index = Math.max(0, Math.min(max, Number(nextIndex || 0)));
    row.dataset.index = String(index);
    track.style.transform = `translateX(${-index * 100}%)`;

    row.querySelectorAll(".shop-skin-dot").forEach((dot, i) => {
      dot.classList.toggle("active", i === index);
    });
  }

  function wireCarousels(root) {
    root.querySelectorAll(".shop-skin-row").forEach((row) => {
      const prev = row.querySelector(".shop-skin-prev");
      const next = row.querySelector(".shop-skin-next");

      prev?.addEventListener("click", () => updateCarousel(row, Number(row.dataset.index || 0) - 1));
      next?.addEventListener("click", () => updateCarousel(row, Number(row.dataset.index || 0) + 1));

      let startX = 0;
      let endX = 0;
      const viewport = row.querySelector(".shop-skin-viewport");
      if (!viewport) return;

      viewport.addEventListener("touchstart", (event) => { startX = event.touches?.[0]?.clientX || 0; }, { passive: true });
      viewport.addEventListener("touchmove", (event) => { endX = event.touches?.[0]?.clientX || 0; }, { passive: true });
      viewport.addEventListener("touchend", () => {
        const delta = endX - startX;
        if (Math.abs(delta) > 36) {
          updateCarousel(row, Number(row.dataset.index || 0) + (delta < 0 ? 1 : -1));
        }
        startX = 0;
        endX = 0;
      }, { passive: true });
    });
  }

  async function rewardVCoins(amount) {
    const ok = await window.VMSAds?.showRewarded?.("shop_vcoins_300");
    if (!ok) return showMessage(tt("shop_reward_error_title", "Pub indisponible"), tt("shop_reward_error_text", "La vidéo n’a pas été validée."));
    window.VMSEconomy?.addCoins?.(amount);
    showMessage(tt("shop_reward_success_title", "Récompense reçue"), tt("shop_reward_vcoins_text", "+{amount} VCoins ajoutés.", { amount }));
  }

  async function rewardJeton(amount) {
    const ok = await window.VMSAds?.showRewarded?.("shop_jeton_1");
    if (!ok) return showMessage(tt("shop_reward_error_title", "Pub indisponible"), tt("shop_reward_error_text", "La vidéo n’a pas été validée."));
    window.VMSEconomy?.addTokens?.(amount);
    showMessage(tt("shop_reward_success_title", "Récompense reçue"), tt("shop_reward_jeton_text", "+{amount} jeton ajouté.", { amount }));
  }

  async function rewardSkin(skinId) {
    if (!skinId || isOwned(skinId)) return;

    const ok = await window.VMSAds?.showRewarded?.("shop_skin_unlock");
    if (!ok) return showMessage(tt("shop_reward_error_title", "Pub indisponible"), tt("shop_reward_error_text", "La vidéo n’a pas été validée."));

    const next = getRewardCount(skinId) + 1;
    setRewardCount(skinId, next);

    if (next >= REWARD_REQUIRED) {
      markOwned(skinId);
      showMessage(tt("shop_skin_unlocked_title", "Skin débloqué"), tt("shop_skin_unlocked_text", "Ce skin est maintenant disponible."));
    } else {
      showMessage(tt("shop_reward_success_title", "Récompense reçue"), tt("shop_skin_progress_text", "Progression : {count}/3", { count: next }));
    }

    window.VMSShop?.render?.();
  }

  function showMessage(title, text) {
    window.VMSModals?.show?.({
      title,
      text,
      primaryText: tt("btn_ok", "OK"),
      secondaryText: tt("btn_close", "Fermer"),
      onPrimary: () => {},
      onSecondary: () => {}
    });
  }

  window.VMSShop = {
    async init() {
      this.render();
    },

    render() {
      const list = document.getElementById("shopList");
      if (!list) return;

      list.innerHTML = `
        <section class="shop-buy-zone">
          <div class="shop-product-grid">
            ${buildTopProducts().map(renderTopProduct).join("")}
          </div>
        </section>

        <div class="shop-separator"></div>
        <h2 class="shop-custom-title">${esc(tt("shop_customization_title", "Skins et personnalisation"))}</h2>

        <section class="shop-skins-zone">
          ${WORLDS.map(renderWorldBlock).join("")}
        </section>
      `;

      wireCarousels(list);
    },

    async handleClick(target) {
      const shopBtn = target.closest("[data-shop-action]");
      if (shopBtn) {
        const action = shopBtn.dataset.rewardAction;
        const productId = shopBtn.dataset.productId;

        if (shopBtn.dataset.shopAction === "reward" && action === "reward_vcoins") return rewardVCoins(300);
        if (shopBtn.dataset.shopAction === "reward" && action === "reward_jeton") return rewardJeton(1);
        if (shopBtn.dataset.shopAction === "iap" && productId) return window.VMSPurchases?.buy?.(productId);
      }

      const skinBtn = target.closest("[data-skin-action]");
      if (skinBtn) {
        const skinAction = skinBtn.dataset.skinAction;
        if (skinAction === "buy-pack") return window.VMSPurchases?.buy?.(skinBtn.dataset.productId);
        if (skinAction === "reward-skin") return rewardSkin(skinBtn.dataset.skinId);
      }
    },

    unlockSkinPack(worldId, styleId) {
      const world = WORLDS.find((w) => w.id === worldId);
      const style = STYLES.find((s) => s.id === styleId);
      if (!world || !style) return false;

      getRowItems(world, style).forEach((item) => {
        if (item.type === "reward_skin") {
          markOwned(item.id);
          setRewardCount(item.id, REWARD_REQUIRED);
        }
      });

      this.render();
      return true;
    },

    getOwnedShopSkins() {
      return getOwnedMap();
    },

    getShopSkinProgress() {
      return getProgressMap();
    }
  };

  document.addEventListener("click", (event) => {
    window.VMSShop?.handleClick?.(event.target);
  });

  window.addEventListener("vms:price_updated", () => { window.VMSShop?.render?.(); });
  window.addEventListener("vms:store_unavailable", () => { window.VMSShop?.render?.(); });
})();
