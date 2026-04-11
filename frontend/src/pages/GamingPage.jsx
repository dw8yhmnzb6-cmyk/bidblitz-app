/**
 * BidBlitz V2 - Gaming Platform
 * Casino-style games with points rewards
 */

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Gamepad2, Star, Trophy, Gift, Zap, Target,
  RefreshCw, Loader2, Crown, Sparkles, Coins, Timer,
  Play, Pause, Volume2, VolumeX, Award, TrendingUp,
  ChevronRight, Lock, Unlock, Heart, X, Check
} from "lucide-react";

const API_URL = process.env.REACT_APP_BACKEND_URL;

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN GAMING PAGE
// ═══════════════════════════════════════════════════════════════════════════════

const GamingPage = ({ onNavigate, onBack }) => {
  const [userCoins, setUserCoins] = useState(0);
  const [ setDailySpins] = useState(50);
  const [activeGame, setActiveGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showBuyCoins, setShowBuyCoins] = useState(false);
  const [buyAmount, setBuyAmount] = useState("5");
  const [buying, setBuying] = useState(false);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const res = await fetch(`${API_URL}/api/gaming/profile`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setUserCoins(data.coins || 0);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleBuyCoins = async () => {
    setBuying(true);
    try {
      const res = await fetch(`${API_URL}/api/gaming/buy-coins`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: parseFloat(buyAmount) }),
      });
      if (res.ok) {
        const data = await res.json();
        setUserCoins(data.new_balance);
        setShowBuyCoins(false);
      } else {
        const err = await res.json();
        alert(err.detail || "Fehler beim Kauf");
      }
    } catch (err) { alert("Fehler"); }
    setBuying(false);
  };

  const handleRedeemCoins = async () => {
    const amount = prompt("Wie viele Coins einlösen? (Min. 500)");
    if (!amount || parseInt(amount) < 500) return;
    try {
      const res = await fetch(`${API_URL}/api/gaming/redeem`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coins: parseInt(amount) }),
      });
      const data = await res.json();
      if (res.ok) {
        setUserCoins(data.remaining_coins);
        alert(data.message);
      } else { alert(data.detail || "Fehler"); }
    } catch (err) { alert("Fehler"); }
  };

  const GAMES = [
    { id: "wheel", name: "Glücksrad", icon: "🎡", desc: "Drehe & Gewinne!", color: "#FFD700", component: WheelGame },
    { id: "scratch", name: "Rubbellos", icon: "🎫", desc: "Kratze & Gewinne!", color: "#FF6B6B", component: ScratchGame },
    { id: "slots", name: "Lucky Slots", icon: "🎰", desc: "777 Jackpot!", color: "#9B59B6", component: SlotsGame },
    { id: "quiz", name: "Quiz Master", icon: "🧠", desc: "Teste dein Wissen!", color: "#3498DB", component: QuizGame },
    { id: "memory", name: "Memory", icon: "🃏", desc: "Finde die Paare!", color: "#2ECC71", component: MemoryGame },
    { id: "dice", name: "Würfelglück", icon: "🎲", desc: "Würfle dein Glück!", color: "#E74C3C", component: DiceGame },
    { id: "coinflip", name: "Münzwurf", icon: "🪙", desc: "Kopf oder Zahl!", color: "#F39C12", component: CoinFlipGame },
    { id: "highlow", name: "Höher/Tiefer", icon: "📊", desc: "Rate die Karte!", color: "#1ABC9C", component: HighLowGame },
    { id: "mines", name: "Minenfeld", icon: "💣", desc: "Weiche den Minen!", color: "#95A5A6", component: MinesGame },
    { id: "crash", name: "Crash", icon: "📈", desc: "Cashe rechtzeitig!", color: "#E91E63", component: CrashGame },
    { id: "plinko", name: "Plinko", icon: "🔴", desc: "Lass fallen!", color: "#FF5722", component: PlinkoGame },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#030303]">
        <Loader2 size={32} className="text-yellow-400 animate-spin" />
      </div>
    );
  }

  // Show game if active
  if (activeGame) {
    const GameComponent = GAMES.find(g => g.id === activeGame)?.component;
    if (GameComponent) {
      return (
        <GameComponent
          onBack={() => { setActiveGame(null); loadUserData(); }}
          userCoins={userCoins}
          onCoinsUpdate={loadUserData}
        />
      );
    }
  }

  return (
    <div data-testid="gaming-page" className="min-h-screen bg-[#030303] pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 px-4 py-3 bg-gradient-to-b from-[#0A0A0F] to-transparent">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <motion.button
              onClick={onBack}
              className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center"
              whileTap={{ scale: 0.9 }}
            >
              <ArrowLeft size={16} className="text-white/60" />
            </motion.button>
            <div>
              <h1 className="text-[17px] font-bold text-white flex items-center gap-2">
                <Gamepad2 size={20} className="text-yellow-400" />
                Game Center
              </h1>
              <p className="text-[11px] text-gray-500">Spiele & Gewinne</p>
            </div>
          </div>
          
          {/* Coins Display */}
          <motion.div whileTap={{ scale: 0.95 }} onClick={() => setShowBuyCoins(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 cursor-pointer">
            <Coins size={16} className="text-yellow-400" />
            <span className="text-yellow-400 font-bold">{userCoins.toLocaleString()}</span>
          </motion.div>
        </div>

        {/* Coin Actions */}
        <div className="flex gap-2 mb-3">
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => setShowBuyCoins(true)}
            className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 flex items-center justify-center gap-1.5"
            data-testid="buy-coins-btn">
            <Coins size={14} /> Coins kaufen
          </motion.button>
          <motion.button whileTap={{ scale: 0.95 }} onClick={handleRedeemCoins}
            disabled={userCoins < 500}
            className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-green-500/10 text-green-400 border border-green-500/20 flex items-center justify-center gap-1.5 disabled:opacity-30"
            data-testid="redeem-coins-btn">
            <TrendingUp size={14} /> Auszahlen
          </motion.button>
        </div>
      </div>

      {/* Buy Coins Modal */}
      <AnimatePresence>
        {showBuyCoins && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end justify-center"
            onClick={() => setShowBuyCoins(false)}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              onClick={e => e.stopPropagation()} className="w-full max-w-lg bg-[#111118] rounded-t-3xl p-6">
              <h3 className="text-lg font-bold mb-1 text-white">Coins kaufen</h3>
              <p className="text-xs text-gray-500 mb-4">1.000 Coins = €1,00</p>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[{e:"1",c:"1.000"},{e:"5",c:"5.000"},{e:"10",c:"10.000"},{e:"20",c:"20.000"},{e:"50",c:"50.000"},{e:"100",c:"100.000"}].map(p => (
                  <motion.button key={p.e} whileTap={{ scale: 0.95 }}
                    onClick={() => setBuyAmount(p.e)}
                    className={`py-3 rounded-xl text-center ${buyAmount===p.e ? "bg-yellow-500/20 border-2 border-yellow-500/50" : "bg-white/5 border border-white/10"}`}>
                    <p className="text-sm font-bold text-yellow-400">{p.c}</p>
                    <p className="text-[10px] text-gray-500">€{p.e}</p>
                  </motion.button>
                ))}
              </div>
              <motion.button whileTap={{ scale: 0.97 }} onClick={handleBuyCoins} disabled={buying}
                className="w-full py-4 rounded-xl bg-yellow-500 text-black font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                data-testid="confirm-buy-coins">
                {buying ? <Loader2 size={20} className="animate-spin" /> : <><Coins size={20} /> Für €{buyAmount} kaufen</>}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Games Grid */}
      <div className="px-4 pt-4">
        <div className="grid grid-cols-2 gap-3">
          {GAMES.map((game, idx) => (
            <motion.button
              key={game.id}
              onClick={() => setActiveGame(game.id)}
              className="p-4 rounded-2xl border text-left relative overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${game.color}15 0%, ${game.color}05 100%)`,
                borderColor: `${game.color}30`,
              }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              whileTap={{ scale: 0.97 }}
            >
              <div className="text-4xl mb-2">{game.icon}</div>
              <p className="text-[14px] font-bold text-white">{game.name}</p>
              <p className="text-[11px] text-gray-400">{game.desc}</p>
              <ChevronRight
                size={16}
                className="absolute top-4 right-4 text-gray-600"
              />
            </motion.button>
          ))}
        </div>
      </div>

      {/* Leaderboard Preview */}
      <div className="px-4 mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[14px] font-bold text-white flex items-center gap-2">
            <Trophy size={16} className="text-yellow-400" />
            Top Spieler
          </h2>
          <button className="text-[11px] text-cyan-400">Alle anzeigen</button>
        </div>
        <div className="space-y-2">
          {[
            { rank: 1, name: "MaxGamer", points: 15420, emoji: "👑" },
            { rank: 2, name: "LuckyLisa", points: 12300, emoji: "🥈" },
            { rank: 3, name: "ProPlayer", points: 9850, emoji: "🥉" },
          ].map((player) => (
            <div
              key={player.rank}
              className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5"
            >
              <span className="text-xl">{player.emoji}</span>
              <div className="flex-1">
                <p className="text-[13px] font-semibold text-white">{player.name}</p>
              </div>
              <p className="text-yellow-400 font-bold text-[13px]">{player.points.toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Rewards Info */}
      <div className="px-4 mt-6">
        <div className="p-4 rounded-2xl bg-gradient-to-br from-green-500/10 to-emerald-500/5 border border-green-500/20">
          <div className="flex items-center gap-2 mb-2">
            <Gift size={18} className="text-green-400" />
            <p className="text-[13px] font-bold text-green-400">Coins einlösen</p>
          </div>
          <p className="text-[11px] text-gray-400 mb-3">
            Tausche deine Coins gegen echte EUR ein!
          </p>
          <div className="flex gap-2">
            <div className="flex-1 p-2 rounded-lg bg-white/5 text-center">
              <p className="text-[18px] font-bold text-white">500</p>
              <p className="text-[9px] text-gray-500">= €0.50</p>
            </div>
            <div className="flex-1 p-2 rounded-lg bg-white/5 text-center">
              <p className="text-[18px] font-bold text-white">2000</p>
              <p className="text-[9px] text-gray-500">= €2.00</p>
            </div>
            <div className="flex-1 p-2 rounded-lg bg-white/5 text-center">
              <p className="text-[18px] font-bold text-white">5000</p>
              <p className="text-[9px] text-gray-500">= €5.00</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// WHEEL OF FORTUNE GAME
// ═══════════════════════════════════════════════════════════════════════════════

const WheelGame = ({ onBack, userCoins,  onCoinsUpdate }) => {
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState(null);
  const [spinsLeft, setSpinsLeft] = useState(dailySpins);

  const PRIZES = [
    { label: "10", points: 10, color: "#FF6B6B" },
    { label: "25", points: 25, color: "#4ECDC4" },
    { label: "50", points: 50, color: "#45B7D1" },
    { label: "100", points: 100, color: "#96CEB4" },
    { label: "200", points: 200, color: "#FFEAA7" },
    { label: "500", points: 500, color: "#DDA0DD" },
    { label: "🎁", points: 1000, color: "#FFD700" },
    { label: "💎", points: 2500, color: "#E056FD" },
  ];

  const spin = async () => {
    if (spinning || spinsLeft <= 0) return;
    
    setSpinning(true);
    setResult(null);
    
    // Random result
    const prizeIndex = Math.floor(Math.random() * PRIZES.length);
    const prize = PRIZES[prizeIndex];
    
    // Calculate rotation (5 full spins + prize position)
    const segmentAngle = 360 / PRIZES.length;
    const targetRotation = 360 * 5 + (360 - (prizeIndex * segmentAngle + segmentAngle / 2));
    
    setRotation(prev => prev + targetRotation);
    
    // Wait for animation
    setTimeout(async () => {
      setResult(prize);
      setSpinsLeft(prev => prev - 1);
      setSpinning(false);
      
      // Save to backend
      try {
        await fetch(`${API_URL}/api/gaming/wheel/spin`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ bet: 10, points_won: prize.points }),
        });
        onCoinsUpdate?.();
      } catch (err) {
        console.error(err);
      }
    }, 4000);
  };

  return (
    <GameWrapper title="Glücksrad" icon="🎡" onBack={onBack} points={userCoins}>
      <div className="flex flex-col items-center py-6">
        {/* Wheel */}
        <div className="relative w-72 h-72 mb-6">
          {/* Pointer */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-10">
            <div className="w-0 h-0 border-l-[15px] border-r-[15px] border-t-[25px] border-l-transparent border-r-transparent border-t-yellow-400" />
          </div>
          
          {/* Wheel */}
          <motion.div
            className="w-full h-full rounded-full border-4 border-yellow-400 overflow-hidden shadow-2xl"
            style={{
              background: `conic-gradient(${PRIZES.map((p, i) => 
                `${p.color} ${i * (100/PRIZES.length)}% ${(i + 1) * (100/PRIZES.length)}%`
              ).join(", ")})`,
            }}
            animate={{ rotate: rotation }}
            transition={{ duration: 4, ease: [0.17, 0.67, 0.12, 0.99] }}
          >
            {/* Prize Labels */}
            {PRIZES.map((prize, i) => {
              const angle = (i * 360 / PRIZES.length) + (180 / PRIZES.length);
              return (
                <div
                  key={i}
                  className="absolute top-1/2 left-1/2 origin-left"
                  style={{
                    transform: `rotate(${angle}deg) translateX(40px)`,
                  }}
                >
                  <span
                    className="text-white font-bold text-lg drop-shadow-lg"
                    style={{ transform: `rotate(90deg)` }}
                  >
                    {prize.label}
                  </span>
                </div>
              );
            })}
          </motion.div>
          
          {/* Center */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-lg">
            <Sparkles size={24} className="text-white" />
          </div>
        </div>

        {/* Result */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="mb-6 p-4 rounded-2xl bg-green-500/20 border border-green-500/30 text-center"
            >
              <p className="text-2xl mb-1">🎉</p>
              <p className="text-green-400 font-bold text-lg">+{result.coins_won} Coins!</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Spins Left */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-gray-400 text-[13px]">Drehungen übrig:</span>
          <div className="flex gap-1">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className={`w-6 h-6 rounded-full ${
                  i <= spinsLeft ? "bg-purple-500" : "bg-white/10"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Spin Button */}
        <motion.button
          onClick={spin}
          disabled={spinning || spinsLeft <= 0}
          className={`px-12 py-4 rounded-2xl font-bold text-lg flex items-center gap-3 ${
            spinsLeft > 0 && !spinning
              ? "bg-gradient-to-r from-yellow-500 to-orange-500 text-black"
              : "bg-gray-700 text-gray-500"
          }`}
          whileTap={spinsLeft > 0 && !spinning ? { scale: 0.95 } : {}}
        >
          {spinning ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              Dreht...
            </>
          ) : spinsLeft <= 0 ? (
            <>
              <Lock size={20} />
              Morgen wieder
            </>
          ) : (
            <>
              <Play size={20} />
              DREHEN!
            </>
          )}
        </motion.button>
      </div>
    </GameWrapper>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// SCRATCH CARD GAME
// ═══════════════════════════════════════════════════════════════════════════════

const ScratchGame = ({ onBack, userCoins, onCoinsUpdate }) => {
  const [scratched, setScratched] = useState(Array(9).fill(false));
  const [prize, setPrize] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [cardValues, setCardValues] = useState([]);

  useEffect(() => {
    generateCard();
  }, []);

  const generateCard = () => {
    // Generate 9 values with possible matches
    const prizes = [10, 25, 50, 100, 250, 500];
    const winPrize = prizes[Math.floor(Math.random() * prizes.length)];
    const isWinner = Math.random() > 0.5;
    
    let values = [];
    if (isWinner) {
      // 3 matching values
      const positions = [0, 1, 2, 3, 4, 5, 6, 7, 8].sort(() => Math.random() - 0.5).slice(0, 3);
      for (let i = 0; i < 9; i++) {
        if (positions.includes(i)) {
          values.push(winPrize);
        } else {
          values.push(prizes[Math.floor(Math.random() * prizes.length)]);
        }
      }
      setPrize(winPrize);
    } else {
      // Random non-matching
      for (let i = 0; i < 9; i++) {
        values.push(prizes[Math.floor(Math.random() * prizes.length)]);
      }
      setPrize(0);
    }
    setCardValues(values);
    setScratched(Array(9).fill(false));
    setRevealed(false);
  };

  const scratch = (index) => {
    if (revealed) return;
    const newScratched = [...scratched];
    newScratched[index] = true;
    setScratched(newScratched);
    
    // Check if all scratched
    if (newScratched.filter(Boolean).length >= 5) {
      setRevealed(true);
      if (prize > 0) {
        // Save win
        fetch(`${API_URL}/api/gaming/scratch/win`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ bet: 10, points_won: prize }),
        }).then(() => onCoinsUpdate?.());
      }
    }
  };

  const revealAll = () => {
    setScratched(Array(9).fill(true));
    setRevealed(true);
    if (prize > 0) {
      fetch(`${API_URL}/api/gaming/scratch/win`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ bet: 10, points_won: prize }),
      }).then(() => onCoinsUpdate?.());
    }
  };

  return (
    <GameWrapper title="Rubbellos" icon="🎫" onBack={onBack} points={userCoins}>
      <div className="flex flex-col items-center py-6">
        <p className="text-gray-400 text-[13px] mb-4">Kratze 3 gleiche Symbole frei!</p>
        
        {/* Scratch Card */}
        <div className="grid grid-cols-3 gap-2 mb-6 p-4 rounded-2xl bg-gradient-to-br from-red-500/20 to-pink-500/10 border border-red-500/30">
          {cardValues.map((value, i) => (
            <motion.button
              key={i}
              onClick={() => scratch(i)}
              className={`w-20 h-20 rounded-xl flex items-center justify-center text-2xl font-bold ${
                scratched[i]
                  ? "bg-white/10"
                  : "bg-gradient-to-br from-gray-600 to-gray-700 cursor-pointer"
              }`}
              whileTap={!scratched[i] ? { scale: 0.9 } : {}}
            >
              {scratched[i] ? (
                <span className="text-yellow-400">{value}</span>
              ) : (
                <span className="text-gray-500">?</span>
              )}
            </motion.button>
          ))}
        </div>

        {/* Result */}
        {revealed && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className={`mb-6 p-4 rounded-2xl text-center ${
              prize > 0
                ? "bg-green-500/20 border border-green-500/30"
                : "bg-red-500/20 border border-red-500/30"
            }`}
          >
            {prize > 0 ? (
              <>
                <p className="text-2xl mb-1">🎉</p>
                <p className="text-green-400 font-bold text-lg">+{prize} Coins!</p>
              </>
            ) : (
              <>
                <p className="text-2xl mb-1">😔</p>
                <p className="text-red-400 font-bold">Leider kein Gewinn</p>
              </>
            )}
          </motion.div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          {!revealed && (
            <motion.button
              onClick={revealAll}
              className="px-6 py-3 rounded-xl bg-white/10 text-white font-semibold"
              whileTap={{ scale: 0.95 }}
            >
              Alles aufdecken
            </motion.button>
          )}
          <motion.button
            onClick={generateCard}
            className="px-6 py-3 rounded-xl bg-red-500 text-white font-bold flex items-center gap-2"
            whileTap={{ scale: 0.95 }}
          >
            <RefreshCw size={16} />
            Neues Los
          </motion.button>
        </div>
      </div>
    </GameWrapper>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// SLOTS GAME
// ═══════════════════════════════════════════════════════════════════════════════

const SlotsGame = ({ onBack, userCoins, onCoinsUpdate }) => {
  const SYMBOLS = ["🍒", "🍋", "🍊", "🍇", "⭐", "💎", "7️⃣"];
  const [reels, setReels] = useState(["🍒", "🍋", "🍊"]);
  const [spinning, setSpinning] = useState(false);
  const [win, setWin] = useState(null);

  const spin = async () => {
    if (spinning) return;
    setSpinning(true);
    setWin(null);

    // Animate reels
    let spins = 0;
    const interval = setInterval(() => {
      setReels([
        SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
        SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
        SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
      ]);
      spins++;
      if (spins >= 20) {
        clearInterval(interval);
        
        // Final result
        const finalReels = [
          SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
          SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
          SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
        ];
        setReels(finalReels);
        
        // Check win
        if (finalReels[0] === finalReels[1] && finalReels[1] === finalReels[2]) {
          const multiplier = finalReels[0] === "7️⃣" ? 100 : finalReels[0] === "💎" ? 50 : 25;
          setWin(multiplier * 10);
          fetch(`${API_URL}/api/gaming/slots/win`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ bet: 10, points_won: multiplier * 10 }),
          }).then(() => onCoinsUpdate?.());
        } else if (finalReels[0] === finalReels[1] || finalReels[1] === finalReels[2]) {
          setWin(10);
          fetch(`${API_URL}/api/gaming/slots/win`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ bet: 10, points_won: 10 }),
          }).then(() => onCoinsUpdate?.());
        }
        
        setSpinning(false);
      }
    }, 100);
  };

  return (
    <GameWrapper title="Lucky Slots" icon="🎰" onBack={onBack} points={userCoins}>
      <div className="flex flex-col items-center py-6">
        {/* Slot Machine */}
        <div className="p-6 rounded-3xl bg-gradient-to-b from-purple-900/50 to-purple-800/30 border-4 border-yellow-500/50 mb-6">
          <div className="flex gap-3 mb-4">
            {reels.map((symbol, i) => (
              <motion.div
                key={i}
                className="w-20 h-24 rounded-xl bg-white flex items-center justify-center text-5xl shadow-inner"
                animate={spinning ? { y: [0, -10, 0] } : {}}
                transition={{ duration: 0.1, repeat: spinning ? Infinity : 0 }}
              >
                {symbol}
              </motion.div>
            ))}
          </div>
          
          {/* Win Line */}
          <div className="h-1 bg-yellow-500/50 rounded-full" />
        </div>

        {/* Result */}
        <AnimatePresence>
          {win && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="mb-6 p-4 rounded-2xl bg-green-500/20 border border-green-500/30 text-center"
            >
              <p className="text-3xl mb-1">🎉</p>
              <p className="text-green-400 font-bold text-xl">JACKPOT!</p>
              <p className="text-green-400 font-bold text-lg">+{win} Coins!</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Spin Button */}
        <motion.button
          onClick={spin}
          disabled={spinning}
          className={`px-12 py-4 rounded-2xl font-bold text-lg ${
            spinning
              ? "bg-gray-700 text-gray-500"
              : "bg-gradient-to-r from-purple-500 to-pink-500 text-white"
          }`}
          whileTap={!spinning ? { scale: 0.95 } : {}}
        >
          {spinning ? "Dreht..." : "🎰 SPIN!"}
        </motion.button>

        {/* Paytable */}
        <div className="mt-6 p-4 rounded-xl bg-white/5 w-full max-w-xs">
          <p className="text-[11px] text-gray-500 uppercase mb-2">Gewinntabelle</p>
          <div className="space-y-1 text-[12px]">
            <div className="flex justify-between"><span>7️⃣ 7️⃣ 7️⃣</span><span className="text-yellow-400">1000 Coins</span></div>
            <div className="flex justify-between"><span>💎 💎 💎</span><span className="text-yellow-400">500 Coins</span></div>
            <div className="flex justify-between"><span>3 Gleiche</span><span className="text-yellow-400">250 Coins</span></div>
            <div className="flex justify-between"><span>2 Gleiche</span><span className="text-yellow-400">10 Coins</span></div>
          </div>
        </div>
      </div>
    </GameWrapper>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// QUIZ GAME
// ═══════════════════════════════════════════════════════════════════════════════

const QuizGame = ({ onBack, userCoins, onCoinsUpdate }) => {
  const QUESTIONS = [
    { q: "Was ist die Hauptstadt von Deutschland?", answers: ["Berlin", "München", "Hamburg", "Köln"], correct: 0 },
    { q: "Wie viele Planeten hat unser Sonnensystem?", answers: ["7", "8", "9", "10"], correct: 1 },
    { q: "In welchem Jahr fiel die Berliner Mauer?", answers: ["1987", "1988", "1989", "1990"], correct: 2 },
    { q: "Was ist H2O?", answers: ["Sauerstoff", "Wasser", "Wasserstoff", "Kohlendioxid"], correct: 1 },
    { q: "Wie heißt die größte Wüste der Welt?", answers: ["Sahara", "Gobi", "Antarktis", "Kalahari"], correct: 2 },
  ];

  const [currentQ, setCurrentQ] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [gameOver, setGameOver] = useState(false);

  const selectAnswer = (idx) => {
    if (selected !== null) return;
    setSelected(idx);
    
    if (idx === QUESTIONS[currentQ].correct) {
      setScore(score + 20);
    }
    
    setTimeout(() => {
      if (currentQ < QUESTIONS.length - 1) {
        setCurrentQ(currentQ + 1);
        setSelected(null);
      } else {
        setGameOver(true);
        const finalScore = score + (idx === QUESTIONS[currentQ].correct ? 20 : 0);
        fetch(`${API_URL}/api/gaming/quiz/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ bet: 10, points_won: finalScore }),
        }).then(() => onCoinsUpdate?.());
      }
    }, 1000);
  };

  const restart = () => {
    setCurrentQ(0);
    setScore(0);
    setSelected(null);
    setGameOver(false);
  };

  const q = QUESTIONS[currentQ];

  return (
    <GameWrapper title="Quiz Master" icon="🧠" onBack={onBack} points={userCoins}>
      <div className="p-4">
        {gameOver ? (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center py-8"
          >
            <p className="text-5xl mb-4">🏆</p>
            <p className="text-2xl font-bold text-white mb-2">Quiz beendet!</p>
            <p className="text-yellow-400 font-bold text-3xl mb-6">+{score} Coins</p>
            <motion.button
              onClick={restart}
              className="px-8 py-3 rounded-xl bg-blue-500 text-white font-bold"
              whileTap={{ scale: 0.95 }}
            >
              Nochmal spielen
            </motion.button>
          </motion.div>
        ) : (
          <>
            {/* Progress */}
            <div className="flex gap-1 mb-6">
              {QUESTIONS.map((_, i) => (
                <div
                  key={i}
                  className={`flex-1 h-1.5 rounded-full ${
                    i < currentQ ? "bg-green-500" : i === currentQ ? "bg-blue-500" : "bg-white/10"
                  }`}
                />
              ))}
            </div>

            {/* Question */}
            <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 mb-6">
              <p className="text-[11px] text-blue-400 mb-2">Frage {currentQ + 1}/{QUESTIONS.length}</p>
              <p className="text-[16px] font-semibold text-white">{q.q}</p>
            </div>

            {/* Answers */}
            <div className="space-y-2">
              {q.answers.map((answer, i) => {
                const isCorrect = i === q.correct;
                const isSelected = selected === i;
                const showCorrectness = selected !== null;
                
                return (
                  <motion.button
                    key={i}
                    onClick={() => selectAnswer(i)}
                    disabled={selected !== null}
                    className={`w-full p-4 rounded-xl text-left font-medium transition-colors ${
                      showCorrectness
                        ? isCorrect
                          ? "bg-green-500/20 border-2 border-green-500"
                          : isSelected
                          ? "bg-red-500/20 border-2 border-red-500"
                          : "bg-white/5 border border-white/10"
                        : "bg-white/5 border border-white/10 hover:border-blue-500/50"
                    }`}
                    whileTap={selected === null ? { scale: 0.98 } : {}}
                  >
                    <span className={showCorrectness && isCorrect ? "text-green-400" : "text-white"}>
                      {answer}
                    </span>
                  </motion.button>
                );
              })}
            </div>

            {/* Score */}
            <div className="mt-6 text-center">
              <p className="text-gray-400 text-[13px]">Aktuelle Coins: <span className="text-yellow-400 font-bold">{score}</span></p>
            </div>
          </>
        )}
      </div>
    </GameWrapper>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MEMORY GAME
// ═══════════════════════════════════════════════════════════════════════════════

const MemoryGame = ({ onBack, userCoins, onCoinsUpdate }) => {
  const EMOJIS = ["🍎", "🍊", "🍋", "🍇", "🍓", "🍒", "🥝", "🍑"];
  const [cards, setCards] = useState([]);
  const [flipped, setFlipped] = useState([]);
  const [matched, setMatched] = useState([]);
  const [moves, setMoves] = useState(0);
  const [gameOver, setGameOver] = useState(false);

  useEffect(() => {
    initGame();
  }, []);

  const initGame = () => {
    const pairs = [...EMOJIS, ...EMOJIS];
    const shuffled = pairs.sort(() => Math.random() - 0.5);
    setCards(shuffled);
    setFlipped([]);
    setMatched([]);
    setMoves(0);
    setGameOver(false);
  };

  const flipCard = (index) => {
    if (flipped.length === 2 || flipped.includes(index) || matched.includes(index)) return;
    
    const newFlipped = [...flipped, index];
    setFlipped(newFlipped);
    
    if (newFlipped.length === 2) {
      setMoves(moves + 1);
      
      if (cards[newFlipped[0]] === cards[newFlipped[1]]) {
        // Match!
        setMatched([...matched, ...newFlipped]);
        setFlipped([]);
        
        // Check game over
        if (matched.length + 2 === cards.length) {
          setGameOver(true);
          const points = Math.max(10, 100 - moves * 2);
          fetch(`${API_URL}/api/gaming/memory/complete`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ bet: 10, points_won: points, moves }),
          }).then(() => onCoinsUpdate?.());
        }
      } else {
        // No match
        setTimeout(() => setFlipped([]), 1000);
      }
    }
  };

  return (
    <GameWrapper title="Memory" icon="🃏" onBack={onBack} points={userCoins}>
      <div className="p-4">
        {/* Stats */}
        <div className="flex justify-between mb-4">
          <span className="text-gray-400 text-[13px]">Züge: <span className="text-white font-bold">{moves}</span></span>
          <span className="text-gray-400 text-[13px]">Paare: <span className="text-green-400 font-bold">{matched.length / 2}/{EMOJIS.length}</span></span>
        </div>

        {gameOver ? (
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className="text-center py-8"
          >
            <p className="text-5xl mb-4">🎉</p>
            <p className="text-2xl font-bold text-white mb-2">Geschafft!</p>
            <p className="text-gray-400 mb-2">In {moves} Zügen</p>
            <p className="text-yellow-400 font-bold text-2xl mb-6">+{Math.max(10, 100 - moves * 2)} Coins</p>
            <motion.button
              onClick={initGame}
              className="px-8 py-3 rounded-xl bg-green-500 text-white font-bold"
              whileTap={{ scale: 0.95 }}
            >
              Nochmal spielen
            </motion.button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {cards.map((emoji, i) => {
              const isFlipped = flipped.includes(i) || matched.includes(i);
              return (
                <motion.button
                  key={i}
                  onClick={() => flipCard(i)}
                  className={`aspect-square rounded-xl flex items-center justify-center text-3xl ${
                    matched.includes(i)
                      ? "bg-green-500/20 border-2 border-green-500"
                      : isFlipped
                      ? "bg-white/10"
                      : "bg-gradient-to-br from-green-600 to-green-700"
                  }`}
                  whileTap={{ scale: 0.9 }}
                >
                  {isFlipped ? emoji : "❓"}
                </motion.button>
              );
            })}
          </div>
        )}
      </div>
    </GameWrapper>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// DICE GAME
// ═══════════════════════════════════════════════════════════════════════════════

const DiceGame = ({ onBack, userCoins, onCoinsUpdate }) => {
  const [dice, setDice] = useState([1, 1]);
  const [rolling, setRolling] = useState(false);
  const [bet, setBet] = useState("over7");
  const [result, setResult] = useState(null);

  const BETS = [
    { id: "over7", label: "Über 7", multiplier: 2 },
    { id: "under7", label: "Unter 7", multiplier: 2 },
    { id: "exact7", label: "Genau 7", multiplier: 5 },
    { id: "doubles", label: "Pasch", multiplier: 6 },
  ];

  const rollDice = async () => {
    if (rolling) return;
    setRolling(true);
    setResult(null);

    // Animate dice
    let rolls = 0;
    const interval = setInterval(() => {
      setDice([
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
      ]);
      rolls++;
      if (rolls >= 15) {
        clearInterval(interval);
        
        // Final result
        const d1 = Math.floor(Math.random() * 6) + 1;
        const d2 = Math.floor(Math.random() * 6) + 1;
        setDice([d1, d2]);
        
        const sum = d1 + d2;
        const isDoubles = d1 === d2;
        
        // Check win
        let won = false;
        let winAmount = 0;
        const betConfig = BETS.find(b => b.id === bet);
        
        if (bet === "over7" && sum > 7) won = true;
        if (bet === "under7" && sum < 7) won = true;
        if (bet === "exact7" && sum === 7) won = true;
        if (bet === "doubles" && isDoubles) won = true;
        
        if (won) {
          winAmount = 10 * betConfig.multiplier;
        }
        
        setResult({ won, amount: winAmount, sum, isDoubles });
        setRolling(false);
        
        if (won) {
          fetch(`${API_URL}/api/gaming/dice/win`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ bet: 10, points_won: winAmount }),
          }).then(() => onCoinsUpdate?.());
        }
      }
    }, 100);
  };

  const DICE_FACES = {
    1: "⚀", 2: "⚁", 3: "⚂", 4: "⚃", 5: "⚄", 6: "⚅"
  };

  return (
    <GameWrapper title="Würfelglück" icon="🎲" onBack={onBack} points={userCoins}>
      <div className="flex flex-col items-center py-6">
        {/* Dice */}
        <div className="flex gap-4 mb-6">
          {dice.map((d, i) => (
            <motion.div
              key={i}
              className="w-20 h-20 rounded-xl bg-white flex items-center justify-center text-5xl shadow-lg"
              animate={rolling ? { rotate: [0, 360], scale: [1, 1.1, 1] } : {}}
              transition={{ duration: 0.3, repeat: rolling ? Infinity : 0 }}
            >
              {DICE_FACES[d]}
            </motion.div>
          ))}
        </div>

        {/* Sum Display */}
        <div className="mb-6 text-center">
          <p className="text-gray-400 text-[13px]">Summe</p>
          <p className="text-3xl font-bold text-white">{dice[0] + dice[1]}</p>
        </div>

        {/* Bet Selection */}
        <div className="grid grid-cols-2 gap-2 w-full max-w-xs mb-6">
          {BETS.map((b) => (
            <motion.button
              key={b.id}
              onClick={() => setBet(b.id)}
              className={`p-3 rounded-xl text-center ${
                bet === b.id
                  ? "bg-red-500/20 border-2 border-red-500"
                  : "bg-white/5 border border-white/10"
              }`}
              whileTap={{ scale: 0.95 }}
            >
              <p className="text-[13px] font-semibold text-white">{b.label}</p>
              <p className="text-[11px] text-yellow-400">x{b.multiplier}</p>
            </motion.button>
          ))}
        </div>

        {/* Result */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className={`mb-6 p-4 rounded-2xl text-center ${
                result.won
                  ? "bg-green-500/20 border border-green-500/30"
                  : "bg-red-500/20 border border-red-500/30"
              }`}
            >
              {result.won ? (
                <>
                  <p className="text-2xl mb-1">🎉</p>
                  <p className="text-green-400 font-bold">+{result.amount} Coins!</p>
                </>
              ) : (
                <>
                  <p className="text-2xl mb-1">😔</p>
                  <p className="text-red-400">Leider verloren</p>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Roll Button */}
        <motion.button
          onClick={rollDice}
          disabled={rolling}
          className={`px-12 py-4 rounded-2xl font-bold text-lg ${
            rolling
              ? "bg-gray-700 text-gray-500"
              : "bg-gradient-to-r from-red-500 to-orange-500 text-white"
          }`}
          whileTap={!rolling ? { scale: 0.95 } : {}}
        >
          {rolling ? "Würfelt..." : "🎲 WÜRFELN!"}
        </motion.button>
      </div>
    </GameWrapper>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// GAME WRAPPER
// ═══════════════════════════════════════════════════════════════════════════════

/* ════════════════════════════════════════════
   COIN FLIP (Münzwurf)
   ════════════════════════════════════════════ */
const CoinFlipGame = ({ onBack, userCoins, onCoinsUpdate }) => {
  const [bet, setBet] = useState(10);
  const [choice, setChoice] = useState("heads");
  const [result, setResult] = useState(null);
  const [flipping, setFlipping] = useState(false);
  const [coins, setCoins] = useState(userCoins);

  const flip = async () => {
    if (flipping) return;
    setFlipping(true);
    setResult(null);
    const coinResult = Math.random() < 0.5 ? "heads" : "tails";
    const won = coinResult === choice;
    const winAmount = won ? bet * 2 : 0;

    await new Promise(r => setTimeout(r, 1500));

    try {
      const res = await fetch(`${API_URL}/api/gaming/dice/win`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bet, points_won: winAmount }),
      });
      const data = await res.json();
      if (res.ok) {
        setCoins(data.new_balance);
        setResult({ coinResult, won, winAmount: data.coins_won, net: data.net });
      } else { alert(data.detail || "Fehler"); }
    } catch (err) { alert("Fehler"); }
    setFlipping(false);
  };

  return (
    <GameWrapper title="Münzwurf" icon="🪙" onBack={() => { onCoinsUpdate(); onBack(); }} points={coins}>
      <div className="px-4 pt-6 flex flex-col items-center">
        <div className="flex gap-3 mb-6">
          {["heads", "tails"].map(c => (
            <motion.button key={c} whileTap={{ scale: 0.95 }}
              onClick={() => setChoice(c)}
              className={`px-6 py-3 rounded-xl text-sm font-bold ${choice === c ? "bg-yellow-500 text-black" : "bg-white/5 text-white/60 border border-white/10"}`}>
              {c === "heads" ? "Kopf" : "Zahl"}
            </motion.button>
          ))}
        </div>

        <motion.div className="w-32 h-32 rounded-full flex items-center justify-center text-6xl mb-6"
          style={{ background: "linear-gradient(135deg, #FFD700 0%, #FFA500 100%)", boxShadow: "0 8px 32px rgba(255,215,0,0.3)" }}
          animate={flipping ? { rotateY: [0, 1800] } : {}}
          transition={{ duration: 1.5 }}>
          {result ? (result.coinResult === "heads" ? "👑" : "🔢") : "🪙"}
        </motion.div>

        {result && (
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
            className={`text-center mb-6 p-4 rounded-2xl ${result.won ? "bg-green-500/10 border border-green-500/20" : "bg-red-500/10 border border-red-500/20"}`}>
            <p className="text-2xl font-bold mb-1">{result.won ? "Gewonnen!" : "Verloren!"}</p>
            <p className={`text-lg font-bold ${result.won ? "text-green-400" : "text-red-400"}`}>
              {result.won ? `+${result.winAmount} Coins` : `-${bet} Coins`}
            </p>
          </motion.div>
        )}

        <div className="flex items-center gap-3 mb-4">
          <span className="text-xs text-gray-500">Einsatz:</span>
          {[10, 25, 50, 100].map(b => (
            <motion.button key={b} whileTap={{ scale: 0.9 }}
              onClick={() => setBet(b)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold ${bet === b ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30" : "bg-white/5 text-white/40"}`}>
              {b}
            </motion.button>
          ))}
        </div>

        <motion.button whileTap={{ scale: 0.95 }} onClick={flip} disabled={flipping || coins < bet}
          className="w-full max-w-xs py-4 rounded-2xl bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-bold text-lg flex items-center justify-center gap-2 disabled:opacity-50">
          {flipping ? <Loader2 size={20} className="animate-spin" /> : "🪙 WERFEN!"}
        </motion.button>
      </div>
    </GameWrapper>
  );
};

/* ════════════════════════════════════════════
   HIGHER / LOWER
   ════════════════════════════════════════════ */
const HighLowGame = ({ onBack, userCoins, onCoinsUpdate }) => {
  const [bet, setBet] = useState(10);
  const [currentCard, setCurrentCard] = useState(Math.floor(Math.random() * 13) + 1);
  const [streak, setStreak] = useState(0);
  const [result, setResult] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [coins, setCoins] = useState(userCoins);

  const cardName = (v) => v === 1 ? "A" : v === 11 ? "J" : v === 12 ? "Q" : v === 13 ? "K" : String(v);

  const guess = async (higher) => {
    if (playing) return;
    setPlaying(true);
    const nextCard = Math.floor(Math.random() * 13) + 1;
    const correct = higher ? nextCard >= currentCard : nextCard <= currentCard;
    const newStreak = correct ? streak + 1 : 0;
    const winAmount = correct ? bet * (1 + newStreak * 0.5) : 0;

    await new Promise(r => setTimeout(r, 800));

    try {
      const res = await fetch(`${API_URL}/api/gaming/dice/win`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bet: correct ? 0 : bet, points_won: Math.round(winAmount) }),
      });
      const data = await res.json();
      if (res.ok) setCoins(data.new_balance);
    } catch (err) {}

    setResult({ nextCard, correct, winAmount: Math.round(winAmount) });
    setCurrentCard(nextCard);
    setStreak(newStreak);
    setPlaying(false);
  };

  return (
    <GameWrapper title="Höher/Tiefer" icon="📊" onBack={() => { onCoinsUpdate(); onBack(); }} points={coins}>
      <div className="px-4 pt-6 flex flex-col items-center">
        <p className="text-xs text-gray-500 mb-2">Streak: <span className="text-yellow-400 font-bold">{streak}x</span></p>
        
        <div className="w-28 h-40 rounded-2xl bg-gradient-to-br from-white to-gray-200 flex items-center justify-center mb-6 shadow-xl">
          <span className="text-5xl font-black text-gray-800">{cardName(currentCard)}</span>
        </div>

        {result && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className={`text-center mb-4 ${result.correct ? "text-green-400" : "text-red-400"}`}>
            <p className="text-sm">{cardName(result.nextCard)} — {result.correct ? `+${result.winAmount} Coins!` : "Falsch!"}</p>
          </motion.div>
        )}

        <div className="flex gap-3 mb-4">
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => guess(true)} disabled={playing || coins < bet}
            className="px-8 py-4 rounded-2xl bg-green-500/20 text-green-400 font-bold text-lg border border-green-500/30 disabled:opacity-50">
            Höher ↑
          </motion.button>
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => guess(false)} disabled={playing || coins < bet}
            className="px-8 py-4 rounded-2xl bg-red-500/20 text-red-400 font-bold text-lg border border-red-500/30 disabled:opacity-50">
            Tiefer ↓
          </motion.button>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">Einsatz:</span>
          {[10, 25, 50, 100].map(b => (
            <motion.button key={b} whileTap={{ scale: 0.9 }} onClick={() => setBet(b)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold ${bet === b ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30" : "bg-white/5 text-white/40"}`}>
              {b}
            </motion.button>
          ))}
        </div>
      </div>
    </GameWrapper>
  );
};

/* ════════════════════════════════════════════
   MINES (Minenfeld)
   ════════════════════════════════════════════ */
const MinesGame = ({ onBack, userCoins, onCoinsUpdate }) => {
  const [bet, setBet] = useState(10);
  const [grid, setGrid] = useState([]);
  const [revealed, setRevealed] = useState([]);
  const [gameOver, setGameOver] = useState(false);
  const [multiplier, setMultiplier] = useState(1.0);
  const [coins, setCoins] = useState(userCoins);
  const [started, setStarted] = useState(false);

  const startGame = () => {
    if (coins < bet) { alert("Nicht genug Coins!"); return; }
    const newGrid = Array(16).fill(false);
    const mines = 4;
    let placed = 0;
    while (placed < mines) {
      const idx = Math.floor(Math.random() * 16);
      if (!newGrid[idx]) { newGrid[idx] = true; placed++; }
    }
    setGrid(newGrid);
    setRevealed(Array(16).fill(false));
    setGameOver(false);
    setMultiplier(1.0);
    setStarted(true);
  };

  const reveal = async (idx) => {
    if (gameOver || revealed[idx] || !started) return;
    const newRevealed = [...revealed];
    newRevealed[idx] = true;
    setRevealed(newRevealed);

    if (grid[idx]) {
      setGameOver(true);
      try {
        const res = await fetch(`${API_URL}/api/gaming/dice/win`, {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bet, points_won: 0 }),
        });
        const data = await res.json();
        if (res.ok) setCoins(data.new_balance);
      } catch (err) {}
    } else {
      setMultiplier(m => Math.round((m + 0.3) * 100) / 100);
    }
  };

  const cashOut = async () => {
    const winAmount = Math.round(bet * multiplier);
    try {
      const res = await fetch(`${API_URL}/api/gaming/dice/win`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bet: 0, points_won: winAmount }),
      });
      const data = await res.json();
      if (res.ok) setCoins(data.new_balance);
    } catch (err) {}
    setGameOver(true);
  };

  return (
    <GameWrapper title="Minenfeld" icon="💣" onBack={() => { onCoinsUpdate(); onBack(); }} points={coins}>
      <div className="px-4 pt-4">
        {!started ? (
          <div className="text-center py-10">
            <p className="text-gray-400 mb-4">Wähle Felder ohne Minen! Je mehr du aufdeckst, desto höher der Gewinn.</p>
            <div className="flex items-center justify-center gap-3 mb-6">
              {[10, 25, 50, 100].map(b => (
                <motion.button key={b} whileTap={{ scale: 0.9 }} onClick={() => setBet(b)}
                  className={`px-4 py-2 rounded-xl text-sm font-bold ${bet === b ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30" : "bg-white/5 text-white/40"}`}>
                  {b}
                </motion.button>
              ))}
            </div>
            <motion.button whileTap={{ scale: 0.95 }} onClick={startGame}
              className="px-8 py-4 rounded-2xl bg-gradient-to-r from-gray-500 to-gray-600 text-white font-bold text-lg">
              Spiel starten ({bet} Coins)
            </motion.button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-gray-400">Multiplikator: <span className="text-yellow-400 font-bold">{multiplier.toFixed(1)}x</span></span>
              <span className="text-sm text-green-400 font-bold">Gewinn: {Math.round(bet * multiplier)} Coins</span>
            </div>
            <div className="grid grid-cols-4 gap-2 mb-4">
              {grid.map((isMine, idx) => (
                <motion.button key={idx} whileTap={{ scale: 0.9 }}
                  onClick={() => reveal(idx)}
                  disabled={gameOver || revealed[idx]}
                  className={`aspect-square rounded-xl text-2xl flex items-center justify-center font-bold ${
                    revealed[idx]
                      ? isMine ? "bg-red-500/30 border border-red-500/50" : "bg-green-500/20 border border-green-500/30"
                      : "bg-white/5 border border-white/10 hover:bg-white/10"
                  } disabled:cursor-default`}>
                  {revealed[idx] ? (isMine ? "💣" : "💎") : gameOver && isMine ? "💣" : ""}
                </motion.button>
              ))}
            </div>
            {!gameOver && multiplier > 1 && (
              <motion.button whileTap={{ scale: 0.95 }} onClick={cashOut}
                className="w-full py-4 rounded-2xl bg-green-500 text-black font-bold text-lg">
                Auszahlen: {Math.round(bet * multiplier)} Coins
              </motion.button>
            )}
            {gameOver && (
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => setStarted(false)}
                className="w-full py-4 rounded-2xl bg-white/10 text-white font-bold text-lg mt-2">
                Neues Spiel
              </motion.button>
            )}
          </>
        )}
      </div>
    </GameWrapper>
  );
};

/* ════════════════════════════════════════════
   CRASH
   ════════════════════════════════════════════ */
const CrashGame = ({ onBack, userCoins, onCoinsUpdate }) => {
  const [bet, setBet] = useState(10);
  const [multiplier, setMultiplier] = useState(1.0);
  const [crashed, setCrashed] = useState(false);
  const [cashedOut, setCashedOut] = useState(false);
  const [running, setRunning] = useState(false);
  const [coins, setCoins] = useState(userCoins);
  const [crashPoint] = useState(() => 1 + Math.random() * 4);

  const start = () => {
    if (coins < bet) { alert("Nicht genug Coins!"); return; }
    setMultiplier(1.0);
    setCrashed(false);
    setCashedOut(false);
    setRunning(true);
  };

  useEffect(() => {
    if (!running || crashed || cashedOut) return;
    const iv = setInterval(() => {
      setMultiplier(m => {
        const next = Math.round((m + 0.05) * 100) / 100;
        if (next >= crashPoint) {
          setCrashed(true);
          setRunning(false);
          // Record loss
          fetch(`${API_URL}/api/gaming/dice/win`, {
            method: "POST", credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bet, points_won: 0 }),
          }).then(r => r.json()).then(d => { if (d.new_balance !== undefined) setCoins(d.new_balance); });
          clearInterval(iv);
          return next;
        }
        return next;
      });
    }, 100);
    return () => clearInterval(iv);
  }, [running, crashed, cashedOut]);

  const cashOut = async () => {
    setCashedOut(true);
    setRunning(false);
    const winAmount = Math.round(bet * multiplier);
    try {
      const res = await fetch(`${API_URL}/api/gaming/dice/win`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bet: 0, points_won: winAmount }),
      });
      const data = await res.json();
      if (res.ok) setCoins(data.new_balance);
    } catch (err) {}
  };

  return (
    <GameWrapper title="Crash" icon="📈" onBack={() => { onCoinsUpdate(); onBack(); }} points={coins}>
      <div className="px-4 pt-6 flex flex-col items-center">
        <div className="w-full max-w-sm h-48 rounded-2xl bg-[#111118] border border-white/5 flex items-center justify-center mb-6 relative overflow-hidden">
          <div className="absolute inset-0" style={{
            background: crashed ? "radial-gradient(circle, rgba(255,0,0,0.1) 0%, transparent 70%)"
              : cashedOut ? "radial-gradient(circle, rgba(0,255,100,0.1) 0%, transparent 70%)"
              : "radial-gradient(circle, rgba(0,194,255,0.05) 0%, transparent 70%)"
          }} />
          <div className="text-center">
            <motion.p className={`text-5xl font-black font-mono ${crashed ? "text-red-500" : cashedOut ? "text-green-400" : "text-white"}`}
              animate={running ? { scale: [1, 1.02, 1] } : {}}
              transition={{ duration: 0.3, repeat: running ? Infinity : 0 }}>
              {multiplier.toFixed(2)}x
            </motion.p>
            {crashed && <p className="text-red-400 text-sm mt-2 font-bold">CRASHED!</p>}
            {cashedOut && <p className="text-green-400 text-sm mt-2 font-bold">+{Math.round(bet * multiplier)} Coins!</p>}
          </div>
        </div>

        <div className="flex items-center gap-3 mb-4">
          {[10, 25, 50, 100].map(b => (
            <motion.button key={b} whileTap={{ scale: 0.9 }} onClick={() => !running && setBet(b)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold ${bet === b ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30" : "bg-white/5 text-white/40"}`}>
              {b}
            </motion.button>
          ))}
        </div>

        {!running && !cashedOut && !crashed ? (
          <motion.button whileTap={{ scale: 0.95 }} onClick={start} disabled={coins < bet}
            className="w-full max-w-xs py-4 rounded-2xl bg-gradient-to-r from-pink-500 to-red-500 text-white font-bold text-lg disabled:opacity-50">
            Start ({bet} Coins)
          </motion.button>
        ) : running ? (
          <motion.button whileTap={{ scale: 0.95 }} onClick={cashOut}
            className="w-full max-w-xs py-4 rounded-2xl bg-green-500 text-black font-bold text-lg"
            animate={{ scale: [1, 1.03, 1] }} transition={{ duration: 0.5, repeat: Infinity }}>
            CASH OUT ({Math.round(bet * multiplier)} Coins)
          </motion.button>
        ) : (
          <motion.button whileTap={{ scale: 0.95 }} onClick={start} disabled={coins < bet}
            className="w-full max-w-xs py-4 rounded-2xl bg-white/10 text-white font-bold text-lg disabled:opacity-50">
            Nochmal
          </motion.button>
        )}
      </div>
    </GameWrapper>
  );
};

/* ════════════════════════════════════════════
   PLINKO
   ════════════════════════════════════════════ */
const PlinkoGame = ({ onBack, userCoins, onCoinsUpdate }) => {
  const [bet, setBet] = useState(10);
  const [result, setResult] = useState(null);
  const [dropping, setDropping] = useState(false);
  const [coins, setCoins] = useState(userCoins);
  const multipliers = [0, 0.5, 1, 1.5, 3, 1.5, 1, 0.5, 0];

  const drop = async () => {
    if (dropping || coins < bet) return;
    setDropping(true);
    setResult(null);

    await new Promise(r => setTimeout(r, 1500));

    const slotIdx = Math.floor(Math.random() * multipliers.length);
    const mult = multipliers[slotIdx];
    const winAmount = Math.round(bet * mult);

    try {
      const res = await fetch(`${API_URL}/api/gaming/dice/win`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bet: mult === 0 ? bet : 0, points_won: winAmount }),
      });
      const data = await res.json();
      if (res.ok) setCoins(data.new_balance);
      setResult({ slotIdx, mult, winAmount: data.coins_won || winAmount });
    } catch (err) {}
    setDropping(false);
  };

  return (
    <GameWrapper title="Plinko" icon="🔴" onBack={() => { onCoinsUpdate(); onBack(); }} points={coins}>
      <div className="px-4 pt-6 flex flex-col items-center">
        {/* Peg board visual */}
        <div className="w-full max-w-sm mb-4">
          {[3, 4, 5, 6, 7].map((count, row) => (
            <div key={row} className="flex justify-center gap-4 mb-2">
              {Array(count).fill(0).map((_, i) => (
                <div key={i} className="w-3 h-3 rounded-full bg-white/20" />
              ))}
            </div>
          ))}
        </div>

        {/* Multiplier slots */}
        <div className="flex gap-1 mb-6 w-full max-w-sm">
          {multipliers.map((m, i) => (
            <div key={i} className={`flex-1 py-3 rounded-lg text-center text-xs font-bold transition-all ${
              result?.slotIdx === i ? "bg-yellow-500 text-black scale-110" : m >= 3 ? "bg-red-500/20 text-red-400" : m >= 1.5 ? "bg-orange-500/20 text-orange-400" : m >= 1 ? "bg-green-500/20 text-green-400" : "bg-white/5 text-white/30"
            }`}>
              {m}x
            </div>
          ))}
        </div>

        {result && (
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
            className={`text-center mb-4 p-3 rounded-xl ${result.mult > 0 ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
            <p className="text-lg font-bold">{result.mult}x — {result.mult > 0 ? `+${result.winAmount} Coins` : "Miss!"}</p>
          </motion.div>
        )}

        <div className="flex items-center gap-3 mb-4">
          {[10, 25, 50, 100].map(b => (
            <motion.button key={b} whileTap={{ scale: 0.9 }} onClick={() => setBet(b)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold ${bet === b ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30" : "bg-white/5 text-white/40"}`}>
              {b}
            </motion.button>
          ))}
        </div>

        <motion.button whileTap={{ scale: 0.95 }} onClick={drop} disabled={dropping || coins < bet}
          className="w-full max-w-xs py-4 rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold text-lg disabled:opacity-50">
          {dropping ? <Loader2 size={20} className="animate-spin mx-auto" /> : `Drop! (${bet} Coins)`}
        </motion.button>
      </div>
    </GameWrapper>
  );
};

const GameWrapper = ({ title, icon, onBack, points, children }) => {
  return (
    <div className="min-h-screen bg-[#030303] pb-24">
      <div className="sticky top-0 z-40 px-4 py-3 bg-gradient-to-b from-[#0A0A0F] to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.button
              onClick={onBack}
              className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center"
              whileTap={{ scale: 0.9 }}
            >
              <ArrowLeft size={16} className="text-white/60" />
            </motion.button>
            <div>
              <h1 className="text-[17px] font-bold text-white flex items-center gap-2">
                <span className="text-xl">{icon}</span>
                {title}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-yellow-500/20 border border-yellow-500/30">
            <Coins size={14} className="text-yellow-400" />
            <span className="text-yellow-400 font-bold text-[13px]">{points?.toLocaleString() || 0}</span>
          </div>
        </div>
      </div>
      {children}
    </div>
  );
};

export default GamingPage;
