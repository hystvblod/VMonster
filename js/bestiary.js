(function () {
  "use strict";

  const DATA_URL = "./data/bestiary.json";
  const STORAGE_KEY = "vmonster_bestiary_discovered_v1";
  const REVEAL_ALL_PRODUCT_ID = "vmonster_bestiary_reveal_all";
  const AUTO_POPUP_MIN_LEVEL = 4;

  let data = null;
  let isReady = false;

  function t(key, vars = {}) {
    if (!key) return "";
    const i18n = window.VMSI18n;
    let value = i18n?.t ? i18n.t(key, vars) : key;
    if (value === key && data?.fallback?.[key]) value = data.fallback[key];
    Object.keys(vars).forEach((name) => {
      value = String(value).replaceAll(`{${name}}`, String(vars[name]));
    });
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

  async function init() {
    if (isReady) return true;

    try {
      const response = await fetch(DATA_URL, { cache: "no-store" });
      if (!response.ok) throw new Error(`bestiary json ${response.status}`);
      data = await response.json();
      isReady = true;
      bindEvents();
      render();
      return true;
    } catch (error) {
      console.warn("[VMSBestiary] Impossible de charger le bestiaire", error);
      data = { worlds: [] };
      isReady = true;
      return false;
    }
  }

  function bindEvents() {
    if (window.__VMS_BESTIARY_EVENTS_BOUND__) return;
    window.__VMS_BESTIARY_EVENTS_BOUND__ = true;

    document.body.addEventListener("click", async (event) => {
      const actionNode = event.target.closest("[data-bestiary-action]");
      if (!actionNode) return;

      const action = actionNode.getAttribute("data-bestiary-action");

      if (action === "reward-reveal") {
        const entryId = actionNode.getAttribute("data-entry-id");
        await revealOneWithReward(entryId);
      }

      if (action === "reveal-all") {
        await buyRevealAll();
      }
    });

    window.addEventListener("vms:price_updated", render);
    window.addEventListener("vms:store_unavailable", render);
  }

  function getStorageMap() {
    const value = window.VMSStorage?.get?.(STORAGE_KEY, {});
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return value;
  }

  function saveStorageMap(map) {
    window.VMSStorage?.set?.(STORAGE_KEY, map || {});
  }

  function getWorlds() {
    return Array.isArray(data?.worlds) ? data.worlds : [];
  }

  function getEntries() {
    return getWorlds().flatMap((world) => {
      return (world.monsters || []).map((monster) => ({
        ...monster,
        worldId: world.id,
        worldNameKey: world.nameKey
      }));
    });
  }

  function getEntry(entryId) {
    return getEntries().find((entry) => entry.id === entryId) || null;
  }

  function getEntryByWorldAndLevel(worldId, level) {
    const safeWorld = worldId || window.VMSLevels?.getCurrentWorld?.()?.id || "lab";
    const safeLevel = Number(level || 1);
    return getEntries().find((entry) => entry.worldId === safeWorld && Number(entry.level) === safeLevel) || null;
  }

  function isDiscovered(entryId) {
    return !!getStorageMap()[entryId];
  }

  function markDiscovered(entryId) {
    if (!entryId) return false;
    const map = getStorageMap();
    if (map[entryId]) return false;
    map[entryId] = Date.now();
    saveStorageMap(map);
    return true;
  }

  function getProgress() {
    const entries = getEntries();
    const map = getStorageMap();
    const discovered = entries.filter((entry) => map[entry.id]).length;
    return { discovered, total: entries.length };
  }

  function getRevealAllPrice() {
    return window.VMSPurchases?.getPrice?.(REVEAL_ALL_PRODUCT_ID) || t("bestiary_store_price");
  }

  function render() {
    const root = document.getElementById("bestiaryGrid");
    const progress = document.getElementById("bestiaryProgress");
    const revealAllBtn = document.getElementById("bestiaryRevealAllBtn");

    if (progress) {
      const state = getProgress();
      progress.textContent = t("bestiary_progress", state);
    }

    if (revealAllBtn) {
      revealAllBtn.textContent = t("bestiary_reveal_all_button", { price: getRevealAllPrice() });
    }

    if (!root) return;

    root.innerHTML = getWorlds().map((world) => {
      const cards = (world.monsters || []).map((entry) => renderCard({
        ...entry,
        worldId: world.id,
        worldNameKey: world.nameKey
      })).join("");

      return `
        <section class="bestiary-world-section">
          <h3>${esc(t(world.nameKey))}</h3>
          <div class="bestiary-grid-inner">${cards}</div>
        </section>
      `;
    }).join("");
  }

  function renderCard(entry, options = {}) {
    const unlocked = options.forceReveal || isDiscovered(entry.id);
    const levelText = t("bestiary_level", { level: entry.level });
    const worldText = t(entry.worldNameKey);

    if (!unlocked) {
      return `
        <article class="bestiary-card is-locked">
          <div class="bestiary-locked-image">?</div>
          <div class="bestiary-card-body">
            <div class="bestiary-kicker">${esc(worldText)} · ${esc(levelText)}</div>
            <h3>${esc(t("bestiary_unknown_title"))}</h3>
            <p>${esc(t("bestiary_locked_text"))}</p>
            <button class="bestiary-reward-btn" type="button" data-bestiary-action="reward-reveal" data-entry-id="${esc(entry.id)}">
              <img src="./assets/ui/reward.webp" alt="" />
              <span>${esc(t("bestiary_reward_reveal"))}</span>
            </button>
          </div>
        </article>
      `;
    }

    return `
      <article class="bestiary-card ${options.popup ? "is-popup" : ""}">
        <div class="bestiary-image-wrap">
          <img class="bestiary-image" src="${esc(entry.asset)}" alt="" draggable="false" />
        </div>
        <div class="bestiary-card-body">
          <div class="bestiary-kicker">${esc(worldText)} · ${esc(levelText)}</div>
          <h3>${esc(t(entry.nameKey))}</h3>
          <div class="bestiary-tags">
            <span>${esc(t(entry.typeKey))}</span>
            <span>${esc(t(entry.personalityKey))}</span>
          </div>
          <p>${esc(t(entry.descriptionKey))}</p>
          <dl class="bestiary-facts">
            <div>
              <dt>${esc(t("bestiary_habitat_label"))}</dt>
              <dd>${esc(t(entry.habitatKey))}</dd>
            </div>
            <div>
              <dt>${esc(t("bestiary_fusion_role_label"))}</dt>
              <dd>${esc(t(entry.fusionRoleKey))}</dd>
            </div>
          </dl>
        </div>
      </article>
    `;
  }

  function showDiscoveryPopup(entry) {
    if (!entry) return;

    const layer = document.createElement("div");
    layer.className = "bestiary-popup-layer";
    layer.innerHTML = `
      <div class="bestiary-popup-card" role="dialog" aria-modal="true">
        <button class="bestiary-popup-close" type="button" aria-label="${esc(t("bestiary_close"))}">×</button>
        <div class="bestiary-popup-kicker">${esc(t("bestiary_new_discovery"))}</div>
        ${renderCard(entry, { forceReveal: true, popup: true })}
        <button class="primary-btn bestiary-popup-ok" type="button">${esc(t("bestiary_ok"))}</button>
      </div>
    `;

    document.body.appendChild(layer);

    const close = () => layer.remove();
    layer.querySelector(".bestiary-popup-close")?.addEventListener("click", close);
    layer.querySelector(".bestiary-popup-ok")?.addEventListener("click", close);
  }

  async function revealOneWithReward(entryId) {
    const entry = getEntry(entryId);
    if (!entry) return;
    if (isDiscovered(entry.id)) return;

    const ok = await window.VMSAds?.showRewarded?.("bestiary_reveal_card");
    if (!ok) {
      window.VMSModals?.show?.({
        title: t("shop_reward_error_title"),
        text: t("shop_reward_error_text"),
        primaryText: t("btn_ok"),
        secondaryText: t("btn_close"),
        onPrimary: () => {},
        onSecondary: () => {}
      });
      return;
    }

    markDiscovered(entry.id);
    render();
    showDiscoveryPopup(entry);
  }

  async function buyRevealAll() {
    if (window.VMSPurchases?.buy) {
      await window.VMSPurchases.buy(REVEAL_ALL_PRODUCT_ID);
    }
  }

  function revealAll() {
    const map = getStorageMap();
    getEntries().forEach((entry) => {
      map[entry.id] = map[entry.id] || Date.now();
    });
    saveStorageMap(map);
    render();
  }

  async function discover(worldId, level, options = {}) {
    await init();

    const numericLevel = Number(level || 1);
    if (numericLevel < AUTO_POPUP_MIN_LEVEL) return false;

    const entry = getEntryByWorldAndLevel(worldId, numericLevel);
    if (!entry) return false;

    const isNew = markDiscovered(entry.id);
    if (isNew) {
      render();
      if (options.popup !== false) {
        window.setTimeout(() => showDiscoveryPopup(entry), 240);
      }
    }

    return isNew;
  }

  window.VMSBestiary = {
    init,
    render,
    discover,
    revealAll,
    getProgress,
    getEntries,
    getDiscoveredMap: getStorageMap
  };
})();
