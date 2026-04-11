/**
 * BidBlitz V2 - Vendor Car Rental Dashboard
 * Dashboard for car rental vendors
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Car, Calendar, TrendingUp, Users, Euro, Clock,
  ChevronRight, Loader2, Plus, AlertCircle, Check, Settings,
  FileText, CreditCard, BarChart3, Package, Wrench
} from "lucide-react";
import { getVendorDashboard, getVendorProfile, registerVendor } from "../api";

const StatCard = ({ icon: Icon, label, value, color, trend }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white/[0.02] rounded-xl p-4 border border-white/5"
  >
    <div className="flex items-center justify-between mb-2">
      <div 
        className="w-10 h-10 rounded-xl flex items-center justify-center"
        style={{ background: `${color}15` }}
      >
        <Icon size={20} style={{ color }} />
      </div>
      {trend && (
        <span className={`text-xs font-medium ${trend > 0 ? "text-green-400" : "text-red-400"}`}>
          {trend > 0 ? "+" : ""}{trend}%
        </span>
      )}
    </div>
    <p className="text-2xl font-bold">{value}</p>
    <p className="text-xs text-[#666] mt-1">{label}</p>
  </motion.div>
);

const QuickAction = ({ icon: Icon, label, onClick, color = "#00C2FF" }) => (
  <motion.button
    whileTap={{ scale: 0.95 }}
    onClick={onClick}
    className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white/[0.02] border border-white/5"
  >
    <div 
      className="w-12 h-12 rounded-xl flex items-center justify-center"
      style={{ background: `${color}15` }}
    >
      <Icon size={22} style={{ color }} />
    </div>
    <span className="text-xs text-[#888] text-center">{label}</span>
  </motion.button>
);

export default function VendorCarRentalDashboardPage({ onBack, onNavigate }) {
  const [vendor, setVendor] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showRegister, setShowRegister] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerError, setRegisterError] = useState(null);
  
  const [registerForm, setRegisterForm] = useState({
    company_name: "",
    address: "",
    city: "",
    postal_code: "",
    phone: "",
    email: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const profile = await getVendorProfile();
      if (profile.vendor) {
        setVendor(profile.vendor);
        const dashboardData = await getVendorDashboard();
        setDashboard(dashboardData);
      }
    } catch (err) {
      if (err.status === 404) {
        setShowRegister(true);
      }
    }
    setLoading(false);
  };

  const handleRegister = async () => {
    setRegisterLoading(true);
    setRegisterError(null);
    
    try {
      const result = await registerVendor(registerForm);
      if (result.ok) {
        setShowRegister(false);
        loadData();
      } else {
        setRegisterError(result.detail || "Registrierung fehlgeschlagen");
      }
    } catch (err) {
      setRegisterError(err.message || "Ein Fehler ist aufgetreten");
    }
    
    setRegisterLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#00C2FF]" />
      </div>
    );
  }

  // Registration Form
  if (showRegister) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] text-white pb-24">
        <div className="sticky top-0 z-40 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5">
          <div className="flex items-center gap-3 p-4">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={onBack}
              className="p-2 rounded-xl bg-white/5 border border-white/10"
            >
              <ArrowLeft size={20} />
            </motion.button>
            <div>
              <h1 className="text-lg font-bold">Vermieter werden</h1>
              <p className="text-xs text-[#666]">Als Autovermieter registrieren</p>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div className="bg-gradient-to-br from-[#00C2FF]/10 to-[#00C2FF]/5 rounded-2xl p-6 border border-[#00C2FF]/20 text-center">
            <Car size={48} className="mx-auto text-[#00C2FF] mb-4" />
            <h2 className="text-xl font-bold mb-2">Werde Autovermieter</h2>
            <p className="text-sm text-[#888]">
              Vermiete deine Fahrzeuge über BidBlitz und verdiene Geld
            </p>
          </div>

          {registerError && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
              {registerError}
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="text-xs text-[#666] mb-1 block">Firmenname *</label>
              <input
                type="text"
                value={registerForm.company_name}
                onChange={(e) => setRegisterForm(f => ({ ...f, company_name: e.target.value }))}
                placeholder="z.B. Muster Autovermietung"
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm outline-none focus:border-[#00C2FF]/50"
              />
            </div>
            <div>
              <label className="text-xs text-[#666] mb-1 block">Adresse *</label>
              <input
                type="text"
                value={registerForm.address}
                onChange={(e) => setRegisterForm(f => ({ ...f, address: e.target.value }))}
                placeholder="Straße und Hausnummer"
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm outline-none focus:border-[#00C2FF]/50"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[#666] mb-1 block">PLZ *</label>
                <input
                  type="text"
                  value={registerForm.postal_code}
                  onChange={(e) => setRegisterForm(f => ({ ...f, postal_code: e.target.value }))}
                  placeholder="12345"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm outline-none focus:border-[#00C2FF]/50"
                />
              </div>
              <div>
                <label className="text-xs text-[#666] mb-1 block">Stadt *</label>
                <input
                  type="text"
                  value={registerForm.city}
                  onChange={(e) => setRegisterForm(f => ({ ...f, city: e.target.value }))}
                  placeholder="Berlin"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm outline-none focus:border-[#00C2FF]/50"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-[#666] mb-1 block">Telefon *</label>
              <input
                type="tel"
                value={registerForm.phone}
                onChange={(e) => setRegisterForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="+49 123 456789"
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm outline-none focus:border-[#00C2FF]/50"
              />
            </div>
            <div>
              <label className="text-xs text-[#666] mb-1 block">E-Mail *</label>
              <input
                type="email"
                value={registerForm.email}
                onChange={(e) => setRegisterForm(f => ({ ...f, email: e.target.value }))}
                placeholder="kontakt@muster.de"
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm outline-none focus:border-[#00C2FF]/50"
              />
            </div>
          </div>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleRegister}
            disabled={registerLoading || !registerForm.company_name || !registerForm.city}
            className="w-full py-4 rounded-xl bg-[#00C2FF] text-black font-bold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {registerLoading ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <>
                <Check size={20} />
                Registrierung absenden
              </>
            )}
          </motion.button>

          <p className="text-xs text-[#666] text-center">
            Nach der Registrierung wird dein Antrag von unserem Team geprüft
          </p>
        </div>
      </div>
    );
  }

  // Pending Approval
  if (vendor && vendor.status === "pending") {
    return (
      <div className="min-h-screen bg-[#0A0A0F] text-white pb-24">
        <div className="sticky top-0 z-40 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5">
          <div className="flex items-center gap-3 p-4">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={onBack}
              className="p-2 rounded-xl bg-white/5 border border-white/10"
            >
              <ArrowLeft size={20} />
            </motion.button>
            <h1 className="text-lg font-bold">Vermieter Dashboard</h1>
          </div>
        </div>

        <div className="p-4">
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-6 text-center">
            <Clock size={48} className="mx-auto text-yellow-400 mb-4" />
            <h2 className="text-xl font-bold mb-2">Überprüfung läuft</h2>
            <p className="text-sm text-[#888] mb-4">
              Dein Vermieter-Antrag wird derzeit von unserem Team geprüft.
              Du wirst benachrichtigt, sobald er genehmigt wurde.
            </p>
            <p className="text-xs text-[#666]">
              Firmenname: <span className="text-white">{vendor.company?.company_name}</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Main Dashboard
  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={onBack}
              className="p-2 rounded-xl bg-white/5 border border-white/10"
            >
              <ArrowLeft size={20} />
            </motion.button>
            <div>
              <h1 className="text-lg font-bold">{vendor?.company?.company_name}</h1>
              <p className="text-xs text-[#666]">Vermieter Dashboard</p>
            </div>
          </div>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => onNavigate("/car-rental/vendor/settings")}
            className="p-2 rounded-xl bg-white/5 border border-white/10"
          >
            <Settings size={18} />
          </motion.button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Revenue Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-[#00C2FF]/20 to-[#00C2FF]/5 rounded-2xl p-5 border border-[#00C2FF]/30"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-[#888]">Gesamtumsatz</span>
            <TrendingUp size={18} className="text-[#00C2FF]" />
          </div>
          <p className="text-3xl font-bold">€{(dashboard?.total_revenue || 0).toLocaleString("de-DE", { minimumFractionDigits: 2 })}</p>
          <div className="flex items-center gap-4 mt-3 text-sm">
            <span className="text-[#888]">
              Ausstehend: <span className="text-[#00C2FF] font-medium">€{(dashboard?.pending_payout || 0).toFixed(2)}</span>
            </span>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard 
            icon={Car} 
            label="Fahrzeuge" 
            value={dashboard?.fleet_status?.total || 0} 
            color="#00C2FF" 
          />
          <StatCard 
            icon={Calendar} 
            label="Aktive Buchungen" 
            value={dashboard?.stats?.active || 0} 
            color="#00D26A" 
          />
          <StatCard 
            icon={Check} 
            label="Abgeschlossen" 
            value={dashboard?.stats?.completed || 0} 
            color="#888" 
          />
          <StatCard 
            icon={AlertCircle} 
            label="Ausstehend" 
            value={dashboard?.stats?.pending || 0} 
            color="#FFB800" 
          />
        </div>

        {/* Fleet Status */}
        {dashboard?.fleet_status && (
          <div className="bg-white/[0.02] rounded-xl p-4 border border-white/5">
            <h3 className="font-semibold mb-3 text-sm">Flottenstatus</h3>
            <div className="flex justify-between text-sm">
              <div className="text-center">
                <p className="text-lg font-bold text-green-400">{dashboard.fleet_status.available}</p>
                <p className="text-xs text-[#666]">Verfügbar</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-[#00C2FF]">{dashboard.fleet_status.rented}</p>
                <p className="text-xs text-[#666]">Vermietet</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-yellow-400">{dashboard.fleet_status.maintenance}</p>
                <p className="text-xs text-[#666]">Wartung</p>
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div>
          <h3 className="font-semibold mb-3 text-sm">Schnellaktionen</h3>
          <div className="grid grid-cols-4 gap-2">
            <QuickAction
              icon={Plus}
              label="Neues Fahrzeug"
              onClick={() => onNavigate("/car-rental/vendor/cars/new")}
              color="#00D26A"
            />
            <QuickAction
              icon={Car}
              label="Fahrzeuge"
              onClick={() => onNavigate("/car-rental/vendor/cars")}
            />
            <QuickAction
              icon={Calendar}
              label="Buchungen"
              onClick={() => onNavigate("/car-rental/vendor/bookings")}
            />
            <QuickAction
              icon={FileText}
              label="Rechnungen"
              onClick={() => onNavigate("/car-rental/vendor/invoices")}
              color="#FFB800"
            />
          </div>
        </div>

        {/* Active Bookings */}
        {dashboard?.active_bookings && dashboard.active_bookings.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">Aktive Buchungen</h3>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => onNavigate("/car-rental/vendor/bookings")}
                className="text-xs text-[#00C2FF]"
              >
                Alle anzeigen
              </motion.button>
            </div>
            <div className="space-y-2">
              {dashboard.active_bookings.slice(0, 3).map(booking => (
                <motion.div
                  key={booking.booking_id}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onNavigate(`/car-rental/vendor/bookings/${booking.booking_id}`)}
                  className="bg-white/[0.02] rounded-xl p-3 border border-white/5 flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#00C2FF]/10 flex items-center justify-center">
                      <Car size={18} className="text-[#00C2FF]" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{booking.car_title}</p>
                      <p className="text-xs text-[#666]">{booking.customer_name}</p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-[#666]" />
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Unpaid Invoices */}
        {dashboard?.unpaid_invoices && dashboard.unpaid_invoices.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <AlertCircle size={14} className="text-yellow-400" />
                Offene Rechnungen
              </h3>
            </div>
            <div className="space-y-2">
              {dashboard.unpaid_invoices.slice(0, 3).map(invoice => (
                <div
                  key={invoice.invoice_id}
                  className="bg-yellow-500/5 rounded-xl p-3 border border-yellow-500/20 flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm font-medium">{invoice.invoice_number}</p>
                    <p className="text-xs text-[#666]">€{invoice.total?.toFixed(2)}</p>
                  </div>
                  <span className="px-2 py-1 rounded-lg bg-yellow-500/20 text-yellow-400 text-xs">
                    Offen
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Menu Items */}
        <div className="space-y-2">
          {[
            { icon: Users, label: "Kunden", path: "/car-rental/vendor/customers" },
            { icon: Wrench, label: "Schadensberichte", path: "/car-rental/vendor/damages" },
            { icon: BarChart3, label: "Berichte & Analysen", path: "/car-rental/vendor/reports" },
            { icon: CreditCard, label: "Auszahlungen", path: "/car-rental/vendor/payouts" },
          ].map(item => (
            <motion.button
              key={item.path}
              whileTap={{ scale: 0.98 }}
              onClick={() => onNavigate(item.path)}
              className="w-full flex items-center justify-between p-4 bg-white/[0.02] rounded-xl border border-white/5"
            >
              <div className="flex items-center gap-3">
                <item.icon size={18} className="text-[#00C2FF]" />
                <span className="text-sm">{item.label}</span>
              </div>
              <ChevronRight size={18} className="text-[#666]" />
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
