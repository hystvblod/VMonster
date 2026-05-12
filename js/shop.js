(function () {
  "use strict";

  const BG_REWARD_REQUIRED = 3;
  const MONSTER_SKIN_PRICE = 300;

  const SHOP_PROGRESS_KEY = "shopBgRewardProgress";
  const SHOP_OWNED_KEY = "shopOwnedItems";
  const SHOP_REVEALED_CLASSIC_KEY = "shopRevealedClassicMonsters";
  const SHOP_ACTIVE_BG_KEY = "shopActiveBackground";
  const SHOP_ACTIVE_MONSTER_KEY = "shopActiveMonsterSkin";

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

  const DEFAULT_STYLES = [
    { id: "girly", titleKey: "shop_skin_style_girly" },
    { id: "nature", titleKey: "shop_skin_style_nature" },
    { id: "adventure", titleKey: "shop_skin_style_adventure" }
  ];

  const WORLD_STYLES = {
    lab: [
      { id: "girly", titleKey: "shop_skin_style_girly" },
      { id: "candy", titleKey: "shop_skin_style_candy" },
      { id: "nature", titleKey: "shop_skin_style_nature" },
      { id: "neon", titleKey: "shop_skin_style_neon" }
    ]
  };

  function getStylesForWorld(worldId) {
    return WORLD_STYLES[worldId] || DEFAULT_STYLES;
  }

  const MONSTER_COUNT = 12;

  const MONSTERS = Array.from({ length: MONSTER_COUNT }, (_, index) => {
    const number = index + 1;
    const padded = String(number).padStart(2, "0");
    return {
      number,
      padded,
      level: number,
      titleKey: `monster_${padded}_name`,
      fallback: `Monstre ${number}`
    };
  });

  function tt(key, fallbackOrVars, maybeVars) {
    const vars = maybeVars || (
      fallbackOrVars && typeof fallbackOrVars === "object" && !Array.isArray(fallbackOrVars)
        ? fallbackOrVars
        : {}
    );

    const value = window.VMSI18n?.t?.(key, vars);
    return value || key;
  }

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getObject(key) {
    const value = window.VMSStorage?.get?.(key, {}) || {};
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  function saveObject(key, value) {
    window.VMSStorage?.set?.(key, value || {});
  }

  function getProgressMap() {
    return getObject(SHOP_PROGRESS_KEY);
  }

  function saveProgressMap(map) {
    saveObject(SHOP_PROGRESS_KEY, map);
  }

  function getOwnedMap() {
    return getObject(SHOP_OWNED_KEY);
  }

  function saveOwnedMap(map) {
    saveObject(SHOP_OWNED_KEY, map);
  }

  function getRevealedClassicMap() {
    return getObject(SHOP_REVEALED_CLASSIC_KEY);
  }

  function saveRevealedClassicMap(map) {
    saveObject(SHOP_REVEALED_CLASSIC_KEY, map);
  }

  function isOwned(itemId) {
    return !!getOwnedMap()[itemId];
  }

  function markOwned(itemId) {
    if (!itemId) return;
    const owned = getOwnedMap();
    owned[itemId] = true;
    saveOwnedMap(owned);
  }

  function isClassicRevealed(itemId) {
    return !!getRevealedClassicMap()[itemId];
  }

  function markClassicRevealed(itemId) {
    const revealed = getRevealedClassicMap();
    revealed[itemId] = true;
    saveRevealedClassicMap(revealed);
  }

  function getRewardCount(itemId) {
    const map = getProgressMap();
    return Math.max(0, Math.min(BG_REWARD_REQUIRED, Number(map[itemId] || 0)));
  }

  function setRewardCount(itemId, count) {
    const map = getProgressMap();
    map[itemId] = Math.max(0, Math.min(BG_REWARD_REQUIRED, Number(count || 0)));
    saveProgressMap(map);
  }

  function getActiveBackground() {
    return window.VMSStorage?.get?.(SHOP_ACTIVE_BG_KEY, "default_background") || "default_background";
  }

  function setActiveBackground(itemId) {
    window.VMSStorage?.set?.(SHOP_ACTIVE_BG_KEY, itemId);
    window.dispatchEvent(new CustomEvent("vms:cosmetics_changed", { detail: { type: "background", id: itemId } }));
  }

  function getActiveMonsterSkin() {
    return window.VMSStorage?.get?.(SHOP_ACTIVE_MONSTER_KEY, "classic_lab_monster_01") || "classic_lab_monster_01";
  }

  function setActiveMonsterSkin(itemId) {
    window.VMSStorage?.set?.(SHOP_ACTIVE_MONSTER_KEY, itemId);
    window.dispatchEvent(new CustomEvent("vms:cosmetics_changed", { detail: { type: "monster", id: itemId } }));
  }

  function priceLabel(productId) {
    const price = window.VMSPurchases?.getPrice?.(productId) || "";
    return price || tt("store_not_connected_short");
  }

  function imageTag(src, className) {
    return `<img class="${esc(className || "")}" src="${esc(src)}" alt="" draggable="false" onerror="this.onerror=null;this.src='${UI.fallback}'">`;
  }

  function rewardIconText(text) {
    return `<span class="shop-reward-progress">${imageTag(UI.reward, "shop-reward-small")} ${esc(text)}</span>`;
  }

  function vcoinsText(amount) {
    return `<span class="shop-reward-progress">${imageTag(UI.vcoins, "shop-reward-small")} ${esc(amount)}</span>`;
  }

  function skinBasePath(worldId, styleId) {
    return `./assets/shop/skins/${worldId}/${styleId}`;
  }

  function classicMonsterAsset(worldId, monster) {
    return `./assets/monsters/${worldId}/monster_${monster.padded}.webp`;
  }

  function premiumMonsterAsset(worldId, styleId, monster) {
    return `${skinBasePath(worldId, styleId)}/monster_${monster.padded}.webp`;
  }

  function getMonsterNameKey(worldId, monster) {
    return `${worldId}_monster_${monster.padded}`;
  }

  function getMonsterDisplayName(worldId, monster) {
    return tt(getMonsterNameKey(worldId, monster), tt("monster_generic_name", { n: monster.number }));
  }

  function bgAsset(worldId, number) {
    return `./assets/shop/backgrounds/${worldId}/bg_${String(number).padStart(2, "0")}.webp`;
  }

  function packAsset(worldId, styleId) {
    return `${skinBasePath(worldId, styleId)}/pack.webp`;
  }

function getWorldBackgroundItems(world) {
  const items = [];

  for (let i = 1; i <= 12; i += 1) {
    const padded = String(i).padStart(2, "0");

    items.push({
      type: "background",
      id: `${world.id}_bg_${padded}`,
      worldId: world.id,
      title: `${tt("shop_decor_row_title")} ${padded}`,
      img: bgAsset(world.id, i)
    });
  }

  return items;
}

  function isWorldNormallyAccessible(worldId) {
    if (worldId === "lab") return true;
    return !!window.VMSEconomy?.isInfiniteWorldUnlocked?.(worldId);
  }

  function isClassicNormallyVisible(worldId, monster) {
    const level = Number(window.VMSEconomy?.currentLevel || window.VMSStorage?.get?.("currentLevel", 1) || 1);
    return isWorldNormallyAccessible(worldId) && monster.level <= level;
  }

  function getStyleItems(world, style) {
    const items = [];
    const packId = `${world.id}_${style.id}_pack`;

    items.push({
      type: "pack",
      id: packId,
      worldId: world.id,
      styleId: style.id,
      productId: `vmonster_skinpack_${world.id}_${style.id}`,
      title: tt("shop_skin_pack_complete"),
      img: packAsset(world.id, style.id)
    });


    MONSTERS.forEach((monster) => {
      const monsterName = getMonsterDisplayName(world.id, monster);

      items.push({
        type: "monster_skin",
        id: `${world.id}_${style.id}_monster_${monster.padded}`,
        worldId: world.id,
        styleId: style.id,
        monsterNumber: monster.number,
        title: monsterName,
        img: premiumMonsterAsset(world.id, style.id, monster)
      });
    });

    return items;
  }

  function getClassicItems(world) {
    return MONSTERS.map((monster) => {
      const id = `classic_${world.id}_monster_${monster.padded}`;
      const visible = isClassicNormallyVisible(world.id, monster) || isClassicRevealed(id);
      return {
        type: "classic",
        id,
        worldId: world.id,
        monsterNumber: monster.number,
        visible,
        title: getMonsterDisplayName(world.id, monster),
        img: classicMonsterAsset(world.id, monster)
      };
    });
  }

  function buildTopProducts() {
    return {
      vcoins: [
        {
          id: "reward_vcoins_300",
          kind: "reward",
          icon: UI.vcoins,
          title: tt("shop_reward_vcoins_300_title"),
          rewardIcon: UI.reward,
          action: "reward_vcoins",
          amount: 300
        },
        {
          id: "vcoins_3000",
          kind: "iap",
          icon: UI.vcoins,
          title: tt("shop_vcoins_3000_title"),
          productId: "vmonster_vcoins_3000"
        },
        {
          id: "vcoins_10000",
          kind: "iap",
          icon: UI.vcoins,
          title: tt("shop_vcoins_10000_title"),
          productId: "vmonster_vcoins_10000"
        }
      ],

      jetons: [
        {
          id: "reward_jeton_1",
          kind: "reward",
          icon: UI.jeton,
          title: tt("shop_reward_jeton_1_title"),
          rewardIcon: UI.reward,
          action: "reward_jeton",
          amount: 1
        },
        {
          id: "jetons_12",
          kind: "iap",
          icon: UI.jeton,
          title: tt("shop_jetons_12_title"),
          productId: "vmonster_jetons_12"
        },
        {
          id: "jetons_30",
          kind: "iap",
          icon: UI.jeton,
          title: tt("shop_jetons_30_title"),
          productId: "vmonster_jetons_30"
        }
      ],

      premium: [
        {
          id: "no_ads",
          kind: "iap",
          icon: UI.noads,
          title: tt("shop_no_ads_title"),
          productId: "vmonster_no_ads"
        },
        {
          id: "ultimate",
          kind: "iap",
          icon: UI.noads,
          title: tt("shop_ultimate_title"),
          productId: "vmonster_ultimate_pack",
          ultimate: true
        }
      ]
    };
  }

  function renderTopProduct(item) {
    const bottom = item.kind === "reward"
      ? imageTag(item.rewardIcon, "shop-price-icon")
      : `<span>${esc(priceLabel(item.productId))}</span>`;

    return `
      <button class="shop-product-card ${item.wide ? "shop-product-card-wide" : ""} ${item.ultimate ? "shop-product-card-ultimate" : ""}" type="button" data-shop-action="${esc(item.kind)}" data-id="${esc(item.id)}" data-product-id="${esc(item.productId || "")}" data-reward-action="${esc(item.action || "")}">
        ${imageTag(item.icon, "shop-product-img")}
        <strong>${esc(item.title)}</strong>
        <span class="shop-product-price">${bottom}</span>
      </button>
    `;
  }


  function renderTopSection(titleKey, items, type) {
    return `
      <section class="shop-product-section shop-product-section-${esc(type)}">
        <div class="shop-mini-separator"></div>
        <h3 class="shop-product-section-title">${esc(tt(titleKey))}</h3>
        <div class="shop-product-grid shop-product-grid-${esc(type)}">
          ${items.map(renderTopProduct).join("")}
        </div>
      </section>
    `;
  }

  function renderActionButton(item) {
    if (item.type === "pack") {
      if (isOwned(item.id)) {
        return `<button class="shop-skin-action is-owned" type="button" disabled>${esc(tt("shop_pack_unlocked"))}</button>`;
      }
      return `<button class="shop-skin-action is-buy" type="button" data-skin-action="buy-pack" data-product-id="${esc(item.productId)}">${esc(priceLabel(item.productId))}</button>`;
    }

    if (item.type === "background") {
      if (isOwned(item.id)) {
        const active = getActiveBackground() === item.id;
        return `<button class="shop-skin-action ${active ? "is-active" : "is-owned"}" type="button" ${active ? "disabled" : ""} data-skin-action="activate-bg" data-item-id="${esc(item.id)}">${esc(active ? tt("shop_active") : tt("shop_activate"))}</button>`;
      }

      const count = getRewardCount(item.id);
      return `<button class="shop-skin-action is-reward" type="button" data-skin-action="reward-bg" data-item-id="${esc(item.id)}">${rewardIconText(`${count}/${BG_REWARD_REQUIRED}`)}</button>`;
    }

    if (item.type === "monster_skin") {
      if (isOwned(item.id)) {
        const active = getActiveMonsterSkin() === item.id;
        return `<button class="shop-skin-action ${active ? "is-active" : "is-owned"}" type="button" ${active ? "disabled" : ""} data-skin-action="activate-monster" data-item-id="${esc(item.id)}">${esc(active ? tt("shop_active") : tt("shop_activate"))}</button>`;
      }

      return `<button class="shop-skin-action is-buy" type="button" data-skin-action="buy-monster" data-item-id="${esc(item.id)}">${vcoinsText(MONSTER_SKIN_PRICE)}</button>`;
    }

    if (item.type === "classic") {
      if (!item.visible) {
        return `<button class="shop-skin-action is-reveal" type="button" data-skin-action="reveal-classic" data-item-id="${esc(item.id)}">${rewardIconText(tt("shop_reveal"))}</button>`;
      }

      const active = getActiveMonsterSkin() === item.id;
      return `<button class="shop-skin-action ${active ? "is-active" : "is-owned"}" type="button" ${active ? "disabled" : ""} data-skin-action="activate-monster" data-item-id="${esc(item.id)}">${esc(active ? tt("shop_active") : tt("shop_activate"))}</button>`;
    }

    return "";
  }

  function renderCosmeticItem(item, index, total) {
    const locked = item.type === "classic" && !item.visible;
    const imageClass = item.type === "background" || item.type === "pack" ? "shop-skin-img" : "shop-skin-img shop-skin-img-contain";
    const titleOnTop = item.type === "monster_skin" || item.type === "classic";

    return `
      <div class="shop-skin-slide" data-index="${index}">
        <article class="shop-skin-card ${locked ? "is-locked" : ""} ${titleOnTop ? "has-title-top" : ""} is-${esc(item.type)}">
          ${titleOnTop ? `<div class="shop-skin-title-top">${esc(item.title)}</div>` : ""}
          ${locked ? `<div class="shop-skin-question">?</div>` : imageTag(item.img, imageClass)}
          <div class="shop-skin-overlay">
            ${titleOnTop ? "" : `<div class="shop-skin-title">${esc(item.title)}</div>`}
            <div class="shop-skin-count">${index + 1}/${total}</div>
            ${renderActionButton(item)}
          </div>
        </article>
      </div>
    `;
  }

  function renderCarouselRow(rowTitle, items, extraClass) {
    return `
      <div class="shop-skin-row ${esc(extraClass || "")}" data-index="0">
        <div class="shop-skin-row-title">${esc(rowTitle)}</div>
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
        <h3 class="shop-world-title">${esc(tt(world.titleKey))}</h3>

        <div class="shop-world-subtitle">${esc(tt("shop_decor_section_title", { world: tt(world.titleKey) }))}</div>
        ${renderCarouselRow(tt("shop_decor_row_title"), getWorldBackgroundItems(world), "shop-world-decor-row")}

        <div class="shop-world-subtitle shop-world-subtitle-monsters">${esc(tt("shop_monsters_section_title"))}</div>
        ${renderCarouselRow(tt("shop_classic_style"), getClassicItems(world), "shop-classic-row")}
        ${getStylesForWorld(world.id).map((style) => renderCarouselRow(tt(style.titleKey), getStyleItems(world, style), "shop-monster-style-row")).join("")}
      </section>
    `;
  }

  function updateCarousel(row, nextIndex) {
    const track = row.querySelector(".shop-skin-track");
    const slides = Array.from(row.querySelectorAll(".shop-skin-slide"));
    if (!track || !slides.length) return;

    const total = slides.length;
    const raw = Number(nextIndex || 0);
    const index = ((raw % total) + total) % total;

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

      viewport.addEventListener("touchstart", (event) => { startX = event.touches?.[0]?.clientX || 0; endX = startX; }, { passive: true });
      viewport.addEventListener("touchmove", (event) => { endX = event.touches?.[0]?.clientX || 0; }, { passive: true });
      viewport.addEventListener("touchend", () => {
        const delta = endX - startX;
        if (Math.abs(delta) > 36) updateCarousel(row, Number(row.dataset.index || 0) + (delta < 0 ? 1 : -1));
        startX = 0;
        endX = 0;
      }, { passive: true });
    });
  }

  async function rewardVCoins(amount) {
    const ok = await window.VMSAds?.showRewarded?.("shop_vcoins_300");
    if (!ok) return showMessage(tt("shop_reward_error_title"), tt("shop_reward_error_text"));
    await window.VMSEconomy?.addCoins?.(amount);
    showMessage(tt("shop_reward_success_title"), tt("shop_reward_vcoins_text", { amount }));
  }

  async function rewardJeton(amount) {
    const ok = await window.VMSAds?.showRewarded?.("shop_jeton_1");
    if (!ok) return showMessage(tt("shop_reward_error_title"), tt("shop_reward_error_text"));
    await window.VMSEconomy?.addTokens?.(amount);
    showMessage(tt("shop_reward_success_title"), tt("shop_reward_jeton_text", { amount }));
  }

  async function rewardBackground(itemId) {
    if (!itemId || isOwned(itemId)) return;

    const ok = await window.VMSAds?.showRewarded?.("shop_bg_unlock");
    if (!ok) return showMessage(tt("shop_reward_error_title"), tt("shop_reward_error_text"));

    const next = getRewardCount(itemId) + 1;
    setRewardCount(itemId, next);

    if (next >= BG_REWARD_REQUIRED) {
      markOwned(itemId);
      showMessage(tt("shop_bg_unlocked_title"), tt("shop_bg_unlocked_text"));
    } else {
      showMessage(tt("shop_reward_success_title"), tt("shop_skin_progress_text", { count: next }));
    }

    window.VMSShop?.render?.();
  }

  async function revealClassic(itemId) {
    if (!itemId || isClassicRevealed(itemId)) return;

    const ok = await window.VMSAds?.showRewarded?.("shop_classic_reveal");
    if (!ok) return showMessage(tt("shop_reward_error_title"), tt("shop_reward_error_text"));

    markClassicRevealed(itemId);
    showMessage(tt("shop_classic_revealed_title"), tt("shop_classic_revealed_text"));
    window.VMSShop?.render?.();
  }

  async function buyMonsterSkin(itemId) {
    if (!itemId || isOwned(itemId)) return;

    const ok = await window.VMSEconomy?.spendCoins?.(MONSTER_SKIN_PRICE);
    if (!ok) return showMessage(tt("shop_not_enough_vcoins_title"), tt("shop_not_enough_vcoins_text"));

    markOwned(itemId);
    showMessage(tt("shop_skin_unlocked_title"), tt("shop_skin_unlocked_text"));
    window.VMSShop?.render?.();
  }

  function activateBackground(itemId) {
    if (!isOwned(itemId)) return;
    setActiveBackground(itemId);
    window.VMSShop?.render?.();
  }

  function activateMonsterSkin(itemId) {
    const isClassic = itemId.startsWith("classic_");
    if (!isClassic && !isOwned(itemId)) return;
    if (isClassic && !isClassicRevealed(itemId)) {
      const parts = itemId.match(/^classic_(.+)_monster_(\d+)$/);
      const worldId = parts?.[1];
      const number = Number(parts?.[2] || 0);
      const monster = MONSTERS.find((m) => m.number === number);
      if (!monster || !isClassicNormallyVisible(worldId, monster)) return;
    }

    setActiveMonsterSkin(itemId);
    window.VMSShop?.render?.();
  }

  function showMessage(title, text) {
    window.VMSModals?.show?.({
      title,
      text,
      primaryText: tt("btn_ok"),
      secondaryText: tt("btn_close"),
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

      const topProducts = buildTopProducts();

      list.innerHTML = `
        <section class="shop-buy-zone">
          ${renderTopSection("shop_section_vcoins", topProducts.vcoins, "three")}
          ${renderTopSection("shop_section_jetons", topProducts.jetons, "three")}
          ${renderTopSection("shop_section_premium", topProducts.premium, "premium")}
        </section>

        <div class="shop-separator"></div>
        <h2 class="shop-custom-title">${esc(tt("shop_customization_title"))}</h2>

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
        const action = skinBtn.dataset.skinAction;
        const itemId = skinBtn.dataset.itemId;

        if (action === "buy-pack") return window.VMSPurchases?.buy?.(skinBtn.dataset.productId);
        if (action === "reward-bg") return rewardBackground(itemId);
        if (action === "buy-monster") return buyMonsterSkin(itemId);
        if (action === "activate-bg") return activateBackground(itemId);
        if (action === "activate-monster") return activateMonsterSkin(itemId);
        if (action === "reveal-classic") return revealClassic(itemId);
      }
    },

    unlockSkinPack(worldId, styleId) {
      const world = WORLDS.find((w) => w.id === worldId);
      const style = getStylesForWorld(worldId).find((s) => s.id === styleId);
      if (!world || !style) return false;

      getStyleItems(world, style).forEach((item) => {
        markOwned(item.id);
        if (item.type === "background") setRewardCount(item.id, BG_REWARD_REQUIRED);
      });

      this.render();
      return true;
    },

    unlockUltimatePack() {
      WORLDS.forEach((world) => {
        getStylesForWorld(world.id).forEach((style) => this.unlockSkinPack(world.id, style.id));
      });
      window.VMSEconomy?.activateNoAds?.();
      this.render();
      return true;
    },

    getOwnedShopItems() {
      return getOwnedMap();
    },

    getShopBgRewardProgress() {
      return getProgressMap();
    },

    getRevealedClassicMonsters() {
      return getRevealedClassicMap();
    },

    getActiveBackground,
    getActiveMonsterSkin
  };

  document.addEventListener("click", (event) => {
    window.VMSShop?.handleClick?.(event.target);
  });

  window.addEventListener("vms:price_updated", () => { window.VMSShop?.render?.(); });
  window.addEventListener("vms:store_unavailable", () => { window.VMSShop?.render?.(); });
})();
