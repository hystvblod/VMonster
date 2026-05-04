window.VMSPurchases = {
  init() {},

  restore() {
    VMSModals.show({
      title: VMSI18n.t("modal_restore_title"),
      text: VMSI18n.t("modal_restore_text"),
      primaryText: VMSI18n.t("btn_ok"),
      secondaryText: VMSI18n.t("btn_close")
    });
  }
};
