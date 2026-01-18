import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Zap, Mail, Lock, Eye, EyeOff, Shield, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Login() {
  const { refreshUser } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const formRef = useRef(null);
  const hasAutoLoginAttempted = useRef(false);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!email || !password) return;
    setLoading(true);

    try {
      const response = await axios.post(`${API}/auth/login`, {
        email,
        password,
        two_factor_code: twoFactorCode || null
      });

      // Check if 2FA is required
      if (response.data.requires_2fa) {
        setRequires2FA(true);
        toast.info('Bitte geben Sie Ihren 2FA-Code ein');
        setLoading(false);
        return;
      }

      // Login successful
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      await refreshUser();
      toast.success('Erfolgreich angemeldet!');
      navigate('/dashboard');
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Anmeldung fehlgeschlagen';
      toast.error(errorMsg);
      
      // Reset 2FA code on error
      if (requires2FA) {
        setTwoFactorCode('');
      }
    } finally {
      setLoading(false);
    }
  };

  // Auto-login when browser auto-fills credentials
  useEffect(() => {
    const checkAutoFill = () => {
      if (hasAutoLoginAttempted.current) return;
      
      const emailInput = formRef.current?.querySelector('input[type="email"]');
      const passwordInput = formRef.current?.querySelector('input[type="password"]');
      
      if (emailInput && passwordInput) {
        // Check if browser has auto-filled the fields
        const autoFilledEmail = emailInput.value || email;
        const autoFilledPassword = passwordInput.value || password;
        
        if (autoFilledEmail && autoFilledPassword && autoFilledEmail !== email) {
          setEmail(autoFilledEmail);
          setPassword(autoFilledPassword);
          hasAutoLoginAttempted.current = true;
          // Auto-submit after a short delay
          setTimeout(() => {
            handleSubmit();
          }, 500);
        }
      }
    };

    // Check after a short delay to allow browser autofill
    const timer = setTimeout(checkAutoFill, 800);
    
    // Also listen for input events (some browsers trigger these on autofill)
    const handleInput = (e) => {
      if (e.target.matches('input[type="email"], input[type="password"]')) {
        setTimeout(checkAutoFill, 100);
      }
    };
    
    document.addEventListener('input', handleInput);
    
    return () => {
      clearTimeout(timer);
      document.removeEventListener('input', handleInput);
    };
  }, [email, password]);

  return (
    <div className="min-h-screen pt-24 pb-12 px-4 flex items-center justify-center" data-testid="login-page">
      <div className="w-full max-w-md">
        <div className="glass-card rounded-2xl p-8">
          {/* Logo */}
          <div className="text-center mb-8">
            <Link to="/" className="inline-flex items-center gap-2">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#06B6D4] flex items-center justify-center">
                <Zap className="w-7 h-7 text-white" />
              </div>
            </Link>
            <h1 className="text-2xl font-bold text-white mt-4">Willkommen zurück</h1>
            <p className="text-[#94A3B8] mt-2">
              {requires2FA ? 'Zwei-Faktor-Authentifizierung' : 'Melden Sie sich an, um fortzufahren'}
            </p>
          </div>

          <form ref={formRef} onSubmit={handleSubmit} className="space-y-6" autoComplete="on">
            {!requires2FA ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-white">E-Mail</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="ihre@email.de"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="pl-10 h-12 bg-[#181824] border-white/10 text-white placeholder:text-[#475569]"
                      data-testid="email-input"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-white">Passwort</Label>
                    <Link to="/forgot-password" className="text-sm text-[#7C3AED] hover:underline">
                      Passwort vergessen?
                    </Link>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="pl-10 pr-10 h-12 bg-[#181824] border-white/10 text-white placeholder:text-[#475569]"
                      data-testid="password-input"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-white"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <div className="text-center p-4 rounded-xl bg-[#7C3AED]/10 border border-[#7C3AED]/30">
                  <Shield className="w-12 h-12 text-[#7C3AED] mx-auto mb-3" />
                  <p className="text-white font-medium">2FA-Code erforderlich</p>
                  <p className="text-[#94A3B8] text-sm">Geben Sie den Code aus Ihrer Authenticator-App ein</p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="twoFactorCode" className="text-white">6-stelliger Code</Label>
                  <Input
                    id="twoFactorCode"
                    type="text"
                    placeholder="000000"
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    required
                    autoFocus
                    className="h-14 text-center text-2xl font-mono tracking-[0.5em] bg-[#181824] border-white/10 text-white"
                    data-testid="2fa-input"
                    maxLength={6}
                  />
                </div>
                
                <button
                  type="button"
                  onClick={() => {
                    setRequires2FA(false);
                    setTwoFactorCode('');
                  }}
                  className="text-[#94A3B8] hover:text-white text-sm underline w-full text-center"
                >
                  Zurück zur Anmeldung
                </button>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading || (requires2FA && twoFactorCode.length !== 6)}
              className="w-full btn-primary py-3 h-auto"
              data-testid="login-submit"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Wird angemeldet...
                </>
              ) : requires2FA ? (
                'Code bestätigen'
              ) : (
                'Anmelden'
              )}
            </Button>
          </form>

          {!requires2FA && (
            <div className="mt-6 text-center">
              <p className="text-[#94A3B8]">
                Noch kein Konto?{' '}
                <Link to="/register" className="text-[#7C3AED] hover:underline font-medium">
                  Jetzt registrieren
                </Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
