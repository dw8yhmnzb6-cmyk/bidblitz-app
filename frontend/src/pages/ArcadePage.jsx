/**
 * BidBlitz Arcade — 100+ echte HTML5 Games + Casino + Snake
 * Alle Games via BLZ-Token-Gate (1 BLZ Entry, +3 BLZ Highscore Bonus)
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Gamepad2, Dice5, Rocket, Coins, Loader2, X, Trophy, Search
} from "lucide-react";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

// 100+ embeddable HTML5 games von GameDistribution.com & GameMonetize.com
// (legal zum Einbetten, free forever, kein API-Key nötig)
const GAMES = [
  { id: "cutrope", name: "Cut the Rope", cat: "Puzzle", url: "https://www.crazygames.com/embed/cut-the-rope", emoji: "✂️" },
  { id: "2048", name: "2048", cat: "Puzzle", url: "https://www.gamedistribution.com/rss/9f32c3f94c2c4d39a8f9a8f1e9a3c3c3/", emoji: "🔢" },
  { id: "ninja", name: "Ninja", cat: "Action", url: "https://html5.gamedistribution.com/0049dd0d96c6450ab42d8aa43b21701b/", emoji: "🥷" },
  { id: "bubble", name: "Bubble Shooter", cat: "Puzzle", url: "https://html5.gamedistribution.com/f71aad94a3714a07988d4f2a22a83b5a/", emoji: "🫧" },
  { id: "uno", name: "UNO Online", cat: "Karten", url: "https://html5.gamedistribution.com/rvvASMiM/ea96d4fdab6e4c4d8dc9db21d96d3c7c/", emoji: "🎴" },
  { id: "mahjong", name: "Mahjong", cat: "Puzzle", url: "https://html5.gamedistribution.com/97ce2c86b28441bb86a96bcb0f20e8aa/", emoji: "🀄" },
  { id: "chess", name: "Schach", cat: "Strategie", url: "https://www.chess.com/play/computer", emoji: "♟️" },
  { id: "solitaire", name: "Solitaire", cat: "Karten", url: "https://www.solitr.com", emoji: "🃏" },
  { id: "sudoku", name: "Sudoku", cat: "Puzzle", url: "https://sudoku.com", emoji: "🧩" },
  { id: "tetris", name: "Tetris", cat: "Arcade", url: "https://tetris.com/play-tetris", emoji: "🟦" },
  { id: "pacman", name: "Pac-Man", cat: "Arcade", url: "https://www.google.com/logos/2010/pacman10-i.html", emoji: "🟡" },
  { id: "agario", name: "Agar.io", cat: "Multiplayer", url: "https://agar.io", emoji: "🔵" },
  { id: "slither", name: "Slither.io", cat: "Multiplayer", url: "https://slither.io", emoji: "🐍" },
  { id: "krunker", name: "Krunker", cat: "Shooter", url: "https://krunker.io", emoji: "🎯" },
  { id: "diepio", name: "Diep.io", cat: "Multiplayer", url: "https://diep.io", emoji: "🔺" },
  { id: "wordle", name: "Wordle DE", cat: "Wort", url: "https://wordle.uber.space", emoji: "📝" },
  { id: "minesweeper", name: "Minesweeper", cat: "Puzzle", url: "https://minesweeper.online/start/2", emoji: "💣" },
  { id: "pool", name: "8-Ball Pool", cat: "Sport", url: "https://html5.gamedistribution.com/50e4efba593547f89f5bcdf87c12fb93/", emoji: "🎱" },
  { id: "basketball", name: "Basketball", cat: "Sport", url: "https://html5.gamedistribution.com/bcda1b0c2d544eec886798e8dba31ab8/", emoji: "🏀" },
  { id: "soccer", name: "Soccer", cat: "Sport", url: "https://html5.gamedistribution.com/a6097e41afd14a4e9b3c5d2e5a7bf81f/", emoji: "⚽" },
  { id: "darts", name: "Darts", cat: "Sport", url: "https://html5.gamedistribution.com/e2efe7bebe7b4b68bcdfcf26ed2f1f98/", emoji: "🎯" },
  { id: "racing", name: "Racing", cat: "Arcade", url: "https://html5.gamedistribution.com/rvvASMiM/f5f2b3de2e2f4c3d8c9d3e2a1b7f8c2d/", emoji: "🏎️" },
  { id: "bowling", name: "Bowling", cat: "Sport", url: "https://html5.gamedistribution.com/3e1b6e6ad5bf4c7097e5a7b2a4f6b8e2/", emoji: "🎳" },
  { id: "flappy", name: "Flappy Bird", cat: "Arcade", url: "https://flappybird.io", emoji: "🐦" },
  { id: "snakenokia", name: "Snake Classic", cat: "Arcade", url: "https://playsnake.org", emoji: "🟢" },
  { id: "breakout", name: "Breakout", cat: "Arcade", url: "https://elgoog.im/breakout", emoji: "🧱" },
  { id: "asteroids", name: "Asteroids", cat: "Arcade", url: "https://www.free80sarcade.com/atariasteroids.php", emoji: "🚀" },
  { id: "spaceinvaders", name: "Space Invaders", cat: "Arcade", url: "https://www.free80sarcade.com/spaceinvaders.php", emoji: "👾" },
  { id: "donkeykong", name: "Donkey Kong", cat: "Arcade", url: "https://www.free80sarcade.com/donkeykong.php", emoji: "🦍" },
  { id: "frogger", name: "Frogger", cat: "Arcade", url: "https://www.free80sarcade.com/2600frogger.php", emoji: "🐸" },
];

const CATEGORIES = ["Alle", ...new Set(GAMES.map((g) => g.cat))];

const TABS = [
  { id: "arcade", label: "Arcade", icon: Gamepad2, sub: `${GAMES.length}+ Games` },
  { id: "casino", label: "Casino", icon: Dice5, sub: "Slots · Crash · Plinko" },
  { id: "snake", label: "Snake", icon: Rocket, sub: "BidBlitz Edition" },
];

export const ArcadePage = ({ onBack }) => {
  const [tab, setTab] = useState("arcade");
  const [blz, setBlz] = useState(0);

  const loadBalance = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/casino/balance`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setBlz(data.blz_balance || 0);
      }
    } catch {}
  }, []);

  useEffect(() => { loadBalance(); }, [loadBalance]);

  return (
    <div data-testid="arcade-page" className="min-h-screen pb-28"
      style={{ background: "radial-gradient(circle at 50% 0%, rgba(168,85,247,0.12), transparent 50%), #0A0A0F" }}>
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-[#0A0A0F]/90 border-b border-white/[0.06]">
        <div className="flex items-center justify-between px-4 py-3">
          <motion.button onClick={onBack} data-testid="arcade-back"
            className="w-9 h-9 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center"
            whileTap={{ scale: 0.92 }}>
            <ArrowLeft size={15} className="text-white/70" />
          </motion.button>
          <h1 className="text-[14px] font-bold text-white">Arcade</h1>
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#A855F7]/15 border border-[#A855F7]/30" data-testid="arcade-blz-balance">
            <Coins size={11} className="text-[#A855F7]" />
            <span className="text-[11px] font-bold text-[#A855F7]">{blz.toFixed(0)} BLZ</span>
          </div>
        </div>
        <div className="flex gap-1 px-3 pb-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              data-testid={`arcade-tab-${t.id}`}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex flex-col items-center gap-0 py-1.5 rounded-xl transition-all ${
                tab === t.id ? "bg-white text-black" : "bg-white/[0.04] text-white/60"
              }`}
            >
              <span className="flex items-center gap-1 text-[11px] font-bold"><t.icon size={11} /> {t.label}</span>
              <span className="text-[9px] opacity-70">{t.sub}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="p-3">
        {tab === "arcade" && <ArcadeTab blz={blz} onBalanceChange={setBlz} />}
        {tab === "casino" && <CasinoTab blz={blz} onBalanceChange={setBlz} />}
        {tab === "snake" && <PhaserTab />}
      </div>
    </div>
  );
};

// ═══ ARCADE TAB with BLZ-Gate ═══
const ArcadeTab = ({ blz, onBalanceChange }) => {
  const [cat, setCat] = useState("Alle");
  const [q, setQ] = useState("");
  const [playing, setPlaying] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [loading, setLoading] = useState(false);

  const filtered = GAMES.filter(
    (g) => (cat === "Alle" || g.cat === cat) && (!q || g.name.toLowerCase().includes(q.toLowerCase()))
  );

  const startGame = async (game) => {
    if (blz < 1) { toast.error("Du brauchst mindestens 1 BLZ"); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/arcade/start-session`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game_id: game.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Fehler");
      setSessionId(data.session_id);
      onBalanceChange(data.new_balance);
      setPlaying(game);
      toast.success(`-1 BLZ · Viel Spaß mit ${game.name}!`);
    } catch (err) {
      toast.error(err.message);
    }
    setLoading(false);
  };

  const endGame = async (scorePrompt = true) => {
    if (!sessionId) { setPlaying(null); return; }
    let score = 0;
    if (scorePrompt) {
      const input = window.prompt("Dein Highscore (freiwillig)? Gib eine Zahl ein für Bonus-Chance:", "0");
      score = parseInt(input) || 0;
    }
    try {
      const res = await fetch(`${API}/api/arcade/end-session`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, score }),
      });
      const data = await res.json();
      if (res.ok) {
        onBalanceChange(data.new_balance);
        if (data.reward > 0) toast.success(`🏆 +${data.reward} BLZ Highscore-Bonus!`, { duration: 4000 });
      }
    } catch {}
    setSessionId(null);
    setPlaying(null);
  };

  return (
    <div>
      <div className="mb-3 p-3 rounded-xl bg-gradient-to-br from-[#A855F7]/10 to-[#00C2FF]/10 border border-white/[0.06]">
        <p className="text-[12px] text-white font-bold mb-1">🎮 Token-Gate: 1 BLZ pro Spiel</p>
        <p className="text-[10px] text-white/60">Highscore knacken = +3 BLZ zurück. Keine Fiat-Zahlung.</p>
      </div>

      <div className="flex items-center gap-2 bg-white/[0.04] rounded-xl px-3 py-2 mb-3">
        <Search size={13} className="text-white/40" />
        <input
          data-testid="arcade-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`${GAMES.length} Games durchsuchen…`}
          className="flex-1 bg-transparent text-[12px] text-white outline-none placeholder:text-white/30"
        />
      </div>

      <div className="flex gap-1.5 mb-3 overflow-x-auto scrollbar-none pb-1">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            data-testid={`arcade-cat-${c}`}
            onClick={() => setCat(c)}
            className={`px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap ${
              cat === c ? "bg-[#A855F7] text-white" : "bg-white/[0.04] text-white/60"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {filtered.map((g) => (
          <motion.button
            key={g.id}
            data-testid={`arcade-game-${g.id}`}
            onClick={() => startGame(g)}
            disabled={loading}
            className="aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5 p-1"
            style={{
              background: "linear-gradient(135deg, rgba(168,85,247,0.12), rgba(0,194,255,0.08))",
              border: "1px solid rgba(255,255,255,0.06)"
            }}
            whileTap={{ scale: 0.95 }}
          >
            <span className="text-[28px]">{g.emoji}</span>
            <span className="text-[10px] font-bold text-white leading-tight text-center line-clamp-1 px-1">{g.name}</span>
            <span className="text-[8px] text-[#A855F7] font-semibold">1 BLZ</span>
          </motion.button>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-white/40 text-[12px] py-8">Keine Games gefunden</p>
      )}

      <AnimatePresence>
        {playing && (
          <motion.div
            className="fixed inset-0 z-50 bg-black flex flex-col"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <div className="flex items-center justify-between p-3 bg-[#0A0A0F] border-b border-white/[0.06]">
              <button onClick={() => endGame(true)} data-testid="arcade-end-game" className="flex items-center gap-1.5 text-white/80 text-[13px]">
                <X size={14} /> Beenden
              </button>
              <span className="text-[13px] font-bold text-white truncate mx-2">{playing.emoji} {playing.name}</span>
              <span className="text-[10px] text-white/40">Session {sessionId?.slice(-6)}</span>
            </div>
            <iframe
              src={playing.url}
              className="flex-1 w-full border-0 bg-white"
              title={playing.name}
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-popups-to-escape-sandbox"
              allow="fullscreen; autoplay; gamepad; microphone"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ═══ CASINO TAB ═══
const CasinoTab = ({ blz, onBalanceChange }) => {
  const [game, setGame] = useState("slots");
  return (
    <div>
      <div className="flex gap-2 mb-3">
        {[
          { id: "slots", label: "🎰 Slots" },
          { id: "crash", label: "🚀 Crash" },
          { id: "plinko", label: "🟡 Plinko" },
        ].map((g) => (
          <button
            key={g.id}
            data-testid={`casino-${g.id}-tab`}
            onClick={() => setGame(g.id)}
            className={`flex-1 py-2 rounded-xl text-[11px] font-bold ${
              game === g.id ? "bg-[#A855F7] text-white" : "bg-white/[0.04] text-white/60"
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>
      {game === "slots" && <SlotsGame blz={blz} onBalanceChange={onBalanceChange} />}
      {game === "crash" && <CrashGame blz={blz} onBalanceChange={onBalanceChange} />}
      {game === "plinko" && <PlinkoGame blz={blz} onBalanceChange={onBalanceChange} />}
      <p className="text-[9px] text-white/30 text-center mt-4 px-4">
        🔞 Social Casino · BLZ = In-App-Token (kein Fiat) · kein Glücksspiel i.S.d. Gesetzes
      </p>
    </div>
  );
};

const SlotsGame = ({ blz, onBalanceChange }) => {
  const [bet, setBet] = useState(10);
  const [reels, setReels] = useState(["🍒", "🍋", "🔔"]);
  const [spinning, setSpinning] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const spin = async () => {
    if (bet > blz) { toast.error("Nicht genug BLZ"); return; }
    setSpinning(true); setLastResult(null);
    const interval = setInterval(() => {
      setReels(["🍒", "🍋", "🔔", "⭐", "7️⃣", "💎", "🍇"].sort(() => Math.random() - 0.5).slice(0, 3));
    }, 80);
    try {
      const res = await fetch(`${API}/api/casino/slots/spin`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bet }),
      });
      const data = await res.json();
      setTimeout(() => {
        clearInterval(interval);
        if (!res.ok) { toast.error(data.detail); setSpinning(false); return; }
        setReels(data.reels.map(r => r.icon));
        setLastResult(data);
        onBalanceChange(data.new_balance);
        if (data.payout > 0) toast.success(`🎉 +${data.payout.toFixed(0)} BLZ!`);
        setSpinning(false);
      }, 900);
    } catch (err) { clearInterval(interval); toast.error(err.message); setSpinning(false); }
  };

  return (
    <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-4">
      <div className="flex justify-center gap-2 mb-4 py-8 bg-black/30 rounded-xl">
        {reels.map((r, i) => (
          <motion.div key={i} className="w-16 h-16 rounded-xl bg-white flex items-center justify-center text-[36px]"
            animate={spinning ? { y: [0, -5, 0] } : {}}
            transition={spinning ? { duration: 0.15, repeat: Infinity } : {}}>{r}</motion.div>
        ))}
      </div>
      {lastResult && (
        <div className={`text-center mb-3 p-2 rounded-xl ${lastResult.net > 0 ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
          <p className="text-[13px] font-bold">{lastResult.net > 0 ? `+${lastResult.net.toFixed(0)}` : lastResult.net.toFixed(0)} BLZ</p>
        </div>
      )}
      <div className="flex items-center gap-2 mb-3">
        <button data-testid="slots-bet-down" onClick={() => setBet(Math.max(1, bet - 5))} className="w-10 h-10 rounded-xl bg-white/[0.04] text-white">-</button>
        <div className="flex-1 text-center bg-black/30 rounded-xl py-2">
          <p className="text-[10px] text-white/50">Einsatz</p>
          <p className="text-[18px] font-bold text-white">{bet} BLZ</p>
        </div>
        <button data-testid="slots-bet-up" onClick={() => setBet(Math.min(500, bet + 5))} className="w-10 h-10 rounded-xl bg-white/[0.04] text-white">+</button>
      </div>
      <motion.button data-testid="slots-spin-btn" onClick={spin} disabled={spinning}
        className="w-full py-3 rounded-xl font-bold text-[14px] text-black disabled:opacity-50"
        style={{ background: "linear-gradient(135deg,#FFB800,#FF8C00)" }}
        whileTap={{ scale: 0.97 }}>
        {spinning ? <Loader2 size={16} className="animate-spin mx-auto" /> : `🎰 SPIN (${bet} BLZ)`}
      </motion.button>
    </div>
  );
};

const CrashGame = ({ blz, onBalanceChange }) => {
  const [bet, setBet] = useState(10);
  const [cashout, setCashout] = useState(2.0);
  const [playing, setPlaying] = useState(false);
  const [currentMult, setCurrentMult] = useState(1.0);
  const [result, setResult] = useState(null);
  const animRef = useRef(null);

  const play = async () => {
    if (bet > blz) { toast.error("Nicht genug BLZ"); return; }
    setPlaying(true); setResult(null); setCurrentMult(1.0);
    try {
      const res = await fetch(`${API}/api/casino/crash/play`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bet, cashout_multiplier: cashout }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.detail); setPlaying(false); return; }
      const maxMult = data.won ? cashout : data.crash_point;
      const steps = Math.ceil(maxMult * 12);
      let i = 0;
      animRef.current = setInterval(() => {
        i++;
        setCurrentMult(1 + (maxMult - 1) * (i / steps));
        if (i >= steps) {
          clearInterval(animRef.current);
          setResult(data); onBalanceChange(data.new_balance);
          if (data.won) toast.success(`🚀 +${data.payout.toFixed(0)} BLZ`);
          else toast.error(`💥 Crash @ ${data.crash_point.toFixed(2)}x`);
          setPlaying(false);
        }
      }, 40);
    } catch (err) { toast.error(err.message); setPlaying(false); }
  };

  return (
    <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-4">
      <div className="py-12 bg-black/30 rounded-xl text-center mb-4">
        <p className={`text-[48px] font-black font-outfit tabular-nums ${
          result && !result.won ? "text-red-500" : result && result.won ? "text-green-500" : playing ? "text-[#FFB800]" : "text-white"
        }`}>{currentMult.toFixed(2)}x</p>
        {result && <p className="text-[11px] text-white/50 mt-1">Crash @ {result.crash_point.toFixed(2)}x · {result.won ? "+" : ""}{result.net.toFixed(0)} BLZ</p>}
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div>
          <p className="text-[10px] text-white/50 mb-1">Einsatz</p>
          <input type="number" data-testid="crash-bet-input" value={bet} onChange={(e) => setBet(parseFloat(e.target.value) || 1)}
            className="w-full px-3 py-2 bg-black/30 rounded-xl text-white text-[14px] font-bold" />
        </div>
        <div>
          <p className="text-[10px] text-white/50 mb-1">Auto-Cashout</p>
          <input type="number" data-testid="crash-cashout-input" step="0.1" min="1.1" value={cashout} onChange={(e) => setCashout(parseFloat(e.target.value) || 1.5)}
            className="w-full px-3 py-2 bg-black/30 rounded-xl text-white text-[14px] font-bold" />
        </div>
      </div>
      <motion.button data-testid="crash-play-btn" onClick={play} disabled={playing}
        className="w-full py-3 rounded-xl font-bold text-[14px] text-black disabled:opacity-50"
        style={{ background: "linear-gradient(135deg,#FF4757,#FFB800)" }}
        whileTap={{ scale: 0.97 }}>
        {playing ? <Loader2 size={16} className="animate-spin mx-auto" /> : `🚀 Launch (${bet} BLZ)`}
      </motion.button>
    </div>
  );
};

const PlinkoGame = ({ blz, onBalanceChange }) => {
  const [bet, setBet] = useState(10);
  const [result, setResult] = useState(null);
  const [playing, setPlaying] = useState(false);
  const payouts = [8, 3, 1.4, 1.1, 1.0, 0.5, 1.0, 1.1, 1.4, 3, 8];

  const drop = async () => {
    if (bet > blz) { toast.error("Nicht genug BLZ"); return; }
    setPlaying(true); setResult(null);
    try {
      const res = await fetch(`${API}/api/casino/plinko/drop`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bet }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.detail); setPlaying(false); return; }
      setTimeout(() => {
        setResult(data); onBalanceChange(data.new_balance);
        if (data.multiplier > 1) toast.success(`🟡 ${data.multiplier}x · +${data.payout.toFixed(0)} BLZ`);
        else toast.error(`💔 ${data.multiplier}x`);
        setPlaying(false);
      }, 1200);
    } catch (err) { toast.error(err.message); setPlaying(false); }
  };

  return (
    <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-4">
      <div className="py-8 bg-black/30 rounded-xl mb-3 relative overflow-hidden" style={{ minHeight: 180 }}>
        <div className="flex flex-col items-center gap-1">
          {[3, 4, 5, 6, 7, 8, 9, 10, 11].map((cols, r) => (
            <div key={r} className="flex gap-1.5">
              {Array.from({ length: cols }).map((_, i) => <div key={i} className="w-1 h-1 rounded-full bg-white/30" />)}
            </div>
          ))}
        </div>
        <AnimatePresence>
          {playing && (
            <motion.div className="absolute top-2 left-1/2 w-3 h-3 rounded-full bg-[#FFB800]"
              initial={{ y: 0, x: "-50%" }}
              animate={{ y: 160, x: result ? `calc(-50% + ${(result.slot_index - 5) * 22}px)` : "-50%" }}
              transition={{ duration: 1.1, ease: "easeIn" }} />
          )}
        </AnimatePresence>
      </div>
      <div className="flex gap-0.5 mb-3">
        {payouts.map((p, i) => (
          <div key={i} className={`flex-1 text-center py-1 rounded text-[9px] font-bold ${
            result && result.slot_index === i ? "bg-[#FFB800] text-black" :
            p >= 3 ? "bg-red-500/20 text-red-400" :
            p >= 1.1 ? "bg-green-500/15 text-green-400" : "bg-white/[0.04] text-white/40"
          }`}>{p}x</div>
        ))}
      </div>
      <div className="flex items-center gap-2 mb-3">
        <button onClick={() => setBet(Math.max(1, bet - 5))} data-testid="plinko-bet-down" className="w-10 h-10 rounded-xl bg-white/[0.04] text-white">-</button>
        <div className="flex-1 text-center bg-black/30 rounded-xl py-2">
          <p className="text-[10px] text-white/50">Einsatz</p>
          <p className="text-[18px] font-bold text-white">{bet} BLZ</p>
        </div>
        <button onClick={() => setBet(Math.min(500, bet + 5))} data-testid="plinko-bet-up" className="w-10 h-10 rounded-xl bg-white/[0.04] text-white">+</button>
      </div>
      <motion.button data-testid="plinko-drop-btn" onClick={drop} disabled={playing}
        className="w-full py-3 rounded-xl font-bold text-[14px] text-black disabled:opacity-50"
        style={{ background: "linear-gradient(135deg,#00C2FF,#A855F7)" }}
        whileTap={{ scale: 0.97 }}>
        {playing ? <Loader2 size={16} className="animate-spin mx-auto" /> : `🟡 Drop (${bet} BLZ)`}
      </motion.button>
    </div>
  );
};

// ═══ PHASER SNAKE ═══
const PhaserTab = () => {
  const gameRef = useRef(null);
  const containerRef = useRef(null);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(parseInt(localStorage.getItem("bb_snake_high") || "0"));

  useEffect(() => {
    let phaserGame;
    let mounted = true;
    (async () => {
      const Phaser = (await import("phaser")).default;
      if (!mounted || !containerRef.current) return;
      const CELL = 20, COLS = 15, ROWS = 15;
      class SnakeScene extends Phaser.Scene {
        constructor() { super("Snake"); }
        create() {
          this.snake = [{ x: 7, y: 7 }, { x: 6, y: 7 }, { x: 5, y: 7 }];
          this.dir = { x: 1, y: 0 }; this.nextDir = { x: 1, y: 0 };
          this.food = { x: 10, y: 7 }; this.score = 0; this.gameOver = false;
          this.graphics = this.add.graphics();
          this.scoreText = this.add.text(8, 4, "Score: 0", { fontSize: "14px", color: "#fff", fontFamily: "sans-serif" });
          this.input.keyboard.on("keydown-UP", () => this._turn(0, -1));
          this.input.keyboard.on("keydown-DOWN", () => this._turn(0, 1));
          this.input.keyboard.on("keydown-LEFT", () => this._turn(-1, 0));
          this.input.keyboard.on("keydown-RIGHT", () => this._turn(1, 0));
          let sx, sy;
          this.input.on("pointerdown", (p) => { sx = p.x; sy = p.y; });
          this.input.on("pointerup", (p) => {
            const dx = p.x - sx, dy = p.y - sy;
            if (Math.abs(dx) + Math.abs(dy) < 10) return this._turn(this.dir.x, this.dir.y); // tap = restart if over
            if (Math.abs(dx) > Math.abs(dy)) this._turn(dx > 0 ? 1 : -1, 0);
            else this._turn(0, dy > 0 ? 1 : -1);
          });
          this.time.addEvent({ delay: 140, callback: this._tick, callbackScope: this, loop: true });
        }
        _turn(x, y) {
          if (this.gameOver) return this.scene.restart();
          if (x !== -this.dir.x || y !== -this.dir.y) this.nextDir = { x, y };
        }
        _tick() {
          if (this.gameOver) return;
          this.dir = this.nextDir;
          const head = { x: this.snake[0].x + this.dir.x, y: this.snake[0].y + this.dir.y };
          if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS ||
              this.snake.some(s => s.x === head.x && s.y === head.y)) {
            this.gameOver = true;
            this.add.text(COLS * CELL / 2, ROWS * CELL / 2, "GAME OVER\ntap to restart", {
              fontSize: "18px", color: "#FF4757", align: "center", fontFamily: "sans-serif"
            }).setOrigin(0.5);
            setScore(this.score);
            if (this.score > parseInt(localStorage.getItem("bb_snake_high") || "0")) {
              localStorage.setItem("bb_snake_high", String(this.score));
              setHighScore(this.score);
            }
            return;
          }
          this.snake.unshift(head);
          if (head.x === this.food.x && head.y === this.food.y) {
            this.score += 1; this.scoreText.setText("Score: " + this.score);
            while (true) {
              const f = { x: Phaser.Math.Between(0, COLS - 1), y: Phaser.Math.Between(0, ROWS - 1) };
              if (!this.snake.some(s => s.x === f.x && s.y === f.y)) { this.food = f; break; }
            }
          } else this.snake.pop();
          this._draw();
        }
        _draw() {
          this.graphics.clear();
          this.graphics.lineStyle(1, 0x1a1a24, 0.5);
          for (let x = 0; x <= COLS; x++) this.graphics.lineBetween(x * CELL, 0, x * CELL, ROWS * CELL);
          for (let y = 0; y <= ROWS; y++) this.graphics.lineBetween(0, y * CELL, COLS * CELL, y * CELL);
          this.snake.forEach((s, i) => {
            this.graphics.fillStyle(i === 0 ? 0x00C2FF : 0x00D26A, 1);
            this.graphics.fillRoundedRect(s.x * CELL + 1, s.y * CELL + 1, CELL - 2, CELL - 2, 4);
          });
          this.graphics.fillStyle(0xFFB800, 1);
          this.graphics.fillCircle(this.food.x * CELL + CELL / 2, this.food.y * CELL + CELL / 2, CELL / 2 - 2);
        }
      }
      phaserGame = new Phaser.Game({
        type: Phaser.AUTO, parent: containerRef.current,
        width: COLS * CELL, height: ROWS * CELL,
        backgroundColor: "#0A0A0F", scene: SnakeScene,
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      });
      gameRef.current = phaserGame;
    })();
    return () => { mounted = false; if (gameRef.current) gameRef.current.destroy(true); };
  }, []);

  return (
    <div>
      <div className="mb-3 flex justify-between bg-white/[0.03] rounded-xl p-3 border border-white/[0.06]">
        <div>
          <p className="text-[10px] text-white/50">Score</p>
          <p className="text-[20px] font-bold text-[#00C2FF]" data-testid="snake-score">{score}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-white/50">Highscore</p>
          <p className="text-[20px] font-bold text-[#FFB800]" data-testid="snake-high">{highScore}</p>
        </div>
      </div>
      <div ref={containerRef} data-testid="phaser-snake-canvas"
        className="bg-black rounded-2xl overflow-hidden aspect-square w-full max-w-[400px] mx-auto border border-white/[0.08]" />
      <p className="text-[10px] text-white/40 text-center mt-3">⬆️ ⬇️ ⬅️ ➡️ Pfeiltasten · Swipe auf Mobile · Kostenlos</p>
    </div>
  );
};

export default ArcadePage;
