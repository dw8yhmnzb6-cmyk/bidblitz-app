import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, BarChart3, Clock, Flame, Loader2, MapPin, Search, ShieldCheck, ShoppingBag, Sparkles, Store, Target, Zap } from "lucide-react";
import { api } from "../../services/api";
import { toast } from "sonner";

const colors = ["#00D4FF", "#10D981", "#FFB800", "#FF5A5A", "#A78BFA"];

export const AdminCustomerIntelligenceTab = () => {
  const [days, setDays] = useState(365);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [query, setQuery] = useState("");
  const [acting, setActing] = useState("");
  const [templateForm, setTemplateForm] = useState({ name: "", action_type: "coupon_push_alert", coupon_value: 5, message: "", segment: "vip_seconds_buyers" });
  const [ruleForm, setRuleForm] = useState({ name: "", template_id: "", segment: "vip_seconds_buyers", min_total_revenue: 100, max_distance_km: 1, cooldown_hours: 24, daily_cap: 25, active: true });

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.getAdminCustomerIntelligence(days);
      setData(res);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [days]);

  const customers = useMemo(() => {
    const rows = data?.top_customers || [];
    if (!query.trim()) return rows;
    const q = query.toLowerCase();
    return rows.filter((row) => `${row.user?.name || ""} ${row.user?.email || ""} ${row.user?.user_number || ""}`.toLowerCase().includes(q));
  }, [data, query]);

  const maxMonth = Math.max(...(data?.timeline_monthly || []).map((row) => row.seconds_revenue + row.commerce_revenue + row.pos_revenue), 1);

  const executeRadarAction = async (alert, actionType, templateId = "") => {
    const userId = alert?.user?.user_id;
    if (!userId) return toast.error("Kunde fehlt");
    setActing(`${alert.alert_id}-${actionType}`);
    try {
      const result = await api.executeAdminCustomerRadarAction({
        action_type: actionType,
        user_id: userId,
        alert_id: alert.alert_id,
        store_id: alert.store?.store_id || "",
        merchant_id: alert.store?.merchant_id || "",
        template_id: templateId,
        coupon_value: alert.severity === "high" ? 10 : 5,
        message: alert.recommended_action || "Persönliches BidBlitz-Angebot",
      });
      toast.success(result?.coupon?.code ? `Aktion ausgeführt: ${result.coupon.code}` : "Radar-Aktion ausgeführt");
      await load();
    } catch (error) {
      toast.error(error.message || "Radar-Aktion fehlgeschlagen");
    } finally {
      setActing("");
    }
  };

  const createTemplate = async () => {
    if (!templateForm.name.trim() || !templateForm.message.trim()) return toast.error("Template-Name und Nachricht eingeben");
    setActing("create-template");
    try {
      await api.createAdminCustomerRadarTemplate(templateForm);
      toast.success("Kampagnen-Template gespeichert");
      setTemplateForm({ name: "", action_type: "coupon_push_alert", coupon_value: 5, message: "", segment: "vip_seconds_buyers" });
      await load();
    } catch (error) {
      toast.error(error.message || "Template konnte nicht gespeichert werden");
    } finally {
      setActing("");
    }
  };

  const createRule = async () => {
    const templateId = ruleForm.template_id || data?.campaign_templates?.[0]?.template_id || "";
    if (!ruleForm.name.trim() || !templateId) return toast.error("Rule-Name und Template wählen");
    setActing("create-rule");
    try {
      await api.createAdminCustomerRadarRule({ ...ruleForm, template_id: templateId });
      toast.success("Automation Rule gespeichert");
      setRuleForm({ name: "", template_id: "", segment: "vip_seconds_buyers", min_total_revenue: 100, max_distance_km: 1, cooldown_hours: 24, daily_cap: 25, active: true });
      await load();
    } catch (error) {
      toast.error(error.message || "Rule konnte nicht gespeichert werden");
    } finally {
      setActing("");
    }
  };

  const runRule = async (rule, dryRun = true) => {
    setActing(`${rule.rule_id}-${dryRun ? "dry" : "run"}`);
    try {
      const result = await api.runAdminCustomerRadarRule({ rule_id: rule.rule_id, dry_run: dryRun, days });
      toast.success(dryRun ? `${result.run.match_count} Treffer simuliert` : `${result.run.executed_count} Aktionen ausgeführt`);
      await load();
    } catch (error) {
      toast.error(error.message || "Rule Run fehlgeschlagen");
    } finally {
      setActing("");
    }
  };

  if (loading && !data) {
    return <div data-testid="admin-customer-intelligence-loading" className="py-20 flex justify-center"><Loader2 size={22} className="animate-spin text-[#00D4FF]" /></div>;
  }

  return (
    <motion.div data-testid="admin-customer-intelligence-tab" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/35 font-semibold">Customer Intelligence</p>
          <h2 className="text-xl font-bold text-white mt-1">Sekunden, Käufe, Shops & Standortkarte</h2>
        </div>
        <select value={days} onChange={(event) => setDays(Number(event.target.value))} data-testid="admin-ci-period-select" className="rounded-xl bg-white/[0.04] border border-white/[0.08] px-3 py-2 text-xs text-white outline-none">
          <option value={30}>30 Tage</option>
          <option value={90}>90 Tage</option>
          <option value={365}>Jahr</option>
          <option value={1095}>3 Jahre</option>
        </select>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5" data-testid="admin-ci-summary-grid">
        <InsightCard icon={Clock} label="Sekunden-Käufe" value={data?.summary?.seconds_purchases || 0} sub={`€${money(data?.summary?.seconds_revenue)} · ${data?.summary?.seconds_credits || 0} Credits`} color="#00D4FF" testId="admin-ci-seconds-summary" />
        <InsightCard icon={ShoppingBag} label="Commerce" value={data?.summary?.commerce_orders || 0} sub={`€${money(data?.summary?.commerce_revenue)}`} color="#10D981" testId="admin-ci-commerce-summary" />
        <InsightCard icon={Store} label="POS Shops" value={data?.summary?.pos_sales || 0} sub={`€${money(data?.summary?.pos_revenue)} · ${data?.summary?.visited_stores || 0} Stores`} color="#FFB800" testId="admin-ci-pos-summary" />
        <InsightCard icon={MapPin} label="Live Signale" value={data?.summary?.located_customers || 0} sub={`${data?.summary?.store_visit_matches || 0} Shop-Matches`} color="#FF5A5A" testId="admin-ci-location-summary" />
      </div>

      <section className="grid lg:grid-cols-[1.2fr_0.8fr] gap-3" data-testid="admin-ci-radar-section">
        <div className="rounded-2xl p-3 border border-white/[0.05] bg-white/[0.02]" data-testid="admin-ci-radar-alerts-panel">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2"><Target size={14} className="text-[#FF5A5A]" /><p className="text-[10px] uppercase tracking-widest text-white/35 font-semibold">Live Radar Alerts</p></div>
            <span className="text-[9px] text-white/30">{data?.radar_alerts?.length || 0} Signale</span>
          </div>
          <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
            {(data?.radar_alerts || []).length === 0 ? <p className="py-5 text-center text-[11px] text-white/30" data-testid="admin-ci-radar-empty">Keine Radar-Alerts</p> : (data?.radar_alerts || []).slice(0, 8).map((alert) => <RadarAlertRow key={alert.alert_id} alert={alert} onAction={executeRadarAction} acting={acting} />)}
          </div>
        </div>
        <div className="rounded-2xl p-3 border border-white/[0.05] bg-white/[0.02]" data-testid="admin-ci-privacy-panel">
          <div className="flex items-center gap-2 mb-3"><ShieldCheck size={14} className="text-[#10D981]" /><p className="text-[10px] uppercase tracking-widest text-white/35 font-semibold">Privacy Guard</p></div>
          <PolicyRow label="Präzise Rohdaten" value={`${data?.privacy_policy?.precise_location_retention_hours || 24}h`} />
          <PolicyRow label="Analytics Retention" value={`${data?.privacy_policy?.aggregated_analytics_retention_days || 1095} Tage`} />
          <PolicyRow label="Zugriff" value="Admin + Audit" />
          <p className="mt-3 text-[10px] leading-relaxed text-white/35" data-testid="admin-ci-privacy-next-step">{data?.privacy_policy?.recommended_next_step}</p>
        </div>
      </section>

      <section className="grid lg:grid-cols-[0.9fr_1.1fr] gap-3" data-testid="admin-ci-campaign-section">
        <div className="rounded-2xl p-3 border border-white/[0.05] bg-white/[0.02]" data-testid="admin-ci-template-panel">
          <div className="flex items-center justify-between mb-3"><p className="text-[10px] uppercase tracking-widest text-white/35 font-semibold">Kampagnen-Templates</p><span className="text-[9px] text-white/30">{data?.campaign_templates?.length || 0}</span></div>
          <div className="space-y-2 mb-3 max-h-[180px] overflow-y-auto pr-1">
            {(data?.campaign_templates || []).slice(0, 8).map((tpl) => <TemplateRow key={tpl.template_id} template={tpl} alerts={data?.radar_alerts || []} onApply={executeRadarAction} acting={acting} />)}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input value={templateForm.name} onChange={(e) => setTemplateForm((p) => ({ ...p, name: e.target.value }))} placeholder="Template Name" data-testid="admin-ci-template-name-input" className="rounded-xl bg-white/[0.04] border border-white/[0.07] px-3 py-2 text-xs text-white outline-none" />
            <select value={templateForm.action_type} onChange={(e) => setTemplateForm((p) => ({ ...p, action_type: e.target.value }))} data-testid="admin-ci-template-action-select" className="rounded-xl bg-white/[0.04] border border-white/[0.07] px-3 py-2 text-xs text-white outline-none"><option value="coupon_push_alert">Auto</option><option value="coupon">Coupon</option><option value="push">Push</option><option value="manager_alert">Manager</option></select>
            <input type="number" min="0" max="100" value={templateForm.coupon_value} onChange={(e) => setTemplateForm((p) => ({ ...p, coupon_value: Number(e.target.value) }))} placeholder="€" data-testid="admin-ci-template-value-input" className="rounded-xl bg-white/[0.04] border border-white/[0.07] px-3 py-2 text-xs text-white outline-none" />
            <select value={templateForm.segment} onChange={(e) => setTemplateForm((p) => ({ ...p, segment: e.target.value }))} data-testid="admin-ci-template-segment-select" className="rounded-xl bg-white/[0.04] border border-white/[0.07] px-3 py-2 text-xs text-white outline-none"><option value="vip_seconds_buyers">VIP Sekunden</option><option value="omnichannel_buyers">Omnichannel</option><option value="pos_loyalists">POS Loyal</option><option value="dormant_high_value">Reaktivierung</option><option value="all">Alle</option></select>
          </div>
          <textarea value={templateForm.message} onChange={(e) => setTemplateForm((p) => ({ ...p, message: e.target.value }))} placeholder="Nachricht" rows={2} data-testid="admin-ci-template-message-input" className="mt-2 w-full rounded-xl bg-white/[0.04] border border-white/[0.07] px-3 py-2 text-xs text-white outline-none" />
          <button onClick={createTemplate} disabled={acting === "create-template"} data-testid="admin-ci-template-save-button" className="mt-2 w-full rounded-xl bg-[#00D4FF]/15 border border-[#00D4FF]/25 px-3 py-2 text-xs font-bold text-[#00D4FF] disabled:opacity-50">{acting === "create-template" ? "Speichert…" : "Template speichern"}</button>
        </div>
        <div className="rounded-2xl p-3 border border-white/[0.05] bg-white/[0.02]" data-testid="admin-ci-metrics-panel">
          <p className="text-[10px] uppercase tracking-widest text-white/35 font-semibold mb-3">Erfolgsmessung</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
            <MetricPill label="Actions" value={data?.campaign_metrics?.total_actions || 0} />
            <MetricPill label="Coupons" value={data?.campaign_metrics?.coupons_issued || 0} />
            <MetricPill label="Redeemed" value={data?.campaign_metrics?.coupons_redeemed || 0} />
            <MetricPill label="Rate" value={`${data?.campaign_metrics?.redemption_rate || 0}%`} />
          </div>
          <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1" data-testid="admin-ci-history-timeline">
            {(data?.radar_history || []).length === 0 ? <p className="py-6 text-center text-[11px] text-white/30">Noch keine Radar-Actions</p> : (data?.radar_history || []).slice(0, 18).map((item) => <HistoryRow key={item.action_id} item={item} />)}
          </div>
        </div>
      </section>

      <section className="rounded-2xl p-3 border border-white/[0.05] bg-white/[0.02]" data-testid="admin-ci-automation-rule-center">
        <div className="flex items-center justify-between gap-3 mb-3"><p className="text-[10px] uppercase tracking-widest text-white/35 font-semibold">Automation Rule Center</p><span className="text-[9px] text-white/30">{data?.automation_rules?.length || 0} Regeln</span></div>
        <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-3">
          <div className="rounded-xl bg-black/20 border border-white/[0.04] p-3" data-testid="admin-ci-rule-form">
            <div className="grid grid-cols-2 gap-2">
              <input value={ruleForm.name} onChange={(e) => setRuleForm((p) => ({ ...p, name: e.target.value }))} placeholder="Rule Name" data-testid="admin-ci-rule-name-input" className="rounded-xl bg-white/[0.04] border border-white/[0.07] px-3 py-2 text-xs text-white outline-none" />
              <select value={ruleForm.template_id} onChange={(e) => setRuleForm((p) => ({ ...p, template_id: e.target.value }))} data-testid="admin-ci-rule-template-select" className="rounded-xl bg-white/[0.04] border border-white/[0.07] px-3 py-2 text-xs text-white outline-none"><option value="">Template wählen</option>{(data?.campaign_templates || []).map((tpl) => <option key={tpl.template_id} value={tpl.template_id}>{tpl.name}</option>)}</select>
              <select value={ruleForm.segment} onChange={(e) => setRuleForm((p) => ({ ...p, segment: e.target.value }))} data-testid="admin-ci-rule-segment-select" className="rounded-xl bg-white/[0.04] border border-white/[0.07] px-3 py-2 text-xs text-white outline-none"><option value="vip_seconds_buyers">VIP Sekunden</option><option value="omnichannel_buyers">Omnichannel</option><option value="pos_loyalists">POS Loyal</option><option value="dormant_high_value">Reaktivierung</option><option value="all">Alle</option></select>
              <select value={ruleForm.trigger_type || "customer_near_shop"} onChange={(e) => setRuleForm((p) => ({ ...p, trigger_type: e.target.value }))} data-testid="admin-ci-rule-trigger-select" className="rounded-xl bg-white/[0.04] border border-white/[0.07] px-3 py-2 text-xs text-white outline-none"><option value="customer_near_shop">Kunde nahe Shop</option><option value="vip_seconds_buyer">VIP Segment</option></select>
              <input type="number" value={ruleForm.min_total_revenue} onChange={(e) => setRuleForm((p) => ({ ...p, min_total_revenue: Number(e.target.value) }))} placeholder="Min Umsatz" data-testid="admin-ci-rule-min-revenue-input" className="rounded-xl bg-white/[0.04] border border-white/[0.07] px-3 py-2 text-xs text-white outline-none" />
              <input type="number" step="0.1" value={ruleForm.max_distance_km} onChange={(e) => setRuleForm((p) => ({ ...p, max_distance_km: Number(e.target.value) }))} placeholder="Radius km" data-testid="admin-ci-rule-distance-input" className="rounded-xl bg-white/[0.04] border border-white/[0.07] px-3 py-2 text-xs text-white outline-none" />
              <input type="number" value={ruleForm.cooldown_hours} onChange={(e) => setRuleForm((p) => ({ ...p, cooldown_hours: Number(e.target.value) }))} placeholder="Cooldown h" data-testid="admin-ci-rule-cooldown-input" className="rounded-xl bg-white/[0.04] border border-white/[0.07] px-3 py-2 text-xs text-white outline-none" />
              <input type="number" min="1" max="250" value={ruleForm.daily_cap} onChange={(e) => setRuleForm((p) => ({ ...p, daily_cap: Number(e.target.value) }))} placeholder="Daily Cap" data-testid="admin-ci-rule-daily-cap-input" className="rounded-xl bg-white/[0.04] border border-white/[0.07] px-3 py-2 text-xs text-white outline-none" />
            </div>
            <button onClick={createRule} disabled={acting === "create-rule"} data-testid="admin-ci-rule-save-button" className="mt-2 w-full rounded-xl bg-[#A78BFA]/15 border border-[#A78BFA]/25 px-3 py-2 text-xs font-bold text-[#C4B5FD] disabled:opacity-50">{acting === "create-rule" ? "Speichert…" : "Automation Rule speichern"}</button>
          </div>
          <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1" data-testid="admin-ci-rule-list">
            {(data?.automation_rules || []).length === 0 ? <p className="text-center text-[11px] text-white/30 py-8">Noch keine Automation Rules</p> : (data?.automation_rules || []).map((rule) => <RuleRow key={rule.rule_id} rule={rule} onRun={runRule} acting={acting} />)}
          </div>
        </div>
      </section>

      <section className="rounded-2xl p-3 border border-white/[0.05] bg-white/[0.02]" data-testid="admin-ci-map-panel">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] uppercase tracking-widest text-white/35 font-semibold">Kundenkarte</p>
          <span className="text-[9px] text-white/30">{data?.map?.customers?.length || 0} Kunden · {data?.map?.stores?.length || 0} Shops</span>
        </div>
        <div className="relative aspect-[16/9] min-h-[260px] overflow-hidden rounded-xl" style={{ background: "linear-gradient(135deg, rgba(0,212,255,0.12), rgba(16,217,129,0.08)), radial-gradient(circle at 20% 30%, rgba(255,255,255,0.08), transparent 22%), #071018" }}>
          <MapGrid />
          <div className="absolute left-3 bottom-3 z-10 flex items-center gap-3 rounded-xl bg-black/35 border border-white/10 px-3 py-2" data-testid="admin-ci-map-legend">
            <span className="flex items-center gap-1.5 text-[10px] text-white/60"><i className="w-2.5 h-2.5 rounded-full bg-[#00D4FF]" /> Kunde</span>
            <span className="flex items-center gap-1.5 text-[10px] text-white/60"><i className="w-2.5 h-2.5 rounded-full bg-[#FFB800]" /> Shop</span>
          </div>
          {(data?.map?.stores || []).map((store, index) => <MapDot key={store.marker_id} item={store} index={index} type="store" />)}
          {(data?.map?.customers || []).map((customer, index) => <MapDot key={customer.marker_id} item={customer} index={index} type="customer" />)}
          {(data?.heatmap || []).slice(0, 10).map((cell, index) => <HeatDot key={cell.cell_id} cell={cell} index={index} />)}
        </div>
      </section>

      <section className="grid lg:grid-cols-4 gap-2.5" data-testid="admin-ci-segments-panel">
        <SegmentCard icon={Sparkles} title="VIP Sekunden" rows={data?.segments?.vip_seconds_buyers || []} testId="admin-ci-segment-vip" />
        <SegmentCard icon={Zap} title="Omnichannel" rows={data?.segments?.omnichannel_buyers || []} testId="admin-ci-segment-omni" />
        <SegmentCard icon={Store} title="POS Loyal" rows={data?.segments?.pos_loyalists || []} testId="admin-ci-segment-pos" />
        <SegmentCard icon={Flame} title="Reaktivieren" rows={data?.segments?.dormant_high_value || []} testId="admin-ci-segment-dormant" />
      </section>

      <section className="rounded-2xl p-3 border border-white/[0.05] bg-white/[0.02]" data-testid="admin-ci-yearly-analysis-panel">
        <div className="flex items-center gap-2 mb-3"><BarChart3 size={14} className="text-[#00D4FF]" /><p className="text-[10px] uppercase tracking-widest text-white/35 font-semibold">Jahresanalyse</p></div>
        <div className="space-y-2">
          {(data?.timeline_yearly || []).map((row) => (
            <div key={row.year} className="grid grid-cols-[52px_1fr_78px] items-center gap-3" data-testid={`admin-ci-year-${row.year}`}>
              <span className="text-xs font-bold text-white/75">{row.year}</span>
              <div className="h-3 rounded-full overflow-hidden bg-white/[0.04] flex">
                <div style={{ width: `${pct(row.seconds_revenue, row.total_revenue)}%`, background: colors[0] }} />
                <div style={{ width: `${pct(row.commerce_revenue, row.total_revenue)}%`, background: colors[1] }} />
                <div style={{ width: `${pct(row.pos_revenue, row.total_revenue)}%`, background: colors[2] }} />
              </div>
              <span className="text-right text-xs font-bold text-white">€{money(row.total_revenue)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl p-3 border border-white/[0.05] bg-white/[0.02]" data-testid="admin-ci-monthly-chart-panel">
        <p className="text-[10px] uppercase tracking-widest text-white/35 font-semibold mb-3">Monatlicher Verlauf</p>
        <div className="flex items-end gap-1.5 h-32 overflow-x-auto pb-1">
          {(data?.timeline_monthly || []).map((row) => {
            const total = row.seconds_revenue + row.commerce_revenue + row.pos_revenue;
            return <div key={row.month} className="min-w-[28px] flex flex-col items-center gap-1" data-testid={`admin-ci-month-${row.month}`}><div className="w-5 rounded-t-md bg-[#00D4FF]" style={{ height: `${Math.max(4, (total / maxMonth) * 110)}px` }} /><span className="text-[8px] text-white/30 rotate-[-35deg] origin-top-left">{row.month.slice(5)}</span></div>;
          })}
        </div>
      </section>

      <section className="rounded-2xl p-3 border border-white/[0.05] bg-white/[0.02]" data-testid="admin-ci-customer-list-panel">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 flex items-center gap-2 rounded-xl bg-white/[0.04] border border-white/[0.07] px-3 py-2">
            <Search size={13} className="text-white/25" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Kunde suchen" data-testid="admin-ci-customer-search-input" className="bg-transparent outline-none text-xs text-white flex-1 placeholder:text-white/25" />
          </div>
        </div>
        <div className="space-y-2">
          {customers.slice(0, 20).map((row) => <CustomerRow key={row.user.user_id} row={row} onClick={() => setSelectedCustomer(row)} />)}
        </div>
      </section>

      <section className="rounded-2xl p-3 border border-white/[0.05] bg-white/[0.02]" data-testid="admin-ci-recent-events-panel">
        <p className="text-[10px] uppercase tracking-widest text-white/35 font-semibold mb-3">Letzte Sekunden-Käufe</p>
        <div className="space-y-2">
          {(data?.recent_seconds_purchases || []).slice(0, 10).map((item) => <EventRow key={item.event_id} item={item} />)}
        </div>
      </section>

      {selectedCustomer && <CustomerDrawer row={selectedCustomer} onClose={() => setSelectedCustomer(null)} days={days} />}
    </motion.div>
  );
};

function InsightCard({ icon: Icon, label, value, sub, color, testId }) {
  return <div data-testid={testId} className="rounded-2xl p-3 border border-white/[0.05] bg-white/[0.02]"><div className="flex items-center gap-1.5 mb-2"><Icon size={13} style={{ color }} /><span className="text-[9px] uppercase tracking-widest text-white/35">{label}</span></div><p className="text-lg font-black text-white">{value}</p><p className="text-[10px] text-white/35 mt-0.5">{sub}</p></div>;
}

function MapGrid() {
  return <div className="absolute inset-0 opacity-25" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />;
}

function MapDot({ item, index, type }) {
  const left = `${10 + ((Math.abs(Number(item.lng || 0)) * 37 + index * 11) % 78)}%`;
  const top = `${12 + ((Math.abs(Number(item.lat || 0)) * 41 + index * 7) % 70)}%`;
  const color = type === "customer" ? "#00D4FF" : "#FFB800";
  return <div className="absolute group" style={{ left, top }} data-testid={`admin-ci-map-${type}-marker`}><div className="w-3 h-3 rounded-full" style={{ background: color, boxShadow: `0 0 20px ${color}` }} /><div className="absolute left-4 top-[-10px] hidden group-hover:block whitespace-nowrap rounded-lg bg-black/80 border border-white/10 px-2 py-1 text-[10px] text-white z-20">{type === "customer" ? item.user?.name : item.store_name}</div></div>;
}

function HeatDot({ cell, index }) {
  const left = `${8 + ((Math.abs(Number(cell.lng || 0)) * 29 + index * 13) % 82)}%`;
  const top = `${10 + ((Math.abs(Number(cell.lat || 0)) * 31 + index * 9) % 72)}%`;
  const size = 26 + Math.min(54, Number(cell.intensity || 0));
  return <div className="absolute rounded-full pointer-events-none" data-testid="admin-ci-heatmap-cell" style={{ left, top, width: size, height: size, transform: "translate(-50%, -50%)", background: "radial-gradient(circle, rgba(255,90,90,0.26), rgba(255,184,0,0.12), transparent 68%)" }} />;
}

function RadarAlertRow({ alert, onAction, acting }) {
  const high = alert.severity === "high";
  return <div data-testid={`admin-ci-radar-alert-${alert.alert_id}`} className="rounded-xl bg-black/20 border border-white/[0.04] px-3 py-2.5"><div className="flex items-start gap-2"><AlertTriangle size={14} className={high ? "text-[#FF5A5A]" : "text-[#FFB800]"} /><div className="min-w-0 flex-1"><p className="text-xs font-bold text-white truncate">{alert.title}</p><p className="text-[10px] text-white/45 mt-0.5">{alert.message}</p><p className="text-[9px] text-[#00D4FF] mt-1">{alert.recommended_action}</p><div className="mt-2 grid grid-cols-4 gap-1.5"><RadarActionButton testId={`admin-ci-radar-coupon-${alert.alert_id}`} disabled={Boolean(acting)} loading={acting === `${alert.alert_id}-coupon`} onClick={() => onAction(alert, "coupon")}>Coupon</RadarActionButton><RadarActionButton testId={`admin-ci-radar-push-${alert.alert_id}`} disabled={Boolean(acting)} loading={acting === `${alert.alert_id}-push`} onClick={() => onAction(alert, "push")}>Push</RadarActionButton><RadarActionButton testId={`admin-ci-radar-manager-alert-${alert.alert_id}`} disabled={Boolean(acting)} loading={acting === `${alert.alert_id}-manager_alert`} onClick={() => onAction(alert, "manager_alert")}>Manager</RadarActionButton><RadarActionButton testId={`admin-ci-radar-combo-${alert.alert_id}`} disabled={Boolean(acting)} loading={acting === `${alert.alert_id}-coupon_push_alert`} onClick={() => onAction(alert, "coupon_push_alert")}>Auto</RadarActionButton></div></div></div></div>;
}

function RadarActionButton({ children, onClick, disabled, loading, testId }) {
  return <button type="button" onClick={onClick} disabled={disabled} data-testid={testId} className="rounded-lg bg-white/[0.05] border border-white/[0.06] px-2 py-1.5 text-[9px] font-bold text-white/70 disabled:opacity-50 active:scale-95 transition-transform">{loading ? <Loader2 size={11} className="animate-spin mx-auto" /> : children}</button>;
}

function PolicyRow({ label, value }) {
  return <div className="flex items-center justify-between py-1.5 border-b border-white/[0.04] last:border-b-0" data-testid={`admin-ci-policy-${label.toLowerCase().replace(/\s+/g, "-")}`}><span className="text-[10px] text-white/35">{label}</span><span className="text-[10px] font-bold text-white/70">{value}</span></div>;
}

function SegmentCard({ icon: Icon, title, rows, testId }) {
  return <div data-testid={testId} className="rounded-2xl p-3 border border-white/[0.05] bg-white/[0.02]"><div className="flex items-center justify-between mb-2"><div className="flex items-center gap-1.5"><Icon size={13} className="text-[#00D4FF]" /><p className="text-[10px] uppercase tracking-widest text-white/35 font-semibold">{title}</p></div><span className="text-[10px] font-bold text-white/50">{rows.length}</span></div><div className="space-y-1.5">{rows.slice(0, 3).map((row) => <div key={row.user.user_id} className="rounded-lg bg-black/18 px-2 py-1.5"><p className="text-[11px] font-bold text-white truncate">{row.user.name}</p><p className="text-[9px] text-white/35">€{money(row.total_revenue)} · {row.channels || 1} Kanäle</p></div>)}{rows.length === 0 && <p className="py-3 text-center text-[10px] text-white/25">Noch keine Treffer</p>}</div></div>;
}

function TemplateRow({ template, alerts, onApply, acting }) {
  const firstAlert = alerts?.[0];
  return <div data-testid={`admin-ci-template-row-${template.template_id}`} className="rounded-xl bg-black/20 border border-white/[0.04] px-3 py-2"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="text-xs font-bold text-white truncate">{template.name}</p><p className="text-[9px] text-white/35 truncate">{template.action_type} · €{money(template.coupon_value)} · {template.segment}</p></div><button type="button" disabled={!firstAlert || Boolean(acting)} onClick={() => onApply(firstAlert, template.action_type, template.template_id)} data-testid={`admin-ci-template-apply-${template.template_id}`} className="rounded-lg bg-[#10D981]/12 border border-[#10D981]/20 px-2 py-1 text-[9px] font-bold text-[#10D981] disabled:opacity-40">Apply</button></div><p className="mt-1 text-[9px] text-white/30 line-clamp-2">{template.message}</p></div>;
}

function MetricPill({ label, value }) {
  return <div data-testid={`admin-ci-metric-${label.toLowerCase()}`} className="rounded-xl bg-black/20 border border-white/[0.04] p-2"><p className="text-[9px] uppercase tracking-widest text-white/30">{label}</p><p className="text-sm font-black text-white mt-0.5">{value}</p></div>;
}

function HistoryRow({ item }) {
  return <div data-testid={`admin-ci-history-${item.action_id}`} className="rounded-xl bg-black/20 border border-white/[0.04] px-3 py-2 flex items-center justify-between gap-3"><div className="min-w-0"><p className="text-xs font-bold text-white truncate">{item.action_type} · {item.user?.name || item.user_id}</p><p className="text-[9px] text-white/30 truncate">{String(item.created_at || "").slice(0, 16).replace("T", " ")} · {item.coupon_code || item.manager_alert_id || item.notification_id || "Action"}</p></div><span className="text-[9px] text-[#00D4FF] font-bold">{item.template_id || "manual"}</span></div>;
}

function RuleRow({ rule, onRun, acting }) {
  return <div data-testid={`admin-ci-rule-row-${rule.rule_id}`} className="rounded-xl bg-black/20 border border-white/[0.04] px-3 py-2"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-bold text-white truncate">{rule.name}</p><p className="text-[9px] text-white/35 truncate">{rule.segment} · €{money(rule.min_total_revenue)} · {rule.max_distance_km}km · {rule.cooldown_hours}h</p>{rule.last_result && <p className="text-[9px] text-[#00D4FF] mt-1">Letzter Lauf: {rule.last_result.match_count} Treffer / {rule.last_result.executed_count} ausgeführt</p>}</div><span className={`text-[9px] font-bold ${rule.active ? "text-[#10D981]" : "text-white/30"}`}>{rule.active ? "AKTIV" : "INAKTIV"}</span></div><div className="mt-2 grid grid-cols-2 gap-2"><button type="button" onClick={() => onRun(rule, true)} disabled={Boolean(acting)} data-testid={`admin-ci-rule-simulate-${rule.rule_id}`} className="rounded-lg bg-white/[0.05] border border-white/[0.06] px-2 py-1.5 text-[9px] font-bold text-white/70 disabled:opacity-50">{acting === `${rule.rule_id}-dry` ? "…" : "Simulieren"}</button><button type="button" onClick={() => onRun(rule, false)} disabled={Boolean(acting) || !rule.active} data-testid={`admin-ci-rule-run-${rule.rule_id}`} className="rounded-lg bg-[#10D981]/12 border border-[#10D981]/20 px-2 py-1.5 text-[9px] font-bold text-[#10D981] disabled:opacity-50">{acting === `${rule.rule_id}-run` ? "…" : "Ausführen"}</button></div></div>;
}

function CustomerRow({ row, onClick }) {
  return <button onClick={onClick} data-testid={`admin-ci-customer-row-${row.user.user_id}`} className="w-full rounded-xl bg-black/20 border border-white/[0.04] px-3 py-2.5 flex items-center justify-between gap-3 text-left"><div className="min-w-0"><p className="text-sm font-bold text-white truncate">{row.user.name}</p><p className="text-[10px] text-white/35 truncate">{row.user.email || row.user.user_number || row.user.user_id}</p></div><div className="text-right"><p className="text-sm font-black text-[#00D4FF]">€{money(row.total_revenue)}</p><p className="text-[9px] text-white/30">{row.purchases} Events</p></div></button>;
}

function EventRow({ item }) {
  return <div data-testid={`admin-ci-seconds-event-${item.event_id}`} className="rounded-xl bg-black/20 border border-white/[0.04] px-3 py-2 flex items-center justify-between gap-3"><div className="min-w-0"><p className="text-xs font-semibold text-white truncate">{item.description}</p><p className="text-[9px] text-white/30 truncate">{item.reference || item.user_id} · {String(item.created_at || "").slice(0, 16).replace("T", " ")}</p></div><div className="text-right"><p className="text-xs font-black text-[#10D981]">€{money(item.amount)}</p><p className="text-[9px] text-white/30">{item.credits} Credits</p></div></div>;
}

function CustomerDrawer({ row, onClose, days }) {
  const [detail, setDetail] = useState(null);
  useEffect(() => { api.getAdminCustomerIntelligenceCustomer(row.user.user_id, days).then(setDetail).catch(() => setDetail(null)); }, [row.user.user_id, days]);
  return <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end" data-testid="admin-ci-customer-drawer"><motion.div initial={{ y: 320 }} animate={{ y: 0 }} className="w-full max-h-[78vh] overflow-y-auto rounded-t-3xl bg-[#070A10] border-t border-white/10 p-5"><div className="flex items-center justify-between mb-4"><div><p className="text-lg font-black text-white">{row.user.name}</p><p className="text-xs text-white/35">{row.user.email}</p></div><button onClick={onClose} data-testid="admin-ci-customer-drawer-close" className="rounded-xl bg-white/[0.06] px-3 py-2 text-xs text-white">Schließen</button></div>{detail ? <div className="space-y-3"><div className="grid grid-cols-2 gap-2"><InsightCard icon={Zap} label="Sekunden" value={detail.summary.seconds_purchases} sub={`€${money(detail.summary.seconds_revenue)}`} color="#00D4FF" testId="admin-ci-drawer-seconds" /><InsightCard icon={MapPin} label="Standorte" value={detail.summary.location_signals} sub={`${detail.summary.store_visit_matches} Shop-Matches`} color="#FF5A5A" testId="admin-ci-drawer-locations" /></div>{detail.store_visit_matches?.length > 0 && <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-3"><p className="text-[10px] uppercase tracking-widest text-white/35 mb-2">Shop-Besuche</p>{detail.store_visit_matches.map((visit, idx) => <p key={`${visit.store_name}-${idx}`} className="text-xs text-white/70 py-1">{visit.store_name} · {visit.distance_km} km</p>)}</div>}</div> : <Loader2 size={18} className="animate-spin text-[#00D4FF]" />}</motion.div></div>;
}

function money(value) {
  return Number(value || 0).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pct(value, total) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, (Number(value || 0) / Number(total || 1)) * 100));
}