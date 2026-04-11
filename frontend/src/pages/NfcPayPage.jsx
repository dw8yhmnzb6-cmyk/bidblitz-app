/**
 * BidBlitz V2 - NFC Pay Page
 * Contactless payment via QR/Barcode (NFC simulation)
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, Smartphone, Wallet, QrCode, CreditCard, 
  Check, X, Loader2, AlertCircle, Zap
} from 'lucide-react';
import { useI18n, useUser } from '../store';
import { api } from '../services/api';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

export default function NfcPayPage({ onBack }) {
  const { t } = useI18n();
  const user = useUser();
  
  const [view, setView] = useState('main'); // main, receive, send
  const [loading, setLoading] = useState(false);
  const [barcode, setBarcode] = useState(null);
  const [countdown, setCountdown] = useState(120);
  const [balance, setBalance] = useState(0);
  const [amount, setAmount] = useState('');
  const [recipientCode, setRecipientCode] = useState('');

  // Fetch balance
  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const res = await fetch(`${API}/api/wallet/balance`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setBalance(data.balance || 0);
        }
      } catch (e) {}
    };
    fetchBalance();
  }, []);

  // Generate barcode for receiving payment
  const generateBarcode = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/payments/my-barcode`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setBarcode(data);
        setCountdown(data.seconds_remaining || 120);
        setView('receive');
      } else {
        toast.error('Fehler beim Erstellen des QR-Codes');
      }
    } catch (e) {
      toast.error('Verbindungsfehler');
    }
    setLoading(false);
  };

  // Countdown timer
  useEffect(() => {
    if (view === 'receive' && countdown > 0) {
      const timer = setInterval(() => {
        setCountdown(c => {
          if (c <= 1) {
            clearInterval(timer);
            return 0;
          }
          return c - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [view, barcode]);

  // Refresh barcode
  const refreshBarcode = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/payments/refresh-barcode`, {
        method: 'POST',
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setBarcode(data);
        setCountdown(data.seconds_remaining || 120);
      }
    } catch (e) {}
    setLoading(false);
  };

  return (
    <motion.div
      data-testid="nfc-pay-page"
      className="min-h-screen"
      style={{ background: "#030303" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Header */}
      <div className="px-5 pt-[max(env(safe-area-inset-top,0px),24px)] pb-4">
        <div className="flex items-center gap-3">
          <motion.button
            data-testid="nfc-back-btn"
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.05] flex items-center justify-center"
            whileTap={{ scale: 0.9 }}
          >
            <ChevronLeft size={16} className="text-white/50" />
          </motion.button>
          <div>
            <h1 className="text-[18px] font-semibold text-white font-outfit">NFC Pay</h1>
            <p className="text-[11px] text-[#444]">Kontaktlos bezahlen</p>
          </div>
        </div>
      </div>

      <div className="px-5 pb-8">
        {/* Balance Card */}
        <motion.div
          className="rounded-2xl p-5 mb-6"
          style={{ background: "rgba(0,194,255,0.04)", border: "1px solid rgba(0,194,255,0.1)" }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-[#444] uppercase tracking-wider mb-1">Verfügbar</p>
              <p className="text-[28px] font-bold text-white font-outfit">€{balance.toFixed(2)}</p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-[#00C2FF]/10 flex items-center justify-center">
              <Wallet size={24} className="text-[#00C2FF]" />
            </div>
          </div>
        </motion.div>

        {view === 'main' && (
          <>
            {/* NFC Info */}
            <motion.div
              className="rounded-2xl p-5 mb-6 text-center"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <div className="w-20 h-20 mx-auto mb-4 rounded-3xl bg-gradient-to-br from-[#00C2FF]/20 to-[#00E89D]/20 flex items-center justify-center">
                <Smartphone size={36} className="text-[#00C2FF]" />
              </div>
              <h2 className="text-[16px] font-semibold text-white mb-2">Kontaktlos zahlen</h2>
              <p className="text-[12px] text-[#555] leading-relaxed">
                Zeige deinen QR-Code, um Zahlungen zu empfangen, oder scanne einen Code, um zu bezahlen.
              </p>
            </motion.div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <motion.button
                data-testid="nfc-receive-btn"
                onClick={generateBarcode}
                disabled={loading}
                className="rounded-2xl p-5 text-center"
                style={{ background: "rgba(0,210,106,0.06)", border: "1px solid rgba(0,210,106,0.15)" }}
                whileTap={{ scale: 0.97 }}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
              >
                <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-[#00D26A]/10 flex items-center justify-center">
                  <QrCode size={22} className="text-[#00D26A]" />
                </div>
                <p className="text-[13px] font-semibold text-white mb-1">Empfangen</p>
                <p className="text-[10px] text-[#555]">QR zeigen</p>
              </motion.button>

              <motion.button
                data-testid="nfc-send-btn"
                onClick={() => setView('send')}
                className="rounded-2xl p-5 text-center"
                style={{ background: "rgba(0,194,255,0.06)", border: "1px solid rgba(0,194,255,0.15)" }}
                whileTap={{ scale: 0.97 }}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 }}
              >
                <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-[#00C2FF]/10 flex items-center justify-center">
                  <Zap size={22} className="text-[#00C2FF]" />
                </div>
                <p className="text-[13px] font-semibold text-white mb-1">Senden</p>
                <p className="text-[10px] text-[#555]">Schnell überweisen</p>
              </motion.button>
            </div>

            {/* Fee Info */}
            <motion.div
              className="mt-6 rounded-xl p-4"
              style={{ background: "rgba(255,255,255,0.02)" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <div className="flex items-center gap-2 mb-3">
                <CreditCard size={14} className="text-[#00C2FF]" />
                <p className="text-[11px] font-semibold text-white">Gebühren</p>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-[11px]">
                  <span className="text-[#555]">NFC Wallet</span>
                  <span className="text-[#00D26A] font-semibold">0.3%</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-[#555]">QR/Barcode</span>
                  <span className="text-[#00D26A] font-semibold">0.5%</span>
                </div>
              </div>
            </motion.div>
          </>
        )}

        {view === 'receive' && barcode && (
          <motion.div
            className="rounded-2xl p-6 text-center"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <p className="text-[11px] text-[#555] mb-4">Lasse diesen Code scannen</p>
            
            {/* QR Code Display */}
            <div className="bg-white rounded-2xl p-4 inline-block mb-4">
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(barcode.barcode)}`}
                alt="Payment QR"
                className="w-48 h-48"
              />
            </div>

            <p className="text-[12px] font-mono text-[#00C2FF] mb-3">{barcode.barcode}</p>

            {/* Countdown */}
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className={`w-2 h-2 rounded-full ${countdown > 30 ? 'bg-[#00D26A]' : 'bg-[#FFB800]'} animate-pulse`} />
              <span className="text-[11px] text-[#555]">
                Gültig noch {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')}
              </span>
            </div>

            <div className="flex gap-3">
              <motion.button
                onClick={refreshBarcode}
                disabled={loading || countdown > 90}
                className="flex-1 py-3 rounded-xl text-[12px] font-semibold"
                style={{ 
                  background: countdown <= 90 ? "rgba(0,194,255,0.1)" : "rgba(255,255,255,0.03)",
                  color: countdown <= 90 ? "#00C2FF" : "#444"
                }}
                whileTap={{ scale: 0.97 }}
              >
                {loading ? <Loader2 size={14} className="animate-spin mx-auto" /> : "Erneuern"}
              </motion.button>
              <motion.button
                onClick={() => { setView('main'); setBarcode(null); }}
                className="flex-1 py-3 rounded-xl text-[12px] font-semibold"
                style={{ background: "rgba(255,255,255,0.05)", color: "#fff" }}
                whileTap={{ scale: 0.97 }}
              >
                Zurück
              </motion.button>
            </div>
          </motion.div>
        )}

        {view === 'send' && (
          <motion.div
            className="rounded-2xl p-5"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <h3 className="text-[14px] font-semibold text-white mb-4">Schnellüberweisung</h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-[11px] text-[#555] mb-2 block">Empfänger-Code</label>
                <input
                  type="text"
                  value={recipientCode}
                  onChange={(e) => setRecipientCode(e.target.value.toUpperCase())}
                  placeholder="BLZ-XXXX..."
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white text-[13px] font-mono"
                />
              </div>
              
              <div>
                <label className="text-[11px] text-[#555] mb-2 block">Betrag (EUR)</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white text-[18px] font-bold"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <motion.button
                  onClick={() => setView('main')}
                  className="flex-1 py-3 rounded-xl text-[12px] font-semibold"
                  style={{ background: "rgba(255,255,255,0.05)", color: "#fff" }}
                  whileTap={{ scale: 0.97 }}
                >
                  Abbrechen
                </motion.button>
                <motion.button
                  onClick={async () => {
                    if (!recipientCode || !amount) {
                      toast.error('Bitte alle Felder ausfüllen');
                      return;
                    }
                    setLoading(true);
                    try {
                      const res = await fetch(`${API}/api/wallet/transfer`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({
                          to_identifier: recipientCode,
                          amount: parseFloat(amount),
                          description: 'NFC Quick Transfer'
                        })
                      });
                      const data = await res.json();
                      if (res.ok && data.ok) {
                        toast.success(`€${amount} erfolgreich gesendet!`);
                        setView('main');
                        setAmount('');
                        setRecipientCode('');
                        setBalance(data.new_balance || balance - parseFloat(amount));
                      } else {
                        toast.error(data.detail || 'Überweisung fehlgeschlagen');
                      }
                    } catch (e) {
                      toast.error('Verbindungsfehler');
                    }
                    setLoading(false);
                  }}
                  disabled={loading || !amount || !recipientCode}
                  className="flex-1 py-3 rounded-xl text-[12px] font-semibold flex items-center justify-center gap-2"
                  style={{ 
                    background: "rgba(0,194,255,0.15)", 
                    color: "#00C2FF",
                    opacity: (!amount || !recipientCode) ? 0.5 : 1
                  }}
                  whileTap={{ scale: 0.97 }}
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                  Senden
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
