/**
 * BidBlitz V2 - Notification Settings Page
 * Manage Web Push subscription (VAPID) + test notification.
 */
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Bell, BellOff, CheckCircle2, Send, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export default function NotificationSettingsPage({ onNavigate }) {
  const [permission, setPermission] = useState(typeof Notification !== "undefined" ? Notification.permission : "default");
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [publicKey, setPublicKey] = useState(null);
  const [supported] = useState(
    typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      typeof Notification !== "undefined"
  );

  useEffect(() => {
    checkStatus();
    fetchPublicKey();
  }, []);

  const fetchPublicKey = async () => {
    try {
      const res = await fetch(`${API}/api/push/vapid-public-key`);
      if (res.ok) {
        const data = await res.json();
        setPublicKey(data.publicKey);
      }
    } catch (e) {}
  };

  const checkStatus = async () => {
    try {
      const res = await fetch(`${API}/api/push/subscription-status`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setSubscribed(data.subscribed);
      }
    } catch (e) {}
  };

  const enable = async () => {
    if (!supported) {
      toast.error("Push-Benachrichtigungen werden auf diesem Gerät/Browser nicht unterstützt");
      return;
    }
    if (!publicKey) {
      toast.error("Server-Schlüssel nicht verfügbar. Bitte später erneut versuchen.");
      return;
    }
    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        toast.error("Benachrichtigungen wurden blockiert. Bitte im Browser erlauben.");
        setLoading(false);
        return;
      }

      const reg = await navigator.serviceWorker.register("/push-sw.js");
      await navigator.serviceWorker.ready;

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const keys = sub.toJSON().keys;
      const res = await fetch(`${API}/api/push/subscribe`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint, keys }),
      });

      if (res.ok) {
        setSubscribed(true);
        toast.success("Push-Benachrichtigungen aktiviert");
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.detail || "Abonnement fehlgeschlagen");
      }
    } catch (e) {
      toast.error(e.message || "Fehler beim Aktivieren");
    }
    setLoading(false);
  };

  const disable = async () => {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        await fetch(`${API}/api/push/unsubscribe`, {
          method: "DELETE",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint, keys: sub.toJSON().keys }),
        });
        await sub.unsubscribe();
      }
      setSubscribed(false);
      toast.success("Push-Benachrichtigungen deaktiviert");
    } catch (e) {
      toast.error("Fehler beim Deaktivieren");
    }
    setLoading(false);
  };

  const sendTest = async () => {
    setTesting(true);
    try {
      const res = await fetch(`${API}/api/push/test`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "BidBlitz Test",
          body: "Push-Benachrichtigungen funktionieren! 🎉",
        }),
      });
      if (res.ok) {
        toast.success("Test-Benachrichtigung gesendet (kann einige Sekunden dauern)");
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.detail || "Test fehlgeschlagen");
      }
    } catch (e) { toast.error("Netzwerkfehler"); }
    setTesting(false);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-24" data-testid="notifications-page">
      <div className="sticky top-0 z-40 bg-[#0A0A0A]/95 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => onNavigate && onNavigate("/more")} className="p-2 -ml-2" data-testid="notif-back">
            <ArrowLeft size={20} className="text-white/70"/>
          </button>
          <h1 className="text-[15px] font-bold">Benachrichtigungen</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* Status Card */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-6 border border-white/10 bg-gradient-to-br from-cyan-500/5 to-blue-500/5 text-center">
          <div className={`w-16 h-16 mx-auto mb-3 rounded-full flex items-center justify-center ${subscribed ? "bg-cyan-500/20" : "bg-white/5"}`}>
            {subscribed ? <Bell size={28} className="text-cyan-400"/> : <BellOff size={28} className="text-white/40"/>}
          </div>
          <h2 className="text-lg font-bold mb-1">
            {subscribed ? "Benachrichtigungen aktiv" : "Benachrichtigungen deaktiviert"}
          </h2>
          <p className="text-xs text-gray-400 mb-4">
            {subscribed
              ? "Du erhältst Benachrichtigungen bei neuen Auktions-Gewinnen, überbotenen Geboten und Fahrten."
              : "Aktiviere Push-Benachrichtigungen, um über wichtige Ereignisse informiert zu bleiben."}
          </p>

          {!supported ? (
            <div className="p-3 rounded-lg bg-yellow-500/10 text-xs text-yellow-400">
              Dieser Browser/Gerät unterstützt keine Push-Benachrichtigungen.
            </div>
          ) : permission === "denied" ? (
            <div className="p-3 rounded-lg bg-red-500/10 text-xs text-red-400">
              Benachrichtigungen sind im Browser blockiert. Bitte in den Browser-Einstellungen erlauben.
            </div>
          ) : !subscribed ? (
            <button
              onClick={enable}
              disabled={loading}
              data-testid="push-enable-btn"
              className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl font-bold text-black disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? <Loader2 size={16} className="animate-spin"/> : <Bell size={16}/>}
              Aktivieren
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={sendTest}
                disabled={testing}
                data-testid="push-test-btn"
                className="py-3 bg-white/5 border border-cyan-500/30 rounded-xl font-semibold text-cyan-400 disabled:opacity-50 flex items-center justify-center gap-2 text-sm">
                {testing ? <Loader2 size={14} className="animate-spin"/> : <Send size={14}/>}
                Test
              </button>
              <button
                onClick={disable}
                disabled={loading}
                data-testid="push-disable-btn"
                className="py-3 bg-white/5 border border-red-500/30 rounded-xl font-semibold text-red-400 disabled:opacity-50 flex items-center justify-center gap-2 text-sm">
                {loading ? <Loader2 size={14} className="animate-spin"/> : <BellOff size={14}/>}
                Aus
              </button>
            </div>
          )}
        </motion.div>

        {/* Benefits */}
        <div className="rounded-2xl p-4 bg-white/[0.02] border border-white/5 space-y-3">
          <h3 className="text-sm font-semibold">Wobei wirst du benachrichtigt?</h3>
          {[
            "Du gewinnst eine Auktion",
            "Du wurdest überboten",
            "Neue Auktionen gestartet",
            "Fahrer ist angekommen",
            "Freund hat dich eingeladen",
          ].map((t, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-gray-300">
              <CheckCircle2 size={12} className="text-cyan-400 shrink-0"/>
              <span>{t}</span>
            </div>
          ))}
        </div>

        {/* Privacy */}
        <div className="flex items-start gap-2 text-[10px] text-gray-500 p-3 rounded-xl bg-white/[0.01]">
          <ShieldCheck size={14} className="text-cyan-400/60 shrink-0 mt-0.5"/>
          <span>Deine Abonnement-Daten werden Ende-zu-Ende verschlüsselt übertragen (VAPID Protokoll). Du kannst jederzeit deaktivieren.</span>
        </div>
      </div>
    </div>
  );
}
