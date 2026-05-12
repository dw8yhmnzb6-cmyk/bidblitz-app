/**
 * BidBlitz Staff — i18n Stub (DE/EN/AL/TR)
 * ========================================
 */
const STAFF_I18N = {
  de: {
    today: "Heute",
    check_in: "Einchecken",
    check_out: "Auschecken",
    start_break: "Pause starten",
    end_break: "Pause beenden",
    today_hours: "Heutige Arbeitszeit",
    week_hours: "Wochenstunden",
    next_shift: "Nächste Schicht",
    vacation_remaining: "Resturlaub",
    status_working: "Eingecheckt",
    status_break: "In Pause",
    status_off: "Nicht aktiv",
    profile: "Mein Profil",
    change_pin: "PIN ändern",
    language: "Sprache",
    notifications: "Benachrichtigungen",
    logout: "Abmelden",
    offline_notice: "Offline — wird später synchronisiert",
    saved_offline: "Lokal gespeichert (Offline)",
    invite_employee: "Mitarbeiter einladen",
    pending: "Ausstehend",
    accepted: "Akzeptiert",
    expired: "Abgelaufen",
  },
  en: {
    today: "Today",
    check_in: "Clock in",
    check_out: "Clock out",
    start_break: "Start break",
    end_break: "End break",
    today_hours: "Today's hours",
    week_hours: "Weekly hours",
    next_shift: "Next shift",
    vacation_remaining: "Vacation left",
    status_working: "On duty",
    status_break: "On break",
    status_off: "Off",
    profile: "My profile",
    change_pin: "Change PIN",
    language: "Language",
    notifications: "Notifications",
    logout: "Sign out",
    offline_notice: "Offline — will sync later",
    saved_offline: "Saved locally (offline)",
    invite_employee: "Invite employee",
    pending: "Pending",
    accepted: "Accepted",
    expired: "Expired",
  },
  sq: {
    today: "Sot",
    check_in: "Hyrje",
    check_out: "Dalje",
    start_break: "Fillo pushimin",
    end_break: "Mbaro pushimin",
    today_hours: "Orë sot",
    week_hours: "Orë javore",
    next_shift: "Turni i ardhshëm",
    vacation_remaining: "Pushim i mbetur",
    status_working: "Në punë",
    status_break: "Në pushim",
    status_off: "I/E lirë",
    profile: "Profili im",
    change_pin: "Ndrysho PIN",
    language: "Gjuha",
    notifications: "Njoftime",
    logout: "Dil",
    offline_notice: "Offline — do sinkronizohet më vonë",
    saved_offline: "Ruajtur lokalisht",
    invite_employee: "Fto punonjësin",
    pending: "Në pritje",
    accepted: "Pranuar",
    expired: "Skaduar",
  },
  tr: {
    today: "Bugün",
    check_in: "Giriş yap",
    check_out: "Çıkış yap",
    start_break: "Mola başlat",
    end_break: "Mola bitir",
    today_hours: "Bugünkü saatler",
    week_hours: "Haftalık saatler",
    next_shift: "Sonraki vardiya",
    vacation_remaining: "Kalan izin",
    status_working: "Görevde",
    status_break: "Molada",
    status_off: "İzinli",
    profile: "Profilim",
    change_pin: "PIN değiştir",
    language: "Dil",
    notifications: "Bildirimler",
    logout: "Çıkış",
    offline_notice: "Çevrimdışı — daha sonra senkronize edilecek",
    saved_offline: "Yerel olarak kaydedildi",
    invite_employee: "Çalışan davet et",
    pending: "Beklemede",
    accepted: "Kabul edildi",
    expired: "Süresi doldu",
  },
};

export function getStaffLang() {
  try {
    return localStorage.getItem("staff_lang") || "de";
  } catch (e) {
    return "de";
  }
}

export function setStaffLang(lang) {
  try {
    localStorage.setItem("staff_lang", lang);
  } catch (e) {}
}

export function t(key, lang) {
  const l = lang || getStaffLang();
  return STAFF_I18N[l]?.[key] || STAFF_I18N.de[key] || key;
}

export const STAFF_LANGUAGES = [
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "sq", label: "Shqip", flag: "🇦🇱" },
  { code: "tr", label: "Türkçe", flag: "🇹🇷" },
];

export default STAFF_I18N;
