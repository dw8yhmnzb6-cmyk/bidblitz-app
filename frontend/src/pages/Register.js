import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { usePageTranslations } from '../i18n/pageTranslations';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Zap, Mail, Lock, Eye, EyeOff, User, Gift, Users } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Register() {
  const { language } = useLanguage();
  const texts = usePageTranslations(language);
  const { register } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Referral code from URL
  const [referralCode, setReferralCode] = useState('');
  const [referralValid, setReferralValid] = useState(null);
  const [affiliateName, setAffiliateName] = useState('');

  useEffect(() => {
    const refCode = searchParams.get('ref');
    if (refCode) {
      setReferralCode(refCode);
      validateReferralCode(refCode);
    }
  }, [searchParams]);

  const validateReferralCode = async (code) => {
    try {
      const response = await axios.get(`${API}/affiliates/referral/${code}`);
      setReferralValid(response.data.valid);
      if (response.data.valid) {
        setAffiliateName(response.data.affiliate_name);
      }
    } catch (error) {
      setReferralValid(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error(texts.passwordMismatch);
      return;
    }

    if (password.length < 6) {
      toast.error(texts.passwordTooShort);
      return;
    }

    setLoading(true);

    try {
      await register(name, email, password, referralValid ? referralCode : null);
      toast.success(texts.registerSuccess);
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.detail || texts.registerFailed);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-12 px-4 flex items-center justify-center" data-testid="register-page">
      <div className="w-full max-w-md">
        <div className="glass-card rounded-2xl p-8">
          {/* Logo */}
          <div className="text-center mb-8">
            <Link to="/" className="inline-flex items-center gap-2">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#06B6D4] flex items-center justify-center">
                <Zap className="w-7 h-7 text-white" />
              </div>
            </Link>
            <h1 className="text-2xl font-bold text-white mt-4">{texts.createAccount}</h1>
            <p className="text-[#94A3B8] mt-2">{texts.startBiddingToday}</p>
          </div>

          {/* Free bids banner */}
          <div className="flex items-center gap-3 p-4 rounded-lg bg-[#10B981]/10 border border-[#10B981]/30 mb-6">
            <Gift className="w-6 h-6 text-[#10B981] flex-shrink-0" />
            <div>
              <p className="text-[#10B981] font-bold">{texts.freeBids}</p>
              <p className="text-[#94A3B8] text-sm">{texts.onRegistration}</p>
            </div>
          </div>

          {/* Referral Banner */}
          {referralValid && (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-[#FFD700]/10 border border-[#FFD700]/30 mb-6">
              <Users className="w-6 h-6 text-[#FFD700] flex-shrink-0" />
              <div>
                <p className="text-[#FFD700] font-bold">{texts.referredBy} {affiliateName}</p>
                <p className="text-[#94A3B8] text-sm">{texts.bonusBids}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-white">{texts.name}</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
                <Input
                  id="name"
                  type="text"
                  placeholder={texts.enterName}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="pl-10 h-12 bg-[#181824] border-white/10 text-white placeholder:text-[#475569]"
                  data-testid="name-input"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-white">{texts.email}</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
                <Input
                  id="email"
                  type="email"
                  placeholder={texts.enterEmail}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pl-10 h-12 bg-[#181824] border-white/10 text-white placeholder:text-[#475569]"
                  data-testid="email-input"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-white">{texts.password}</Label>
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

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-white">{texts.confirmPassword}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
                <Input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="pl-10 h-12 bg-[#181824] border-white/10 text-white placeholder:text-[#475569]"
                  data-testid="confirm-password-input"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full btn-primary py-3 h-auto"
              data-testid="register-submit"
            >
              {loading ? texts.registering : texts.registerButton}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-[#94A3B8]">
              {texts.hasAccount}{' '}
              <Link to="/login" className="text-[#7C3AED] hover:underline font-medium">
                {texts.loginHere}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
