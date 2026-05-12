window.VMonsterAdminPopups = {
  checking: false,
  currentPopupId: null,

  getCurrentLang() {
    const raw =
      window.VMSI18n?.lang ||
      window.VMSStorage?.get?.("language", "fr") ||
      document.documentElement.lang ||
      "fr";

    const lang = String(raw || "fr").toLowerCase();

    if (lang.startsWith("fr")) return "fr";
    if (lang.startsWith("en")) return "en";
    if (lang.startsWith("es-419") || lang === "es_latam" || lang === "es-latam") return "es-419";
    if (lang.startsWith("es")) return "es";
    if (lang.startsWith("de")) return "de";
    if (lang.startsWith("it")) return "it";
    if (lang === "pt-br" || lang === "ptbr") return "pt-BR";
    if (lang.startsWith("pt")) return "pt-PT";
    if (lang.startsWith("nl")) return "nl";
    if (lang.startsWith("ar")) return "ar";
    if (lang.startsWith("id")) return "id";
    if (lang.startsWith("ja") || lang.startsWith("jp")) return "ja";
    if (lang.startsWith("ko")) return "ko";

    return "fr";
  },

  pickText(value, lang, fallbackKey) {
    if (!value) return fallbackKey ? window.VMSI18n?.t?.(fallbackKey) || "" : "";

    if (typeof value === "string") return value;

    if (typeof value === "object") {
      return (
        value[lang] ||
        value[lang.toLowerCase?.()] ||
        value[lang.toUpperCase?.()] ||
        value["pt-BR"] ||
        value["pt-PT"] ||
        value["es-419"] ||
        value.en ||
        value.fr ||
        Object.values(value)[0] ||
        (fallbackKey ? window.VMSI18n?.t?.(fallbackKey) || "" : "")
      );
    }

    return fallbackKey ? window.VMSI18n?.t?.(fallbackKey) || "" : "";
  },

  getUserId() {
    return (
      window.VMSUserData?.profile?.id ||
      window.VMSUserData?.profile?.user_id ||
      null
    );
  },

  async check() {
    if (this.checking) return;
    if (!window.sb) return;
    if (!window.VMSUserData?.online) return;

    const userId = this.getUserId();
    if (!userId) return;

    this.checking = true;

    try {
      const result = await window.sb
        .from("vmonster_admin_popups")
        .select("id,payload,shown_at,read_at,is_active,sent_at")
        .eq("user_id", userId)
        .eq("is_active", true)
        .is("read_at", null)
        .order("sent_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (result.error) {
        console.warn("[VMonsterAdminPopups] fetch failed", result.error);
        return;
      }

      const popup = result.data;
      if (!popup || !popup.id || !popup.payload) return;

      this.currentPopupId = popup.id;

      if (!popup.shown_at) {
        await window.sb
          .from("vmonster_admin_popups")
          .update({ shown_at: new Date().toISOString() })
          .eq("id", popup.id);
      }

      this.show(popup);
    } catch (error) {
      console.warn("[VMonsterAdminPopups] check error", error);
    } finally {
      this.checking = false;
    }
  },

  show(popup) {
    const payload = popup.payload || {};
    const lang = this.getCurrentLang();

    const title = this.pickText(payload.title, lang, "btn_ok");
    const text = this.pickText(payload.body || payload.message || payload.text, lang, "");
    const primaryText = this.pickText(payload.cta, lang, "btn_ok");

    if (!text) return;

    if (window.VMSModals?.show) {
      window.VMSModals.show({
        title: title,
        text: text,
        primaryText: primaryText,
        secondaryText: window.VMSI18n?.t?.("btn_close") || primaryText,
        onPrimary: () => {
          this.markRead(popup.id);
        },
        onSecondary: () => {
          this.markRead(popup.id);
        }
      });

      return;
    }

    alert(text);
    this.markRead(popup.id);
  },

  async markRead(popupId) {
    if (!popupId || !window.sb) return;

    try {
      await window.sb
        .from("vmonster_admin_popups")
        .update({
          read_at: new Date().toISOString(),
          is_active: false
        })
        .eq("id", popupId);
    } catch (error) {
      console.warn("[VMonsterAdminPopups] markRead failed", error);
    }
  }
};
