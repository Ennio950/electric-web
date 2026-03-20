import { applyCompanyBranding, loadCompanyConfig } from "./company-config.js?v=20260310a";

(async () => {
  const config = await loadCompanyConfig();
  applyCompanyBranding(config);

  window.dispatchEvent(new CustomEvent("company-config:loaded", {
    detail: config,
  }));
})();
