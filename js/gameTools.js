(function () {
  "use strict";

  const DELETE_TOKEN_COST = 1;
  const UNDO_TOKEN_COST = 1;

  let deleteMode = false;
  let deletePaymentMode = "token";
  let selectedMonsterId = null;

  function t(key, vars) {
    return window.VMSI18n?.t?.(key, vars) || key;
  }

  function clonePlain(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function getMonsterById(id) {
    return window.VMSGame?.state?.monsters?.find((monster) => monster.id === id) || null;
  }

  function clearDeleteSelection() {
    selectedMonsterId = null;

    const monsters = window.VMSGame?.state?.monsters || [];
    monsters.forEach((monster) => {
      monster.pendingDelete = false;
    });
  }

  function showToolsPopup() {
    const tokens = Number(window.VMSEconomy?.tokens || 0);

    window.VMSModals.show({
      title: t("game_tools_title"),
      text: t("game_tools_text", { tokens }),
      primaryText: t("game_tools_delete_token"),
      secondaryText: t("game_tools_undo_token"),
      tertiaryText: t("game_tools_more"),
      onPrimary: () => startDeleteMode("token"),
      onSecondary: () => undoWithToken(),
      onTertiary: () => showMoreToolsPopup()
    });
  }

  function showMoreToolsPopup() {
    window.VMSModals.show({
      title: t("game_tools_more_title"),
      text: t("game_tools_more_text"),
      primaryText: t("game_tools_delete_reward"),
      secondaryText: t("game_tools_undo_reward"),
      tertiaryText: t("game_tools_buy_12"),
      onPrimary: () => startDeleteMode("reward"),
      onSecondary: () => undoWithReward(),
      onTertiary: () => window.VMSPurchases?.buy?.("vmonster_jetons_12")
    });
  }

  function startDeleteMode(paymentMode) {
    if (!window.VMSGame?.running || window.VMSGame?.gameOver) return;

    if (!Array.isArray(window.VMSGame.state.monsters) || window.VMSGame.state.monsters.length <= 0) {
      window.VMSModals.show({
        title: t("game_tools_no_monster_title"),
        text: t("game_tools_no_monster_text"),
        primaryText: t("btn_ok"),
        secondaryText: t("btn_close"),
        onPrimary: () => {},
        onSecondary: () => {}
      });
      return;
    }

    deleteMode = true;
    deletePaymentMode = paymentMode || "token";
    clearDeleteSelection();

    window.VMSModals.show({
      title: t("game_tools_select_title"),
      text: t("game_tools_select_text"),
      primaryText: t("btn_ok"),
      secondaryText: t("btn_close"),
      onPrimary: () => {},
      onSecondary: () => cancelDeleteMode()
    });
  }

  function cancelDeleteMode() {
    deleteMode = false;
    deletePaymentMode = "token";
    clearDeleteSelection();
  }

  function findMonsterAt(clientX, clientY) {
    const monsters = window.VMSGame?.state?.monsters || [];

    for (let index = monsters.length - 1; index >= 0; index -= 1) {
      const monster = monsters[index];
      if (!monster || monster.collecting || monster.merging) continue;

      const meta = window.VMSLevels?.getMonsterByLevel?.(monster.level) || {};
      const radius = Number(monster.drawRadius || monster.radius || meta.drawRadius || meta.radius || 40);
      const dx = clientX - monster.x;
      const dy = clientY - monster.y;
      const touchRadius = Math.max(34, radius * 1.15);

      if ((dx * dx + dy * dy) <= touchRadius * touchRadius) {
        return monster;
      }
    }

    return null;
  }

  function handleCanvasPointerDown(event) {
    if (!deleteMode) return false;

    const monster = findMonsterAt(event.clientX, event.clientY);

    clearDeleteSelection();

    if (!monster) {
      window.VMSModals.show({
        title: t("game_tools_select_title"),
        text: t("game_tools_select_again_text"),
        primaryText: t("btn_ok"),
        secondaryText: t("btn_close"),
        onPrimary: () => {},
        onSecondary: () => cancelDeleteMode()
      });
      return true;
    }

    monster.pendingDelete = true;
    selectedMonsterId = monster.id;

    window.VMSModals.show({
      title: t("game_tools_confirm_delete_title"),
      text: t("game_tools_confirm_delete_text"),
      primaryText: t("game_tools_confirm"),
      secondaryText: t("btn_close"),
      onPrimary: () => confirmDelete(),
      onSecondary: () => cancelDeleteMode()
    });

    return true;
  }

  async function confirmDelete() {
    const monster = getMonsterById(selectedMonsterId);

    if (!monster) {
      cancelDeleteMode();
      return;
    }

    let paid = false;

    if (deletePaymentMode === "reward") {
      paid = await window.VMSAds?.showRewarded?.("game_delete_monster");
    } else {
      paid = await window.VMSEconomy?.spendToken?.(DELETE_TOKEN_COST);
    }

    if (!paid) {
      window.VMSModals.show({
        title: t("game_tools_payment_failed_title"),
        text: t("game_tools_payment_failed_text"),
        primaryText: t("btn_ok"),
        secondaryText: t("btn_close"),
        onPrimary: () => {},
        onSecondary: () => {}
      });
      cancelDeleteMode();
      return;
    }

    window.VMSGame.state.monsters = window.VMSGame.state.monsters.filter((item) => item.id !== selectedMonsterId);

    window.VMSGame.spawnParticles(
      monster.x,
      monster.y,
      monster.color || "#9cecff",
      22
    );

    window.VMSEconomy?.refreshHud?.();
    window.VMSGame?.refreshHud?.();

    cancelDeleteMode();
  }

  function createUndoSnapshot() {
    const game = window.VMSGame;
    if (!game) return;

    game.lastUndoSnapshot = {
      score: game.score,
      maxMonsterReached: game.maxMonsterReached,
      spawnCooldown: game.spawnCooldown,
      dangerTimer: game.dangerTimer,
      nextMonsterLevel: game.nextMonsterLevel,
      currentMonster: clonePlain(game.currentMonster),
      monsters: clonePlain(game.state.monsters || []),
      orders: clonePlain(game.state.orders || []),
      aim: clonePlain(game.state.aim || {})
    };
  }

  function hasUndoSnapshot() {
    return !!window.VMSGame?.lastUndoSnapshot;
  }

  function restoreUndoSnapshot() {
    const game = window.VMSGame;
    const snap = game?.lastUndoSnapshot;

    if (!game || !snap) return false;

    game.score = snap.score;
    game.maxMonsterReached = snap.maxMonsterReached;
    game.spawnCooldown = snap.spawnCooldown;
    game.dangerTimer = snap.dangerTimer;
    game.nextMonsterLevel = snap.nextMonsterLevel;
    game.currentMonster = clonePlain(snap.currentMonster);
    game.state.monsters = clonePlain(snap.monsters || []);
    game.state.orders = clonePlain(snap.orders || []);
    game.state.aim = clonePlain(snap.aim || {});
    game.lastUndoSnapshot = null;

    game.gameOver = false;

    if (!game.running) {
      game.running = true;
      game.lastTime = performance.now();
      cancelAnimationFrame(game.raf);
      game.raf = requestAnimationFrame((time) => game.loop(time));
    }

    window.VMSEconomy?.refreshHud?.();
    game.refreshHud?.();

    return true;
  }

  async function undoWithToken() {
    if (!hasUndoSnapshot()) {
      showNoUndoPopup();
      return;
    }

    const paid = await window.VMSEconomy?.spendToken?.(UNDO_TOKEN_COST);

    if (!paid) {
      window.VMSModals.show({
        title: t("game_tools_not_enough_tokens_title"),
        text: t("game_tools_not_enough_tokens_text"),
        primaryText: t("game_tools_buy_12"),
        secondaryText: t("btn_close"),
        onPrimary: () => window.VMSPurchases?.buy?.("vmonster_jetons_12"),
        onSecondary: () => {}
      });
      return;
    }

    restoreUndoSnapshot();
  }

  async function undoWithReward() {
    if (!hasUndoSnapshot()) {
      showNoUndoPopup();
      return;
    }

    const watched = await window.VMSAds?.showRewarded?.("game_undo_shot");

    if (!watched) {
      window.VMSModals.show({
        title: t("game_tools_payment_failed_title"),
        text: t("game_tools_payment_failed_text"),
        primaryText: t("btn_ok"),
        secondaryText: t("btn_close"),
        onPrimary: () => {},
        onSecondary: () => {}
      });
      return;
    }

    restoreUndoSnapshot();
  }

  function showNoUndoPopup() {
    window.VMSModals.show({
      title: t("game_tools_no_undo_title"),
      text: t("game_tools_no_undo_text"),
      primaryText: t("btn_ok"),
      secondaryText: t("btn_close"),
      onPrimary: () => {},
      onSecondary: () => {}
    });
  }

  function isDeleteModeActive() {
    return deleteMode;
  }

  window.VMSGameTools = {
    showToolsPopup,
    showMoreToolsPopup,
    startDeleteMode,
    cancelDeleteMode,
    handleCanvasPointerDown,
    createUndoSnapshot,
    restoreUndoSnapshot,
    isDeleteModeActive
  };
})();
