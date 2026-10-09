import { useEffect, useState } from "react";
import { Loader2, ShieldCheck, Trophy } from "lucide-react";
import { useUser } from "../store";

const BACKEND = process.env.REACT_APP_BACKEND_URL || "";

const COPY = {
  de: {
    title: "Deine Platzierung",
    guest: "Melde dich an, um deine persönliche Platzierung zu sehen.",
    loading: "Platzierung wird geladen…",
    error: "Platzierung konnte nicht geladen werden.",
    rank: "Rang",
    players: "Spieler",
    score: "Bestscore gesamt",
    stars: "Sterne",
    levels: "Level",
    unranked: "Noch nicht platziert",
    note: "Practice-Ranking: nur dein eigener Rang wird angezeigt. Scores sind noch nicht serverseitig gegen Manipulation verifiziert.",
    verifiedNote: "Server-Replay-Ranking: dein Ergebnis wurde aus einem Server-Seed und deiner Aktionsfolge reproduziert. Das ist noch kein vollständiger Anti-Cheat und kein öffentliches Trusted-Leaderboard.",
    verifiedLabel: "Server-Replay",
  },
  en: {
    title: "Your ranking",
    guest: "Sign in to see your personal ranking.",
    loading: "Loading ranking…",
    error: "Ranking could not be loaded.",
    rank: "Rank",
    players: "Players",
    score: "Total best score",
    stars: "Stars",
    levels: "Levels",
    unranked: "Not ranked yet",
    note: "Practice ranking: only your own rank is shown. Scores are not yet server-verified against manipulation.",
    verifiedNote: "Server replay ranking: your result was reproduced from a server seed and action trace. This is not yet full anti-cheat or a public trusted leaderboard.",
    verifiedLabel: "Server replay",
  },
  sq: {
    title: "Renditja jote",
    guest: "Hyr në llogari për të parë renditjen tënde personale.",
    loading: "Po ngarkohet renditja…",
    error: "Renditja nuk u ngarkua.",
    rank: "Renditja",
    players: "Lojtarë",
    score: "Rezultati më i mirë total",
    stars: "Yje",
    levels: "Nivele",
    unranked: "Ende pa renditje",
    note: "Renditje prove: shfaqet vetëm renditja jote. Rezultatet ende nuk verifikohen nga serveri kundër manipulimit.",
    verifiedNote: "Renditje me replay të serverit: rezultati yt u riprodhua nga seed-i i serverit dhe gjurmët e veprimeve. Kjo ende nuk është anti-cheat i plotë ose renditje publike e besuar.",
    verifiedLabel: "Replay i serverit",
  },
};

export default function GamesPersonalRankingCard({ gameId, locale = "en" }) {
  const user = useUser();
  const c = COPY[locale] || COPY.en;
  const [ranking, setRanking] = useState(null);
  const [state, setState] = useState("idle");

  useEffect(() => {
    if (!user.sessionReady || !user.isAuthenticated || !gameId) {
      setRanking(null);
      setState("idle");
      return undefined;
    }

    const controller = new AbortController();
    setState("loading");
    fetch(`${BACKEND}/api/games/rankings/${encodeURIComponent(gameId)}/me`, {
      credentials: "include",
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.detail || "ranking");
        return body;
      })
      .then((body) => {
        if (controller.signal.aborted) return;
        setRanking(body);
        setState("ready");
      })
      .catch((error) => {
        if (!controller.signal.aborted && error.name !== "AbortError") {
          setRanking(null);
          setState("error");
        }
      });

    return () => controller.abort();
  }, [gameId, user.isAuthenticated, user.sessionReady]);

  return (
    <section className="mt-6 rounded-3xl border border-cyan-200/15 bg-[#0a1d36] p-5" data-testid="games-personal-ranking">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Trophy size={19} className="text-cyan-300" />{c.title}
        </h2>
        {ranking?.verified && <span className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-[10px] font-semibold text-emerald-100">{c.verifiedLabel}</span>}
      </div>

      {!user.sessionReady || state === "loading"
        ? <p className="mt-4 flex items-center gap-2 text-sm text-white/55"><Loader2 size={16} className="animate-spin" />{c.loading}</p>
        : !user.isAuthenticated
          ? <p className="mt-4 text-sm text-white/55">{c.guest}</p>
          : state === "error"
            ? <p role="alert" className="mt-4 text-sm text-rose-200">{c.error}</p>
            : ranking && <div className="mt-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <div className="rounded-2xl border border-white/10 bg-white/[.04] p-3">
                  <p className="text-[10px] text-white/45">{c.rank}</p>
                  <p className="mt-1 text-lg font-bold">{ranking.rank == null ? "—" : `#${ranking.rank}`}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[.04] p-3">
                  <p className="text-[10px] text-white/45">{c.players}</p>
                  <p className="mt-1 text-lg font-bold">{Number(ranking.participants || 0)}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[.04] p-3">
                  <p className="text-[10px] text-white/45">{c.score}</p>
                  <p className="mt-1 text-lg font-bold">{Number(ranking.total_score || 0).toLocaleString()}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[.04] p-3">
                  <p className="text-[10px] text-white/45">{c.stars}</p>
                  <p className="mt-1 text-lg font-bold">{Number(ranking.total_stars || 0)}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[.04] p-3">
                  <p className="text-[10px] text-white/45">{c.levels}</p>
                  <p className="mt-1 text-lg font-bold">{Number(ranking.completed_levels || 0)}/{Number(ranking.max_levels || 0)}</p>
                </div>
              </div>
              {ranking.rank == null && <p className="mt-3 text-xs text-white/45">{c.unranked}</p>}
            </div>}

      <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-cyan-50/55">
        <ShieldCheck size={16} className="mt-0.5 shrink-0 text-cyan-300" />{ranking?.verified ? c.verifiedNote : c.note}
      </p>
    </section>
  );
}
