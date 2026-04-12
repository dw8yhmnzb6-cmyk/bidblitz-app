/**
 * BidBlitz V2 - Vendor Staff Management Page
 */
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Users, Plus, Loader2, Edit3, Trash2, X, Check, Shield, Mail
} from "lucide-react";
import { getVendorStaff, addVendorStaff, updateVendorStaff, removeVendorStaff } from "../api";
import { useI18n } from "../../../store/I18nContext";

const ROLES = [
  { value: "manager", label: "Manager", desc: "Voller Zugriff" },
  { value: "operator", label: "Operator", desc: "Buchungen & Übergaben" },
  { value: "viewer", label: "Betrachter", desc: "Nur lesen" },
];

export default function VendorStaffPage({ onBack }) {
  const { t } = useI18n();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [form, setForm] = useState({ email: "", role: "operator" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getVendorStaff();
      setStaff(data.staff || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const handleAdd = async () => {
    if (!form.email) return;
    setSaving(true);
    setError(null);
    try {
      await addVendorStaff(form);
      setShowAdd(false);
      setForm({ email: "", role: "operator" });
      load();
    } catch (err) { setError(err.message); }
    setSaving(false);
  };

  const handleUpdate = async () => {
    if (!editingStaff) return;
    setSaving(true);
    setError(null);
    try {
      await updateVendorStaff(editingStaff.user_id, { role: form.role });
      setEditingStaff(null);
      load();
    } catch (err) { setError(err.message); }
    setSaving(false);
  };

  const handleRemove = async (userId) => {
    if (!window.confirm("Mitarbeiter wirklich entfernen?")) return;
    try {
      await removeVendorStaff(userId);
      load();
    } catch (err) { alert(err.message); }
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString("de-DE") : "";

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24">
      <div className="sticky top-0 z-40 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <motion.button whileTap={{ scale: 0.9 }} onClick={onBack}
              className="p-2 rounded-xl bg-white/5 border border-white/10" data-testid="vendor-staff-back">
              <ArrowLeft size={20} />
            </motion.button>
            <div>
              <h1 className="text-lg font-bold">Mitarbeiter</h1>
              <p className="text-xs text-[#666]">{staff.length} Mitarbeiter</p>
            </div>
          </div>
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => { setShowAdd(true); setError(null); setForm({ email: "", role: "operator" }); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00C2FF] text-black text-sm font-medium"
            data-testid="add-staff-btn">
            <Plus size={16} /> Hinzufügen
          </motion.button>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[#00C2FF]" /></div>
        ) : staff.length === 0 ? (
          <div className="text-center py-20">
            <Users size={48} className="mx-auto text-[#333] mb-4" />
            <p className="text-white/70">Keine Mitarbeiter</p>
            <p className="text-sm text-[#666] mt-2">Füge Mitarbeiter hinzu, um Aufgaben zu delegieren.</p>
          </div>
        ) : staff.map((s, idx) => {
          const roleInfo = ROLES.find(r => r.value === s.role) || ROLES[2];
          return (
            <motion.div key={s.user_id} initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}
              className="bg-[#111118] rounded-2xl p-4 border border-white/5"
              data-testid={`staff-${s.user_id}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                    <Shield size={18} className="text-purple-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{s.name || s.email}</h3>
                    <p className="text-xs text-[#666] flex items-center gap-1"><Mail size={10} /> {s.email}</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-purple-500/10 text-purple-400">
                  {roleInfo.label}
                </span>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-white/5">
                <span className="text-xs text-[#555]">Seit {fmtDate(s.added_at)}</span>
                <div className="flex gap-2">
                  <motion.button whileTap={{ scale: 0.9 }}
                    onClick={() => { setEditingStaff(s); setForm({ email: s.email, role: s.role }); setError(null); }}
                    className="p-2 rounded-lg bg-white/5 border border-white/10" data-testid={`edit-staff-${s.user_id}`}>
                    <Edit3 size={14} />
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleRemove(s.user_id)}
                    className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400"
                    data-testid={`remove-staff-${s.user_id}`}>
                    <Trash2 size={14} />
                  </motion.button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {(showAdd || editingStaff) && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end justify-center"
            onClick={() => { setShowAdd(false); setEditingStaff(null); }}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              onClick={e => e.stopPropagation()} className="w-full max-w-lg bg-[#111118] rounded-t-3xl p-6">
              <h3 className="text-lg font-bold mb-4">{editingStaff ? "Mitarbeiter bearbeiten" : "Mitarbeiter hinzufügen"}</h3>
              {error && <div className="p-3 mb-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</div>}

              {!editingStaff && (
                <div className="mb-4">
                  <label className="text-xs text-[#666] mb-1 block">E-Mail des Mitarbeiters *</label>
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="mitarbeiter@firma.de"
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm outline-none"
                    data-testid="staff-email-input" />
                  <p className="text-[10px] text-[#555] mt-1">Der Mitarbeiter muss ein BidBlitz-Konto haben.</p>
                </div>
              )}

              <div className="mb-6">
                <label className="text-xs text-[#666] mb-2 block">Rolle</label>
                <div className="space-y-2">
                  {ROLES.map(r => (
                    <motion.button key={r.value} whileTap={{ scale: 0.98 }}
                      onClick={() => setForm(f => ({ ...f, role: r.value }))}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${
                        form.role === r.value ? "bg-purple-500/10 border border-purple-500/20" : "bg-white/[0.02] border border-white/5"
                      }`} data-testid={`staff-role-${r.value}`}>
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        form.role === r.value ? "border-purple-400" : "border-white/20"
                      }`}>
                        {form.role === r.value && <div className="w-2 h-2 rounded-full bg-purple-400" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{r.label}</p>
                        <p className="text-xs text-[#666]">{r.desc}</p>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>

              <motion.button whileTap={{ scale: 0.97 }}
                onClick={editingStaff ? handleUpdate : handleAdd}
                disabled={saving || (!editingStaff && !form.email)}
                className="w-full py-4 rounded-xl bg-[#00C2FF] text-black font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                data-testid="save-staff-btn">
                {saving ? <Loader2 size={20} className="animate-spin" /> : <><Check size={20} /> {editingStaff ? "Speichern" : "Hinzufügen"}</>}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
