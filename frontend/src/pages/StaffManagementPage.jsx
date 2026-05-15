/**
 * BidBlitz Staff Management
 * =========================
 * Zeiterfassung, Mitarbeiterverwaltung, Schichtplanung
 * Crewmeister/Papershift Alternative
 */
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Users, Clock, Calendar, UmbrellaIcon, FileText, Plus,
  CheckCircle, XCircle, Loader2, MapPin, AlertCircle, Download,
  Edit, Trash2, Play, Pause, Square, TrendingUp, Award, QrCode,
  Crown, Sparkles, Settings, ArrowRight, BookOpen, LayoutGrid
} from "lucide-react";
import { toast } from "sonner";
import QRCode from "qrcode.react";
import QrCheckinScanner from "../components/QrCheckinScanner";
import StaffUpgradeScreen from "./StaffUpgradeScreen";
import StaffDashboardCards from "../components/staff/StaffDashboardCards";
import StaffWarningsList from "../components/staff/StaffWarningsList";
import StaffExportButtons from "../components/staff/StaffExportButtons";
import StaffWalletPanel from "../components/staff/StaffWalletPanel";
import ManagerTeamTimesheet from "../components/staff/ManagerTeamTimesheet";
import MerchantLiveOverview from "../components/staff/MerchantLiveOverview";
import ScheduleGridEditor from "../components/staff/ScheduleGridEditor";
import KnowledgeBaseManager from "../components/staff/KnowledgeBaseManager";

const API = process.env.REACT_APP_BACKEND_URL;

// Sub-tab switcher: pill-style selector inside parent tabs (iter113)
function SubTabSwitcher({ current, onChange, options }) {
  return (
    <div className="mb-4 inline-flex p-1 rounded-xl bg-white/[0.04] border border-white/[0.08]">
      {options.map((opt) => (
        <button
          key={opt.id}
          onClick={() => onChange(opt.id)}
          data-testid={`subtab-${opt.id}`}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
            current === opt.id
              ? "bg-[#00C2FF] text-black shadow-md"
              : "text-white/60 hover:text-white"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}


export default function StaffManagementPage({ onBack, onNavigate }) {
  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(false);
  
  // Subscription State
  const [subscription, setSubscription] = useState(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);
  
  // Data State
  const [members, setMembers] = useState([]);
  const [todayEvents, setTodayEvents] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [summary, setSummary] = useState({});
  
  // Modals
  const [showAddMember, setShowAddMember] = useState(false);
  const [showClockModal, setShowClockModal] = useState(false);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);

  // ═════════════════════════════════════════════════════════════════════════
  // Subscription Loading
  // ═════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    loadSubscription();
    // Handle Stripe return: ?session_id=cs_test_...
    const url = new URL(window.location.href);
    const sessionId = url.searchParams.get("session_id");
    if (sessionId) {
      pollStripe(sessionId);
      url.searchParams.delete("session_id");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  const pollStripe = async (sessionId, attempts = 0) => {
    if (attempts >= 5) {
      toast.error("Zahlungsstatus-Check Timeout");
      return;
    }
    try {
      const r = await fetch(`${API}/api/staff/subscription/checkout-status/${sessionId}`, { credentials: "include" });
      if (r.ok) {
        const d = await r.json();
        if (d.payment_status === "paid") {
          toast.success("Zahlung erfolgreich! Plan aktiviert.");
          loadSubscription();
          return;
        }
      }
    } catch (e) {}
    setTimeout(() => pollStripe(sessionId, attempts + 1), 2000);
  };

  const loadSubscription = async () => {
    setSubscriptionLoading(true);
    try {
      const res = await fetch(`${API}/api/staff/subscription/status`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setSubscription(data);
      }
    } catch (e) {
      console.error("Subscription load failed:", e);
    }
    setSubscriptionLoading(false);
  };

  // ═════════════════════════════════════════════════════════════════════════
  // Data Fetching
  // ═════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    if (subscription?.active) loadData();
  }, [tab, subscription?.active]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [membersRes, eventsRes, summaryRes] = await Promise.all([
        fetch(`${API}/api/staff/members`, { credentials: "include" }),
        fetch(`${API}/api/staff/clock/today`, { credentials: "include" }),
        fetch(`${API}/api/staff/reports/summary`, { credentials: "include" })
      ]);

      if (membersRes.ok) {
        const data = await membersRes.json();
        setMembers(data.members || []);
      }
      if (eventsRes.ok) {
        const data = await eventsRes.json();
        setTodayEvents(data.events || []);
      }
      if (summaryRes.ok) {
        const data = await summaryRes.json();
        setSummary(data);
      }

      // Load shifts if on calendar tab
      if (tab === "shifts") {
        const shiftsRes = await fetch(`${API}/api/staff/shifts`, { credentials: "include" });
        if (shiftsRes.ok) {
          const data = await shiftsRes.json();
          setShifts(data.shifts || []);
        }
      }

      // Load leave requests if on leave tab
      if (tab === "leave") {
        const leaveRes = await fetch(`${API}/api/staff/leave`, { credentials: "include" });
        if (leaveRes.ok) {
          const data = await leaveRes.json();
          setLeaveRequests(data.requests || []);
        }
      }
    } catch (err) {
      console.error("Error loading data:", err);
      toast.error("Fehler beim Laden der Daten");
    } finally {
      setLoading(false);
    }
  };

  // ═════════════════════════════════════════════════════════════════════════
  // Actions
  // ═════════════════════════════════════════════════════════════════════════

  const handleAddMember = async (formData) => {
    try {
      const res = await fetch(`${API}/api/staff/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(formData)
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success("Mitarbeiter hinzugefügt");
        setShowAddMember(false);
        loadData();
        loadSubscription();
      } else {
        // Limit reached or no subscription
        const detail = data.detail;
        if (typeof detail === "object" && detail?.code === "limit_reached") {
          toast.error(detail.message, {
            action: { label: "Upgrade", onClick: () => onNavigate && onNavigate("/merchant/staff/upgrade") },
          });
        } else if (typeof detail === "object" && (detail?.code === "no_subscription" || detail?.code === "subscription_inactive")) {
          toast.error(detail.message);
          onNavigate && onNavigate("/merchant/staff/upgrade");
        } else {
          toast.error(typeof detail === "string" ? detail : "Fehler beim Hinzufügen");
        }
      }
    } catch (err) {
      toast.error("Netzwerkfehler");
    }
  };

  const handleClockAction = async (staffId, action) => {
    try {
      const res = await fetch(`${API}/api/staff/clock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          staff_id: staffId,
          action: action,
          source: "web"
        })
      });
      if (res.ok) {
        toast.success(`${action === "clock_in" ? "Eingecheckt" : action === "clock_out" ? "Ausgecheckt" : "Pause"}`);
        loadData();
      } else {
        toast.error("Fehler bei Zeitbuchung");
      }
    } catch (err) {
      toast.error("Netzwerkfehler");
    }
  };

  const handleApproveLeave = async (requestId, status) => {
    try {
      const res = await fetch(`${API}/api/staff/leave/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        toast.success(status === "approved" ? "Genehmigt" : "Abgelehnt");
        loadData();
      } else {
        toast.error("Fehler");
      }
    } catch (err) {
      toast.error("Netzwerkfehler");
    }
  };

  // ═════════════════════════════════════════════════════════════════════════
  // Render Tabs
  // ═════════════════════════════════════════════════════════════════════════

  // 4-Tab Consolidation (iter113): 9 → 4 mit internen Sub-Switches
  const tabs = [
    { id: "overview", label: "Heute", icon: TrendingUp },
    { id: "shifts", label: "Plan", icon: Calendar },
    { id: "members", label: "Mitarbeiter", icon: Users },
    { id: "reports", label: "Auswertung", icon: FileText },
  ];
  // Sub-views inside parent tabs
  const [subView, setSubView] = useState({ overview: "live", shifts: "list", members: "list", reports: "timesheet" });

  // ═════════════════════════════════════════════════════════════════════════
  // PAYWALL GATE
  // ═════════════════════════════════════════════════════════════════════════
  if (subscriptionLoading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-[#00C2FF]" />
      </div>
    );
  }
  if (!subscription?.active) {
    return (
      <StaffUpgradeScreen
        onBack={onBack}
        onSuccess={() => loadSubscription()}
      />
    );
  }

  const isTrialing = subscription?.status === "trialing";
  const trialDaysLeft = subscription?.trial_days_left;
  const currentPlan = subscription?.plan;
  const maxStaff = subscription?.max_staff || 0;
  const currentCount = subscription?.current_staff_count || 0;
  const planColors = { basic: "#00C2FF", pro: "#A855F7", enterprise: "#F59E0B" };
  const planColor = planColors[currentPlan] || "#00C2FF";

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-[#0A0A0A]/95 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              data-testid="staff-back-btn"
              className="p-2 rounded-xl hover:bg-white/5 transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-base font-bold font-outfit">Staff Management</h1>
              <p className="text-[10px] text-white/40">Zeiterfassung & Mitarbeiter</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Trial / Plan Badge */}
            {isTrialing ? (
              <button
                onClick={() => onNavigate && onNavigate("/merchant/staff/upgrade")}
                data-testid="staff-trial-badge-header"
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#00C2FF]/10 border border-[#00C2FF]/30 text-[10px] font-semibold text-[#00C2FF]"
                title="Trial endet bald — upgraden"
              >
                <Sparkles size={11} />
                Trial · {trialDaysLeft}T
              </button>
            ) : currentPlan ? (
              <span
                data-testid="staff-plan-badge-header"
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase"
                style={{ background: `${planColor}22`, border: `1px solid ${planColor}55`, color: planColor }}
              >
                <Crown size={11} /> {currentPlan}
              </span>
            ) : null}

            {/* Limit Display */}
            <span
              data-testid="staff-limit-display"
              className="hidden md:inline-flex items-center px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-medium text-white/70"
            >
              {currentCount}/{maxStaff === 9999 ? "∞" : maxStaff}
            </span>

            {/* Settings */}
            <button
              onClick={() => onNavigate && onNavigate("/staff/settings")}
              data-testid="staff-settings-btn"
              className="p-2 rounded-xl hover:bg-white/5 transition-colors"
              title="Einstellungen"
            >
              <Settings size={16} className="text-white/60" />
            </button>

            {/* Upgrade Button (only on trial or basic) */}
            {(isTrialing || currentPlan === "basic") && (
              <button
                onClick={() => onNavigate && onNavigate("/merchant/staff/upgrade")}
                data-testid="staff-upgrade-cta"
                className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-[#00C2FF] to-[#A855F7] text-white text-[11px] font-semibold"
              >
                Upgrade <ArrowRight size={11} />
              </button>
            )}

            <button
              onClick={() => setShowAddMember(true)}
              data-testid="staff-add-member-btn"
              className="px-3 py-1.5 bg-[#00C2FF] text-black rounded-lg text-xs font-semibold hover:bg-[#00A8E0] transition-colors flex items-center gap-1.5"
            >
              <Plus size={14} />
              <span className="hidden sm:inline">Mitarbeiter</span>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 overflow-x-auto scrollbar-hide">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors border-b-2 ${
                  tab === t.id
                    ? "text-[#00C2FF] border-[#00C2FF]"
                    : "text-white/40 border-transparent hover:text-white/60"
                }`}
              >
                <Icon size={14} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-[#00C2FF]" />
          </div>
        ) : (
          <>
            {/* HEUTE — Übersicht + Zeiterfassung */}
            {tab === "overview" && (
              <div>
                <SubTabSwitcher
                  current={subView.overview}
                  onChange={(v) => setSubView({ ...subView, overview: v })}
                  options={[
                    { id: "live", label: "Live-Status" },
                    { id: "clock", label: "Zeiterfassung" },
                  ]}
                />
                {subView.overview === "live" && (
                  <OverviewTab
                    summary={summary}
                    members={members}
                    todayEvents={todayEvents}
                    onAddMember={() => setShowAddMember(true)}
                    onCreateShift={() => setTab("shifts")}
                    onOpenTimesheet={() => { setTab("reports"); setSubView((s) => ({ ...s, reports: "timesheet" })); }}
                  />
                )}
                {subView.overview === "clock" && (
                  <ClockTab todayEvents={todayEvents} members={members} onClockAction={handleClockAction} />
                )}
              </div>
            )}

            {/* PLAN — Schichtplan + Schedule-Editor */}
            {tab === "shifts" && (
              <div>
                <SubTabSwitcher
                  current={subView.shifts}
                  onChange={(v) => setSubView({ ...subView, shifts: v })}
                  options={[
                    { id: "list", label: "Schichtplan" },
                    { id: "editor", label: "Editor" },
                  ]}
                />
                {subView.shifts === "list" && (
                  <ShiftsTab shifts={shifts} members={members} onReload={loadData} />
                )}
                {subView.shifts === "editor" && (
                  <ScheduleGridEditor members={members} onMembersReload={loadData} />
                )}
              </div>
            )}

            {/* MITARBEITER — Liste + Urlaub/Krank */}
            {tab === "members" && (
              <div>
                <SubTabSwitcher
                  current={subView.members}
                  onChange={(v) => setSubView({ ...subView, members: v })}
                  options={[
                    { id: "list", label: "Mitarbeiter" },
                    { id: "leave", label: `Anträge${leaveRequests.filter((r) => r.status === "pending").length ? ` (${leaveRequests.filter((r) => r.status === "pending").length})` : ""}` },
                  ]}
                />
                {subView.members === "list" && (
                  <MembersTab members={members} onReload={loadData} onClockAction={handleClockAction} />
                )}
                {subView.members === "leave" && (
                  <LeaveTab requests={leaveRequests} members={members} onApprove={handleApproveLeave} />
                )}
              </div>
            )}

            {/* AUSWERTUNG — Timesheet + Reports + Knowledge */}
            {tab === "reports" && (
              <div>
                <SubTabSwitcher
                  current={subView.reports}
                  onChange={(v) => setSubView({ ...subView, reports: v })}
                  options={[
                    { id: "timesheet", label: "Timesheet" },
                    { id: "reports", label: "Reports" },
                    { id: "knowledge", label: "Schulungen" },
                  ]}
                />
                {subView.reports === "timesheet" && <ManagerTeamTimesheet />}
                {subView.reports === "reports" && <ReportsTab members={members} />}
                {subView.reports === "knowledge" && <KnowledgeBaseManager />}
              </div>
            )}
          </>
        )}
      </div>

      {/* Add Member Modal */}
      <AddMemberModal
        isOpen={showAddMember}
        onClose={() => setShowAddMember(false)}
        onSubmit={handleAddMember}
      />
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// Overview Tab
// ═════════════════════════════════════════════════════════════════════════

function OverviewTab({ summary, members, todayEvents, onAddMember, onCreateShift, onOpenTimesheet }) {
  return (
    <div className="space-y-5">
      <MerchantLiveOverview
        summary={summary}
        members={members}
        todayEvents={todayEvents}
        onAddMember={onAddMember}
        onCreateShift={onCreateShift}
        onOpenTimesheet={onOpenTimesheet}
      />
      <StaffWarningsList />
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// Members Tab
// ═════════════════════════════════════════════════════════════════════════

function MembersTab({ members, onReload, onClockAction }) {
  if (members.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Users size={48} className="text-white/10 mb-3" />
        <p className="text-sm text-white/40 mb-1">Keine Mitarbeiter</p>
        <p className="text-xs text-white/30">Füge deinen ersten Mitarbeiter hinzu</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {members.map((member) => (
        <motion.div
          key={member.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl bg-white/[0.02] border border-white/5"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#00C2FF]/20 to-[#A855F7]/20 flex items-center justify-center text-lg font-bold">
                {member.name.charAt(0)}
              </div>
              <div>
                <p className="text-sm font-semibold">{member.name}</p>
                <p className="text-[10px] text-white/40">{member.email}</p>
                <p className="text-[10px] text-white/30 mt-0.5">{member.role} • €{member.hourly_rate}/h</p>
              </div>
            </div>
            <div className={`px-2 py-1 rounded-lg text-[10px] font-medium ${member.active ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
              {member.active ? "Aktiv" : "Inaktiv"}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-4 gap-2">
            <button
              onClick={() => onClockAction(member.id, "clock_in")}
              className="px-2 py-1.5 rounded-lg bg-green-500/10 text-green-400 text-[10px] font-medium hover:bg-green-500/20 transition-colors flex items-center justify-center gap-1"
            >
              <Play size={12} />
              Ein
            </button>
            <button
              onClick={() => onClockAction(member.id, "clock_out")}
              className="px-2 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-[10px] font-medium hover:bg-red-500/20 transition-colors flex items-center justify-center gap-1"
            >
              <Square size={12} />
              Aus
            </button>
            <button
              onClick={() => onClockAction(member.id, "break_start")}
              className="px-2 py-1.5 rounded-lg bg-yellow-500/10 text-yellow-400 text-[10px] font-medium hover:bg-yellow-500/20 transition-colors flex items-center justify-center gap-1"
            >
              <Pause size={12} />
              Pause
            </button>
            <button
              onClick={() => alert("Edit coming soon")}
              className="px-2 py-1.5 rounded-lg bg-white/5 text-white/60 text-[10px] font-medium hover:bg-white/10 transition-colors flex items-center justify-center gap-1"
            >
              <Edit size={12} />
            </button>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// Clock Tab
// ═════════════════════════════════════════════════════════════════════════

function ClockTab({ todayEvents, members, onClockAction }) {
  return (
    <div className="space-y-4">
      {/* Quick Clock In */}
      <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-4">
        <h3 className="text-sm font-semibold mb-3">Schnell-Check-in</h3>
        <div className="grid grid-cols-2 gap-2">
          {members.slice(0, 6).map((member) => (
            <button
              key={member.id}
              onClick={() => onClockAction(member.id, "clock_in")}
              className="p-3 rounded-xl bg-white/5 hover:bg-[#00C2FF]/10 border border-white/10 hover:border-[#00C2FF]/30 transition-all text-left"
            >
              <p className="text-xs font-semibold truncate">{member.name}</p>
              <p className="text-[10px] text-white/40 mt-0.5">{member.role}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Today's Events */}
      <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-4">
        <h3 className="text-sm font-semibold mb-3">Heutige Buchungen</h3>
        {todayEvents.length === 0 ? (
          <p className="text-xs text-white/40 py-4 text-center">Noch keine Buchungen heute</p>
        ) : (
          <div className="space-y-2">
            {todayEvents.map((event, i) => {
              const member = members.find((m) => m.id === event.staff_id);
              return (
                <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-xs font-semibold">
                      {member?.name?.charAt(0) || "?"}
                    </div>
                    <div>
                      <p className="text-xs font-medium">{member?.name || "Unbekannt"}</p>
                      <p className="text-[10px] text-white/40">{getActionLabel(event.action)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium">{new Date(event.timestamp).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</p>
                    {event.lat && event.lng && (
                      <p className="text-[9px] text-white/30 flex items-center gap-0.5 justify-end mt-0.5">
                        <MapPin size={9} />
                        GPS
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// Shifts Tab
// ═════════════════════════════════════════════════════════════════════════

function ShiftsTab({ shifts, members }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-4">
        <h3 className="text-sm font-semibold mb-3">Kommende Schichten</h3>
        {shifts.length === 0 ? (
          <p className="text-xs text-white/40 py-4 text-center">Keine Schichten geplant</p>
        ) : (
          <div className="space-y-2">
            {shifts.map((shift) => {
              const member = members.find((m) => m.id === shift.staff_id);
              return (
                <div key={shift.id} className="p-3 rounded-xl bg-white/5 border border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold">{shift.title}</p>
                    <p className="text-[10px] text-white/40">{member?.name || "Unbekannt"}</p>
                  </div>
                  <p className="text-[10px] text-white/60">
                    {new Date(shift.start_time).toLocaleString("de-DE")} - {new Date(shift.end_time).toLocaleTimeString("de-DE")}
                  </p>
                  {shift.location && (
                    <p className="text-[10px] text-white/40 mt-1 flex items-center gap-1">
                      <MapPin size={10} />
                      {shift.location}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// Leave Tab
// ═════════════════════════════════════════════════════════════════════════

function LeaveTab({ requests, members, onApprove }) {
  const pending = requests.filter((r) => r.status === "pending");
  const approved = requests.filter((r) => r.status === "approved");

  return (
    <div className="space-y-4">
      {/* Pending Requests */}
      <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-4">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <AlertCircle size={16} className="text-yellow-400" />
          Offene Anträge ({pending.length})
        </h3>
        {pending.length === 0 ? (
          <p className="text-xs text-white/40 py-4 text-center">Keine offenen Anträge</p>
        ) : (
          <div className="space-y-2">
            {pending.map((req) => {
              const member = members.find((m) => m.id === req.staff_id);
              return (
                <div key={req.id} className="p-3 rounded-xl bg-white/5 border border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-xs font-semibold">{member?.name || "Unbekannt"}</p>
                      <p className="text-[10px] text-white/40">{getLeaveTypeLabel(req.type)}</p>
                    </div>
                    <div className={`px-2 py-1 rounded-lg text-[10px] font-medium ${getLeaveTypeColor(req.type)}`}>
                      {getLeaveTypeLabel(req.type)}
                    </div>
                  </div>
                  <p className="text-[10px] text-white/60 mb-2">
                    {req.start_date} bis {req.end_date}
                  </p>
                  {req.reason && (
                    <p className="text-[10px] text-white/40 mb-3 italic">"{req.reason}"</p>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => onApprove(req.id, "approved")}
                      className="px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 text-[10px] font-medium hover:bg-green-500/20 transition-colors flex items-center justify-center gap-1"
                    >
                      <CheckCircle size={12} />
                      Genehmigen
                    </button>
                    <button
                      onClick={() => onApprove(req.id, "rejected")}
                      className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-[10px] font-medium hover:bg-red-500/20 transition-colors flex items-center justify-center gap-1"
                    >
                      <XCircle size={12} />
                      Ablehnen
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Approved Requests */}
      {approved.length > 0 && (
        <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <CheckCircle size={16} className="text-green-400" />
            Genehmigte Anträge ({approved.length})
          </h3>
          <div className="space-y-2">
            {approved.slice(0, 3).map((req) => {
              const member = members.find((m) => m.id === req.staff_id);
              return (
                <div key={req.id} className="p-3 rounded-xl bg-white/5 border border-white/10">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold">{member?.name || "Unbekannt"}</p>
                      <p className="text-[10px] text-white/40">{req.start_date} - {req.end_date}</p>
                    </div>
                    <div className="px-2 py-1 rounded-lg bg-green-500/10 text-green-400 text-[10px] font-medium">
                      ✓ Genehmigt
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// Reports Tab
// ═════════════════════════════════════════════════════════════════════════

function ReportsTab({ members }) {
  const [selectedMember, setSelectedMember] = useState(null);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadReport = async (staffId) => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/staff/reports/hours?staff_id=${staffId}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setReport(data);
      }
    } catch (err) {
      toast.error("Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Export Buttons */}
      <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-4">
        <h3 className="text-sm font-semibold mb-3">Exporte</h3>
        <StaffExportButtons period="monthly" />
      </div>

      {/* Wallet Panel: Bonus & Trinkgeld */}
      <StaffWalletPanel members={members} />

      {/* Member Selection */}
      <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-4">
        <h3 className="text-sm font-semibold mb-3">Mitarbeiter wählen</h3>
        <div className="grid grid-cols-2 gap-2">
          {members.map((member) => (
            <button
              key={member.id}
              onClick={() => {
                setSelectedMember(member);
                loadReport(member.id);
              }}
              className={`p-3 rounded-xl border transition-all text-left ${
                selectedMember?.id === member.id
                  ? "bg-[#00C2FF]/10 border-[#00C2FF]/30"
                  : "bg-white/5 border-white/10 hover:bg-white/10"
              }`}
            >
              <p className="text-xs font-semibold truncate">{member.name}</p>
              <p className="text-[10px] text-white/40 mt-0.5">{member.role}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Report Display */}
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 size={24} className="animate-spin text-[#00C2FF]" />
        </div>
      ) : report ? (
        <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-4">
          <h3 className="text-sm font-semibold mb-3">Wochenreport</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-white/5">
              <p className="text-[10px] text-white/40 mb-1">Gesamtstunden</p>
              <p className="text-2xl font-bold">{report.net_hours}h</p>
            </div>
            <div className="p-3 rounded-xl bg-white/5">
              <p className="text-[10px] text-white/40 mb-1">Überstunden</p>
              <p className="text-2xl font-bold text-[#00C2FF]">{report.overtime_hours}h</p>
            </div>
            <div className="p-3 rounded-xl bg-white/5">
              <p className="text-[10px] text-white/40 mb-1">Pausen</p>
              <p className="text-2xl font-bold text-yellow-400">{report.break_hours}h</p>
            </div>
            <div className="p-3 rounded-xl bg-white/5">
              <p className="text-[10px] text-white/40 mb-1">Buchungen</p>
              <p className="text-2xl font-bold">{report.events_count}</p>
            </div>
          </div>

          <button
            className="w-full mt-3 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Download size={14} />
            Export (Coming Soon)
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <FileText size={32} className="text-white/10 mb-2" />
          <p className="text-xs text-white/40">Wähle einen Mitarbeiter</p>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// Add Member Modal
// ═════════════════════════════════════════════════════════════════════════

function AddMemberModal({ isOpen, onClose, onSubmit }) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    role: "employee",
    hourly_rate: "12",
    vacation_days_yearly: "24"
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...form,
      hourly_rate: parseFloat(form.hourly_rate),
      vacation_days_yearly: parseInt(form.vacation_days_yearly)
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md rounded-2xl bg-[#111] border border-white/10 p-6"
      >
        <h2 className="text-lg font-bold mb-4">Neuer Mitarbeiter</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs text-white/60 mb-1 block">Name</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-[#00C2FF]/50"
            />
          </div>
          <div>
            <label className="text-xs text-white/60 mb-1 block">E-Mail</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-[#00C2FF]/50"
            />
          </div>
          <div>
            <label className="text-xs text-white/60 mb-1 block">Telefon (optional)</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-[#00C2FF]/50"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/60 mb-1 block">Stundenlohn (€)</label>
              <input
                type="number"
                step="0.5"
                required
                value={form.hourly_rate}
                onChange={(e) => setForm({ ...form, hourly_rate: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-[#00C2FF]/50"
              />
            </div>
            <div>
              <label className="text-xs text-white/60 mb-1 block">Urlaubstage</label>
              <input
                type="number"
                required
                value={form.vacation_days_yearly}
                onChange={(e) => setForm({ ...form, vacation_days_yearly: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-[#00C2FF]/50"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-medium transition-colors"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 rounded-xl bg-[#00C2FF] text-black text-sm font-semibold hover:bg-[#00A8E0] transition-colors"
            >
              Hinzufügen
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// Helper Functions
// ═════════════════════════════════════════════════════════════════════════

function getActionLabel(action) {
  const labels = {
    clock_in: "Eingecheckt",
    clock_out: "Ausgecheckt",
    break_start: "Pause Start",
    break_end: "Pause Ende"
  };
  return labels[action] || action;
}

function getLeaveTypeLabel(type) {
  const labels = {
    vacation: "Urlaub",
    sick: "Krank",
    other: "Sonstiges"
  };
  return labels[type] || type;
}

function getLeaveTypeColor(type) {
  const colors = {
    vacation: "bg-blue-500/10 text-blue-400",
    sick: "bg-red-500/10 text-red-400",
    other: "bg-gray-500/10 text-gray-400"
  };
  return colors[type] || "bg-gray-500/10 text-gray-400";
}
