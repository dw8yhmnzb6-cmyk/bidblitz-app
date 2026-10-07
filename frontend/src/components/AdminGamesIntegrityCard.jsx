import { useEffect, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL || ""}/api/admin/game-studio/integrity/status`;

const COPY = {
  de: {
    title: "Integritätsstatus", subtitle: "Server-Replay ohne öffentliche Trusted-Leaderboards.",
    loading: "Integritätsstatus wird geladen…", error: "Integritätsstatus konnte nicht geladen werden.",
    verified: "verifizierte Profile", sessions: "aktive Replay-Sessions", leaderboard: "Öffentliches Trusted-Leaderboard", off: "Aus",
    match: "BidBlitz Match", bubble: "Bubble Islands", runner: "Blitz Runner", farm: "BidBlitz Farm",
  },
  en: {
    title: "Integrity status", subtitle: "Server replay without public trusted leaderboards.",
    loading: "Loading integrity status…", error: "Could not load integrity status.",
    verified: "verified profiles", sessions: "active replay sessions", leaderboard: "Public trusted leaderboard", off: "Off",
    match: "BidBlitz Match", bubble: "Bubble Islands", runner: "Blitz Runner", farm: "BidBlitz Farm",
  },
  sq: {
    title: "Statusi i integritetit", subtitle: "Replay i serverit pa leaderboard publik të besuar.",
    loading: "Po ngarkohet statusi…", error: "Statusi nuk u ngarkua.",
    verified: "profile të verifikuara", sessions: "sesione replay aktive", leaderboard: "Leaderboard publik i besuar", off: "Joaktiv",
    match: "BidBlitz Match", bubble: "Bubble Islands", runner: "Blitz Runner", farm: "BidBlitz Farm",
  },
};

export default function AdminGamesIntegrityCard({ locale = "en" }) {
  const c = COPY[locale] || COPY.en;
  const [data, setData] = useState(null);
  const [state, setState] = useState("loading");

  useEffect(() => {
    const controller = new AbortController();
    fetch(API, { credentials: "include", signal: controller.signal })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.detail || "integrity");
        return body;
      })
      .then((body) => {
        if (controller.signal.aborted) return;
        setData(body);
        setState("ready");
      })
      .catch((error) => {
        if (!controller.signal.aborted && error.name !== "AbortError") setState("error");
      });
    return () => controller.abort();
  }, []);

  return (
    <section className="mt-6 rounded-3xl border border-emerald-200/15 bg-[#0a1d36] p-5" data-testid="games-integrity-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold"><ShieldCheck size={19} className="text-emerald-300" />{c.title}</h2>
          <p className="mt-1 text-xs text-white/45">{c.subtitle}</p>
        </div>
        {data && <span className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-[10px] font-semibold text-emerald-100">{data.verified_profiles_total || 0} {c.verified}</span>}
      </div>

      {state === "loading" && <p className="mt-4 flex items-center gap-2 text-sm text-white/55"><Loader2 size={15} className="animate-spin" />{c.loading}</p>}
      {state === "error" && <p role="alert" className="mt-4 text-sm text-rose-200">{c.error}</p>}
      {state === "ready" && data && <>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(data.games || []).map((game) => (
            <article key={game.game_id} className="rounded-2xl border border-white/10 bg-white/[.04] p-3">
              <p className="text-xs font-semibold text-white/85">{c[game.game_id] || game.game_id}</p>
              <p className="mt-2 text-2xl font-black">{Number(game.verified_profiles || 0)}</p>
              <p className="text-[10px] text-white/40">{c.verified}</p>
              <p className="mt-2 text-[10px] text-cyan-100/60">{game.mode === "server_replay" ? "Server-Replay" : "Kein Score-Ranking"}</p>
            </article>
          ))}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[.04] p-3"><p className="text-[10px] text-white/45">{c.sessions}</p><p className="mt-1 text-lg font-bold">{Number(data.active_replay_sessions || 0)}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[.04] p-3"><p className="text-[10px] text-white/45">{c.leaderboard}</p><p className="mt-1 text-lg font-bold text-amber-200">{c.off}</p></div>
        </div>
      </>}
    </section>
  );
}
