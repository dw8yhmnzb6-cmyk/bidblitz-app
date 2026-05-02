/**
 * Admin Detail Data Loaders
 * Maps an admin section item.key to an async loader returning detail data.
 */

const API = process.env.REACT_APP_BACKEND_URL;

async function api(path, opts = {}) {
  const r = await fetch(`${API}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.detail || "Fehler");
  return d;
}

const MODULE_LIST_CONFIG = {
  "admin-handwerker": {
    url: "/api/handwerker/list",
    pickItems: (d) => d.handwerker || [],
    module: "Handwerker", countLabel: "Handwerker",
    fields: ["name", "category", "city", "rating", "completed_jobs"],
  },
  "admin-gebrauchtwagen": {
    url: "/api/gebrauchtwagen/listings",
    pickItems: (d) => d.cars || [],
    module: "Gebrauchtwagen", countLabel: "Autos",
    fields: ["title", "brand", "price", "city", "views"],
  },
  "admin-reinigung": {
    url: "/api/reinigung/services",
    pickItems: (d) => d.services || [],
    module: "Reinigungsservices", countLabel: "Services",
    fields: ["name", "price_per_hour", "min_hours"],
  },
  "admin-umzug": {
    url: "/api/umzug/companies",
    pickItems: (d) => d.companies || [],
    module: "Umzugsfirmen", countLabel: "Firmen",
    fields: ["name", "city", "base_price", "rating", "reviews"],
  },
  "admin-tierbetreuung": {
    url: "/api/tierbetreuung/sitters",
    pickItems: (d) => d.sitters || [],
    module: "Tierbetreuung", countLabel: "Betreuer",
    fields: ["name", "service", "city", "price_per_day", "rating"],
  },
  "admin-streaming": {
    url: "/api/streaming/catalog",
    pickItems: (d) => d.catalog || [],
    module: "Streaming-Katalog", countLabel: "Inhalte",
    fields: ["title", "type", "genre", "rating", "views"],
  },
  "admin-telemedizin": {
    url: "/api/telemedizin/doctors",
    pickItems: (d) => d.doctors || [],
    module: "Telemedizin Ärzte", countLabel: "Ärzte",
    fields: ["name", "specialty", "city", "price_consultation", "rating"],
  },
  "admin-dating": {
    url: "/api/dating/discover",
    pickItems: (d) => d.profiles || [],
    module: "Dating-Profile", countLabel: "Profile",
    fields: ["name", "city", "likes_count", "verified"],
  },
  "admin-fitness": {
    url: "/api/fitness/gyms",
    pickItems: (d) => d.gyms || [],
    module: "Fitness-Studios", countLabel: "Gyms",
    fields: ["name", "type", "city", "monthly_price", "rating"],
  },
  "admin-reiseplaner": {
    url: "/api/reiseplaner/trips",
    pickItems: (d) => d.trips || [],
    module: "Reiseangebote", countLabel: "Reisen",
    fields: ["title", "destination", "duration_days", "price_per_person", "rating"],
  },
  "admin-scooter-abos": {
    url: "/api/scooter/plans",
    pickItems: (d) => d.plans || [],
    module: "Scooter-Abos", countLabel: "Pläne",
    fields: ["name", "price", "duration_days", "free_minutes_per_day", "per_minute_rate"],
  },
};

/**
 * Returns either a `data` object for the detail view, or `null` if the click
 * was a navigation (handled by caller).
 */
export async function loadAdminDetail(item, onNavigate) {
  // Navigation shortcut
  if (item.nav?.startsWith("/")) {
    onNavigate(item.nav);
    return null;
  }

  switch (item.key) {
    case "users": {
      const d = await api("/api/admin/stats");
      const users = await api("/api/admin/users?limit=30").catch(() => ({ users: [] }));
      return { type: "users", stats: d, users: users.users || [] };
    }
    case "kyc": {
      const d = await api("/api/role-requests/admin/list?status=pending");
      return { type: "kyc", requests: d.requests || [] };
    }
    case "roles": {
      const d = await api("/api/role-requests/admin/list?status=pending");
      return { type: "roles", requests: d.requests || [] };
    }
    case "staff":
    case "enterprise":
    case "influencer": {
      const d = await api("/api/admin/stats");
      return { type: "user_filter", role: item.key, total_users: d.total_users || 0 };
    }
    case "car-ads":
    case "partner-credit":
      return { type: "form", formType: item.key };

    case "partners": {
      const d = await api("/api/admin/stats");
      return { type: "partners", stats: d };
    }
    case "applications": {
      const d = await api("/api/role-requests/admin/list?status=all").catch(() => ({ requests: [] }));
      return { type: "applications", requests: d.requests || [] };
    }

    case "pay-requests": {
      const d = await api("/api/pay/admin/applications?status=pending");
      return { type: "pay_requests", applications: d.applications || [], count: d.count || 0 };
    }
    case "payments":
    case "wallet-topup":
    case "payouts":
    case "sepa":
    case "wholesale": {
      const d = await api("/api/admin/stats");
      return { type: "finance_detail", subtype: item.key, stats: d };
    }
    case "credits":
      onNavigate("/admin/credits");
      return null;
    case "api-keys":
      return { type: "api_keys" };

    case "flash-sales":
    case "banners":
    case "email-marketing":
    case "jackpot":
    case "challenges":
    case "mystery-box":
    case "surveys":
      return { type: "marketing", subtype: item.key };

    case "products":
    case "standard-auctions":
    case "vip-auctions":
    case "voucher-auctions": {
      const d = await api("/api/auctions/active");
      return { type: "auctions", subtype: item.key, auctions: d.auctions || [] };
    }
    case "bot-system": {
      const d = await api("/api/auctions/admin/config").catch(() => ({}));
      return { type: "bot_config", config: d };
    }
    case "winner-control": {
      const d = await api("/api/auctions/admin/winners").catch(() => ({ winners: [] }));
      return { type: "winners", winners: d.winners || [] };
    }
    case "product-analytics":
    case "user-analytics":
    case "revenue-analytics": {
      const d = await api("/api/admin/stats");
      return { type: "analytics", subtype: item.key, stats: d };
    }

    case "merchant-vouchers":
    case "bidder-vouchers":
    case "partner-vouchers":
    case "discount-coupons": {
      const d = await api("/api/admin/grants/coupons");
      return { type: "coupons", subtype: item.key, coupons: d.coupons || [] };
    }
    case "coupon-manager":
      onNavigate("/admin/old");
      return null;

    case "system-logs": {
      const d = await api("/api/admin/stats");
      return { type: "system_logs", stats: d };
    }

    case "admin-ladesaeulen": {
      const d = await api("/api/ladesaeulen/stations");
      const stats_ev = await api("/api/ladesaeulen/stats").catch(() => ({}));
      return {
        type: "module_list", module: "Ladesäulen",
        items: d.stations || [], countLabel: "Stationen",
        fields: ["name", "operator", "city", "power_kw", "price_per_kwh", "slots_available"],
        extra_stats: stats_ev,
      };
    }
    case "admin-taxi": {
      const d = await api("/api/admin/stats");
      return { type: "module_stats", module: "Taxi-Fleet", stats: d };
    }
    case "admin-parcels": {
      const d = await api("/api/admin/stats");
      return { type: "module_stats", module: "Paket-Verwaltung", stats: d };
    }

    case "maintenance":
    case "cms":
    case "game-settings":
    case "sustainability":
    case "passwords":
    case "voice-commands":
    case "debug":
    case "system-health":
    case "database":
      return { type: "system_detail", subtype: item.key };

    default: {
      // Generic module list?
      const cfg = MODULE_LIST_CONFIG[item.key];
      if (cfg) {
        const d = await api(cfg.url);
        return {
          type: "module_list",
          module: cfg.module,
          items: cfg.pickItems(d),
          countLabel: cfg.countLabel,
          fields: cfg.fields,
        };
      }
      return { type: "generic" };
    }
  }
}

export { api };
