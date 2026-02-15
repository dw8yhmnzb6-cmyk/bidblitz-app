import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Building2, Mail, Lock, ArrowRight, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

export default function WholesaleLogin() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    email: '',
    password: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const res = await fetch(`${API}/api/wholesale/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.detail || 'Login fehlgeschlagen');
      }
      
      // Store wholesale token separately
      localStorage.setItem('wholesale_token', data.token);
      localStorage.setItem('wholesale_customer', JSON.stringify(data.customer));
      
      toast.success(`Willkommen zurück, ${data.customer.company_name}!`);
      navigate('/b2b/dashboard');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-900 flex flex-col">
      {/* Header */}
      <div className="bg-slate-900/50 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-xl font-bold text-white">bidblitz.ae</span>
              <span className="text-cyan-400 font-bold ml-1">B2B</span>
            </div>
          </Link>
          <Link to="/b2b/register">
            <Button variant="outline" size="sm" className="border-slate-600 text-slate-300 hover:bg-slate-800">
              Noch kein Konto? Registrieren
            </Button>
          </Link>
        </div>
      </div>

      {/* Login Form */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white">Großkunden-Login</h1>
            <p className="text-slate-400 mt-2">Zugang zu Ihrem B2B-Portal</p>
          </div>
          
          <form onSubmit={handleSubmit} className="bg-slate-800/50 backdrop-blur rounded-2xl p-6 border border-slate-700 space-y-5">
            <div>
              <Label className="text-slate-300">E-Mail</Label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({...form, email: e.target.value})}
                  placeholder="b2b@firma.de"
                  className="pl-10 bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>
            </div>
            
            <div>
              <Label className="text-slate-300">Passwort</Label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  type="password"
                  required
                  value={form.password}
                  onChange={(e) => setForm({...form, password: e.target.value})}
                  placeholder="Ihr Passwort"
                  className="pl-10 bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>
            </div>
            
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white py-6"
            >
              {loading ? 'Wird eingeloggt...' : 'Einloggen'}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </form>
          
          {/* Info Box */}
          <div className="mt-6 p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/30">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-slate-300">
                <p className="font-medium text-cyan-400">Noch kein Großkunden-Konto?</p>
                <p className="mt-1">
                  <Link to="/b2b/register" className="text-cyan-400 hover:text-cyan-300 underline">
                    Jetzt registrieren
                  </Link>
                  {' '}und von exklusiven B2B-Rabatten profitieren.
                </p>
              </div>
            </div>
          </div>
          
          {/* Back to main site */}
          <div className="text-center mt-6">
            <Link to="/" className="text-slate-500 hover:text-slate-400 text-sm">
              ← Zurück zur Hauptseite
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
