/**
 * Staff Mobile — Profile
 * =======================
 * Avatar, Rolle, Standort, Sprache, PIN ändern, Notifications, Logout.
 */
import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  User, Bell, Globe, Lock, LogOut, ChevronRight, Loader2, Mail, Phone, Briefcase, MapPin,
  Shield, FileText, Sun, Moon, CheckCircle2,
} from "lucide-react";
import { t, getStaffLang, setStaffLang, STAFF_LANGUAGES } from "../../i18n/staff";

const API = process.env.REACT_APP_BACKEND_URL;

export default function StaffProfile({ staff, onLoggedOut }) {
  const [lang, setLang] = useState(getStaffLang());
  const [pinModal, setPinModal] = useState(false);
  const [langModal, setLangModal] = useState(false);
  const [notif, setNotif] = useState(true);

  const logout = async () => {
    try {
      await fetch(`${API}/api/staff/auth/logout`, { method: "POST", credentials: "include" });
    } catch (e) {}
    onLoggedOut && onLoggedOut();
  };

  const initials = (staff?.name || "?").split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div data-testid="staff-profile-tab" className="px-5 pt-6 pb-2 space-y-5">
      <div>
        <p className="text-[11px] uppercase tracking-widest text-white/40">Profil</p>
        <h2 className="text-2xl font-bold mt-1 font-outfit">Dein Account</h2>
      </div>

      {/* Hero card */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl p-5 border border-white/[0.08] bg-white/[0.03]"
        data-testid="staff-profile-hero"
      >
        <div className="flex items-center gap-4">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold"
            style={{ background: "linear-gradient(135deg, #00D4FF 0%, #A855F7 100%)" }}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-lg font-bold truncate">{staff?.name}</p>
            <p className="text-[12px] text-white/50 truncate flex items-center gap-1"><Briefcase size={11} /> {staff?.staff_role || staff?.role || "Mitarbeiter"}</p>
            {staff?.location && <p className="text-[11px] text-white/40 flex items-center gap-1 mt-0.5"><MapPin size={10} /> {staff.location}</p>}
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-1 gap-1.5">
          {staff?.email && <ProfileLine icon={Mail} label="E-Mail" value={staff.email} />}
          {staff?.phone && <ProfileLine icon={Phone} label="Telefon" value={staff.phone} />}
        </div>
      </motion.div>

      {/* Settings */}
      <div className="rounded-2xl bg-white/[0.03] border border-white/[0.08] divide-y divide-white/[0.05] overflow-hidden">
        <Row
          icon={Globe} color="#00D4FF"
          label="Sprache" value={STAFF_LANGUAGES.find((l) => l.code === lang)?.label || "Deutsch"}
          onClick={() => setLangModal(true)} testId="staff-profile-lang"
        />
        <Row
          icon={Lock} color="#A855F7"
          label="PIN ändern" value="Sicherer Zugang"
          onClick={() => setPinModal(true)} testId="staff-profile-pin"
        />
        <Row
          icon={Bell} color="#F59E0B"
          label="Benachrichtigungen"
          rightSlot={
            <Toggle on={notif} onChange={(v) => { setNotif(v); toast.message(v ? "Benachrichtigungen aktiv" : "Stumm geschaltet"); }} />
          }
          testId="staff-profile-notifications"
        />
        <Row icon={Shield} color="#10B981" label="Datenschutz" value="Privatsphäre & Sicherheit" testId="staff-profile-privacy" />
        <Row icon={FileText} color="#6B7280" label="Hilfe & Support" testId="staff-profile-help" />
      </div>

      <button
        onClick={logout}
        data-testid="staff-profile-logout"
        className="w-full py-3.5 rounded-2xl bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#EF4444]/15 transition-colors"
      >
        <LogOut size={16} /> Abmelden
      </button>

      <p className="text-center text-[10px] text-white/30 pt-2">BidBlitz Staff · v1.0</p>

      {langModal && (
        <BottomSheet onClose={() => setLangModal(false)} title="Sprache wählen">
          <div className="grid grid-cols-2 gap-2">
            {STAFF_LANGUAGES.map((l) => (
              <button
                key={l.code}
                onClick={() => { setStaffLang(l.code); setLang(l.code); setLangModal(false); toast.success("Sprache aktualisiert"); }}
                data-testid={`staff-lang-${l.code}`}
                className={`px-3 py-3 rounded-xl border flex items-center gap-2 text-sm ${
                  lang === l.code ? "bg-[#00D4FF]/10 border-[#00D4FF]/40 text-white" : "bg-white/[0.03] border-white/10 text-white/70"
                }`}
              >
                <span>{l.flag}</span>{l.label}
                {lang === l.code && <CheckCircle2 size={14} className="ml-auto text-[#00D4FF]" />}
              </button>
            ))}
          </div>
        </BottomSheet>
      )}
      {pinModal && <PinChangeSheet onClose={() => setPinModal(false)} />}
    </div>
  );
}

function PinChangeSheet({ onClose }) {
  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!oldPin || !newPin) return toast.error("Bitte beide Felder ausfüllen");
    if (newPin.length < 4) return toast.error("Neue PIN min. 4 Zeichen");
    setBusy(true);
    try {
      const r = await fetch(`${API}/api/staff/change-pin`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ old_pin: oldPin, new_pin: newPin }),
      });
      if (r.ok) { toast.success("PIN aktualisiert"); onClose(); }
      else toast.error("Aktualisierung fehlgeschlagen");
    } catch (e) { toast.error("Fehler"); }
    setBusy(false);
  };

  return (
    <BottomSheet onClose={onClose} title="PIN ändern">
      <input
        type="password" inputMode="numeric" placeholder="Aktuelle PIN"
        value={oldPin} onChange={(e) => setOldPin(e.target.value)}
        data-testid="staff-pin-old"
        className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-sm mb-2"
      />
      <input
        type="password" inputMode="numeric" placeholder="Neue PIN"
        value={newPin} onChange={(e) => setNewPin(e.target.value)}
        data-testid="staff-pin-new"
        className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-sm mb-3"
      />
      <button
        onClick={submit} disabled={busy}
        data-testid="staff-pin-submit"
        className="w-full py-3 rounded-xl bg-gradient-to-r from-[#00D4FF] to-[#A855F7] font-semibold text-sm disabled:opacity-60"
      >
        {busy ? <Loader2 size={14} className="animate-spin mx-auto" /> : "PIN speichern"}
      </button>
    </BottomSheet>
  );
}

function BottomSheet({ children, title, onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end justify-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 200 }} animate={{ y: 0 }} exit={{ y: 200 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-[#0A0A0A] border-t border-white/10 rounded-t-3xl p-5"
      >
        <div className="w-10 h-1 bg-white/15 rounded-full mx-auto mb-4" />
        <p className="text-sm font-bold mb-3">{title}</p>
        {children}
      </motion.div>
    </motion.div>
  );
}

function ProfileLine({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-2 text-[12px]">
      <Icon size={12} className="text-white/40 flex-shrink-0" />
      <span className="text-white/40 w-16">{label}</span>
      <span className="text-white/80 truncate flex-1">{value}</span>
    </div>
  );
}

function Row({ icon: Icon, color, label, value, onClick, rightSlot, testId }) {
  return (
    <button
      onClick={onClick} disabled={!onClick && !rightSlot}
      data-testid={testId}
      className="w-full flex items-center gap-3 p-4 hover:bg-white/[0.03] transition-colors text-left disabled:cursor-default"
    >
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}1F`, color }}>
        <Icon size={16} strokeWidth={2.2} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{label}</p>
        {value && <p className="text-[11px] text-white/40 truncate">{value}</p>}
      </div>
      {rightSlot || (onClick && <ChevronRight size={16} className="text-white/30" />)}
    </button>
  );
}

function Toggle({ on, onChange }) {
  return (
    <button
      onClick={() => onChange(!on)}
      data-testid="staff-toggle"
      className={`relative w-11 h-6 rounded-full transition-colors ${on ? "bg-[#10B981]" : "bg-white/15"}`}
    >
      <span className={`absolute top-0.5 ${on ? "left-[22px]" : "left-0.5"} w-5 h-5 bg-white rounded-full transition-all shadow`} />
    </button>
  );
}
