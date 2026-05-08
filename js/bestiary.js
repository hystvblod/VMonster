(function () {
  "use strict";

  const DATA_URL = "./data/bestiary.json";
  const STORAGE_KEY = "vmonster_bestiary_discovered_v1";
  const REVEAL_ALL_PRODUCT_ID = "vmonster_bestiary_reveal_all";
  const AUTO_POPUP_MIN_LEVEL = 4;

  let data = null;
  let isReady = false;
  let popupEntryId = null;
  const railIndexByWorld = {};

  function t(key, vars = {}) {
    if (!key) return "";
    let value = window.VMSI18n?.t ? window.VMSI18n.t(key, vars) : key;
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
    } catch (error) {
      console.warn("[VMSBestiary] Impossible de charger le bestiaire", error);
      data = { worlds: [] };
    }

    isReady = true;
    bindEvents();
    render();
    return true;
  }

  function bindEvents() {
    if (window.__VMS_BESTIARY_EVENTS_BOUND__) return;
    window.__VMS_BESTIARY_EVENTS_BOUND__ = true;

    document.body.addEventListener("click", async (event) => {
      const node = event.target.closest("[data-bestiary-action]");
      if (!node) return;

      const action = node.getAttribute("data-bestiary-action");

      if (action === "reward-reveal") {
        const entryId = node.getAttribute("data-entry-id");
        await revealOneWithReward(entryId);
        return;
      }

      if (action === "reveal-all") {
        await buyRevealAll();
        return;
      }

      if (action === "open-info") {
        const entryId = node.getAttribute("data-entry-id");
        openPopup(entryId);
        return;
      }

      if (action === "close-popup") {
        closePopup();
        return;
      }

      if (action === "popup-prev") {
        switchPopup(-1);
        return;
      }

      if (action === "popup-next") {
        switchPopup(1);
        return;
      }

      if (action === "prev-world") {
        moveRail(node.getAttribute("data-world-id"), -1);
        return;
      }

      if (action === "next-world") {
        moveRail(node.getAttribute("data-world-id"), 1);
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

  function getWorldEntries(worldId) {
    return getEntries().filter((entry) => entry.worldId === worldId);
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

  function revealAll() {
    const map = getStorageMap();
    getEntries().forEach((entry) => {
      map[entry.id] = map[entry.id] || Date.now();
    });
    saveStorageMap(map);
    render();
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
    const progress = document.getElementById("bestiaryProgress");
    const revealAllBtn = document.getElementById("bestiaryRevealAllBtn");
    const root = document.getElementById("bestiaryGrid");

    if (progress) {
      const state = getProgress();
      progress.textContent = t("bestiary_progress", state);
    }

    if (revealAllBtn) {
      revealAllBtn.textContent = t("bestiary_reveal_all_button", {
        price: getRevealAllPrice()
      });
    }

    if (!root) return;

    root.innerHTML = getWorlds().map((world) => {
      const entries = world.monsters || [];
      if (railIndexByWorld[world.id] == null) railIndexByWorld[world.id] = 0;

      return `
        <section class="bestiary-world-section">
          <div class="bestiary-world-head">
            <h3>${esc(t(world.nameKey))}</h3>

            <div class="bestiary-world-nav">
              <button type="button" data-bestiary-action="prev-world" data-world-id="${esc(world.id)}">‹</button>
              <button type="button" data-bestiary-action="next-world" data-world-id="${esc(world.id)}">›</button>
            </div>
          </div>

          <div class="bestiary-world-rail-wrap">
            <div class="bestiary-world-rail" id="bestiaryRail-${esc(world.id)}">
              ${entries.map((entry) => renderMiniCard({
                ...entry,
                worldId: world.id,
                worldNameKey: world.nameKey
              })).join("")}
            </div>
          </div>
        </section>
      `;
    }).join("");

    requestAnimationFrame(() => {
      Object.keys(railIndexByWorld).forEach((worldId) => {
        scrollToRailIndex(worldId, railIndexByWorld[worldId], false);
      });
    });

    if (popupEntryId) {
      renderPopup();
    }
  }

  function renderMiniCard(entry) {
    const unlocked = isDiscovered(entry.id);

    if (!unlocked) {
      return `
        <article class="bestiary-mini-card" data-entry-id="${esc(entry.id)}">
          <div class="bestiary-mini-visual-locked">?</div>
          <div class="bestiary-mini-name">${esc(t("bestiary_unknown_title"))}</div>
          <div class="bestiary-mini-level">${esc(t("bestiary_level", { level: entry.level }))}</div>

          <div class="bestiary-mini-actions">
            <button class="bestiary-mini-reveal-btn" type="button" data-bestiary-action="reward-reveal" data-entry-id="${esc(entry.id)}">
              <img src="./assets/ui/reward.webp" alt="" />
              <span>${esc(t("bestiary_reveal_chip"))}</span>
            </button>
          </div>
        </article>
      `;
    }

    return `
      <article class="bestiary-mini-card" data-entry-id="${esc(entry.id)}">
        <div class="bestiary-mini-visual">
          <img src="${esc(entry.asset)}" alt="" draggable="false" />
        </div>
        <div class="bestiary-mini-name">${esc(t(entry.nameKey))}</div>
        <div class="bestiary-mini-level">${esc(t("bestiary_level", { level: entry.level }))}</div>

        <div class="bestiary-mini-actions">
          <button class="bestiary-mini-info-btn" type="button" data-bestiary-action="open-info" data-entry-id="${esc(entry.id)}">
            ${esc(t("bestiary_more_info"))}
          </button>
        </div>
      </article>
    `;
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
    openPopup(entry.id);
  }

  async function buyRevealAll() {
    if (window.VMSPurchases?.buy) {
      await window.VMSPurchases.buy(REVEAL_ALL_PRODUCT_ID);
    }
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
        window.setTimeout(() => openPopup(entry.id), 240);
      }
    }

    return isNew;
  }

  function moveRail(worldId, delta) {
    const entries = getWorldEntries(worldId);
    if (!entries.length) return;

    const current = Number(railIndexByWorld[worldId] || 0);
    let next = current + delta;

    if (next < 0) next = entries.length - 1;
    if (next >= entries.length) next = 0;

    railIndexByWorld[worldId] = next;
    scrollToRailIndex(worldId, next, true);
  }

  function scrollToRailIndex(worldId, index, smooth = true) {
    const rail = document.getElementById(`bestiaryRail-${worldId}`);
    if (!rail) return;

    const cards = rail.querySelectorAll(".bestiary-mini-card");
    if (!cards.length) return;

    const safeIndex = Math.max(0, Math.min(index, cards.length - 1));
    const card = cards[safeIndex];

    card.scrollIntoView({
      behavior: smooth ? "smooth" : "auto",
      inline: "start",
      block: "nearest"
    });
  }

  function openPopup(entryId) {
    popupEntryId = entryId;
    renderPopup();
  }

  function closePopup() {
    popupEntryId = null;
    document.querySelector(".bestiary-popup-layer")?.remove();
  }

  function switchPopup(delta) {
    const current = getEntry(popupEntryId);
    if (!current) return;

    const entries = getWorldEntries(current.worldId);
    const index = entries.findIndex((entry) => entry.id === current.id);
    if (index < 0) return;

    let nextIndex = index + delta;
    if (nextIndex < 0) nextIndex = entries.length - 1;
    if (nextIndex >= entries.length) nextIndex = 0;

    popupEntryId = entries[nextIndex].id;
    renderPopup();
  }

  function renderPopup() {
    const entry = getEntry(popupEntryId);
    if (!entry || !isDiscovered(entry.id)) {
      closePopup();
      return;
    }

    const existing = document.querySelector(".bestiary-popup-layer");
    if (existing) existing.remove();

    const layer = document.createElement("div");
    layer.className = "bestiary-popup-layer";
    layer.innerHTML = buildPopupMarkup(entry);

    layer.addEventListener("click", (event) => {
      if (event.target === layer) closePopup();
    });

    document.body.appendChild(layer);
  }

  function buildPopupMarkup(entry) {
    return `
      <div class="bestiary-popup-card" role="dialog" aria-modal="true">
        <button class="bestiary-popup-close" type="button" data-bestiary-action="close-popup" aria-label="${esc(t("bestiary_close"))}">×</button>

        <div class="bestiary-popup-top">
          <div class="bestiary-popup-kicker">${esc(t("bestiary_new_discovery"))}</div>

          <div class="bestiary-popup-switch">
            <button type="button" data-bestiary-action="popup-prev">‹</button>
            <button type="button" data-bestiary-action="popup-next">›</button>
          </div>
        </div>

        <div class="bestiary-popup-body">
          <div class="bestiary-popup-visual">
            <img src="${esc(entry.asset)}" alt="" draggable="false" />
          </div>

          <div class="bestiary-popup-content">
            <div class="bestiary-popup-sub">
              ${esc(t(entry.worldNameKey))} · ${esc(t("bestiary_level", { level: entry.level }))}
            </div>

            <h3>${esc(t(entry.nameKey))}</h3>

            <div class="bestiary-popup-tags">
              <span>${esc(t(entry.typeKey))}</span>
              <span>${esc(t(entry.personalityKey))}</span>
            </div>

            <p>${esc(t(entry.descriptionKey))}</p>

            <dl class="bestiary-popup-facts">
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
        </div>

        <button class="primary-btn bestiary-popup-ok" type="button" data-bestiary-action="close-popup">
          ${esc(t("bestiary_ok"))}
        </button>
      </div>
    `;
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
