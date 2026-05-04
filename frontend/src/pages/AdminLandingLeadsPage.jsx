import { useState, useEffect } from 'react';
import {
  ArrowLeft, Mail, MessageSquare, TrendingUp, Users, RefreshCw,
  Loader2, Search, Download, Video, Send, X, Check, Clock, RotateCw, GitBranch
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function AdminLandingLeadsPage({ onBack }) {
  const [analytics, setAnalytics] = useState(null);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [exportLoading, setExportLoading] = useState(false);
  const [salesModal, setSalesModal] = useState(null); // { email, lead_name }
  const [salesMsg, setSalesMsg] = useState('');
  const [salesLoading, setSalesLoading] = useState(false);
  const [salesResult, setSalesResult] = useState(null);
  const [funnel, setFunnel] = useState(null);
  const [historyModal, setHistoryModal] = useState(null); // { email, history, loading }
  const [rescoring, setRescoring] = useState({}); // { session_id: bool }

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token')}`,
  };

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [aRes, lRes, fRes] = await Promise.all([
        fetch(`${API}/api/landing-chatbot/analytics`, { headers, credentials: 'include' }),
        fetch(`${API}/api/landing-chatbot/leads`, { headers, credentials: 'include' }),
        fetch(`${API}/api/landing-chatbot/analytics/funnel`, { headers, credentials: 'include' }),
      ]);
      if (!aRes.ok) throw new Error('Analytics fehlgeschlagen');
      if (!lRes.ok) throw new Error('Leads fehlgeschlagen');
      setAnalytics(await aRes.json());
      const lj = await lRes.json();
      setLeads(lj.leads || []);
      if (fRes.ok) setFunnel(await fRes.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const rescoreLead = async (sessionId) => {
    if (!sessionId) return;
    setRescoring((r) => ({ ...r, [sessionId]: true }));
    try {
      await fetch(`${API}/api/landing-chatbot/score-session?session_id=${encodeURIComponent(sessionId)}`, {
        method: 'POST', headers, credentials: 'include',
      });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setRescoring((r) => ({ ...r, [sessionId]: false }));
    }
  };

  const openHistory = async (email) => {
    setHistoryModal({ email, history: [], loading: true });
    try {
      const res = await fetch(`${API}/api/landing-chatbot/leads/score-history-by-email/${encodeURIComponent(email)}`, {
        headers, credentials: 'include',
      });
      const data = await res.json();
      setHistoryModal({ email, history: data.history || [], loading: false });
    } catch (e) {
      setHistoryModal({ email, history: [], loading: false, error: e.message });
    }
  };

  useEffect(() => { load(); }, []);

  const handleExport = async () => {
    setExportLoading(true);
    try {
      const res = await fetch(`${API}/api/landing-chatbot/leads/export`, {
        headers,
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Export fehlgeschlagen');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bidblitz-leads-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message);
    } finally {
      setExportLoading(false);
    }
  };

  const sendSalesInvite = async () => {
    if (!salesModal) return;
    setSalesLoading(true);
    setSalesResult(null);
    try {
      const res = await fetch(`${API}/api/landing-chatbot/leads/sales-invite`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          email: salesModal.email,
          lead_name: salesModal.lead_name,
          custom_message: salesMsg || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Fehler');
      setSalesResult(data);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSalesLoading(false);
    }
  };

  const filtered = leads.filter((l) =>
    !search || l.email?.toLowerCase().includes(search.toLowerCase()) ||
    l.interest?.toLowerCase().includes(search.toLowerCase())
  );

  const stats = analytics
    ? [
        { label: 'Sessions', value: analytics.total_sessions, icon: MessageSquare, color: '#3B82F6' },
        { label: 'Nachrichten', value: analytics.total_messages, icon: MessageSquare, color: '#8B5CF6' },
        { label: 'Leads', value: analytics.total_leads, icon: Mail, color: '#10B981' },
        { label: 'Conversion', value: `${analytics.conversion_rate}%`, icon: TrendingUp, color: '#F59E0B' },
      ]
    : [];

  // SVG bar chart helper
  const series = analytics?.messages_per_day || [];
  const maxCount = Math.max(1, ...series.map((s) => s.count));

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24" data-testid="admin-landing-leads-page">
      <div className="sticky top-0 z-20 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} data-testid="admin-leads-back" className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center">
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-bold flex items-center gap-2">
              <Users size={18} className="text-blue-400" /> Landing Chatbot Analytics
            </h1>
            <p className="text-[10px] text-blue-400">Sessions · Leads · Conversion · Sales</p>
          </div>
          <button
            onClick={handleExport}
            disabled={exportLoading}
            data-testid="admin-leads-export-csv"
            className="px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg flex items-center gap-1 text-xs font-bold text-emerald-400"
          >
            {exportLoading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            CSV
          </button>
          <button
            onClick={load}
            disabled={loading}
            data-testid="admin-leads-refresh"
            className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-4 mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400" data-testid="admin-leads-error">
          {error}
        </div>
      )}

      <div className="px-4 pt-4 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.label}
                data-testid={`admin-leads-stat-${s.label.toLowerCase()}`}
                className="p-4 rounded-2xl bg-white/[0.03] border border-white/5"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400">{s.label}</span>
                  <Icon size={16} style={{ color: s.color }} />
                </div>
                <div className="text-2xl font-black" style={{ color: s.color }}>
                  {loading ? '…' : s.value}
                </div>
              </div>
            );
          })}
        </div>

        {/* Lead Funnel */}
        {funnel?.funnel?.length > 0 && (
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5" data-testid="admin-leads-funnel">
            <h3 className="text-sm font-bold mb-3 text-emerald-400 flex items-center gap-2">
              <GitBranch size={16} /> Lead-Funnel
            </h3>
            <div className="space-y-2">
              {funnel.funnel.map((stage, idx) => {
                const labels = {
                  chat_started: 'Chat gestartet',
                  email_requested: 'Email angefordert',
                  email_captured: 'Email erfasst',
                  sales_call_sent: 'Sales-Call versendet',
                  sales_call_accepted: 'Sales-Call angenommen',
                };
                const colors = ['#3B82F6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444'];
                const color = colors[idx] || '#6B7280';
                return (
                  <div key={stage.stage} data-testid={`admin-funnel-stage-${stage.stage}`} className="flex items-center gap-3">
                    <div className="w-32 text-xs font-semibold text-gray-300">{labels[stage.stage] || stage.stage}</div>
                    <div className="flex-1 relative h-7 bg-white/5 rounded-md overflow-hidden">
                      <div
                        className="h-full transition-all flex items-center px-2"
                        style={{ width: `${stage.from_top_pct}%`, background: `${color}40`, borderRight: `2px solid ${color}` }}
                      >
                        <span className="text-xs font-bold" style={{ color }}>{stage.count}</span>
                      </div>
                    </div>
                    <div className="w-16 text-right text-[10px] text-gray-400">
                      {stage.from_prev_pct}%
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-4 mt-3 pt-3 border-t border-white/5 text-[10px] text-gray-400">
              <span>🔥 Hot leads: <strong className="text-red-400">{funnel.hot_leads_total}</strong></span>
              <span>📡 Alerts gesendet: <strong className="text-amber-400">{funnel.hot_alerts_sent}</strong></span>
            </div>
          </div>
        )}

        {/* Time-series Chart */}
        {series.length > 0 && (
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5" data-testid="admin-leads-chart">
            <h3 className="text-sm font-bold mb-3 text-blue-400">Nachrichten · 14 Tage</h3>
            <div className="flex items-end gap-1 h-32">
              {series.slice(-14).map((s) => (
                <div key={s.date} className="flex-1 flex flex-col items-center group">
                  <div
                    className="w-full bg-gradient-to-t from-blue-600 to-purple-500 rounded-t transition-all group-hover:opacity-80"
                    style={{ height: `${(s.count / maxCount) * 100}%`, minHeight: '4px' }}
                    title={`${s.date}: ${s.count}`}
                  />
                  <div className="text-[8px] text-gray-500 mt-1">{s.date.slice(5)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top Topics */}
        {analytics?.top_topics?.length > 0 && (
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5" data-testid="admin-leads-topics">
            <h3 className="text-sm font-bold mb-3 text-purple-400">Top-Themen aus Chats</h3>
            <div className="flex flex-wrap gap-2">
              {analytics.top_topics.map((t, idx) => (
                <span
                  key={t.word}
                  className="px-3 py-1 rounded-full text-xs font-semibold"
                  style={{
                    background: `rgba(139, 92, 246, ${0.05 + (10 - idx) * 0.04})`,
                    color: '#A78BFA',
                    border: '1px solid rgba(139, 92, 246, 0.2)',
                  }}
                >
                  {t.word} <span className="text-gray-400">{t.count}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Email/Interest suchen…"
            data-testid="admin-leads-search"
            className="w-full pl-10 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Leads Table */}
        <div className="bg-white/[0.03] border border-white/5 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/5">
            <h3 className="text-sm font-bold">Leads ({filtered.length})</h3>
          </div>
          {loading ? (
            <div className="p-8 flex items-center justify-center text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm" data-testid="admin-leads-empty">
              {search ? 'Keine Treffer.' : 'Noch keine Leads erfasst.'}
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {filtered.map((lead, idx) => {
                const score = lead.lead_score;
                const cat = lead.lead_category;
                const isHot = score >= 70;
                const isWarm = score >= 40 && score < 70;
                const scoreColor = isHot ? '#EF4444' : isWarm ? '#F59E0B' : '#6B7280';
                const scoreEmoji = isHot ? '🔥' : isWarm ? '✨' : '❄️';
                return (
                <div
                  key={lead.email || idx}
                  data-testid={`admin-lead-row-${idx}`}
                  className={`px-4 py-3 hover:bg-white/[0.02] flex items-center justify-between gap-3 ${
                    isHot ? 'border-l-2 border-red-500' : ''
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate flex items-center gap-2" data-testid={`admin-lead-email-${idx}`}>
                      {score !== undefined && score !== null && (
                        <span
                          data-testid={`admin-lead-score-${idx}`}
                          className="px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1"
                          style={{ background: `${scoreColor}20`, color: scoreColor }}
                          title={lead.lead_score_reason || ''}
                        >
                          {scoreEmoji} {score}
                        </span>
                      )}
                      {lead.email}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400">
                        {lead.interest || 'unknown'}
                      </span>
                      <span className="text-gray-500">{lead.source}</span>
                      {cat && (
                        <span className="px-2 py-0.5 rounded bg-white/5 text-gray-300 capitalize">{cat}</span>
                      )}
                      {(lead.lead_tags || []).slice(0, 3).map((t) => (
                        <span key={t} className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-300">
                          {t}
                        </span>
                      ))}
                      {lead.last_sales_call_at && (
                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 flex items-center gap-1">
                          <Check size={10} /> kontaktiert
                        </span>
                      )}
                    </div>
                    {lead.lead_score_reason && (
                      <div className="text-[10px] text-gray-500 mt-1 italic truncate" data-testid={`admin-lead-reason-${idx}`}>
                        {lead.lead_score_reason}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => rescoreLead(lead.session_id)}
                    disabled={!lead.session_id || rescoring[lead.session_id]}
                    data-testid={`admin-lead-rescore-${idx}`}
                    className="p-2 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 disabled:opacity-30"
                    title="Score neu berechnen"
                  >
                    {rescoring[lead.session_id] ? <Loader2 size={14} className="animate-spin" /> : <RotateCw size={14} />}
                  </button>
                  <button
                    onClick={() => openHistory(lead.email)}
                    data-testid={`admin-lead-history-${idx}`}
                    className="p-2 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400"
                    title="Score-Historie"
                  >
                    <Clock size={14} />
                  </button>
                  <button
                    onClick={() => { setSalesModal({ email: lead.email, lead_name: lead.name }); setSalesMsg(''); setSalesResult(null); }}
                    data-testid={`admin-lead-sales-btn-${idx}`}
                    className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 flex items-center gap-1 text-xs font-bold"
                    title="1:1 Demo-Call starten"
                  >
                    <Video size={14} /> Demo
                  </button>
                  <a
                    href={`mailto:${lead.email}`}
                    data-testid={`admin-lead-email-link-${idx}`}
                    className="p-2 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400"
                  >
                    <Mail size={14} />
                  </a>
                </div>
              );})}
            </div>
          )}
        </div>
      </div>

      {/* Sales Invite Modal */}
      {salesModal && (        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a1f] border border-white/10 rounded-2xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Video className="w-5 h-5 text-rose-400" /> 1:1 Demo-Call
              </h3>
              <button onClick={() => setSalesModal(null)} className="text-gray-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            {salesResult ? (
              <div data-testid="admin-sales-result">
                <div className="flex items-center gap-2 text-emerald-400 mb-3">
                  <Check size={18} /> <span className="font-semibold">Einladung erstellt</span>
                </div>
                <div className="bg-black/40 rounded-lg p-3 text-xs space-y-1">
                  <div><span className="text-gray-400">Lead:</span> {salesResult.lead_email}</div>
                  <div><span className="text-gray-400">Raum:</span> <span className="font-mono text-blue-400">{salesResult.room_name}</span></div>
                  <div><span className="text-gray-400">Email-Status:</span>{' '}
                    {salesResult.email_reason === 'sent' && <span className="text-emerald-400">✓ versendet via Resend</span>}
                    {salesResult.email_reason === 'logged_only' && <span className="text-amber-400">⚠ Resend nicht konfiguriert (nur geloggt)</span>}
                    {salesResult.email_reason === 'rejected' && (
                      <span className="text-red-400" title={salesResult.email_error}>
                        ✗ Resend lehnte Adresse ab
                      </span>
                    )}
                  </div>
                  {salesResult.email_error && (
                    <div className="text-red-400 text-[10px] truncate" title={salesResult.email_error}>
                      {salesResult.email_error.slice(0, 120)}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => { window.location.href = '/livekit-stream'; }}
                  className="w-full mt-4 py-2 bg-rose-500 hover:bg-rose-600 rounded-lg font-bold text-sm"
                >
                  Zum LiveKit-Raum wechseln
                </button>
              </div>
            ) : (
              <>
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-4 text-sm">
                  Lead: <strong>{salesModal.email}</strong>
                  {salesModal.lead_name && <span className="text-gray-400"> ({salesModal.lead_name})</span>}
                </div>
                <label className="block text-sm text-gray-300 mb-1">Persönliche Nachricht (optional)</label>
                <textarea
                  value={salesMsg}
                  onChange={(e) => setSalesMsg(e.target.value)}
                  rows={3}
                  data-testid="admin-sales-message"
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  placeholder="z.B. Hallo Max, danke für dein Interesse — gerne zeige ich dir BidBlitz live in 15 Minuten."
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setSalesModal(null)}
                    className="flex-1 py-2 bg-white/5 hover:bg-white/10 rounded-lg"
                  >
                    Abbrechen
                  </button>
                  <button
                    onClick={sendSalesInvite}
                    disabled={salesLoading}
                    data-testid="admin-sales-send"
                    className="flex-1 py-2 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 rounded-lg font-bold flex items-center justify-center gap-2"
                  >
                    {salesLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    Senden
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Score History Modal */}
      {historyModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" data-testid="admin-history-modal">
          <div className="bg-[#1a1a1f] border border-white/10 rounded-2xl p-6 w-full max-w-lg max-h-[80vh] overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Clock className="w-5 h-5 text-cyan-400" /> Score-Historie
              </h3>
              <button onClick={() => setHistoryModal(null)} className="text-gray-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-gray-400 mb-3 break-all">{historyModal.email}</p>

            {historyModal.loading ? (
              <div className="flex items-center justify-center py-8 text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : historyModal.history.length === 0 ? (
              <p className="text-sm text-gray-500 py-6 text-center">Noch keine Score-Einträge.</p>
            ) : (
              <div className="space-y-2">
                {historyModal.history.map((h, idx) => {
                  const isHot = h.score >= 70;
                  const color = isHot ? '#EF4444' : h.score >= 40 ? '#F59E0B' : '#6B7280';
                  return (
                    <div key={idx} data-testid={`admin-history-entry-${idx}`} className="p-3 rounded-lg bg-white/5 border-l-2" style={{ borderColor: color }}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-lg" style={{ color }}>
                          {h.score}/100 · {h.category}
                        </span>
                        <span className="text-[10px] text-gray-500">
                          {new Date(h.scored_at).toLocaleString('de-DE')}
                        </span>
                      </div>
                      <p className="text-xs text-gray-300 italic mb-2">{h.reason}</p>
                      <div className="flex flex-wrap gap-1">
                        {(h.tags || []).map((t) => (
                          <span key={t} className="px-2 py-0.5 rounded-full text-[10px] bg-purple-500/20 text-purple-300">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
