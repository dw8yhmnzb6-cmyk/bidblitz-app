/**
 * TaxiOrderOptions — Bottom-sheet style panel for ride options (taxi.eu parity).
 * Shows: Language, Pet, Luggage, Assistance, Notes, Scheduled departure.
 */
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const LANGUAGES = [
  { code: "de", label: "Deutsch" },
  { code: "en", label: "English" },
  { code: "tr", label: "Türkçe" },
  { code: "ar", label: "العربية" },
  { code: "sq", label: "Shqip" },
];

const LUGGAGE = [
  { value: "none", label: "Kein Gepäck" },
  { value: "small", label: "Klein" },
  { value: "much", label: "Viel Gepäck" },
  { value: "much_combi", label: "Viel Gepäck – Kombi" },
];

function Row({ label, value, onClick, testId, danger = false }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between py-3.5 px-4 border-b border-white/5 text-left active:bg-white/5"
      data-testid={testId}
    >
      <span className="text-sm text-white">{label}</span>
      <span className={`text-sm ${danger ? "text-yellow-400" : "text-gray-400"} flex items-center gap-1`}>
        {value}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m9 6 6 6-6 6" />
        </svg>
      </span>
    </button>
  );
}

function Toggle({ label, checked, onChange, testId }) {
  return (
    <div className="w-full flex items-center justify-between py-3.5 px-4 border-b border-white/5">
      <span className="text-sm text-white">{label}</span>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors ${checked ? "bg-cyan-500" : "bg-white/15"}`}
        data-testid={testId}
        aria-pressed={checked}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : ""
          }`}
        />
      </button>
    </div>
  );
}

function Picker({ title, items, current, onPick, onClose }) {
  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 30, stiffness: 300 }}
      className="fixed inset-x-0 bottom-0 z-[80] bg-[#0E0E14] rounded-t-3xl border-t border-white/10 max-h-[70vh] flex flex-col"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <button onClick={onClose} className="text-cyan-400 text-sm" data-testid="picker-cancel">
          Abbrechen
        </button>
        <span className="text-sm font-semibold text-white">{title}</span>
        <span className="w-16" />
      </div>
      <div className="overflow-y-auto flex-1">
        {items.map((it) => (
          <button
            key={it.value || it.code}
            onClick={() => onPick(it.value || it.code)}
            className={`w-full flex items-center justify-between py-4 px-5 border-b border-white/5 text-left active:bg-white/5 ${
              (it.value || it.code) === current ? "bg-cyan-500/10" : ""
            }`}
            data-testid={`picker-opt-${it.value || it.code}`}
          >
            <span className="text-sm text-white">{it.label}</span>
            {(it.value || it.code) === current && (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00C2FF" strokeWidth="2.5">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            )}
          </button>
        ))}
      </div>
    </motion.div>
  );
}

function ScheduleSheet({ current, onPick, onClose }) {
  const [date, setDate] = useState(() => {
    if (current) return new Date(current);
    const d = new Date();
    d.setMinutes(d.getMinutes() + 30, 0, 0);
    return d;
  });
  const fmt = (d) =>
    d.toLocaleString("de-DE", {
      weekday: "short", day: "2-digit", month: "2-digit",
      hour: "2-digit", minute: "2-digit",
    });
  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 30, stiffness: 300 }}
      className="fixed inset-x-0 bottom-0 z-[80] bg-[#0E0E14] rounded-t-3xl border-t border-white/10 p-5 pb-8"
    >
      <div className="flex items-center justify-between mb-4">
        <button onClick={onClose} className="text-cyan-400 text-sm" data-testid="sched-cancel">
          Abbrechen
        </button>
        <span className="text-sm font-semibold text-white">Abfahrtszeit</span>
        <span className="w-16" />
      </div>
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => { onPick(null); onClose(); }}
          className={`flex-1 py-3 rounded-xl text-sm font-semibold ${
            current ? "bg-white/5 text-gray-400" : "bg-cyan-500 text-black"
          }`}
          data-testid="sched-now"
        >
          Jetzt
        </button>
        <button
          onClick={() => { onPick(date.toISOString()); onClose(); }}
          className={`flex-1 py-3 rounded-xl text-sm font-semibold ${
            current ? "bg-cyan-500 text-black" : "bg-white/5 text-white"
          }`}
          data-testid="sched-later"
        >
          Vorbestellen
        </button>
      </div>
      <input
        type="datetime-local"
        className="w-full px-4 py-3 bg-[#111] border border-white/10 rounded-xl text-white"
        value={(() => {
          const tz = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
          return tz.toISOString().slice(0, 16);
        })()}
        onChange={(e) => setDate(new Date(e.target.value))}
        data-testid="sched-input"
      />
      <p className="text-xs text-gray-500 mt-2">{fmt(date)}</p>
    </motion.div>
  );
}

export default function TaxiOrderOptions({ isOpen, onClose, options, setOptions }) {
  const [pickerOpen, setPickerOpen] = useState(null); // 'language' | 'luggage' | 'schedule' | null
  const [notesDraft, setNotesDraft] = useState(options.notes || "");

  const update = (patch) => setOptions((prev) => ({ ...prev, ...patch }));

  const luggageLabel = (LUGGAGE.find((l) => l.value === options.luggage) || LUGGAGE[0]).label;
  const langLabel = (LANGUAGES.find((l) => l.code === options.language) || LANGUAGES[0]).label;
  const scheduleLabel = options.scheduledAt
    ? new Date(options.scheduledAt).toLocaleString("de-DE", {
        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
      })
    : "Jetzt";

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 280 }}
            className="fixed inset-x-0 bottom-0 z-[75] bg-[#0A0A0F] rounded-t-3xl border-t border-white/10 max-h-[85vh] flex flex-col"
            data-testid="taxi-order-options-sheet"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <button onClick={onClose} className="text-cyan-400 text-sm font-medium" data-testid="opts-cancel">
                Fertig
              </button>
              <span className="text-base font-bold text-white">Bestelloptionen</span>
              <span className="w-16" />
            </div>

            <div className="overflow-y-auto flex-1">
              <Row
                label="Sprache"
                value={langLabel}
                onClick={() => setPickerOpen("language")}
                testId="opt-language"
              />
              <Toggle
                label="Mit Haustier"
                checked={options.withPet}
                onChange={(v) => update({ withPet: v })}
                testId="opt-with-pet"
              />
              <Row
                label="Gepäck"
                value={luggageLabel}
                onClick={() => setPickerOpen("luggage")}
                testId="opt-luggage"
              />
              <Toggle
                label="Unterstützung beim Einsteigen"
                checked={options.assistance}
                onChange={(v) => update({ assistance: v })}
                testId="opt-assistance"
              />
              <Row
                label="Abfahrtszeit"
                value={scheduleLabel}
                danger={!!options.scheduledAt}
                onClick={() => setPickerOpen("schedule")}
                testId="opt-schedule"
              />

              <div className="px-4 py-4 border-b border-white/5">
                <label className="block text-xs text-gray-400 mb-2">Sonderwünsche (optional)</label>
                <textarea
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value.slice(0, 500))}
                  onBlur={() => update({ notes: notesDraft })}
                  placeholder="z.B. Beim Eingang warten, Klingelschild ..."
                  rows={3}
                  className="w-full px-3 py-2 bg-[#111] border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 resize-none"
                  data-testid="opt-notes"
                />
              </div>
            </div>
          </motion.div>

          <AnimatePresence>
            {pickerOpen === "language" && (
              <Picker
                title="Sprache"
                items={LANGUAGES}
                current={options.language}
                onPick={(v) => { update({ language: v }); setPickerOpen(null); }}
                onClose={() => setPickerOpen(null)}
              />
            )}
            {pickerOpen === "luggage" && (
              <Picker
                title="Gepäck"
                items={LUGGAGE}
                current={options.luggage}
                onPick={(v) => { update({ luggage: v }); setPickerOpen(null); }}
                onClose={() => setPickerOpen(null)}
              />
            )}
            {pickerOpen === "schedule" && (
              <ScheduleSheet
                current={options.scheduledAt}
                onPick={(v) => update({ scheduledAt: v })}
                onClose={() => setPickerOpen(null)}
              />
            )}
          </AnimatePresence>
        </>
      )}
    </AnimatePresence>
  );
}
