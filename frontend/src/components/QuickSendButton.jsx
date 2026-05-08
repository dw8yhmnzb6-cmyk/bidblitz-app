import { useState } from "react";
import { motion } from "framer-motion";
import { Send, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

const QuickSendButton = ({ savedRecipient, onSendComplete }) => {
  const [showAmountInput, setShowAmountInput] = useState(false);
  const [amount, setAmount] = useState("");
  const [sending, setSending] = useState(false);
  
  const iconMap = {
    family: '👨‍👩‍👧',
    friend: '👤',
    work: '💼',
    star: '⭐',
    user: '👤'
  };

  const handleQuickSend = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Betrag eingeben');
      return;
    }

    setSending(true);
    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/wallet/transfer-by-number`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          recipient_number: savedRecipient.recipient_number,
          amount: parseFloat(amount)
        })
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(`€${amount} an ${savedRecipient.nickname} gesendet! 🎉`);
        setShowAmountInput(false);
        setAmount("");
        if (onSendComplete) onSendComplete(data);
      } else {
        const err = await res.json();
        toast.error(err.detail || 'Fehler beim Senden');
      }
    } catch (err) {
      toast.error('Netzwerkfehler');
    }
    setSending(false);
  };

  if (!showAmountInput) {
    return (
      <motion.button
        onClick={() => setShowAmountInput(true)}
        className="flex-1 min-w-[100px] max-w-[140px] p-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] active:scale-95 transition-all"
        whileTap={{ scale: 0.95 }}
      >
        <div className="text-3xl mb-2">{iconMap[savedRecipient.icon]}</div>
        <p className="text-sm font-bold text-white truncate">{savedRecipient.nickname}</p>
        <p className="text-xs text-white/40 mt-1">Schnell senden</p>
      </motion.button>
    );
  }

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="flex-1 min-w-[100px] max-w-[140px] p-4 rounded-2xl bg-[#00C2FF]/10 border border-[#00C2FF]/30"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl">{iconMap[savedRecipient.icon]}</span>
        <button
          onClick={() => setShowAmountInput(false)}
          className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center"
        >
          <X size={14} className="text-white/60" />
        </button>
      </div>
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="€0.00"
        className="w-full px-2 py-1.5 mb-2 rounded-lg bg-white/[0.08] border border-white/10 text-white text-sm placeholder-white/30 outline-none focus:border-[#00C2FF]/50"
        autoFocus
        step="0.01"
      />
      <button
        onClick={handleQuickSend}
        disabled={sending}
        className="w-full py-2 rounded-lg bg-[#00C2FF] text-black text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-1"
      >
        {sending ? (
          <Loader2 size={12} className="animate-spin" />
        ) : (
          <>
            <Send size={12} />
            Senden
          </>
        )}
      </button>
    </motion.div>
  );
};

export default QuickSendButton;
