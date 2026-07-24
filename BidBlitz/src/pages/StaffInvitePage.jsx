/**
 * BidBlitz Staff — Invite Accept Page
 * Route: /staff/invite?token=...
 */
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Loader2, CheckCircle, Mail, Phone, User as UserIcon, KeyRound } from "lucide-react";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

export default function StaffInvitePage({ onSuccess }) {
  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState(null);
  const [error, setError] = useState(null);
  const [token, setToken] = useState("");
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    const tkn = url.searchParams.get("token");
    if (!tkn) {
      setError("Kein Einladungslink. Bitte über den Link aus deiner Mail/SMS öffnen.");
      setLoading(false);
      return;
    }
    setToken(tkn);
    (async () => {
      try {
        const r = await fetch(`${API}/api/staff/invites/preview/${tkn}`);
        if (r.ok) {
          const d = await r.json();
          setInvite(d.invite);
          if (d.invite?.name) setName(d.invite.name);
        } else {
          const d = await r.json().catch(() => ({}));
          setError(d.detail || "Einladung ungültig");
        }
      } catch (e) {
        setError("Netzwerkfehler");
      }
      setLoading(false);
    })();
  }, []);

  const accept = async () => {
    if (!name) return toast.error("Name eingeben");
    if (pin && !/^\d{4,8}$/.test(pin)) return toast.error("PIN muss 4–8 Ziffern haben");
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/staff/invites/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, name, pin: pin || null }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Willkommen im Team!");
        setAccepted(true);
        setTimeout(() => onSuccess && onSuccess(), 1500);
      } else {
        toast.error(data.detail || "Fehler");
      }
    } catch (e) {
      toast.error("Netzwerkfehler");
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-[#00C2FF]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white px-4 pt-12 pb-8" data-testid="staff-invite-page">
      <div className="max-w-sm mx-auto">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-[#00C2FF] to-[#A855F7] flex items-center justify-center mb-3">
            <UserIcon size={28} />
          </div>
          <h1 className="text-2xl font-bold">Mitarbeiter-Einladung</h1>
          <p className="text-xs text-white/50 mt-1">BidBlitz Staff</p>
        </div>

        {error && (
          <div className="rounded-2xl p-4 bg-red-500/10 border border-red-500/30 text-red-300 text-sm" data-testid="staff-invite-error">
            {error}
          </div>
        )}

        {invite && !accepted && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            <div className="rounded-2xl p-4 bg-white/[0.03] border border-white/10 space-y-2">
              {invite.email && (
                <div className="flex items-center gap-2 text-xs"><Mail size={12} className="text-white/40" /> {invite.email}</div>
              )}
              {invite.phone && (
                <div className="flex items-center gap-2 text-xs"><Phone size={12} className="text-white/40" /> {invite.phone}</div>
              )}
              <div className="text-[10px] uppercase text-white/40 tracking-widest pt-1">Rolle: {invite.role}</div>
            </div>

            <input
              type="text"
              placeholder="Dein Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-testid="staff-invite-name-input"
              className="w-full px-4 py-3.5 rounded-xl bg-white/[0.05] border border-white/10 text-sm"
            />
            <div className="relative">
              <KeyRound size={14} className="absolute top-1/2 -translate-y-1/2 left-3 text-white/40" />
              <input
                type="password"
                inputMode="numeric"
                placeholder="PIN setzen (optional, 4–8 Ziffern)"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                data-testid="staff-invite-pin-input"
                className="w-full pl-9 pr-4 py-3.5 rounded-xl bg-white/[0.05] border border-white/10 text-sm"
              />
            </div>
            <button
              onClick={accept}
              disabled={submitting}
              data-testid="staff-invite-accept-btn"
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#00C2FF] to-[#A855F7] font-semibold text-sm"
            >
              {submitting ? <Loader2 size={16} className="animate-spin mx-auto" /> : "Einladung annehmen"}
            </button>
          </motion.div>
        )}

        {accepted && (
          <div className="text-center py-10" data-testid="staff-invite-success">
            <CheckCircle size={48} className="text-green-400 mx-auto mb-3" />
            <p className="text-base font-semibold">Willkommen!</p>
            <p className="text-xs text-white/50 mt-1">Weiterleitung...</p>
          </div>
        )}
      </div>
    </div>
  );
}
