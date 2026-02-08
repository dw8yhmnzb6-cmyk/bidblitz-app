import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Building2, Mail, Phone, Globe, FileText, Users, Lock, ArrowRight, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

export default function WholesaleRegister() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({
    company_name: '',
    contact_name: '',
    email: '',
    phone: '',
    password: '',
    password_confirm: '',
    website: '',
    tax_id: '',
    expected_volume: '500-1000',
    message: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (form.password !== form.password_confirm) {
      toast.error('Passwörter stimmen nicht überein');
      return;
    }
    
    if (form.password.length < 8) {
      toast.error('Passwort muss mindestens 8 Zeichen lang sein');
      return;
    }
    
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/wholesale/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: form.company_name,
          contact_name: form.contact_name,
          email: form.email,
          phone: form.phone,
          password: form.password,
          website: form.website || null,
          tax_id: form.tax_id || null,
          expected_volume: form.expected_volume,
          message: form.message || null
        })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.detail || 'Registrierung fehlgeschlagen');
      }
      
      setSuccess(true);
      toast.success('Registrierung erfolgreich!');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-4">Registrierung erfolgreich!</h1>
          <p className="text-slate-300 mb-8">
            Vielen Dank für Ihre Registrierung. Ihr Konto wird innerhalb von 24-48 Stunden geprüft und freigeschaltet.
            Sie erhalten eine E-Mail, sobald Ihr Konto aktiviert ist.
          </p>
          <div className="space-y-3">
            <Link to="/b2b/login">
              <Button className="w-full bg-cyan-500 hover:bg-cyan-600 text-white">
                Zum Login
              </Button>
            </Link>
            <Link to="/">
              <Button variant="outline" className="w-full border-slate-600 text-slate-300 hover:bg-slate-800">
                Zur Hauptseite
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-900">
      {/* Header */}
      <div className="bg-slate-900/50 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-xl font-bold text-white">BidBlitz</span>
              <span className="text-cyan-400 font-bold ml-1">B2B</span>
            </div>
          </Link>
          <Link to="/b2b/login">
            <Button variant="outline" size="sm" className="border-slate-600 text-slate-300 hover:bg-slate-800">
              Bereits registriert? Login
            </Button>
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="grid md:grid-cols-5 gap-8">
          {/* Benefits Sidebar */}
          <div className="md:col-span-2 space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Großkunden-Portal</h1>
              <p className="text-slate-400">Registrieren Sie sich für exklusive B2B-Vorteile</p>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-emerald-400 font-bold">%</span>
                </div>
                <div>
                  <h3 className="text-white font-semibold">Dauerhafter Rabatt</h3>
                  <p className="text-slate-400 text-sm">Bis zu 20% auf alle Gebote-Pakete</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-white font-semibold">Flexible Zahlungsziele</h3>
                  <p className="text-slate-400 text-sm">Netto 15 oder 30 Tage auf Rechnung</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                  <Users className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-white font-semibold">Persönlicher Ansprechpartner</h3>
                  <p className="text-slate-400 text-sm">Dedizierter Account Manager für Sie</p>
                </div>
              </div>
            </div>
          </div>

          {/* Registration Form */}
          <div className="md:col-span-3">
            <form onSubmit={handleSubmit} className="bg-slate-800/50 backdrop-blur rounded-2xl p-6 border border-slate-700 space-y-5">
              <h2 className="text-xl font-bold text-white mb-4">Registrierung</h2>
              
              {/* Company Info */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-300">Firmenname *</Label>
                  <div className="relative mt-1">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <Input
                      required
                      value={form.company_name}
                      onChange={(e) => setForm({...form, company_name: e.target.value})}
                      placeholder="Musterfirma GmbH"
                      className="pl-10 bg-slate-900/50 border-slate-600 text-white"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-slate-300">Ansprechpartner *</Label>
                  <Input
                    required
                    value={form.contact_name}
                    onChange={(e) => setForm({...form, contact_name: e.target.value})}
                    placeholder="Max Mustermann"
                    className="mt-1 bg-slate-900/50 border-slate-600 text-white"
                  />
                </div>
              </div>
              
              {/* Contact Info */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-300">E-Mail *</Label>
                  <div className="relative mt-1">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <Input
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => setForm({...form, email: e.target.value})}
                      placeholder="b2b@firma.de"
                      className="pl-10 bg-slate-900/50 border-slate-600 text-white"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-slate-300">Telefon *</Label>
                  <div className="relative mt-1">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <Input
                      required
                      value={form.phone}
                      onChange={(e) => setForm({...form, phone: e.target.value})}
                      placeholder="+49 123 456789"
                      className="pl-10 bg-slate-900/50 border-slate-600 text-white"
                    />
                  </div>
                </div>
              </div>
              
              {/* Password */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-300">Passwort *</Label>
                  <div className="relative mt-1">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <Input
                      type="password"
                      required
                      value={form.password}
                      onChange={(e) => setForm({...form, password: e.target.value})}
                      placeholder="Min. 8 Zeichen"
                      className="pl-10 bg-slate-900/50 border-slate-600 text-white"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-slate-300">Passwort bestätigen *</Label>
                  <div className="relative mt-1">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <Input
                      type="password"
                      required
                      value={form.password_confirm}
                      onChange={(e) => setForm({...form, password_confirm: e.target.value})}
                      placeholder="Passwort wiederholen"
                      className="pl-10 bg-slate-900/50 border-slate-600 text-white"
                    />
                  </div>
                </div>
              </div>
              
              {/* Optional Info */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-300">Website</Label>
                  <div className="relative mt-1">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <Input
                      value={form.website}
                      onChange={(e) => setForm({...form, website: e.target.value})}
                      placeholder="www.firma.de"
                      className="pl-10 bg-slate-900/50 border-slate-600 text-white"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-slate-300">Steuernummer / USt-IdNr.</Label>
                  <Input
                    value={form.tax_id}
                    onChange={(e) => setForm({...form, tax_id: e.target.value})}
                    placeholder="DE123456789"
                    className="mt-1 bg-slate-900/50 border-slate-600 text-white"
                  />
                </div>
              </div>
              
              {/* Volume */}
              <div>
                <Label className="text-slate-300">Erwartetes monatliches Volumen (Gebote) *</Label>
                <select
                  value={form.expected_volume}
                  onChange={(e) => setForm({...form, expected_volume: e.target.value})}
                  className="w-full mt-1 px-4 py-2 rounded-lg bg-slate-900/50 border border-slate-600 text-white"
                >
                  <option value="100-500">100 - 500 Gebote</option>
                  <option value="500-1000">500 - 1.000 Gebote</option>
                  <option value="1000-5000">1.000 - 5.000 Gebote</option>
                  <option value="5000-10000">5.000 - 10.000 Gebote</option>
                  <option value="10000+">10.000+ Gebote</option>
                </select>
              </div>
              
              {/* Message */}
              <div>
                <Label className="text-slate-300">Nachricht (optional)</Label>
                <textarea
                  value={form.message}
                  onChange={(e) => setForm({...form, message: e.target.value})}
                  placeholder="Erzählen Sie uns mehr über Ihr Unternehmen..."
                  rows={3}
                  className="w-full mt-1 px-4 py-2 rounded-lg bg-slate-900/50 border border-slate-600 text-white resize-none"
                />
              </div>
              
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white py-6"
              >
                {loading ? 'Wird gesendet...' : 'Jetzt registrieren'}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              
              <p className="text-xs text-slate-500 text-center">
                Mit der Registrierung akzeptieren Sie unsere AGB und Datenschutzrichtlinien.
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
