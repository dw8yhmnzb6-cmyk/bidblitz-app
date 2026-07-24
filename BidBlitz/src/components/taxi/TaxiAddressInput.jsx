/**
 * TaxiAddressInput — pickup or dropoff address input with autocomplete dropdown.
 * Variant: "pickup" → cyan accent + favorites star button.
 *          "dropoff" → red accent.
 */
import React from "react";

const VARIANTS = {
  pickup: {
    dotClass: "bg-cyan-500 ring-cyan-500/20",
    labelText: "ABHOLUNG",
    inputFocus: "focus:border-cyan-500/50 focus:ring-cyan-500/20",
    suggHover: "hover:bg-cyan-500/10",
    suggIconBg: "bg-cyan-500/10",
    suggIconColor: "#00C2FF",
  },
  dropoff: {
    dotClass: "bg-red-500 ring-red-500/20",
    labelText: "ZIEL",
    inputFocus: "focus:border-red-500/50 focus:ring-red-500/20",
    suggHover: "hover:bg-red-500/10",
    suggIconBg: "bg-red-500/10",
    suggIconColor: "#EF4444",
  },
};

export default function TaxiAddressInput({
  variant = "pickup",
  value, placeholder, onChange, onBlur,
  suggestions = [], showSuggestions, setShowSuggestions,
  onSuggestionClick,
  // pickup-only
  favoritesCount, onFavoritesClick,
  // optional zIndex tier
  zIndexClass = "z-20",
  testId,
}) {
  const v = VARIANTS[variant] || VARIANTS.pickup;
  return (
    <div className={`relative ${zIndexClass}`}>
      <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col items-center z-10">
        <div className={`w-3 h-3 rounded-full ring-4 ${v.dotClass}`} />
      </div>
      <div className="absolute left-4 top-[58px] -translate-y-1/2 text-[8px] text-gray-500 uppercase tracking-wider z-10">
        {v.labelText}
      </div>

      {variant === "pickup" && onFavoritesClick && (
        <button
          onClick={onFavoritesClick}
          className="absolute right-14 top-1/2 -translate-y-1/2 z-10 p-2 text-yellow-400 hover:text-yellow-300 transition-colors"
          title="Gespeicherte Orte"
          data-testid="taxi-pickup-favorites"
        >
          <svg
            className="w-5 h-5"
            fill={favoritesCount > 0 ? "currentColor" : "none"}
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
            />
          </svg>
        </button>
      )}

      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
        onBlur={() => { setTimeout(() => setShowSuggestions(false), 200); onBlur && onBlur(); }}
        className={`w-full pl-10 pr-4 pt-6 pb-3 bg-[#111] border border-white/10 rounded-xl text-white placeholder-gray-500 ${v.inputFocus} focus:outline-none focus:ring-2 transition-all`}
        data-testid={testId}
      />

      {showSuggestions && suggestions.length > 0 && (
        <div
          className="absolute top-full left-0 right-0 mt-1 bg-[#1a1a1f] border border-white/10 rounded-xl overflow-hidden shadow-2xl"
          style={{ zIndex: 50 }}
        >
          {suggestions.map((s, i) => (
            <button
              key={i}
              onMouseDown={() => onSuggestionClick(s)}
              className={`w-full flex items-start gap-3 px-4 py-3 ${v.suggHover} transition-colors text-left border-b border-white/5 last:border-0`}
              data-testid={`${variant}-sugg-${i}`}
            >
              <div className={`w-8 h-8 rounded-lg ${v.suggIconBg} flex items-center justify-center shrink-0 mt-0.5`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={v.suggIconColor} strokeWidth="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white truncate">{s.name}</div>
                <div className="text-[11px] text-gray-400 truncate">{s.cityZip || s.address}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
