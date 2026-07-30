import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, Plus, Save, SlidersHorizontal, Sparkles, ToggleLeft, ToggleRight, Pencil, MapPin, Store, Tag } from "lucide-react";
import { toast } from "sonner";
import { api } from "../services/api";

const EMPTY_FORM = {
  name: "",
  region: "",
  merchant_slug: "",
  category: "",
  reason_label: "",
  offer_title: "",
  offer_hint: "",
  score_boost: 20,
  priority: 50,
  active: true,
};

export default function AdminChargeOfferRulesPage({ onBack }) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [data, setData] = useState({ rules: [], summary: {} });
  const [editingRuleId, setEditingRuleId] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);

  const loadRules = useCallback(async () => {
    try {
      const response = await api.getChargeOfferRulesAdmin();
      setData(response);
    } catch (error) {
      toast.error(error.message || "Charge-Regeln konnten nicht geladen werden");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  const activeRules = useMemo(() => (data.rules || []).filter((item) => item.active), [data.rules]);

  const resetForm = useCallback(() => {
    setEditingRuleId("");
    setForm(EMPTY_FORM);
  }, []);

  const submitRule = useCallback(async () => {
    if (!form.name.trim()) {
      toast.error("Bitte einen Regelnamen eingeben");
      return;
    }
    setBusy("save");
    try {
      if (editingRuleId) {
        await api.updateChargeOfferRuleAdmin(editingRuleId, form);
        toast.success("Regel aktualisiert");
      } else {
        await api.createChargeOfferRuleAdmin(form);
        toast.success("Regel erstellt");
      }
      resetForm();
      await loadRules();
    } catch (error) {
      toast.error(error.message || "Regel konnte nicht gespeichert werden");
    } finally {
      setBusy("");
    }
  }, [editingRuleId, form, loadRules, resetForm]);

  const toggleRule = useCallback(async (ruleId) => {
    setBusy(`toggle-${ruleId}`);
    try {
      await api.toggleChargeOfferRuleAdmin(ruleId);
      await loadRules();
      toast.success("Regelstatus aktualisiert");
    } catch (error) {
      toast.error(error.message || "Regel konnte nicht umgeschaltet werden");
    } finally {
      setBusy("");
    }
  }, [loadRules]);

  const startEdit = useCallback((rule) => {
    setEditingRuleId(rule.rule_id);
    setForm({
      name: rule.name || "",
      region: rule.region || "",
      merchant_slug: rule.merchant_slug || "",
      category: rule.category || "",
      reason_label: rule.reason_label || "",
      offer_title: rule.offer_title || "",
      offer_hint: rule.offer_hint || "",
      score_boost: Number(rule.score_boost || 0),
      priority: Number(rule.priority || 0),
      active: Boolean(rule.active),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#F4F0E8]" data-testid="admin-charge-offer-rules-loading"><Loader2 size={24} className="animate-spin text-[#00A8D8]" /></div>;
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#08131D_0%,#102233_34%,#F4F0E8_34%,#F4F0E8_100%)] pb-24" data-testid="admin-charge-offer-rules-page">
      <div className="sticky top-0 z-30 border-b border-white/10 bg-[#08131dcc] px-4 py-4 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <button onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5" data-testid="admin-charge-offer-rules-back-button"><ArrowLeft size={18} className="text-white" /></button>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-[0.24em] text-[#6EE7F9]">Charge Admin</p>
            <h1 className="text-xl font-black text-white">Angebotsregeln je Region, Händler und Kategorie</h1>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(110,231,249,0.22),transparent_30%),linear-gradient(135deg,rgba(8,19,29,1),rgba(14,26,43,0.96))] p-6 text-white shadow-[0_24px_80px_rgba(0,0,0,0.35)]" data-testid="admin-charge-offer-rules-hero">
          <div className="grid gap-4 lg:grid-cols-4">
            <HeroStat label="Regeln gesamt" value={data.summary?.total || 0} testid="admin-charge-offer-rules-stat-total" />
            <HeroStat label="Aktiv" value={data.summary?.active || 0} testid="admin-charge-offer-rules-stat-active" />
            <HeroStat label="Regionen" value={data.summary?.regions || 0} testid="admin-charge-offer-rules-stat-regions" />
            <HeroStat label="Kategorien" value={data.summary?.categories || 0} testid="admin-charge-offer-rules-stat-categories" />
          </div>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
          <div className="rounded-[30px] border border-[#D9CFC0] bg-[#F8F3EA] p-5 shadow-[0_18px_48px_rgba(15,23,42,0.08)]" data-testid="admin-charge-offer-rules-form-card">
            <div className="mb-4 flex items-center gap-2"><div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#0A1626] text-[#6EE7F9]"><Sparkles size={16} /></div><h2 className="text-lg font-black text-slate-900">{editingRuleId ? "Regel bearbeiten" : "Neue Regel anlegen"}</h2></div>
            <div className="space-y-3">
              <TextField label="Regelname" value={form.name} onChange={(value) => setForm((prev) => ({ ...prev, name: value }))} testid="admin-charge-offer-rules-name-input" />
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField label="Region / Stadt" value={form.region} onChange={(value) => setForm((prev) => ({ ...prev, region: value }))} testid="admin-charge-offer-rules-region-input" icon={MapPin} />
                <TextField label="Händler-Slug" value={form.merchant_slug} onChange={(value) => setForm((prev) => ({ ...prev, merchant_slug: value }))} testid="admin-charge-offer-rules-merchant-input" icon={Store} />
              </div>
              <TextField label="Kategorie" value={form.category} onChange={(value) => setForm((prev) => ({ ...prev, category: value }))} testid="admin-charge-offer-rules-category-input" icon={Tag} />
              <TextField label="Grundlabel für Nutzer" value={form.reason_label} onChange={(value) => setForm((prev) => ({ ...prev, reason_label: value }))} testid="admin-charge-offer-rules-reason-input" />
              <TextField label="Angebotstitel (optional Override)" value={form.offer_title} onChange={(value) => setForm((prev) => ({ ...prev, offer_title: value }))} testid="admin-charge-offer-rules-offer-title-input" />
              <TextAreaField label="Hinweis / Copy" value={form.offer_hint} onChange={(value) => setForm((prev) => ({ ...prev, offer_hint: value }))} testid="admin-charge-offer-rules-hint-input" />
              <div className="grid gap-3 sm:grid-cols-3">
                <NumberField label="Score-Boost" value={form.score_boost} onChange={(value) => setForm((prev) => ({ ...prev, score_boost: value }))} testid="admin-charge-offer-rules-score-input" />
                <NumberField label="Priorität" value={form.priority} onChange={(value) => setForm((prev) => ({ ...prev, priority: value }))} testid="admin-charge-offer-rules-priority-input" />
                <ToggleField label="Aktiv" checked={form.active} onChange={(value) => setForm((prev) => ({ ...prev, active: value }))} testid="admin-charge-offer-rules-active-toggle" />
              </div>
              <div className="flex flex-wrap gap-3">
                <button onClick={submitRule} disabled={busy === "save"} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#0A1626] px-5 text-sm font-black text-[#D8FCFF] disabled:opacity-50" data-testid="admin-charge-offer-rules-save-button">{busy === "save" ? <Loader2 size={15} className="animate-spin" /> : editingRuleId ? <Save size={15} /> : <Plus size={15} />}{editingRuleId ? "Regel speichern" : "Regel erstellen"}</button>
                {editingRuleId ? <button onClick={resetForm} className="inline-flex h-11 items-center justify-center rounded-2xl border border-[#D9CFC0] bg-white px-5 text-sm font-bold text-slate-700" data-testid="admin-charge-offer-rules-cancel-button">Abbrechen</button> : null}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[30px] border border-[#D9CFC0] bg-[#F8F3EA] p-5 shadow-[0_18px_48px_rgba(15,23,42,0.08)]" data-testid="admin-charge-offer-rules-preview-card">
              <div className="mb-4 flex items-center gap-2"><div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#0A1626] text-[#6EE7F9]"><SlidersHorizontal size={16} /></div><h2 className="text-lg font-black text-slate-900">Wie die Regeln wirken</h2></div>
              <div className="space-y-3 text-sm text-slate-600">
                <p>Aktive Regeln verstärken personalisierte Charge-Angebote zusätzlich zur bestehenden Nutzerlogik.</p>
                <div className="flex flex-wrap gap-2">
                  {(activeRules || []).slice(0, 4).map((item, index) => <span key={item.rule_id} className="rounded-full bg-[#0A1626] px-3 py-1 text-xs font-black text-[#6EE7F9]" data-testid={`admin-charge-offer-rules-preview-item-${index}`}>{item.name} +{item.score_boost}</span>)}
                </div>
              </div>
            </div>

            <div className="rounded-[30px] border border-[#D9CFC0] bg-[#F8F3EA] p-5 shadow-[0_18px_48px_rgba(15,23,42,0.08)]" data-testid="admin-charge-offer-rules-list-card">
              <div className="mb-4 flex items-center gap-2"><div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#0A1626] text-[#6EE7F9]"><Store size={16} /></div><h2 className="text-lg font-black text-slate-900">Bestehende Regeln</h2></div>
              <div className="space-y-3">
                {(data.rules || []).length === 0 ? <div className="rounded-2xl border border-dashed border-[#D9CFC0] bg-white/60 px-4 py-8 text-center text-sm text-slate-500" data-testid="admin-charge-offer-rules-empty">Noch keine Regeln angelegt</div> : (data.rules || []).map((rule, index) => (
                  <div key={rule.rule_id} className="rounded-[26px] border border-[#E1D7C7] bg-white p-4" data-testid={`admin-charge-offer-rule-item-${index}`}>
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-[#0A1626] px-3 py-1 text-[11px] font-black text-[#6EE7F9]">+{rule.score_boost}</span>
                          <span className={`rounded-full px-3 py-1 text-[11px] font-black ${rule.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`} data-testid={`admin-charge-offer-rule-status-${index}`}>{rule.active ? "aktiv" : "inaktiv"}</span>
                          <span className="rounded-full border border-[#D9CFC0] px-3 py-1 text-[11px] font-semibold text-slate-600">Prio {rule.priority}</span>
                        </div>
                        <h3 className="mt-3 text-base font-black text-slate-900">{rule.name}</h3>
                        <p className="mt-1 text-sm text-slate-600">{rule.offer_hint || rule.reason_label || "Charge-Regel aktiv"}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {rule.region ? <RuleChip label={`Region: ${rule.region}`} testid={`admin-charge-offer-rule-region-${index}`} /> : null}
                          {rule.merchant_slug ? <RuleChip label={`Händler: ${rule.merchant_slug}`} testid={`admin-charge-offer-rule-merchant-${index}`} /> : null}
                          {rule.category ? <RuleChip label={`Kategorie: ${rule.category}`} testid={`admin-charge-offer-rule-category-${index}`} /> : null}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        <button onClick={() => startEdit(rule)} className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-[#D9CFC0] bg-white px-4 text-xs font-black text-slate-700" data-testid={`admin-charge-offer-rule-edit-${index}`}><Pencil size={14} />Bearbeiten</button>
                        <button onClick={() => toggleRule(rule.rule_id)} disabled={busy === `toggle-${rule.rule_id}`} className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl bg-[#0A1626] px-4 text-xs font-black text-[#D8FCFF] disabled:opacity-50" data-testid={`admin-charge-offer-rule-toggle-${index}`}>{busy === `toggle-${rule.rule_id}` ? <Loader2 size={14} className="animate-spin" /> : rule.active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}{rule.active ? "Deaktivieren" : "Aktivieren"}</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroStat({ label, value, testid }) {
  return <div className="rounded-[24px] border border-white/8 bg-white/5 p-4" data-testid={testid}><p className="text-[11px] uppercase tracking-[0.18em] text-slate-300">{label}</p><p className="mt-3 text-2xl font-black text-white">{value}</p></div>;
}

function TextField({ label, value, onChange, testid, icon: Icon }) {
  return (
    <label className="block" data-testid={`${testid}-wrapper`}>
      <span className="mb-1 block text-xs font-semibold text-slate-600">{label}</span>
      <div className="relative">
        {Icon ? <Icon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /> : null}
        <input value={value} onChange={(e) => onChange(e.target.value)} className={`h-11 w-full rounded-2xl border border-[#D9CFC0] bg-white ${Icon ? "pl-10" : "pl-4"} pr-4 text-sm text-slate-900 outline-none`} data-testid={testid} />
      </div>
    </label>
  );
}

function TextAreaField({ label, value, onChange, testid }) {
  return <label className="block" data-testid={`${testid}-wrapper`}><span className="mb-1 block text-xs font-semibold text-slate-600">{label}</span><textarea value={value} onChange={(e) => onChange(e.target.value)} rows={4} className="w-full rounded-2xl border border-[#D9CFC0] bg-white px-4 py-3 text-sm text-slate-900 outline-none" data-testid={testid} /></label>;
}

function NumberField({ label, value, onChange, testid }) {
  return <label className="block" data-testid={`${testid}-wrapper`}><span className="mb-1 block text-xs font-semibold text-slate-600">{label}</span><input type="number" value={value} onChange={(e) => onChange(Number(e.target.value || 0))} className="h-11 w-full rounded-2xl border border-[#D9CFC0] bg-white px-4 text-sm text-slate-900 outline-none" data-testid={testid} /></label>;
}

function ToggleField({ label, checked, onChange, testid }) {
  return <label className="block" data-testid={`${testid}-wrapper`}><span className="mb-1 block text-xs font-semibold text-slate-600">{label}</span><button type="button" onClick={() => onChange(!checked)} className={`flex h-11 w-full items-center justify-between rounded-2xl border px-4 text-sm font-black ${checked ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-500"}`} data-testid={testid}><span>{checked ? "Aktiv" : "Inaktiv"}</span>{checked ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}</button></label>;
}

function RuleChip({ label, testid }) {
  return <span className="rounded-full border border-[#D9CFC0] px-3 py-1 text-[11px] font-semibold text-slate-600" data-testid={testid}>{label}</span>;
}