import React from "react";

import { useI18n } from "../store";
import { Bike, Car, Zap, Navigation } from "lucide-react";

const COPY = {
  "de": {
    "language": "Sprache",
    "payment": "Bezahlung mit BidBlitz",
    "title": "Elektrisch durch deine Stadt.",
    "intro": "Geplante elektrische Mobilität von iCharging. Fahrzeuge und Buchbarkeit hängen vom jeweiligen Standort und der Freischaltung ab.",
    "login": "Mit BidBlitz anmelden",
    "register": "BidBlitz-Konto erstellen",
    "note": "BidBlitz-Konto für Zugang, Wallet und Bezahlung. iCharging verantwortet die Vermietung.",
    "regions": "Städte & Regionen",
    "heading": "Geplante Mobilität in Europa und den VAE.",
    "planned": "Geplant · noch keine Verfügbarkeitszusage",
    "countries": [
      "Kosovo",
      "Deutschland",
      "Albanien",
      "Montenegro",
      "Österreich",
      "Frankreich",
      "Vereinigte Arabische Emirate"
    ],
    "vehicles": [
      "E-Scooter",
      "E-Roller",
      "E-Bike",
      "E-Auto"
    ],
    "descriptions": [
      "Für kurze Stadtwege",
      "Für komfortable Fahrten",
      "Für aktive Mobilität",
      "Für längere Strecken"
    ],
    "footer": "iCharging ist ein eigenständiger Mobilitätsanbieter. Fahrzeuge, Vermietung, Preise und Betrieb liegen bei iCharging. BidBlitz dient dem Kontozugang und der Zahlungsabwicklung.",
    "pending": "Städte werden noch festgelegt"
  },
  "en": {
    "language": "Language",
    "payment": "Payments with BidBlitz",
    "title": "Electric mobility for your city.",
    "intro": "Planned electric mobility from iCharging. Vehicles and booking availability depend on each location and its launch.",
    "login": "Sign in with BidBlitz",
    "register": "Create a BidBlitz account",
    "note": "Your BidBlitz account provides access, wallet and payments. iCharging manages rentals.",
    "regions": "Cities & regions",
    "heading": "Planned mobility across Europe and the UAE.",
    "planned": "Planned · availability not confirmed",
    "countries": [
      "Kosovo",
      "Germany",
      "Albania",
      "Montenegro",
      "Austria",
      "France",
      "United Arab Emirates"
    ],
    "vehicles": [
      "E-scooter",
      "Electric moped",
      "E-bike",
      "Electric car"
    ],
    "descriptions": [
      "For short city trips",
      "For comfortable rides",
      "For active mobility",
      "For longer journeys"
    ],
    "footer": "iCharging is an independent mobility provider responsible for vehicles, rentals, pricing and operations. BidBlitz provides account access and payment processing.",
    "pending": "Cities to be determined"
  },
  "sq": {
    "language": "Gjuha",
    "payment": "Pagesa me BidBlitz",
    "title": "Lëvizje elektrike në qytetin tënd.",
    "intro": "Mobilitet elektrik i planifikuar nga iCharging. Automjetet dhe rezervimet varen nga vendndodhja dhe fillimi i shërbimit.",
    "login": "Hyr me BidBlitz",
    "register": "Krijo llogari BidBlitz",
    "note": "Llogaria BidBlitz mundëson hyrjen, portofolin dhe pagesat. iCharging menaxhon qiratë.",
    "regions": "Qytetet dhe rajonet",
    "heading": "Mobilitet i planifikuar në Evropë dhe Emirate.",
    "planned": "Në planifikim · disponueshmëria e pakonfirmuar",
    "countries": [
      "Kosovë",
      "Gjermani",
      "Shqipëri",
      "Mal i Zi",
      "Austri",
      "Francë",
      "Emiratet e Bashkuara Arabe"
    ],
    "vehicles": [
      "Trotinet elektrik",
      "Skuter elektrik",
      "Biçikletë elektrike",
      "Makinë elektrike"
    ],
    "descriptions": [
      "Për rrugë të shkurtra",
      "Për udhëtime të rehatshme",
      "Për lëvizje aktive",
      "Për udhëtime më të gjata"
    ],
    "footer": "iCharging është ofrues i pavarur i mobilitetit dhe përgjegjës për automjetet, qiratë, çmimet dhe operimin. BidBlitz ofron hyrjen në llogari dhe përpunimin e pagesave.",
    "pending": "Qytetet do të përcaktohen"
  },
  "fr": {
    "language": "Langue",
    "payment": "Paiement avec BidBlitz",
    "title": "La mobilité électrique dans votre ville.",
    "intro": "Mobilité électrique prévue par iCharging. Les véhicules et les réservations dépendent du lieu et du lancement du service.",
    "login": "Se connecter avec BidBlitz",
    "register": "Créer un compte BidBlitz",
    "note": "Votre compte BidBlitz donne accès au portefeuille et aux paiements. iCharging gère la location.",
    "regions": "Villes et régions",
    "heading": "Mobilité prévue en Europe et aux Émirats.",
    "planned": "En projet · disponibilité non confirmée",
    "countries": [
      "Kosovo",
      "Allemagne",
      "Albanie",
      "Monténégro",
      "Autriche",
      "France",
      "Émirats arabes unis"
    ],
    "vehicles": [
      "Trottinette électrique",
      "Scooter électrique",
      "Vélo électrique",
      "Voiture électrique"
    ],
    "descriptions": [
      "Pour les petits trajets",
      "Pour rouler confortablement",
      "Pour une mobilité active",
      "Pour les longs trajets"
    ],
    "footer": "iCharging est un opérateur de mobilité indépendant, responsable des véhicules, locations, tarifs et opérations. BidBlitz fournit l’accès au compte et le traitement des paiements.",
    "pending": "Villes à déterminer"
  },
  "ar": {
    "language": "اللغة",
    "payment": "الدفع عبر BidBlitz",
    "title": "تنقّل كهربائي في مدينتك.",
    "intro": "خدمات تنقّل كهربائي مخطط لها من iCharging. تتوقف المركبات والحجوزات على الموقع وبدء تشغيل الخدمة.",
    "login": "تسجيل الدخول عبر BidBlitz",
    "register": "إنشاء حساب BidBlitz",
    "note": "يوفر حساب BidBlitz الدخول والمحفظة والدفع. تتولى iCharging إدارة التأجير.",
    "regions": "المدن والمناطق",
    "heading": "تنقّل مخطط له في أوروبا والإمارات.",
    "planned": "قيد التخطيط · التوفر غير مؤكد",
    "countries": [
      "كوسوفو",
      "ألمانيا",
      "ألبانيا",
      "الجبل الأسود",
      "النمسا",
      "فرنسا",
      "الإمارات العربية المتحدة"
    ],
    "vehicles": [
      "سكوتر كهربائي",
      "دراجة نارية كهربائية",
      "دراجة كهربائية",
      "سيارة كهربائية"
    ],
    "descriptions": [
      "للرحلات القصيرة",
      "لرحلات مريحة",
      "لتنقّل نشط",
      "للمسافات الأطول"
    ],
    "footer": "iCharging مزود مستقل للتنقّل ومسؤول عن المركبات والتأجير والأسعار والتشغيل. يوفر BidBlitz الدخول إلى الحساب ومعالجة المدفوعات.",
    "pending": "سيتم تحديد المدن"
  }
};
const LOCATIONS = [["Prishtina",0],["Ferizaj",0],["Prizren",0],["Peja",0],["Gjilan",0],["Tirana",2],["Podgorica",3],["Wien",4],["Paris",5],["Dubai",6],["Abu Dhabi",6],["",1]];
const ICONS = [Navigation, Zap, Bike, Car];

export default function IChargingEntryPage({ onLogin, onRegister, onNavigate }) {
  const { lang, setLang } = useI18n();
  const locale = Object.prototype.hasOwnProperty.call(COPY, lang.split("-")[0]) ? lang.split("-")[0] : "en";
  const copy = COPY[locale];
  return (
    <div className="min-h-screen bg-[#050505] px-5 py-6 text-white" lang={locale} dir={locale === "ar" ? "rtl" : "ltr"} data-testid="icharging-entry-page">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex items-center justify-between">
          <button onClick={() => onNavigate?.("/")} className="text-sm text-gray-400 transition hover:text-white">← BidBlitz</button>
          <label className="text-sm text-gray-300">{copy.language}
            <select aria-label={copy.language} value={locale} onChange={event => setLang(event.target.value)} className="mx-2 rounded-lg border border-white/20 bg-gray-900 p-2">
              <option value="de">Deutsch</option><option value="sq">Shqip</option><option value="en">English</option><option value="fr">Français</option><option value="ar">العربية</option>
            </select>
          </label>
        </header>

        <section className="overflow-hidden rounded-[2rem] border border-cyan-300/20 bg-gradient-to-br from-cyan-500/20 via-[#111827] to-fuchsia-500/20 p-7 shadow-2xl md:p-10" data-testid="icharging-hero">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-300">iCharging · {copy.payment}</p>
            <h1 className="mt-4 text-4xl font-black tracking-tight md:text-6xl">{copy.title}</h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-gray-300 md:text-lg">{copy.intro}</p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <button onClick={onLogin} className="rounded-2xl bg-cyan-400 px-5 py-3.5 font-bold text-black transition hover:bg-cyan-300" data-testid="icharging-login">{copy.login}</button>
              <button onClick={onRegister} className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3.5 font-bold transition hover:bg-white/10" data-testid="icharging-register">{copy.register}</button>
            </div>
            <p className="mt-4 text-xs text-gray-500">{copy.note}</p>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="icharging-vehicles">
          {copy.vehicles.map((title, index) => { const Icon = ICONS[index]; return (
            <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <Icon aria-hidden="true" className="h-9 w-9 text-cyan-300" /><h2 className="mt-3 font-bold">{title}</h2><p className="mt-1 text-sm leading-5 text-gray-400">{copy.descriptions[index]}</p>
            </div>
          ); })}
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#0b1018] p-6" data-testid="icharging-cities">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-widest text-fuchsia-300">{copy.regions}</p><h2 className="mt-2 text-2xl font-black">{copy.heading}</h2></div><span className="text-xs text-gray-500">{copy.planned}</span></div>
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {LOCATIONS.map(([name, country]) => <div key={name || "de"} className="rounded-xl border border-white/10 bg-white/[0.03] p-3"><p className="font-semibold">{name || copy.pending}</p><p className="text-xs text-gray-500">{copy.countries[country]}</p><p className="mt-2 text-[10px] uppercase tracking-wide text-cyan-300">{copy.planned}</p></div>)}
          </div>
        </section>

        <footer className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 text-center text-xs leading-5 text-gray-500">{copy.footer}</footer>
      </div>
    </div>
  );
}
