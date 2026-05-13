(function () {
  "use strict";

  const DATA_URL = "./data/bestiary.json";
  const STORAGE_KEY = "vmonster_bestiary_discovered_v1";
  const REVEAL_ALL_PRODUCT_ID = "vmonster_bestiary_reveal_all";
  const AUTO_POPUP_MIN_LEVEL = 4;

  const UI = {
    reward: window.VMSAsset("ui", "reward"),
    fallback: window.VMSAsset("ui", "fallback")
  };

  let data = null;
  let isReady = false;
  let popupEntryId = null;

  function t(key, vars = {}) {
    if (!key) return "";

    let value = window.VMSI18n?.t ? window.VMSI18n.t(key, vars) : key;

    if (value === key && data?.fallback?.[key]) {
      value = data.fallback[key];
    }

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

  function imageTag(src, className) {
    return `<img class="${esc(className || "")}" src="${esc(src)}" alt="" draggable="false" onerror="this.onerror=null;this.src='${UI.fallback}'">`;
  }

  function rewardIconText(text) {
    return `<span class="shop-reward-progress">${imageTag(UI.reward, "shop-reward-small")} ${esc(text)}</span>`;
  }

  async function init() {
    if (isReady) return true;

    try {
      const response = await fetch(DATA_URL, { cache: "no-store" });

      if (!response.ok) {
        throw new Error(`bestiary json ${response.status}`);
      }

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
      const actionNode = event.target.closest("[data-bestiary-action]");

      if (actionNode) {
        const action = actionNode.getAttribute("data-bestiary-action");

        if (action === "reward-reveal") {
          await revealOneWithReward(actionNode.getAttribute("data-entry-id"));
          return;
        }

        if (action === "reveal-all") {
          await buyRevealAll();
          return;
        }

        if (action === "open-info") {
          openPopup(actionNode.getAttribute("data-entry-id"));
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
      }

      const carouselButton = event.target.closest("[data-bestiary-carousel]");
      if (carouselButton) {
        const row = carouselButton.closest(".bestiary-skin-row");
        const direction = carouselButton.getAttribute("data-bestiary-carousel");
        const current = Number(row?.dataset.index || 0);

        if (direction === "prev") {
          updateCarousel(row, current - 1);
        }

        if (direction === "next") {
          updateCarousel(row, current + 1);
        }
      }
    });

    window.addEventListener("vms:price_updated", render);
    window.addEventListener("vms:store_unavailable", render);
  }

  function getStorageMap() {
    const value = window.VMSStorage?.get?.(STORAGE_KEY, {});

    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }

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

  function getDiscoveredWorldEntries(worldId) {
    return getWorldEntries(worldId).filter((entry) => isDiscovered(entry.id));
  }

  function getEntry(entryId) {
    return getEntries().find((entry) => entry.id === entryId) || null;
  }

  function getEntryByWorldAndLevel(worldId, level) {
    const safeWorld = worldId || window.VMSLevels?.getCurrentWorld?.()?.id || "lab";
    const safeLevel = Number(level || 1);

    return getEntries().find((entry) => {
      return entry.worldId === safeWorld && Number(entry.level) === safeLevel;
    }) || null;
  }

  function isDiscovered(entryId) {
    return !!getStorageMap()[entryId];
  }

  function markDiscovered(entryId) {
    if (!entryId) return false;

    const map = getStorageMap();

    if (map[entryId]) {
      return false;
    }

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

    return {
      discovered,
      total: entries.length
    };
  }

  function getRevealAllPrice() {
    return window.VMSPurchases?.getPrice?.(REVEAL_ALL_PRODUCT_ID) || t("bestiary_store_price");
  }

  function render() {
    const progress = document.getElementById("bestiaryProgress");
    const revealAllBtn = document.getElementById("bestiaryRevealAllBtn");
    const root = document.getElementById("bestiaryGrid");

    if (progress) {
      progress.textContent = t("bestiary_progress", getProgress());
    }

    if (revealAllBtn) {
      revealAllBtn.textContent = t("bestiary_reveal_all_button", {
        price: getRevealAllPrice()
      });
    }

    if (!root) return;

    root.innerHTML = getWorlds().map(renderWorldBlock).join("");

    root.querySelectorAll(".bestiary-skin-row").forEach((row) => {
      updateCarousel(row, Number(row.dataset.index || 0), false);
      wireSwipe(row);
    });

    if (popupEntryId) {
      renderPopup();
    }
  }

  function renderWorldBlock(world) {
    const entries = (world.monsters || []).map((monster) => ({
      ...monster,
      worldId: world.id,
      worldNameKey: world.nameKey
    }));

    return `
      <section class="shop-world-block bestiary-world-block" data-world="${esc(world.id)}">
        <h3 class="shop-world-title">${esc(t(world.nameKey))}</h3>

        <div class="shop-skin-row bestiary-skin-row" data-index="0" data-world-id="${esc(world.id)}">
          <div class="shop-skin-carousel bestiary-carousel">
            <button class="shop-skin-arrow shop-skin-prev" type="button" data-bestiary-carousel="prev" aria-label="${esc(t("shop_carousel_prev"))}">‹</button>

            <div class="shop-skin-viewport">
              <div class="shop-skin-track">
                ${entries.map((entry, index) => renderSlide(entry, index, entries.length)).join("")}
              </div>
            </div>

            <button class="shop-skin-arrow shop-skin-next" type="button" data-bestiary-carousel="next" aria-label="${esc(t("shop_carousel_next"))}">›</button>
          </div>

          <div class="shop-skin-dots">
            ${entries.map((_, index) => `<span class="shop-skin-dot ${index === 0 ? "active" : ""}"></span>`).join("")}
          </div>
        </div>
      </section>
    `;
  }

  function renderSlide(entry, index, total) {
    const unlocked = isDiscovered(entry.id);

    if (!unlocked) {
      return `
        <div class="shop-skin-slide" data-index="${index}">
          <article class="shop-skin-card bestiary-shop-card is-locked has-title-top">
            <div class="shop-skin-title-top">${esc(t("bestiary_unknown_title"))}</div>
            <div class="shop-skin-question">?</div>

            <div class="shop-skin-overlay">
              <div class="shop-skin-count">${index + 1}/${total} · ${esc(t("bestiary_level", { level: entry.level }))}</div>

              <button class="shop-skin-action is-reveal" type="button" data-bestiary-action="reward-reveal" data-entry-id="${esc(entry.id)}">
                ${rewardIconText(t("bestiary_reveal_chip"))}
              </button>
            </div>
          </article>
        </div>
      `;
    }

    return `
      <div class="shop-skin-slide" data-index="${index}">
        <article class="shop-skin-card bestiary-shop-card has-title-top is-classic">
          <div class="shop-skin-title-top">${esc(t(entry.nameKey))}</div>
          ${imageTag(entry.asset, "shop-skin-img shop-skin-img-contain")}

          <div class="shop-skin-overlay">
            <div class="shop-skin-count">${index + 1}/${total} · ${esc(t("bestiary_level", { level: entry.level }))}</div>

            <button class="shop-skin-action is-owned" type="button" data-bestiary-action="open-info" data-entry-id="${esc(entry.id)}">
              ${esc(t("bestiary_more_info"))}
            </button>
          </div>
        </article>
      </div>
    `;
  }

  function updateCarousel(row, nextIndex, animated = true) {
    if (!row) return;

    const track = row.querySelector(".shop-skin-track");
    const slides = Array.from(row.querySelectorAll(".shop-skin-slide"));

    if (!track || !slides.length) return;

    const total = slides.length;
    const raw = Number(nextIndex || 0);
    const index = ((raw % total) + total) % total;

    row.dataset.index = String(index);

    if (!animated) {
      track.style.transition = "none";
      track.style.transform = `translateX(${-index * 100}%)`;

      requestAnimationFrame(() => {
        track.style.transition = "";
      });
    } else {
      track.style.transform = `translateX(${-index * 100}%)`;
    }

    row.querySelectorAll(".shop-skin-dot").forEach((dot, i) => {
      dot.classList.toggle("active", i === index);
    });
  }

  function wireSwipe(row) {
    if (!row || row.dataset.swipeBound === "1") return;

    row.dataset.swipeBound = "1";

    const viewport = row.querySelector(".shop-skin-viewport");
    if (!viewport) return;

    let startX = 0;
    let endX = 0;

    viewport.addEventListener("touchstart", (event) => {
      startX = event.touches?.[0]?.clientX || 0;
      endX = startX;
    }, { passive: true });

    viewport.addEventListener("touchmove", (event) => {
      endX = event.touches?.[0]?.clientX || 0;
    }, { passive: true });

    viewport.addEventListener("touchend", () => {
      const delta = endX - startX;

      if (Math.abs(delta) > 36) {
        updateCarousel(row, Number(row.dataset.index || 0) + (delta < 0 ? 1 : -1));
      }

      startX = 0;
      endX = 0;
    }, { passive: true });
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

    if (numericLevel < AUTO_POPUP_MIN_LEVEL) {
      return false;
    }

    const entry = getEntryByWorldAndLevel(worldId, numericLevel);

    if (!entry) {
      return false;
    }

    const isNew = markDiscovered(entry.id);

    if (isNew) {
      render();

      if (options.popup !== false) {
        window.setTimeout(() => openPopup(entry.id), 240);
      }
    }

    return isNew;
  }

  function openPopup(entryId) {
    const entry = getEntry(entryId);

    if (!entry) return;
    if (!isDiscovered(entry.id)) return;

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

    const entries = getDiscoveredWorldEntries(current.worldId);

    if (!entries.length) return;

    const index = entries.findIndex((entry) => entry.id === current.id);

    if (index < 0) return;

    let nextIndex = index + delta;

    if (nextIndex < 0) {
      nextIndex = entries.length - 1;
    }

    if (nextIndex >= entries.length) {
      nextIndex = 0;
    }

    popupEntryId = entries[nextIndex].id;
    renderPopup();
  }

  function renderPopup() {
    const entry = getEntry(popupEntryId);

    if (!entry || !isDiscovered(entry.id)) {
      closePopup();
      return;
    }

    document.querySelector(".bestiary-popup-layer")?.remove();

    const layer = document.createElement("div");
    layer.className = "bestiary-popup-layer";
    layer.innerHTML = buildPopupMarkup(entry);

    layer.addEventListener("click", (event) => {
      if (event.target === layer) {
        closePopup();
      }
    });

    document.body.appendChild(layer);
  }

  function buildPopupMarkup(entry) {
    return `
      <div class="bestiary-popup-card" role="dialog" aria-modal="true">
        <button class="bestiary-popup-close" type="button" data-bestiary-action="close-popup" aria-label="${esc(t("bestiary_close"))}">×</button>

        <div class="bestiary-popup-top">
          <div class="bestiary-popup-kicker">${esc(t("bestiary_identity_card"))}</div>

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
