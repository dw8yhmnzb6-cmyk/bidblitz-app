import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { usePageTranslations } from '../i18n/pageTranslations';
import { getFeatureTranslation } from '../i18n/featureTranslations';
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
  const commonT = getFeatureTranslation('common', language);
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
    <div className="min-h-screen pt-24 pb-12 px-4 flex items-center justify-center bg-gradient-to-b from-cyan-50 to-cyan-100" data-testid="register-page">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl p-8 shadow-xl border border-gray-200">
          {/* Logo */}
          <div className="text-center mb-8">
            <Link to="/" className="inline-flex items-center gap-2">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                <Zap className="w-7 h-7 text-white" />
              </div>
            </Link>
            <h1 className="text-2xl font-bold text-gray-800 mt-4">{texts.createAccount}</h1>
            <p className="text-gray-500 mt-2">{texts.startBiddingToday}</p>
          </div>

          {/* Free bids banner */}
          <div className="flex items-center gap-3 p-4 rounded-lg bg-green-50 border border-green-200 mb-6">
            <Gift className="w-6 h-6 text-green-600 flex-shrink-0" />
            <div>
              <p className="text-green-600 font-bold">{texts.freeBids}</p>
              <p className="text-gray-500 text-sm">{texts.onRegistration}</p>
            </div>
          </div>

          {/* Referral Banner */}
          {referralValid && (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-50 border border-amber-200 mb-6">
              <Users className="w-6 h-6 text-amber-600 flex-shrink-0" />
              <div>
                <p className="text-amber-600 font-bold">{texts.referredBy} {affiliateName}</p>
                <p className="text-gray-500 text-sm">{texts.bonusBids}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-gray-700">{texts.name}</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  id="name"
                  type="text"
                  placeholder={texts.enterName}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="pl-10 h-12 bg-gray-50 border-gray-200 text-gray-800 placeholder:text-gray-400"
                  data-testid="name-input"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-gray-700">{texts.email}</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder={texts.enterEmail}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pl-10 h-12 bg-gray-50 border-gray-200 text-gray-800 placeholder:text-gray-400"
                  data-testid="email-input"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-700">{texts.password}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pl-10 pr-10 h-12 bg-gray-50 border-gray-200 text-gray-800 placeholder:text-gray-400"
                  data-testid="password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-gray-700">{texts.confirmPassword}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="pl-10 h-12 bg-gray-50 border-gray-200 text-gray-800 placeholder:text-gray-400"
                  data-testid="confirm-password-input"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-bold py-3 h-auto"
              data-testid="register-submit"
            >
              {loading ? texts.registering : texts.registerButton}
            </Button>

            {/* Google Register */}
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">{language === 'de' ? 'oder' : 'or'}</span>
              </div>
            </div>

            <Button
              type="button"
              onClick={() => {
                // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
                const redirectUrl = window.location.origin + '/login';
                window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
              }}
              variant="outline"
              className="w-full h-12 border-gray-300 text-gray-700 hover:bg-gray-50"
              data-testid="google-register-btn"
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {commonT.registerWithGoogle || 'Sign up with Google'}
            </Button>

            {/* Apple Register */}
            <Button
              type="button"
              onClick={() => toast.info(texts.appleLoginNotConfigured || 'Apple Login requires configuration.')}
              variant="outline"
              className="w-full h-12 border-white/20 text-white hover:bg-white/5 mt-3"
              data-testid="apple-register-btn"
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
              </svg>
              {commonT.registerWithApple || 'Sign up with Apple'}
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
