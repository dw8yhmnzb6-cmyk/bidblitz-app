/**
 * BidBlitz V2 - Credit Score Page
 * Shows user's credit score (A/B/C) and available credit options
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Star, TrendingUp, CreditCard, Shield, Clock,
  CheckCircle, AlertCircle, Loader2, ChevronRight, Euro,
  Calendar, Percent, Lock
} from "lucide-react";

const API_URL = process.env.REACT_APP_BACKEND_URL;

const SCORE_CONFIG = {
  A: {
    label: "Ausgezeichnet",
    color: "green",
    maxCredit: 5000,
    interestRate: 5.9,
    benefits: ["Höchster Kreditrahmen", "Niedrigste Zinsen", "Sofortige Auszahlung"],
  },
  B: {
    label: "Gut",
    color: "blue",
    maxCredit: 2000,
    interestRate: 9.9,
    benefits: ["Guter Kreditrahmen", "Faire Zinsen", "Schnelle Bearbeitung"],
  },
  C: {
    label: "Basis",
    color: "yellow",
    maxCredit: 500,
    interestRate: 14.9,
    benefits: ["Starter-Kreditrahmen", "Score aufbauen", "Flexible Rückzahlung"],
  },
};

const CreditScorePage = ({ onBack, onNavigate }) => {
  const [loading, setLoading] = useState(true);
  const [creditData, setCreditData] = useState(null);
  const [error, setError] = useState(null);
  const [showApply, setShowApply] = useState(false);
  const [applyAmount, setApplyAmount] = useState("");
  const [applyLoading, setApplyLoading] = useState(false);

  useEffect(() => {
    loadCreditData();
  }, []);

  const loadCreditData = async () => {
    try {
      const res = await fetch(`${API_URL}/api/credit/my-score`, { credentials: "include" });
      if (!res.ok) throw new Error("Fehler beim Laden");
      const data = await res.json();
      setCreditData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const applyForCredit = async () => {
    const amount = parseFloat(applyAmount);
    if (!amount || amount < 50) {
      setError("Mindestbetrag ist €50");
      return;
    }
    setApplyLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/credit/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ amount }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Antrag fehlgeschlagen");
      }
      await loadCreditData();
      setShowApply(false);
      setApplyAmount("");
    } catch (err) {
      setError(err.message);
    } finally {
      setApplyLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#030303]">
        <Loader2 size={32} className="text-cyan-400 animate-spin" />
      </div>
    );
  }

  const score = creditData?.score || "C";
  const config = SCORE_CONFIG[score];
  const hasActiveCredit = creditData?.active_credit > 0;
  const availableCredit = config.maxCredit - (creditData?.active_credit || 0);

  const scoreColors = {
    green: { bg: "bg-green-500/20", border: "border-green-500/30", text: "text-green-400" },
    blue: { bg: "bg-blue-500/20", border: "border-blue-500/30", text: "text-blue-400" },
    yellow: { bg: "bg-yellow-500/20", border: "border-yellow-500/30", text: "text-yellow-400" },
  };
  const colors = scoreColors[config.color];

  return (
    <div data-testid="credit-score-page" className="min-h-screen bg-[#030303] pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 px-4 py-3 bg-[#0A0A0F] border-b border-white/5">
        <div className="flex items-center gap-3">
          <motion.button
            onClick={onBack}
            className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center"
            whileTap={{ scale: 0.9 }}
          >
            <ArrowLeft size={16} className="text-white/60" />
          </motion.button>
          <h1 className="text-[17px] font-bold text-white">Kredit Score</h1>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2">
          <AlertCircle size={16} className="text-red-400" />
          <span className="text-sm text-red-400">{error}</span>
        </div>
      )}

      <div className="p-4 space-y-4">
        {/* Score Card */}
        <motion.div
          className={`p-6 rounded-3xl ${colors.bg} border ${colors.border} relative overflow-hidden`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/2" />
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Dein Score</p>
                <div className="flex items-center gap-3">
                  <span className={`text-6xl font-black ${colors.text}`}>{score}</span>
                  <div>
                    <p className={`text-lg font-bold ${colors.text}`}>{config.label}</p>
                    <div className="flex items-center gap-1 text-gray-400 text-xs">
                      <TrendingUp size={12} />
                      <span>+5 Punkte letzter Monat</span>
                    </div>
                  </div>
                </div>
              </div>
              <Shield size={48} className={colors.text} style={{ opacity: 0.3 }} />
            </div>

            {/* Score Bar */}
            <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-4">
              <motion.div
                className={`h-full ${config.color === "green" ? "bg-green-500" : config.color === "blue" ? "bg-blue-500" : "bg-yellow-500"}`}
                initial={{ width: 0 }}
                animate={{ width: score === "A" ? "100%" : score === "B" ? "66%" : "33%" }}
                transition={{ duration: 1, delay: 0.5 }}
              />
            </div>

            {/* Benefits */}
            <div className="space-y-2">
              {config.benefits.map((benefit, i) => (
                <div key={i} className="flex items-center gap-2">
                  <CheckCircle size={14} className={colors.text} />
                  <span className="text-sm text-white/80">{benefit}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Credit Details */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Max. Kreditrahmen</p>
            <p className="text-2xl font-bold text-white">€{config.maxCredit.toLocaleString()}</p>
          </div>
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Zinssatz</p>
            <p className="text-2xl font-bold text-cyan-400">{config.interestRate}%</p>
            <p className="text-[10px] text-gray-500">p.a.</p>
          </div>
        </div>

        {/* Active Credit */}
        {hasActiveCredit && (
          <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-purple-400">Aktiver Kredit</p>
              <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 text-[10px] font-bold">
                AKTIV
              </span>
            </div>
            <p className="text-3xl font-bold text-white mb-1">€{creditData.active_credit?.toFixed(2)}</p>
            <p className="text-xs text-gray-500">
              Fällig am: {creditData.due_date ? new Date(creditData.due_date).toLocaleDateString("de-DE") : "N/A"}
            </p>
            <motion.button
              onClick={() => onNavigate?.("/wallet")}
              className="mt-3 w-full py-2.5 bg-purple-500 text-white rounded-xl text-sm font-semibold"
              whileTap={{ scale: 0.98 }}
            >
              Jetzt zurückzahlen
            </motion.button>
          </div>
        )}

        {/* Available Credit */}
        {!showApply ? (
          <motion.button
            onClick={() => setShowApply(true)}
            disabled={availableCredit <= 0}
            className={`w-full p-4 rounded-2xl flex items-center justify-between ${
              availableCredit > 0
                ? "bg-cyan-500/10 border border-cyan-500/20"
                : "bg-white/5 border border-white/10 opacity-50"
            }`}
            whileTap={availableCredit > 0 ? { scale: 0.98 } : {}}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                <CreditCard size={24} className="text-cyan-400" />
              </div>
              <div className="text-left">
                <p className="text-[15px] font-semibold text-white">Kredit beantragen</p>
                <p className="text-xs text-gray-500">Bis zu €{availableCredit.toLocaleString()} verfügbar</p>
              </div>
            </div>
            <ChevronRight size={20} className="text-gray-500" />
          </motion.button>
        ) : (
          <motion.div
            className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 space-y-4"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
          >
            <p className="text-sm font-semibold text-cyan-400">Kreditbetrag wählen</p>
            <div className="flex gap-2">
              {[100, 250, 500].filter(a => a <= availableCredit).map((amount) => (
                <motion.button
                  key={amount}
                  onClick={() => setApplyAmount(amount.toString())}
                  className={`flex-1 py-3 rounded-xl text-sm font-semibold ${
                    applyAmount === amount.toString()
                      ? "bg-cyan-500 text-white"
                      : "bg-white/5 text-white/70"
                  }`}
                  whileTap={{ scale: 0.95 }}
                >
                  €{amount}
                </motion.button>
              ))}
            </div>
            <input
              type="number"
              value={applyAmount}
              onChange={(e) => setApplyAmount(e.target.value)}
              placeholder="Oder Betrag eingeben..."
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-gray-600 outline-none"
              max={availableCredit}
            />
            <div className="flex gap-2">
              <motion.button
                onClick={applyForCredit}
                disabled={applyLoading || !applyAmount}
                className="flex-1 py-3 bg-cyan-500 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                whileTap={{ scale: 0.98 }}
              >
                {applyLoading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                Beantragen
              </motion.button>
              <motion.button
                onClick={() => setShowApply(false)}
                className="px-4 py-3 bg-white/5 text-gray-400 rounded-xl text-sm"
                whileTap={{ scale: 0.98 }}
              >
                Abbrechen
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* Info */}
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
          <p className="text-xs text-gray-500 mb-2">So verbesserst du deinen Score:</p>
          <ul className="space-y-1 text-xs text-gray-400">
            <li>• Regelmäßige Zahlungen pünktlich leisten</li>
            <li>• Kreditrahmen verantwortungsvoll nutzen</li>
            <li>• Mindestens 3 Monate aktives Konto</li>
            <li>• Verifizierung abschließen</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default CreditScorePage;
