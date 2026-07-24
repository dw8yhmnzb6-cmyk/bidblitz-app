import React from "react";

const TABS = [
  { key: "book", label: "Buchen" },
  { key: "tracking", label: "Live" },
  { key: "history", label: "Verlauf" },
];

export default function TaxiHeader({ onBack, view, setView, moduleEnabled, userBalance }) {
  return (
    <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-xl border-b border-black/5 font-taxi-body">
      <div className="max-w-lg mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="p-2 -ml-2 text-zinc-500 hover:text-zinc-900"
            data-testid="taxi-header-back"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="text-center">
            <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500 font-semibold">Mobilität</p>
            <h1 className="text-xl font-taxi-heading font-black tracking-tight text-zinc-950">BidBlitz Taxi</h1>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="tel:+49305806"
              className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-colors"
              title="Zentrale anrufen"
              data-testid="taxi-call-center"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </a>
            <div className="text-sm text-[#002FA7] font-semibold" data-testid="taxi-balance">
              €{userBalance.toFixed(2)}
            </div>
          </div>
        </div>

        {moduleEnabled && (
          <div className="flex gap-2 mt-4">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setView(tab.key)}
                className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-all ${
                  view === tab.key
                    ? "bg-[#002FA7] text-white border border-[#002FA7]"
                    : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                }`}
                data-testid={`taxi-tab-${tab.key}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
