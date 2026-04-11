/**
 * BidBlitz V2 - Vendor Settings Page
 */

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Settings, Loader2, Check, Save } from "lucide-react";
import { getVendorProfile, updateVendorProfile, updateVendorSettings } from "../api";

export default function VendorSettingsPage({ onBack }) {
  const [vendor, setVendor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [companyForm, setCompanyForm] = useState({
    company_name: "", address: "", city: "", postal_code: "",
    phone: "", email: "", website: "", bank_name: "", iban: "", bic: "",
  });

  const [settingsForm, setSettingsForm] = useState({
    auto_approve_bookings: false,
    min_booking_hours: 24,
    max_booking_days: 30,
    cancellation_hours: 48,
    cancellation_fee_percent: 20,
    late_return_fee_per_hour: 15,
    cleaning_fee: 50,
    require_deposit: true,
  });

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getVendorProfile();
      const v = data.vendor;
      setVendor(v);
      if (v?.company) {
        setCompanyForm(f => ({ ...f, ...v.company }));
      }
      if (v?.settings) {
        setSettingsForm(f => ({ ...f, ...v.settings }));
      }
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await Promise.all([
        updateVendorProfile(companyForm),
        updateVendorSettings(settingsForm),
      ]);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) { alert(err.message); }
    setSaving(false);
  };

  if (loading) return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-[#00C2FF]" />
    </div>
  );

  const Input = ({ label, field, form, setForm, type = "text" }) => (
    <div>
      <label className="text-xs text-[#666] mb-1 block">{label}</label>
      <input type={type} value={form[field] || ""}
        onChange={e => setForm(f => ({ ...f, [field]: type === "number" ? parseFloat(e.target.value) || 0 : e.target.value }))}
        className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm outline-none focus:border-[#00C2FF]/50" />
    </div>
  );

  const Toggle = ({ label, field, desc }) => (
    <label className="flex items-center justify-between p-3 bg-white/[0.02] rounded-xl border border-white/5 cursor-pointer">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {desc && <p className="text-xs text-[#666]">{desc}</p>}
      </div>
      <div className={`w-11 h-6 rounded-full p-0.5 transition-colors ${settingsForm[field] ? "bg-[#00C2FF]" : "bg-white/10"}`}
        onClick={() => setSettingsForm(f => ({ ...f, [field]: !f[field] }))}>
        <div className={`w-5 h-5 rounded-full bg-white transition-transform ${settingsForm[field] ? "translate-x-5" : ""}`} />
      </div>
    </label>
  );

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24">
      <div className="sticky top-0 z-40 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5 p-4 flex items-center gap-3">
        <motion.button whileTap={{ scale: 0.9 }} onClick={onBack}
          className="p-2 rounded-xl bg-white/5 border border-white/10" data-testid="vendor-settings-back">
          <ArrowLeft size={20} />
        </motion.button>
        <h1 className="text-lg font-bold flex-1">Einstellungen</h1>
        <motion.button whileTap={{ scale: 0.95 }} onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00C2FF] text-black text-sm font-medium disabled:opacity-50"
          data-testid="save-settings-btn">
          {saving ? <Loader2 size={16} className="animate-spin" /> : saved ? <><Check size={16} /> Gespeichert</> : <><Save size={16} /> Speichern</>}
        </motion.button>
      </div>

      <div className="p-4 space-y-6">
        {/* Company Info */}
        <div>
          <p className="text-xs text-[#00C2FF] font-medium uppercase tracking-wide mb-3">Firmeninformationen</p>
          <div className="space-y-3">
            <Input label="Firmenname" field="company_name" form={companyForm} setForm={setCompanyForm} />
            <Input label="Adresse" field="address" form={companyForm} setForm={setCompanyForm} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="PLZ" field="postal_code" form={companyForm} setForm={setCompanyForm} />
              <Input label="Stadt" field="city" form={companyForm} setForm={setCompanyForm} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Telefon" field="phone" form={companyForm} setForm={setCompanyForm} />
              <Input label="E-Mail" field="email" form={companyForm} setForm={setCompanyForm} />
            </div>
            <Input label="Website" field="website" form={companyForm} setForm={setCompanyForm} />
          </div>
        </div>

        {/* Bank Details */}
        <div>
          <p className="text-xs text-[#00C2FF] font-medium uppercase tracking-wide mb-3">Bankverbindung</p>
          <div className="space-y-3">
            <Input label="Bank" field="bank_name" form={companyForm} setForm={setCompanyForm} />
            <Input label="IBAN" field="iban" form={companyForm} setForm={setCompanyForm} />
            <Input label="BIC" field="bic" form={companyForm} setForm={setCompanyForm} />
          </div>
        </div>

        {/* Booking Settings */}
        <div>
          <p className="text-xs text-[#00C2FF] font-medium uppercase tracking-wide mb-3">Buchungseinstellungen</p>
          <div className="space-y-3">
            <Toggle label="Auto-Bestätigung" field="auto_approve_bookings" desc="Buchungen automatisch annehmen" />
            <Toggle label="Kaution erforderlich" field="require_deposit" desc="Kaution bei jeder Buchung einziehen" />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Min. Buchungsstunden" field="min_booking_hours" form={settingsForm} setForm={setSettingsForm} type="number" />
              <Input label="Max. Buchungstage" field="max_booking_days" form={settingsForm} setForm={setSettingsForm} type="number" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Stornierung (Stunden)" field="cancellation_hours" form={settingsForm} setForm={setSettingsForm} type="number" />
              <Input label="Stornogebühr (%)" field="cancellation_fee_percent" form={settingsForm} setForm={setSettingsForm} type="number" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Verspätungsgebühr/Std (€)" field="late_return_fee_per_hour" form={settingsForm} setForm={setSettingsForm} type="number" />
              <Input label="Reinigungsgebühr (€)" field="cleaning_fee" form={settingsForm} setForm={setSettingsForm} type="number" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
