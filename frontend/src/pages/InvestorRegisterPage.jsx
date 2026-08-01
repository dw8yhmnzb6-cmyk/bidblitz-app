import { useState } from "react";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { toast } from "sonner";
import { api } from "../services/api";
import { InvestorAuthShell } from "../components/investor/InvestorAuthShell";

export default function InvestorRegisterPage({ onBack, onNavigate }) {
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", phone: "", company: "", investor_type: "private", password: "", locale: "de" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      await api.investorPortalRegister(form);
      toast.success("Investor-Portal-Konto angelegt.");
      onNavigate("/investor-portal");
    } catch (error) {
      toast.error(error.message || "Registrierung fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <InvestorAuthShell
      title="Investor Registrierung"
      subtitle="Lege ein separates Investor-Portal-Konto an. Dieses Portal ist nur für Informationen, Dokumente, Rückfragen und Meetings gedacht – nicht für Wallet- oder Kartenzahlungen."
      onBack={onBack}
      footer={
        <div className="mt-5 text-sm text-white/62">
          Bereits registriert?{" "}
          <button className="font-bold text-[#82E7FF]" onClick={() => onNavigate("/investor-login")} data-testid="investor-register-switch-login">
            Zum Login
          </button>
        </div>
      }
    >
      <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit} data-testid="investor-register-form">
        {[
          ["Vorname", "first_name", "text"],
          ["Nachname", "last_name", "text"],
          ["E-Mail", "email", "email"],
          ["Telefon", "phone", "text"],
          ["Firma / Organisation", "company", "text"],
          ["Passwort", "password", "password"],
        ].map(([label, key, type]) => (
          <div key={key} className={`space-y-2 ${key === "company" ? "md:col-span-2" : ""}`}>
            <Label htmlFor={`investor-register-${key}`} className="text-white">{label}</Label>
            <Input id={`investor-register-${key}`} data-testid={`investor-register-${key}`} type={type} value={form[key]} onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))} className="border-white/10 bg-white/5 text-white" />
          </div>
        ))}
        <div className="space-y-2 md:col-span-2">
          <Label className="text-white">Investorentyp</Label>
          <Select value={form.investor_type} onValueChange={(value) => setForm((p) => ({ ...p, investor_type: value }))}>
            <SelectTrigger className="border-white/10 bg-white/5 text-white" data-testid="investor-register-investor-type">
              <SelectValue placeholder="Investorentyp wählen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="private">Privatanleger</SelectItem>
              <SelectItem value="strategic">Strategischer Investor</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" disabled={loading} className="h-12 rounded-full bg-[#06B6D4] text-[#041018] hover:bg-[#33c7e0] md:col-span-2" data-testid="investor-register-submit-button">
          {loading ? "Bitte warten..." : "Investor-Konto erstellen"}
        </Button>
      </form>
    </InvestorAuthShell>
  );
}