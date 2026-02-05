import { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Mail, ArrowLeft, CheckCircle, Key, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function ForgotPassword() {
  const [step, setStep] = useState(1); // 1: Email, 2: Code, 3: New Password
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleRequestReset = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API}/auth/forgot-password`, { email });
      toast.success('Reset-Code wurde an Ihre E-Mail gesendet');
      setStep(2);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler beim Senden des Reset-Codes');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API}/auth/verify-reset-code`, { email, code });
      toast.success('Code verifiziert');
      setStep(3);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ungültiger Code');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast.error('Passwörter stimmen nicht überein');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Passwort muss mindestens 6 Zeichen lang sein');
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API}/auth/reset-password`, { 
        email, 
        code, 
        new_password: newPassword 
      });
      setSuccess(true);
      toast.success('Passwort erfolgreich geändert!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler beim Zurücksetzen des Passworts');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen pt-24 pb-12 px-4 flex items-center justify-center">
        <div className="w-full max-w-md">
          <div className="glass-card rounded-2xl p-8 text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-[#10B981]/20 flex items-center justify-center mx-auto">
              <CheckCircle className="w-10 h-10 text-[#10B981]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800 mb-2">Passwort geändert!</h1>
              <p className="text-gray-500">
                Ihr Passwort wurde erfolgreich zurückgesetzt. Sie können sich jetzt mit Ihrem 
                neuen Passwort anmelden.
              </p>
            </div>
            <Link to="/login">
              <Button className="w-full btn-primary">
                Zur Anmeldung
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-12 px-4 flex items-center justify-center" data-testid="forgot-password-page">
      <div className="w-full max-w-md">
        <Link to="/login" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-800 mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Zurück zur Anmeldung
        </Link>

        <div className="glass-card rounded-2xl p-8 space-y-6">
          {/* Progress */}
          <div className="flex items-center justify-center gap-2 mb-4">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`w-3 h-3 rounded-full transition-colors ${
                  s === step ? 'bg-[#FFD700]' : s < step ? 'bg-[#10B981]' : 'bg-white/20'
                }`}
              />
            ))}
          </div>

          {/* Step 1: Email */}
          {step === 1 && (
            <>
              <div className="text-center">
                <div className="w-16 h-16 rounded-xl bg-[#FFD700]/20 flex items-center justify-center mx-auto mb-4">
                  <Mail className="w-8 h-8 text-[#FFD700]" />
                </div>
                <h1 className="text-2xl font-bold text-gray-800 mb-2">Passwort vergessen?</h1>
                <p className="text-gray-500">
                  Geben Sie Ihre E-Mail-Adresse ein und wir senden Ihnen einen Code zum Zurücksetzen.
                </p>
              </div>

              <form onSubmit={handleRequestReset} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-gray-800">E-Mail-Adresse</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ihre@email.de"
                    required
                    className="bg-white border-gray-200 text-gray-800 h-12"
                    data-testid="email-input"
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full btn-primary h-12"
                  disabled={loading}
                  data-testid="submit-email-btn"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    'Reset-Code senden'
                  )}
                </Button>
              </form>
            </>
          )}

          {/* Step 2: Code */}
          {step === 2 && (
            <>
              <div className="text-center">
                <div className="w-16 h-16 rounded-xl bg-[#7C3AED]/20 flex items-center justify-center mx-auto mb-4">
                  <Key className="w-8 h-8 text-[#7C3AED]" />
                </div>
                <h1 className="text-2xl font-bold text-gray-800 mb-2">Code eingeben</h1>
                <p className="text-gray-500">
                  Wir haben einen 6-stelligen Code an <span className="text-gray-800">{email}</span> gesendet.
                </p>
              </div>

              <form onSubmit={handleVerifyCode} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-gray-800">Reset-Code</Label>
                  <Input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="ABC123"
                    maxLength={6}
                    required
                    className="bg-white border-gray-200 text-gray-800 h-12 text-center text-2xl tracking-widest font-mono"
                    data-testid="code-input"
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full btn-primary h-12"
                  disabled={loading}
                  data-testid="verify-code-btn"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    'Code verifizieren'
                  )}
                </Button>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="w-full text-gray-500 hover:text-gray-800 text-sm transition-colors"
                >
                  Anderen E-Mail verwenden
                </button>
              </form>
            </>
          )}

          {/* Step 3: New Password */}
          {step === 3 && (
            <>
              <div className="text-center">
                <div className="w-16 h-16 rounded-xl bg-[#10B981]/20 flex items-center justify-center mx-auto mb-4">
                  <Key className="w-8 h-8 text-[#10B981]" />
                </div>
                <h1 className="text-2xl font-bold text-gray-800 mb-2">Neues Passwort</h1>
                <p className="text-gray-500">
                  Geben Sie Ihr neues Passwort ein.
                </p>
              </div>

              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-gray-800">Neues Passwort</Label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mindestens 6 Zeichen"
                    required
                    minLength={6}
                    className="bg-white border-gray-200 text-gray-800 h-12"
                    data-testid="new-password-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-800">Passwort bestätigen</Label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Passwort wiederholen"
                    required
                    className="bg-white border-gray-200 text-gray-800 h-12"
                    data-testid="confirm-password-input"
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full btn-primary h-12"
                  disabled={loading}
                  data-testid="reset-password-btn"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    'Passwort ändern'
                  )}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
