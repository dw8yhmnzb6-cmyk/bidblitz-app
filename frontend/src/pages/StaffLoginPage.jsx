/**
 * Staff Login Page
 * ================
 * Login für Mitarbeiter Self-Service Portal
 */
import React, { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, User, Lock, AlertCircle } from "lucide-react";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

export default function StaffLoginPage({ onBack, onLoginSuccess }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API}/api/staff/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form)
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(`Willkommen, ${data.staff.name}!`);
        onLoginSuccess(data.staff);
      } else {
        setError(data.detail || "Login fehlgeschlagen");
      }
    } catch (err) {
      setError("Netzwerkfehler. Bitte versuche es erneut.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={onBack}
            className="p-2 rounded-xl hover:bg-white/5 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold font-outfit">Mitarbeiter Login</h1>
            <p className="text-sm text-white/40 mt-1">Self-Service Portal</p>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2">
              <AlertCircle size={16} className="text-red-400 flex-shrink-0" />
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}

          <div>
            <label className="text-sm text-white/60 mb-2 block">E-Mail</label>
            <div className="relative">
              <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="mitarbeiter@example.com"
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-[#00C2FF]/50 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="text-sm text-white/60 mb-2 block">Passwort</label>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                type="password"
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-[#00C2FF]/50 transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-3 rounded-xl bg-[#00C2FF] text-black text-sm font-semibold hover:bg-[#00A8E0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Anmelden...
              </>
            ) : (
              "Anmelden"
            )}
          </button>
        </form>

        {/* Info */}
        <div className="mt-8 p-4 rounded-xl bg-white/[0.02] border border-white/5">
          <p className="text-xs text-white/60">
            📌 <strong>Erster Login?</strong> Verwende deine E-Mail-Adresse und ein beliebiges Passwort. 
            Das Passwort wird beim ersten Login automatisch gesetzt.
          </p>
          <p className="text-xs text-white/40 mt-2">
            Kontaktiere deinen Arbeitgeber, wenn du Probleme beim Login hast.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
