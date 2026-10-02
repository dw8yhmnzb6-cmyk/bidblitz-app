import { useId } from "react";
import { Globe2 } from "lucide-react";
import { useI18n } from "../store/I18nContext";
import languages from "../config/gamesLanguages.json";
import { resolveLocale } from "../config/languagePolicy.mjs";

const CODES = languages.map(({ code }) => code);
const COPY = {
  de: { language: "Sprache", fallback: "Diese Games-Oberfläche wird vorerst auf Englisch angezeigt. Die gewählte Sprache bleibt gespeichert." },
  en: { language: "Language", fallback: "This Games page is currently shown in English. Your selected language stays saved." },
  sq: { language: "Gjuha", fallback: "Kjo faqe e lojërave shfaqet përkohësisht në anglisht. Gjuha e zgjedhur ruhet." },
};

export default function GamesLanguageSelect({ textLocale }) {
  const { lang, setLang } = useI18n();
  const id = useId();
  const selected = resolveLocale(lang, CODES);
  const copy = COPY[textLocale] || COPY.en;
  const fallback = selected !== textLocale;
  const selectedLanguage = languages.find(({ code }) => code === selected);
  return (
    <div className="mt-5 space-y-2" data-testid="games-language-select">
      <label htmlFor={id} className="inline-flex max-w-full items-center gap-3 rounded-2xl border border-cyan-200/20 bg-[#102744] px-4 py-3 text-sm">
        <Globe2 size={18} aria-hidden="true" className="shrink-0 text-cyan-200" />
        <span>{copy.language}</span>
        <select id={id} value={selected} onChange={(event) => setLang(event.target.value)} aria-describedby={fallback ? `${id}-fallback` : undefined} className="min-w-0 max-w-[190px] bg-[#102744] text-white outline-none focus-visible:ring-2 focus-visible:ring-cyan-300" dir={selectedLanguage?.rtl ? "rtl" : "ltr"}>
          {languages.map(({ code, label, rtl }) => <option key={code} value={code} lang={code} dir={rtl ? "rtl" : "ltr"}>{label}</option>)}
        </select>
      </label>
      {fallback && <p id={`${id}-fallback`} role="status" lang="en" dir="ltr" className="max-w-2xl text-sm leading-relaxed text-sky-100/70"><bdi>{selectedLanguage?.label}</bdi>: {COPY.en.fallback}</p>}
    </div>
  );
}
