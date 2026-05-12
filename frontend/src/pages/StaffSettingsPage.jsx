/**
 * Staff Settings Page
 * ===================
 * Merchant configuration for Staff Module
 */
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Save, Loader2, Check, Settings as SettingsIcon,
  Clock, MapPin, QrCode, Wifi, Calendar, Bell
} from "lucide-react";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

export default function StaffSettingsPage({ onBack }) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const res = await fetch(`${API}/api/staff/settings/`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings);
      }
    } catch (err) {
      toast.error("Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/staff/settings/`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        toast.success("Einstellungen gespeichert");
      } else {
        toast.error("Fehler beim Speichern");
      }
    } catch (err) {
      toast.error("Netzwerkfehler");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-[#00C2FF]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-[#0A0A0A]/95 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 rounded-xl hover:bg-white/5">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-base font-bold font-outfit">Einstellungen</h1>
              <p className="text-[10px] text-white/40">Staff Management Konfiguration</p>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-[#00C2FF] text-black rounded-xl text-xs font-semibold hover:bg-[#00A8E0] disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Speichern
          </button>
        </div>
      </div>

      {/* Settings Sections */}
      <div className="p-4 space-y-6">
        {/* Working Hours */}
        <Section icon={Clock} title="Arbeitszeit">
          <Input
            label="Arbeitsstunden pro Tag"
            type="number"
            step="0.5"
            value={settings.work_hours_per_day}
            onChange={(e) => setSettings({...settings, work_hours_per_day: parseFloat(e.target.value)})}
          />
          <Input
            label="Standard-Pause (Minuten)"
            type="number"
            value={settings.break_rule_minutes}
            onChange={(e) => setSettings({...settings, break_rule_minutes: parseInt(e.target.value)})}
          />
          <Input
            label="Standard-Urlaubstage"
            type="number"
            value={settings.default_vacation_days}
            onChange={(e) => setSettings({...settings, default_vacation_days: parseInt(e.target.value)})}
          />
        </Section>

        {/* Check-in Methods */}
        <Section icon={MapPin} title="Check-in Methoden">
          <Toggle
            label="GPS Check-in erforderlich"
            checked={settings.gps_checkin_required}
            onChange={(checked) => setSettings({...settings, gps_checkin_required: checked})}
          />
          <Toggle
            label="QR Check-in aktiviert"
            checked={settings.qr_checkin_enabled}
            onChange={(checked) => setSettings({...settings, qr_checkin_enabled: checked})}
          />
          <Toggle
            label="NFC Check-in aktiviert"
            checked={settings.nfc_checkin_enabled}
            onChange={(checked) => setSettings({...settings, nfc_checkin_enabled: checked})}
          />
          {settings.gps_checkin_required && (
            <Input
              label="Geofence Radius (km)"
              type="number"
              step="0.01"
              value={settings.geofence_radius_km}
              onChange={(e) => setSettings({...settings, geofence_radius_km: parseFloat(e.target.value)})}
            />
          )}
        </Section>

        {/* Notifications */}
        <Section icon={Bell} title="Benachrichtigungen">
          <Toggle
            label="Schicht-Erinnerungen aktiviert"
            checked={settings.shift_reminder_enabled}
            onChange={(checked) => setSettings({...settings, shift_reminder_enabled: checked})}
          />
          {settings.shift_reminder_enabled && (
            <Input
              label="Erinnerung vor Schicht (Minuten)"
              type="number"
              value={settings.shift_reminder_minutes}
              onChange={(e) => setSettings({...settings, shift_reminder_minutes: parseInt(e.target.value)})}
            />
          )}
        </Section>

        {/* Overtime Rules */}
        <Section icon={Calendar} title="Überstunden-Regeln">
          <Select
            label="Überstunden-Berechnung"
            value={settings.overtime_rule}
            onChange={(e) => setSettings({...settings, overtime_rule: e.target.value})}
            options={[
              { value: "auto", label: "Automatisch" },
              { value: "manual", label: "Manuell genehmigen" },
              { value: "disabled", label: "Deaktiviert" }
            ]}
          />
        </Section>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, children }) {
  return (
    <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-4">
      <div className="flex items-center gap-2 mb-4">
        <Icon size={18} className="text-[#00C2FF]" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Input({ label, type = "text", value, onChange, step, ...props }) {
  return (
    <div>
      <label className="text-xs text-white/60 mb-1.5 block">{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        step={step}
        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-[#00C2FF]/50"
        {...props}
      />
    </div>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <div className="flex items-center justify-between py-2">
      <label className="text-xs text-white/80">{label}</label>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-12 h-6 rounded-full transition-colors ${
          checked ? "bg-[#00C2FF]" : "bg-white/10"
        }`}
      >
        <div
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
            checked ? "translate-x-6" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <div>
      <label className="text-xs text-white/60 mb-1.5 block">{label}</label>
      <select
        value={value}
        onChange={onChange}
        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-[#00C2FF]/50"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
