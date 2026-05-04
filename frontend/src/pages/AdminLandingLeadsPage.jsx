import { useState, useEffect } from 'react';
import { ArrowLeft, Mail, MessageSquare, TrendingUp, Users, RefreshCw, Loader2, Search } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function AdminLandingLeadsPage({ onBack }) {
  const [analytics, setAnalytics] = useState(null);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token')}`,
  };

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [aRes, lRes] = await Promise.all([
        fetch(`${API}/api/landing-chatbot/analytics`, { headers, credentials: 'include' }),
        fetch(`${API}/api/landing-chatbot/leads`, { headers, credentials: 'include' }),
      ]);
      if (!aRes.ok) throw new Error('Analytics fehlgeschlagen');
      if (!lRes.ok) throw new Error('Leads fehlgeschlagen');
      setAnalytics(await aRes.json());
      const lj = await lRes.json();
      setLeads(lj.leads || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = leads.filter((l) =>
    !search || l.email?.toLowerCase().includes(search.toLowerCase()) || l.interest?.toLowerCase().includes(search.toLowerCase())
  );

  const stats = analytics
    ? [
        { label: 'Sessions', value: analytics.total_sessions, icon: MessageSquare, color: '#3B82F6' },
        { label: 'Nachrichten', value: analytics.total_messages, icon: MessageSquare, color: '#8B5CF6' },
        { label: 'Leads', value: analytics.total_leads, icon: Mail, color: '#10B981' },
        { label: 'Conversion', value: `${analytics.conversion_rate}%`, icon: TrendingUp, color: '#F59E0B' },
      ]
    : [];

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24" data-testid="admin-landing-leads-page">
      <div className="sticky top-0 z-20 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            data-testid="admin-leads-back"
            className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-bold flex items-center gap-2">
              <Users size={18} className="text-blue-400" /> Landing Chatbot Analytics
            </h1>
            <p className="text-[10px] text-blue-400">Sessions · Leads · Conversion</p>
          </div>
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
              {filtered.map((lead, idx) => (
                <div
                  key={lead.email || idx}
                  data-testid={`admin-lead-row-${idx}`}
                  className="px-4 py-3 hover:bg-white/[0.02] flex items-center justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate" data-testid={`admin-lead-email-${idx}`}>
                      {lead.email}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400">
                        {lead.interest || 'unknown'}
                      </span>
                      <span className="text-gray-500">{lead.source}</span>
                      {lead.session_id && (
                        <span className="text-gray-500 font-mono text-[10px]">
                          {lead.session_id.slice(0, 12)}…
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-[10px] text-gray-500 text-right">
                    {(lead.captured_at || lead.created_at)
                      ? new Date(lead.captured_at || lead.created_at).toLocaleString('de-DE', {
                          day: '2-digit',
                          month: '2-digit',
                          year: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '—'}
                  </div>
                  <a
                    href={`mailto:${lead.email}`}
                    data-testid={`admin-lead-email-link-${idx}`}
                    className="p-2 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400"
                  >
                    <Mail size={14} />
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
