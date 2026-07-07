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
        data-testid={`quick-send-button-${savedRecipient.id || savedRecipient.recipient_number || savedRecipient.nickname}`}
        onClick={() => setShowAmountInput(true)}
        className="flex-1 min-w-[100px] max-w-[140px] p-4 rounded-2xl bg-white border border-slate-200 hover:border-[#00C2FF]/30 hover:shadow-[0_10px_24px_rgba(15,23,42,0.06)] active:scale-95 transition-all"
        whileTap={{ scale: 0.95 }}
      >
        <div className="text-3xl mb-2">{iconMap[savedRecipient.icon]}</div>
        <p className="text-sm font-bold text-slate-900 truncate">{savedRecipient.nickname}</p>
        <p className="text-xs text-slate-500 mt-1">Schnell senden</p>
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
          data-testid={`quick-send-close-${savedRecipient.id || savedRecipient.recipient_number || savedRecipient.nickname}`}
          onClick={() => setShowAmountInput(false)}
          className="w-6 h-6 rounded-full bg-white/80 flex items-center justify-center"
        >
          <X size={14} className="text-slate-500" />
        </button>
      </div>
      <input
        data-testid={`quick-send-amount-${savedRecipient.id || savedRecipient.recipient_number || savedRecipient.nickname}`}
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="€0.00"
        className="w-full px-2 py-1.5 mb-2 rounded-lg bg-white border border-slate-200 text-slate-900 text-sm placeholder-slate-400 outline-none focus:border-[#00C2FF]/50"
        autoFocus
        step="0.01"
      />
      <button
        data-testid={`quick-send-submit-${savedRecipient.id || savedRecipient.recipient_number || savedRecipient.nickname}`}
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
