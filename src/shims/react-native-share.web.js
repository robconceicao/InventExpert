/**
 * Stub web para react-native-share (nativo só).
 * Evita TurboModuleRegistry.getEnforcing('RNShare') no browser.
 */
const Social = {
  Facebook: "facebook",
  FacebookStories: "facebookstories",
  Pagesmanager: "pagesmanager",
  Twitter: "twitter",
  Whatsapp: "whatsapp",
  Whatsappbusiness: "whatsappbusiness",
  Instagram: "instagram",
  InstagramStories: "instagramstories",
  Googleplus: "googleplus",
  Email: "email",
  Pinterest: "pinterest",
  Linkedin: "linkedin",
  Sms: "sms",
  Telegram: "telegram",
  Messenger: "messenger",
  Snapchat: "snapchat",
  Viber: "viber",
  Discord: "discord",
};

async function open(options = {}) {
  const message = options?.message || options?.title || "";
  const url = options?.url || (Array.isArray(options?.urls) ? options.urls[0] : "");
  const text = [message, url].filter(Boolean).join("\n");
  if (typeof navigator !== "undefined" && navigator.share && text) {
    try {
      await navigator.share({
        title: options?.title || "InventExpert",
        text: message || undefined,
        url: url || undefined,
      });
      return { success: true, message: "shared" };
    } catch {
      /* cancelado */
    }
  }
  if (typeof navigator !== "undefined" && navigator.clipboard && text) {
    try {
      await navigator.clipboard.writeText(text);
      return { success: true, message: "copied" };
    } catch {
      /* ignore */
    }
  }
  return { success: false, message: "Share unavailable on web", dismissedAction: true };
}

const Share = {
  Social,
  open,
  shareSingle: async () => {
    throw new Error("shareSingle not available on web");
  },
  isPackageInstalled: async () => ({ isInstalled: false, message: "web" }),
};

export default Share;
export { Social };
