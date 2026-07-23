/**
 * Admin Detail Router — renders the right detail panel based on data.type.
 */
import { motion } from "framer-motion";
import { useState } from "react";
import {
  AlertCircle, Bot, Check, Key, Loader2, Star, X, Zap,
} from "lucide-react";
import { api } from "./dataLoaders";

const MODULE_KEY_MAP = {
  Handwerker: "handwerker",
  Gebrauchtwagen: "gebrauchtwagen",
  Reinigungsservices: "reinigung",
  Umzugsfirmen: "umzug",
  Tierbetreuung: "tierbetreuung",
  "Streaming-Katalog": "streaming",
  "Telemedizin Ärzte": "telemedizin",
  "Dating-Profile": "dating",
  "Fitness-Studios": "fitness",
  Reiseangebote: "reisen",
  Ladesäulen: "ladesaeulen",
  "Scooter-Abos": "scooter-abos",
};

export default function AdminDetailRouter({ data, setData, loading, error, onNavigate }) {
  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 size={32} className="animate-spin text-[#A855F7]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2">
        <AlertCircle size={16} className="text-red-500" />
        <span className="text-sm text-red-700">{error}</span>
      </div>
    );
  }

  if (!data) return null;

  switch (data.type) {
    case "users": return <UsersDetail data={data} />;
    case "kyc": return <KycDetail data={data} setData={setData} />;
    case "roles": return <RolesDetail data={data} />;
    case "user_filter": return <UserFilterDetail data={data} />;
    case "form": return <FormDetail data={data} />;
    case "partners": return <PartnersDetail data={data} />;
    case "applications": return <ApplicationsDetail data={data} />;
    case "finance_detail": return <FinanceDetail data={data} onNavigate={onNavigate} />;
    case "payouts": return <PayoutsDetail data={data} />;
    case "pay_requests": return <PayRequestsDetail data={data} setData={setData} />;
    case "api_keys": return <ApiKeysDetail />;
    case "marketing": return <MarketingDetail data={data} />;
    case "auctions": return <AuctionsDetail data={data} onNavigate={onNavigate} />;
    case "bot_config": return <BotConfigDetail data={data} />;
    case "winners": return <WinnersDetail data={data} />;
    case "analytics": return <AnalyticsDetail data={data} onNavigate={onNavigate} />;
    case "coupons": return <CouponsDetail data={data} onNavigate={onNavigate} />;
    case "system_logs": return <SystemLogsDetail data={data} />;
    case "system_detail": return <SystemDetail data={data} onNavigate={onNavigate} />;
    case "module_list": return <ModuleListDetail data={data} onNavigate={onNavigate} />;
    case "module_stats": return <ModuleStatsDetail data={data} />;
    default:
      return (
        <div className="text-center py-10" data-testid="admin-detail-generic">
          <p className="text-sm text-gray-400">Funktion wird vorbereitet</p>
        </div>
      );
  }
}

/* ─── Section Components ─────────────────────────────────────────────────── */

function UsersDetail({ data }) {
  return (
    <div className="space-y-3" data-testid="admin-detail-users">
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: "Gesamt", value: data.stats?.total_users || 0, color: "#3B82F6" },
          { label: "Aktive Heute", value: data.stats?.active_today || 0, color: "#10B981" },
          { label: "Umsatz (30T)", value: `€${(data.stats?.revenue_30d || 0).toFixed(0)}`, color: "#F59E0B" },
          { label: "Transaktionen", value: data.stats?.total_transactions || 0, color: "#A855F7" },
        ].map(s => (
          <div key={s.label} className="p-3 rounded-xl bg-white border border-gray-100 shadow-sm">
            <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-[10px] text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>
      <h3 className="text-xs font-semibold text-gray-500 mt-2">Letzte Kunden ({data.users?.length || 0})</h3>
      {(data.users || []).slice(0, 20).map((u, i) => (
        <div key={i} className="p-3 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#3B82F6]/10 flex items-center justify-center text-[11px] font-bold text-[#3B82F6]">
              {(u.name || u.email || "?")[0].toUpperCase()}
            </div>
            <div>
              <p className="text-[11px] font-semibold text-gray-800">{u.name || "–"}</p>
              <p className="text-[9px] text-gray-400">{u.email}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-bold text-[#10B981]">€{(u.balance || 0).toFixed(2)}</p>
            <span className="text-[8px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{u.role || "user"}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function KycDetail({ data, setData }) {
  const [busyUserId, setBusyUserId] = useState(null);

  const handleDecision = async (userId, decision, reason) => {
    setBusyUserId(userId);
    try {
      await api(`/api/admin/customers/${encodeURIComponent(userId)}/kyc`, {
        method: "POST",
        body: JSON.stringify({ decision, reason }),
      });
      const nextRequests = (data.requests || []).filter((item) => item.user_id !== userId);
      setData?.({ ...data, requests: nextRequests, total: nextRequests.length });
    } catch (e) {
      window.alert(e?.message || "KYC Entscheidung fehlgeschlagen");
    }
    setBusyUserId(null);
  };

  return (
    <div className="space-y-2" data-testid="admin-detail-kyc">
      <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 mb-3">
        <p className="text-xs text-amber-800 font-medium">{data.total ?? (data.requests || []).length} offene KYC-Anträge</p>
      </div>
      {(data.requests || []).length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm">Keine offenen KYC-Anträge</div>
      ) : (data.requests || []).map((r, i) => (
        <div key={r.user_id || i} className="p-3 rounded-xl bg-white border border-gray-100 shadow-sm gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-gray-800 truncate">{r.user_name || r.name || r.user_email || r.email || "–"}</p>
              <p className="text-[9px] text-gray-500 truncate">{r.user_email || r.email || "—"}</p>
              <p className="text-[9px] text-gray-400 mt-1">Typ: {r.document_type || r.type || "KYC"}</p>
              <p className="text-[9px] text-gray-400 mt-1">Fehlversuche: {Number(r.failed_attempts || 0)}</p>
              {r.manual_review_requested && <p className="text-[9px] mt-1 font-semibold text-amber-700">Manuelle Prüfung vom Nutzer angefordert</p>}
            </div>
            <span className={`text-[9px] px-2 py-0.5 rounded font-medium ${r.status === "pending" || r.status === "manual_review_requested" ? "bg-amber-100 text-amber-700" : r.status === "approved" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
              {r.status || "pending"}
            </span>
          </div>
          {(r.user_feedback || []).length > 0 && (
            <div className="mt-3 rounded-lg bg-red-50 border border-red-100 p-2.5" data-testid={`admin-kyc-feedback-${r.user_id || i}`}>
              <p className="text-[10px] font-semibold text-red-700">Konkret erkannte Probleme</p>
              <ul className="mt-2 space-y-1">
                {(r.user_feedback || []).map((item, idx) => (
                  <li key={`${item}-${idx}`} className="text-[10px] text-red-600">• {item}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => handleDecision(r.user_id, "approve", "Manuell durch Admin geprüft und freigeschaltet")}
              disabled={busyUserId === r.user_id}
              className="flex-1 rounded-lg bg-emerald-50 px-3 py-2 text-[10px] font-bold text-emerald-700 border border-emerald-200 disabled:opacity-50"
              data-testid={`admin-kyc-approve-${r.user_id}`}
            >
              {busyUserId === r.user_id ? "Prüft…" : "Freischalten"}
            </button>
            <button
              type="button"
              onClick={() => handleDecision(r.user_id, "reject", "Manuell geprüft: Bitte mit klareren, vollständigen Bildern erneut hochladen")}
              disabled={busyUserId === r.user_id}
              className="flex-1 rounded-lg bg-red-50 px-3 py-2 text-[10px] font-bold text-red-700 border border-red-200 disabled:opacity-50"
              data-testid={`admin-kyc-reject-${r.user_id}`}
            >
              {busyUserId === r.user_id ? "Prüft…" : "Ablehnen"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function PayoutsDetail({ data }) {
  return (
    <div className="space-y-3" data-testid="admin-detail-payouts">
      <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 mb-3">
        <p className="text-xs text-emerald-800 font-medium">{data.count || 0} Auszahlungen geladen</p>
      </div>
      {(data.payouts || []).length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm">Keine Auszahlungen vorhanden</div>
      ) : (data.payouts || []).map((p, i) => (
        <div key={p.payout_id || i} className="p-3 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-gray-800 truncate">{p.user_name || p.email || p.user_id || "Auszahlung"}</p>
            <p className="text-[9px] text-gray-500 truncate">{p.reference || p.payout_id || "—"}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-bold text-emerald-600">€{Number(p.amount || 0).toFixed(2)}</p>
            <p className="text-[9px] text-gray-400">{p.status || "pending"}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function RolesDetail({ data }) {
  return (
    <div className="space-y-2" data-testid="admin-detail-roles">
      <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 mb-3">
        <p className="text-xs text-blue-800 font-medium">Rollen-Anfragen verwalten</p>
      </div>
      {(data.requests || []).length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm">Keine offenen Rollen-Anfragen</div>
      ) : (data.requests || []).map((r, i) => (
        <div key={i} className="p-3 rounded-xl bg-white border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold text-gray-800">{r.user_email || "–"}</p>
            <span className="text-[9px] px-2 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">{r.requested_role}</span>
          </div>
          <p className="text-[9px] text-gray-400 mt-1">Status: {r.status}</p>
        </div>
      ))}
    </div>
  );
}

function UserFilterDetail({ data }) {
  return (
    <div className="space-y-3" data-testid="admin-detail-user-filter">
      <div className="p-4 rounded-xl bg-white border border-gray-100 shadow-sm text-center">
        <p className="text-3xl font-bold text-[#3B82F6]">{data.total_users}</p>
        <p className="text-xs text-gray-500 mt-1">Registrierte Benutzer</p>
      </div>
      <div className="p-4 rounded-xl bg-[#3B82F6]/5 border border-[#3B82F6]/20">
        <p className="text-sm font-semibold text-[#3B82F6] capitalize">{data.role}</p>
        <p className="text-[10px] text-gray-500 mt-1">Verwaltung für {data.role === "staff" ? "Mitarbeiter" : data.role === "enterprise" ? "Großkunden" : "Influencer"}</p>
      </div>
      <p className="text-[10px] text-gray-400 text-center">Detaillierte Verwaltung in Kürze verfügbar</p>
    </div>
  );
}

function FormDetail({ data }) {
  return (
    <div className="space-y-3" data-testid="admin-detail-form">
      <div className="p-4 rounded-xl bg-white border border-gray-100 shadow-sm">
        <p className="text-sm font-semibold text-gray-800">
          {data.formType === "car-ads" ? "Auto-Werbung verwalten" : "Partner-Freibetrag vergeben"}
        </p>
        <p className="text-[10px] text-gray-500 mt-1">
          {data.formType === "car-ads" ? "Werbebanner für Fahrzeuge konfigurieren" : "Freibeträge für Partner zuweisen"}
        </p>
      </div>
      <p className="text-[10px] text-gray-400 text-center">Formular wird in nächstem Update bereitgestellt</p>
    </div>
  );
}

function PartnersDetail({ data }) {
  return (
    <div className="space-y-3" data-testid="admin-detail-partners">
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: "Gesamt Benutzer", value: data.stats?.total_users || 0, color: "#F59E0B" },
          { label: "Umsatz", value: `€${(data.stats?.total_revenue || 0).toFixed(0)}`, color: "#10B981" },
        ].map(s => (
          <div key={s.label} className="p-3 rounded-xl bg-white border border-gray-100 shadow-sm">
            <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-[10px] text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-gray-400 text-center">Partner-Portal Verwaltung</p>
    </div>
  );
}

function ApplicationsDetail({ data }) {
  return (
    <div className="space-y-2" data-testid="admin-detail-applications">
      <p className="text-xs font-semibold text-gray-500 mb-2">Alle Bewerbungen ({(data.requests || []).length})</p>
      {(data.requests || []).length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm">Keine Bewerbungen</div>
      ) : (data.requests || []).map((r, i) => (
        <div key={i} className="p-3 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-gray-800">{r.user_email || "–"}</p>
            <p className="text-[9px] text-gray-400">{r.requested_role} — {r.message?.slice(0, 40) || "Keine Nachricht"}</p>
          </div>
          <span className={`text-[9px] px-2 py-0.5 rounded font-medium ${r.status === "pending" ? "bg-amber-100 text-amber-700" : r.status === "approved" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
            {r.status}
          </span>
        </div>
      ))}
    </div>
  );
}

function FinanceDetail({ data, onNavigate }) {
  const subtypeLabel = ({
    payments: "Zahlungsübersicht",
    "wallet-topup": "Wallet-Aufladungen",
    payouts: "Wise-Auszahlungen",
    sepa: "SEPA-Auszahlungen",
    wholesale: "Großhändler-Finanzen",
  })[data.subtype] || data.subtype;
  return (
    <div className="space-y-3" data-testid="admin-detail-finance">
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: "Gesamtumsatz", value: `€${(data.stats?.total_revenue || 0).toFixed(2)}`, color: "#10B981" },
          { label: "Wallet-Summe", value: `€${(data.stats?.total_wallet_balance || 0).toFixed(2)}`, color: "#3B82F6" },
          { label: "Transaktionen", value: data.stats?.total_transactions || 0, color: "#A855F7" },
          { label: "Benutzer", value: data.stats?.total_users || 0, color: "#F59E0B" },
        ].map(s => (
          <div key={s.label} className="p-3 rounded-xl bg-white border border-gray-100 shadow-sm">
            <p className="text-lg font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-[10px] text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>
      <div className="p-3 rounded-xl bg-[#10B981]/5 border border-[#10B981]/20">
        <p className="text-xs font-semibold text-[#10B981] capitalize">{subtypeLabel}</p>
      </div>
      {data.subtype === "payments" && (
        <motion.button whileTap={{ scale: 0.95 }} onClick={() => onNavigate("/admin/old")}
          className="w-full py-3 rounded-xl bg-[#10B981] text-white font-bold text-xs" data-testid="goto-payments-manager">
          Zahlungs-Manager öffnen
        </motion.button>
      )}
    </div>
  );
}

function PayRequestsDetail({ data, setData }) {
  const reload = async (filter = "pending") => {
    const d = await api(`/api/pay/admin/applications?status=${filter}`);
    setData({ type: "pay_requests", applications: d.applications || [], count: d.count || 0, filter });
  };
  return (
    <div className="space-y-3" data-testid="admin-pay-requests">
      <div className="flex gap-2 mb-3">
        {["pending", "approved", "rejected", "all"].map(f => (
          <motion.button key={f}
            onClick={() => reload(f)}
            whileTap={{ scale: 0.95 }}
            data-testid={`pay-requests-filter-${f}`}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold ${
              (data.filter || "pending") === f
                ? "bg-[#10B981] text-white"
                : "bg-white text-gray-600 border border-gray-200"
            }`}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </motion.button>
        ))}
      </div>
      {(data.applications || []).length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm">Keine {data.filter || "pending"} Anträge</div>
      ) : (data.applications || []).map((app, i) => (
        <motion.div key={app.application_id}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          className="p-4 rounded-xl bg-white border border-gray-100 shadow-sm">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <p className="text-[13px] font-bold text-gray-800">{app.business_name}</p>
              <p className="text-[11px] text-gray-500">{app.email}</p>
              {app.website && <p className="text-[10px] text-[#10B981] truncate">{app.website}</p>}
            </div>
            <span className={`px-2 py-1 rounded-lg text-[9px] font-bold uppercase ${
              app.status === "approved" ? "bg-[#10B981]/10 text-[#10B981]" :
              app.status === "rejected" ? "bg-red-100 text-red-600" :
              "bg-yellow-100 text-yellow-700"
            }`}>{app.status}</span>
          </div>
          {app.description && <p className="text-[11px] text-gray-600 mb-3">{app.description}</p>}
          <div className="flex items-center justify-between text-[9px] text-gray-400 mb-3">
            <span>{new Date(app.created_at).toLocaleDateString("de-DE")}</span>
            {app.reviewed_at && <span>Geprüft: {new Date(app.reviewed_at).toLocaleDateString("de-DE")}</span>}
          </div>
          {app.status === "pending" && (
            <div className="flex gap-2">
              <motion.button
                onClick={async () => {
                  try {
                    await api("/api/pay/admin/applications/decide", {
                      method: "POST",
                      body: JSON.stringify({ application_id: app.application_id, decision: "approve" }),
                    });
                    await reload();
                  } catch (e) { alert(e.message); }
                }}
                whileTap={{ scale: 0.95 }}
                data-testid={`pay-request-approve-${app.application_id}`}
                className="flex-1 py-2 rounded-xl text-[11px] font-bold bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20">
                <Check size={12} className="inline mr-1" />Genehmigen
              </motion.button>
              <motion.button
                onClick={async () => {
                  const reason = prompt("Ablehnungsgrund (optional):");
                  if (reason === null) return;
                  try {
                    await api("/api/pay/admin/applications/decide", {
                      method: "POST",
                      body: JSON.stringify({ application_id: app.application_id, decision: "reject", reason }),
                    });
                    await reload();
                  } catch (e) { alert(e.message); }
                }}
                whileTap={{ scale: 0.95 }}
                data-testid={`pay-request-reject-${app.application_id}`}
                className="flex-1 py-2 rounded-xl text-[11px] font-bold bg-red-50 text-red-600 border border-red-200">
                <X size={12} className="inline mr-1" />Ablehnen
              </motion.button>
            </div>
          )}
          {app.status === "rejected" && app.rejection_reason && (
            <p className="text-[10px] text-red-500/70 mt-2">Grund: {app.rejection_reason}</p>
          )}
        </motion.div>
      ))}
    </div>
  );
}

function ApiKeysDetail() {
  return (
    <div className="space-y-3" data-testid="admin-detail-api-keys">
      <div className="p-4 rounded-xl bg-white border border-gray-100 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <Key size={16} className="text-[#A855F7]" />
          <p className="text-sm font-semibold text-gray-800">Digital API Keys</p>
        </div>
        <p className="text-[10px] text-gray-500">API-Schlüssel für externe Integrationen verwalten</p>
      </div>
      <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
        <p className="text-[10px] text-gray-600 font-mono">sk_live_••••••••••••••••</p>
        <p className="text-[9px] text-gray-400 mt-1">Stripe Live Key</p>
      </div>
      <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
        <p className="text-[10px] text-gray-600 font-mono">pk_live_••••••••••••••••</p>
        <p className="text-[9px] text-gray-400 mt-1">Stripe Publishable Key</p>
      </div>
    </div>
  );
}

function MarketingDetail({ data }) {
  const tile = [
    { key: "flash-sales", title: "Flash Sales", desc: "Zeitlich begrenzte Angebote erstellen und verwalten", color: "#EF4444" },
    { key: "banners", title: "Werbebanner", desc: "Banner-Kampagnen für die App konfigurieren", color: "#3B82F6" },
    { key: "email-marketing", title: "E-Mail Marketing", desc: "Newsletter und Kampagnen versenden", color: "#10B981" },
    { key: "jackpot", title: "Jackpot", desc: "Jackpot-Gewinnspiele erstellen und auswerten", color: "#F59E0B" },
    { key: "challenges", title: "Challenges", desc: "User-Challenges mit Belohnungen konfigurieren", color: "#A855F7" },
    { key: "mystery-box", title: "Mystery Box", desc: "Mystery-Box Inhalte und Preise festlegen", color: "#EC4899" },
    { key: "surveys", title: "Umfragen", desc: "Benutzer-Umfragen erstellen und auswerten", color: "#06B6D4" },
  ].find(m => m.key === data.subtype);
  if (!tile) return null;
  return (
    <div className="space-y-3" data-testid="admin-detail-marketing">
      <div className="p-4 rounded-xl bg-white border border-gray-100 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${tile.color}15` }}>
            <Zap size={16} style={{ color: tile.color }} />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-800">{tile.title}</p>
            <p className="text-[10px] text-gray-500">{tile.desc}</p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-2">
        <div className="p-3 rounded-xl bg-white border border-gray-100 shadow-sm text-center">
          <p className="text-lg font-bold" style={{ color: tile.color }}>0</p>
          <p className="text-[9px] text-gray-500">Aktiv</p>
        </div>
        <div className="p-3 rounded-xl bg-white border border-gray-100 shadow-sm text-center">
          <p className="text-lg font-bold text-gray-400">0</p>
          <p className="text-[9px] text-gray-500">Abgeschlossen</p>
        </div>
      </div>
      <p className="text-[10px] text-gray-400 text-center mt-3">Verwaltung in nächstem Update</p>
    </div>
  );
}

function AuctionsDetail({ data, onNavigate }) {
  const subtypeLabel = ({
    products: "Produkte",
    "standard-auctions": "Standard",
    "vip-auctions": "VIP",
    "voucher-auctions": "Gutschein",
  })[data.subtype];
  return (
    <div className="space-y-2" data-testid="admin-detail-auctions">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-500">
          {subtypeLabel} Auktionen ({(data.auctions || []).length})
        </p>
        <motion.button whileTap={{ scale: 0.95 }} onClick={() => onNavigate("/auction-admin")}
          className="px-3 py-1.5 rounded-lg bg-[#A855F7] text-white text-[10px] font-bold" data-testid="goto-auction-admin">
          Verwalten
        </motion.button>
      </div>
      {(data.auctions || []).length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm">Keine aktiven Auktionen</div>
      ) : (data.auctions || []).slice(0, 15).map((a, i) => (
        <div key={i} className="p-3 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {a.image_url && <img src={a.image_url} alt="" className="w-10 h-10 rounded-lg object-cover" />}
            <div>
              <p className="text-[11px] font-semibold text-gray-800">{a.title || a.product_name || "Auktion"}</p>
              <p className="text-[9px] text-gray-400">Gebote: {a.total_bids || 0}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-bold text-[#A855F7]">€{(a.current_price || a.start_price || 0).toFixed(2)}</p>
            <span className="text-[8px] px-1.5 py-0.5 rounded bg-green-100 text-green-700">{a.status || "aktiv"}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function BotConfigDetail({ data }) {
  return (
    <div className="space-y-3" data-testid="admin-detail-bot">
      <div className="p-4 rounded-xl bg-white border border-gray-100 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <Bot size={18} className="text-[#A855F7]" />
          <p className="text-sm font-bold text-gray-800">Bot-System</p>
        </div>
        <p className="text-[10px] text-gray-500">Automatische Bieter-Bots konfigurieren</p>
      </div>
      {data.config && Object.keys(data.config).length > 0 ? (
        <div className="space-y-2">
          {Object.entries(data.config).filter(([k]) => k !== "detail").slice(0, 10).map(([k, v]) => (
            <div key={k} className="p-3 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-between">
              <span className="text-[10px] text-gray-600 capitalize">{k.replace(/_/g, " ")}</span>
              <span className="text-[10px] font-bold text-gray-800">{typeof v === "boolean" ? (v ? "An" : "Aus") : String(v)}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[10px] text-gray-400 text-center">Keine Bot-Konfiguration vorhanden</p>
      )}
    </div>
  );
}

function WinnersDetail({ data }) {
  return (
    <div className="space-y-2" data-testid="admin-detail-winners">
      <p className="text-xs font-semibold text-gray-500 mb-2">Gewinner ({(data.winners || []).length})</p>
      {(data.winners || []).length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm">Keine Gewinner</div>
      ) : (data.winners || []).slice(0, 20).map((w, i) => (
        <div key={i} className="p-3 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-gray-800">{w.user_email || w.winner_email || "–"}</p>
            <p className="text-[9px] text-gray-400">{w.auction_title || w.product || "Auktion"}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-bold text-[#10B981]">€{(w.winning_price || w.amount || 0).toFixed(2)}</p>
            <p className="text-[9px] text-gray-400">{w.won_at ? new Date(w.won_at).toLocaleDateString("de-DE") : ""}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function AnalyticsDetail({ data, onNavigate }) {
  const titleMap = {
    "product-analytics": "Produkt-Analyse",
    "user-analytics": "Benutzer-Analyse",
    "revenue-analytics": "Umsatz-Analyse",
  };
  return (
    <div className="space-y-3" data-testid="admin-detail-analytics">
      <div className="p-4 rounded-xl bg-white border border-gray-100 shadow-sm">
        <p className="text-sm font-bold text-gray-800">{titleMap[data.subtype]}</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: "Benutzer", value: data.stats?.total_users || 0, color: "#3B82F6" },
          { label: "Umsatz", value: `€${(data.stats?.total_revenue || 0).toFixed(0)}`, color: "#10B981" },
          { label: "Transaktionen", value: data.stats?.total_transactions || 0, color: "#A855F7" },
          { label: "Aktive Heute", value: data.stats?.active_today || 0, color: "#F59E0B" },
        ].map(s => (
          <div key={s.label} className="p-3 rounded-xl bg-white border border-gray-100 shadow-sm text-center">
            <p className="text-lg font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-[9px] text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>
      <motion.button whileTap={{ scale: 0.95 }} onClick={() => onNavigate("/auction-admin")}
        className="w-full py-3 rounded-xl bg-[#A855F7] text-white font-bold text-xs" data-testid="goto-analytics-full">
        Detaillierte Analyse öffnen
      </motion.button>
    </div>
  );
}

function CouponsDetail({ data, onNavigate }) {
  const titleMap = {
    "merchant-vouchers": "Händler",
    "bidder-vouchers": "Bieter",
    "partner-vouchers": "Partner",
    "discount-coupons": "Rabatt",
  };
  return (
    <div className="space-y-2" data-testid="admin-detail-coupons">
      <motion.button whileTap={{ scale: 0.95 }} onClick={() => onNavigate("/admin/old")}
        className="w-full py-3 rounded-xl bg-[#A855F7] text-white font-bold text-xs mb-3" data-testid="goto-coupon-manager">
        Gutschein-Manager öffnen
      </motion.button>
      <p className="text-xs font-semibold text-gray-500">
        {titleMap[data.subtype]} Gutscheine ({(data.coupons || []).length})
      </p>
      {(data.coupons || []).length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">Keine Gutscheine vorhanden</div>
      ) : (data.coupons || []).map((c, i) => (
        <div key={c.coupon_id || i} className="p-3 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="px-2 py-0.5 rounded bg-[#A855F7]/10 text-[#A855F7] text-[10px] font-mono font-bold">{c.code}</span>
            <p className="text-[10px] text-gray-500 mt-1">{c.description || c.coupon_type}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold">{c.value} {c.coupon_type}</p>
            <p className="text-[9px] text-gray-400">{c.used_count}/{c.max_uses} eingelöst</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function SystemLogsDetail({ data }) {
  return (
    <div className="space-y-3" data-testid="admin-detail-logs">
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: "Benutzer", value: data.stats?.total_users || 0, color: "#3B82F6" },
          { label: "Transaktionen", value: data.stats?.total_transactions || 0, color: "#A855F7" },
        ].map(s => (
          <div key={s.label} className="p-3 rounded-xl bg-white border border-gray-100 shadow-sm text-center">
            <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-[10px] text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>
      <div className="p-3 rounded-xl bg-green-50 border border-green-200 flex items-center gap-2">
        <Check size={14} className="text-green-600" />
        <p className="text-[11px] text-green-700 font-medium">System läuft normal</p>
      </div>
    </div>
  );
}

function SystemDetail({ data, onNavigate }) {
  const titleMap = {
    maintenance: "Wartungsmodus",
    cms: "Seiten (CMS)",
    "game-settings": "Spiel-Einstellungen",
    sustainability: "Nachhaltigkeit",
    passwords: "Passwort-Verwaltung",
    "voice-commands": "Sprachbefehle",
    debug: "Debug Reports",
    "rtk-proxy": "RTK Proxy",
    "system-health": "System-Gesundheit",
    database: "Daten-Management",
  };
  return (
    <div className="space-y-3" data-testid="admin-detail-system">
      <div className="p-4 rounded-xl bg-white border border-gray-100 shadow-sm">
        <p className="text-sm font-bold text-gray-800 capitalize">{titleMap[data.subtype] || data.subtype}</p>
        <p className="text-[10px] text-gray-500 mt-1">Systemverwaltung</p>
      </div>
      {data.subtype === "system-health" && (
        <>
          <div className="space-y-2">
            {["API Server", "Datenbank", "Auth Service", "Payment Gateway"].map(s => (
              <div key={s} className="p-3 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center justify-between">
                <span className="text-[11px] text-gray-700">{s}</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-[10px] text-green-600 font-medium">Online</span>
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-2 mt-3">
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => onNavigate("/admin/monitoring")}
              className="w-full py-3 rounded-xl text-white font-bold text-xs flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(135deg, #10B981, #059669)" }}
              data-testid="goto-monitoring">
              Server Monitoring Dashboard
            </motion.button>
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => onNavigate("/admin/merchants")}
              className="w-full py-3 rounded-xl text-white font-bold text-xs flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(135deg, #FFB800, #F59E0B)" }}
              data-testid="goto-merchant-admin">
              Haendler-Verwaltung
            </motion.button>
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => onNavigate("/admin/rtk")}
              className="w-full py-3 rounded-xl text-white font-bold text-xs flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(135deg, #7C3AED, #4F46E5)" }}
              data-testid="goto-rtk-admin">
              RTK Proxy Dashboard
            </motion.button>
          </div>
        </>
      )}
      {data.subtype === "rtk-proxy" && (
        <motion.button whileTap={{ scale: 0.95 }} onClick={() => onNavigate("/admin/rtk")}
          className="w-full py-3 rounded-xl text-white font-bold text-xs flex items-center justify-center gap-2"
          style={{ background: "linear-gradient(135deg, #7C3AED, #4F46E5)" }}
          data-testid="goto-rtk-dashboard-direct">
          RTK Status & Savings öffnen
        </motion.button>
      )}
      {data.subtype === "database" && (
        <div className="space-y-2">
          {["users", "transactions", "auctions", "kids_children", "crypto_holdings", "coupons"].map(c => (
            <div key={c} className="p-3 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-between">
              <span className="text-[10px] font-mono text-gray-600">{c}</span>
              <span className="text-[9px] text-gray-400">Collection</span>
            </div>
          ))}
        </div>
      )}
      {!["system-health", "database", "rtk-proxy"].includes(data.subtype) && (
        <p className="text-[10px] text-gray-400 text-center">Konfiguration in nächstem Update</p>
      )}
    </div>
  );
}

function ModuleListDetail({ data, onNavigate }) {
  return (
    <div className="space-y-3" data-testid={`admin-module-${data.module}`}>
      <button
        data-testid="module-manage-btn"
        onClick={() => {
          const modKey = MODULE_KEY_MAP[data.module];
          if (modKey && onNavigate) onNavigate(`/admin/modules?mod=${modKey}`);
          else if (onNavigate) onNavigate("/admin/modules");
        }}
        className="w-full p-3 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-[12px] font-bold flex items-center justify-center gap-2 shadow"
      >
        ✏️ {data.module} verwalten (Neu · Bearbeiten · Löschen)
      </button>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="p-3 rounded-xl bg-white border border-gray-100 shadow-sm">
          <p className="text-xl font-bold text-[#059669]">{data.items?.length || 0}</p>
          <p className="text-[10px] text-gray-500">{data.countLabel}</p>
        </div>
        {data.extra_stats && Object.entries(data.extra_stats).slice(0, 3).map(([k, v]) => (
          <div key={k} className="p-3 rounded-xl bg-white border border-gray-100 shadow-sm">
            <p className="text-xl font-bold text-[#3B82F6]">{typeof v === "number" ? v.toLocaleString("de-DE") : v}</p>
            <p className="text-[10px] text-gray-500">{k.replace(/_/g, " ")}</p>
          </div>
        ))}
      </div>
      <h3 className="text-xs font-semibold text-gray-500">{data.module} ({data.items?.length || 0})</h3>
      {(data.items || []).map((item, i) => (
        <div key={i} className="p-3 rounded-xl bg-white border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[12px] font-semibold text-gray-800 line-clamp-1">
              {item[data.fields?.[0]] || item.name || item.title || `#${i + 1}`}
            </p>
            {item.rating && (
              <span className="text-[10px] font-bold text-yellow-600 flex items-center gap-0.5">
                <Star size={10} className="fill-yellow-400 text-yellow-400" /> {item.rating}
              </span>
            )}
            {item.featured && (
              <span className="text-[8px] px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 font-bold">TOP</span>
            )}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5">
            {(data.fields || []).slice(1).map((field, fi) => {
              const val = item[field];
              if (val === undefined || val === null) return null;
              const displayVal = typeof val === "boolean"
                ? (val ? "Ja" : "Nein")
                : typeof val === "number"
                  ? (field.includes("price") || field.includes("rate") || field.includes("per_") ? `${val}€` : val.toLocaleString("de-DE"))
                  : String(val);
              return (
                <span key={fi} className="text-[10px] text-gray-500">
                  <span className="text-gray-400">{field.replace(/_/g, " ")}:</span> <span className="text-gray-700 font-medium">{displayVal}</span>
                </span>
              );
            })}
          </div>
        </div>
      ))}
      {(data.items || []).length === 0 && (
        <div className="text-center py-8 text-gray-400 text-sm">Keine Einträge vorhanden</div>
      )}
    </div>
  );
}

function ModuleStatsDetail({ data }) {
  return (
    <div className="space-y-3" data-testid={`admin-module-stats-${data.module}`}>
      <div className="p-4 rounded-xl bg-white border border-gray-100 shadow-sm text-center">
        <p className="text-sm font-semibold text-gray-600">{data.module}</p>
        <p className="text-xs text-gray-400 mt-1">Verwaltung über die Hauptseite verfügbar</p>
      </div>
      {data.stats && (
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Nutzer", value: data.stats.total_users || 0, color: "#3B82F6" },
            { label: "Transaktionen", value: data.stats.total_transactions || 0, color: "#10B981" },
            { label: "Umsatz 30T", value: `€${(data.stats.revenue_30d || 0).toFixed(0)}`, color: "#F59E0B" },
            { label: "Aktive Heute", value: data.stats.active_today || 0, color: "#A855F7" },
          ].map(s => (
            <div key={s.label} className="p-3 rounded-xl bg-white border border-gray-100 shadow-sm">
              <p className="text-lg font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[10px] text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
