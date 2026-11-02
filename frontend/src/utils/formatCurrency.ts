const SETTINGS_CACHE_KEY = "business-ops-company-settings-cache";

function getConfiguredCurrency() {
  if (typeof window === "undefined") {
    return "INR";
  }

  try {
    const settings = JSON.parse(window.localStorage.getItem(SETTINGS_CACHE_KEY) || "{}") as {
      currency?: string;
    };
    return settings.currency || "INR";
  } catch {
    return "INR";
  }
}

export function formatCurrency(value: number, currency = getConfiguredCurrency()) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency
  }).format(value);
}
