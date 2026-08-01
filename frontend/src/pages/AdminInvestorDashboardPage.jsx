import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";
import { api } from "../services/api";

function pretty(value) {
  return JSON.stringify(value, null, 2);
}

export default function AdminInvestorDashboardPage({ onBack }) {
  const [rawConfig, setRawConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getAdminInvestorDashboardConfig()
      .then((data) => setRawConfig({
        development_status: pretty(data.config?.development_status || []),
        roadmap_progress: pretty(data.config?.roadmap_progress || []),
        product_modules: pretty(data.config?.product_modules || []),
        use_of_capital: pretty(data.config?.use_of_capital || []),
        funding_round: data.config?.funding_round || {},
        contact: data.config?.contact || {},
      }))
      .catch((error) => toast.error(error.message || "Investor-Dashboard-Konfiguration konnte nicht geladen werden."))
      .finally(() => setLoading(false));
  }, []);

  const disabled = loading || !rawConfig;

  const handleSave = async () => {
    setSaving(true);
    try {
      const body = {
        development_status: JSON.parse(rawConfig.development_status),
        roadmap_progress: JSON.parse(rawConfig.roadmap_progress),
        product_modules: JSON.parse(rawConfig.product_modules),
        use_of_capital: JSON.parse(rawConfig.use_of_capital),
        funding_round: rawConfig.funding_round,
        contact: rawConfig.contact,
      };
      await api.updateAdminInvestorDashboardConfig(body);
      toast.success("Investor-Dashboard gespeichert.");
    } catch (error) {
      toast.error(error.message || "Konfiguration konnte nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  };

  if (disabled) return <div className="min-h-screen bg-[#030507]" data-testid="admin-investor-dashboard-loading" />;

  return (
    <div className="min-h-screen bg-[#030507] px-4 py-5 sm:px-5 lg:px-8" data-testid="admin-investor-dashboard-page">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white" data-testid="admin-investor-dashboard-back-button"><ArrowLeft size={18} /></button>
          <div>
            <h1 className="text-3xl font-black text-white">Admin Investor Dashboard</h1>
            <p className="text-sm text-white/62">Funding Round, Roadmap, Development Status, Dokumente, KPIs und Updates pflegen.</p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,0.94fr)_minmax(0,1.06fr)]">
          <EditorCard title="Funding Round">
            <GridInputs>
              <LabeledInput label="Status" value={rawConfig.funding_round.status_label || ""} onChange={(value) => setRawConfig((p) => ({ ...p, funding_round: { ...p.funding_round, status_label: value } }))} testId="admin-investor-dashboard-funding-status" />
              <LabeledInput label="Target amount" value={rawConfig.funding_round.target_amount ?? ""} onChange={(value) => setRawConfig((p) => ({ ...p, funding_round: { ...p.funding_round, target_amount: value === "" ? null : Number(value) } }))} testId="admin-investor-dashboard-funding-target" type="number" />
              <LabeledInput label="Amount reserved" value={rawConfig.funding_round.amount_reserved ?? ""} onChange={(value) => setRawConfig((p) => ({ ...p, funding_round: { ...p.funding_round, amount_reserved: value === "" ? null : Number(value) } }))} testId="admin-investor-dashboard-funding-reserved" type="number" />
              <LabeledInput label="Remaining allocation" value={rawConfig.funding_round.remaining_allocation ?? ""} onChange={(value) => setRawConfig((p) => ({ ...p, funding_round: { ...p.funding_round, remaining_allocation: value === "" ? null : Number(value) } }))} testId="admin-investor-dashboard-funding-remaining" type="number" />
              <LabeledInput label="Minimum investment" value={rawConfig.funding_round.minimum_investment ?? ""} onChange={(value) => setRawConfig((p) => ({ ...p, funding_round: { ...p.funding_round, minimum_investment: value === "" ? null : Number(value) } }))} testId="admin-investor-dashboard-funding-minimum" type="number" />
              <LabeledInput label="Max total equity available" value={rawConfig.funding_round.maximum_total_equity_available ?? ""} onChange={(value) => setRawConfig((p) => ({ ...p, funding_round: { ...p.funding_round, maximum_total_equity_available: value === "" ? null : Number(value) } }))} testId="admin-investor-dashboard-funding-equity" type="number" />
            </GridInputs>
            <div className="mt-4 space-y-2">
              <Label className="text-white">Notes</Label>
              <Textarea value={rawConfig.funding_round.notes || ""} onChange={(e) => setRawConfig((p) => ({ ...p, funding_round: { ...p.funding_round, notes: e.target.value } }))} className="min-h-[120px] border-white/10 bg-white/5 text-white" data-testid="admin-investor-dashboard-funding-notes" />
            </div>
          </EditorCard>

          <EditorCard title="Contact">
            <GridInputs>
              <LabeledInput label="Investor Relations Name" value={rawConfig.contact.investor_relations_name || ""} onChange={(value) => setRawConfig((p) => ({ ...p, contact: { ...p.contact, investor_relations_name: value } }))} testId="admin-investor-dashboard-contact-name" />
              <LabeledInput label="Meeting request route" value={rawConfig.contact.meeting_request_url || ""} onChange={(value) => setRawConfig((p) => ({ ...p, contact: { ...p.contact, meeting_request_url: value } }))} testId="admin-investor-dashboard-contact-meeting-url" />
              <LabeledInput label="Email" value={rawConfig.contact.email || ""} onChange={(value) => setRawConfig((p) => ({ ...p, contact: { ...p.contact, email: value } }))} testId="admin-investor-dashboard-contact-email" />
              <LabeledInput label="Telephone" value={rawConfig.contact.telephone || ""} onChange={(value) => setRawConfig((p) => ({ ...p, contact: { ...p.contact, telephone: value } }))} testId="admin-investor-dashboard-contact-telephone" />
            </GridInputs>
          </EditorCard>
        </div>

        <div className="mt-4 grid gap-4">
          <JsonEditorCard title="Development Status" value={rawConfig.development_status} onChange={(value) => setRawConfig((p) => ({ ...p, development_status: value }))} testId="admin-investor-dashboard-development-json" />
          <JsonEditorCard title="Roadmap Progress" value={rawConfig.roadmap_progress} onChange={(value) => setRawConfig((p) => ({ ...p, roadmap_progress: value }))} testId="admin-investor-dashboard-roadmap-json" />
          <JsonEditorCard title="Product Modules" value={rawConfig.product_modules} onChange={(value) => setRawConfig((p) => ({ ...p, product_modules: value }))} testId="admin-investor-dashboard-modules-json" />
          <JsonEditorCard title="Use of Capital" value={rawConfig.use_of_capital} onChange={(value) => setRawConfig((p) => ({ ...p, use_of_capital: value }))} testId="admin-investor-dashboard-capital-json" />
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <Button onClick={handleSave} disabled={saving} className="rounded-full bg-[#06B6D4] text-[#041018] hover:bg-[#33c7e0]" data-testid="admin-investor-dashboard-save-button">
            {saving ? "Speichert..." : "Dashboard speichern"}
          </Button>
          <Button onClick={() => window.open("/admin/investor-documents", "_self")} variant="outline" className="rounded-full border-white/10 bg-white/5 text-white" data-testid="admin-investor-dashboard-documents-link">
            Dokumente verwalten
          </Button>
          <Button onClick={() => window.open("/admin/investor-updates", "_self")} variant="outline" className="rounded-full border-white/10 bg-white/5 text-white" data-testid="admin-investor-dashboard-updates-link">
            Updates verwalten
          </Button>
        </div>
      </div>
    </div>
  );
}

function EditorCard({ title, children }) {
  return <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5 shadow-[0_18px_42px_rgba(0,0,0,0.22)]"><h2 className="text-2xl font-black text-white">{title}</h2><div className="mt-4">{children}</div></div>;
}

function JsonEditorCard({ title, value, onChange, testId }) {
  return (
    <EditorCard title={title}>
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} className="min-h-[220px] border-white/10 bg-white/5 font-mono text-sm text-white" data-testid={testId} />
    </EditorCard>
  );
}

function GridInputs({ children }) {
  return <div className="grid gap-4 md:grid-cols-2">{children}</div>;
}

function LabeledInput({ label, value, onChange, testId, type = "text" }) {
  return (
    <div className="space-y-2">
      <Label className="text-white">{label}</Label>
      <Input value={value} type={type} onChange={(e) => onChange(e.target.value)} className="border-white/10 bg-white/5 text-white" data-testid={testId} />
    </div>
  );
}