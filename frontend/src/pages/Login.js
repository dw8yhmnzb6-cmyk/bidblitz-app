import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { getFeatureTranslation } from '../i18n/featureTranslations';
import { usePageTranslations } from '../i18n/pageTranslations';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Zap, Mail, Lock, Eye, EyeOff, Shield, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Login() {
  const { language } = useLanguage();
  const texts = usePageTranslations(language);
  const commonT = getFeatureTranslation('common', language);
  const { refreshUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Handle Google OAuth callback
  useEffect(() => {
    const hash = location.hash;
    if (hash && hash.includes('session_id=')) {
      const sessionId = hash.split('session_id=')[1]?.split('&')[0];
      if (sessionId) {
        handleGoogleCallback(sessionId);
      }
    }
  }, [location]);

  const handleGoogleCallback = async (sessionId) => {
    setGoogleLoading(true);
    try {
      const response = await axios.post(`${API}/auth/google`, { session_id: sessionId });
      const { token, user, is_new_user } = response.data;
      
      localStorage.setItem('token', token);
      await refreshUser();
      
      if (is_new_user) {
        toast.success(texts.registerSuccess || 'Welcome! 10 free bids credited.');
      } else {
        toast.success(texts.loginSuccess);
      }
      
      // Clear hash and redirect
      window.history.replaceState(null, '', '/login');
      window.location.href = '/dashboard';
    } catch (error) {
      toast.error(error.response?.data?.detail || texts.loginFailed || 'Login failed');
      window.history.replaceState(null, '', '/login');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + '/login';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!email || !password || loading) return;
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
        toast.info(texts.enter2FAPrompt);
        setLoading(false);
        return;
      }

      // Login successful
      const { token, user: userData } = response.data;
      
      try {
        localStorage.setItem('token', token);
      } catch (e) {
        console.warn('localStorage not available, using sessionStorage:', e);
        try {
          sessionStorage.setItem('token', token);
        } catch (e2) {
          console.error('Storage not available:', e2);
        }
      }
      
      await refreshUser();
      toast.success(texts.loginSuccess);
      
      // Check user role and redirect accordingly
      // First check for URL redirect parameter
      const urlParams = new URLSearchParams(location.search);
      const redirectParam = urlParams.get('redirect');
      
      let redirectPath;
      if (redirectParam) {
        // Redirect to the specified path
        redirectPath = redirectParam;
      } else {
        // Default redirect based on role
        redirectPath = (userData?.is_manager || userData?.role === 'manager') 
          ? '/manager-dashboard' 
          : (userData?.is_admin ? '/admin' : '/dashboard');
      }
      
      // Force navigation with window.location as fallback
      setTimeout(() => {
        window.location.href = redirectPath;
      }, 100);
    } catch (error) {
      const errorMsg = error.response?.data?.detail || texts.loginFailed;
      
      // Handle KYC-related errors
      if (errorMsg === 'kyc_documents_missing') {
        toast.error(language === 'de' 
          ? 'Bitte vervollständigen Sie Ihre Identitätsverifizierung' 
          : 'Please complete your identity verification');
        navigate('/kyc-verification');
        return;
      } else if (errorMsg === 'kyc_pending_approval') {
        toast.info(language === 'de' 
          ? 'Ihre Dokumente werden geprüft. Bitte warten Sie auf die Freischaltung.' 
          : 'Your documents are being reviewed. Please wait for approval.');
        return;
      } else if (errorMsg.startsWith('kyc_rejected:')) {
        const reason = errorMsg.replace('kyc_rejected:', '');
        toast.error(language === 'de' 
          ? `Ihre Verifizierung wurde abgelehnt: ${reason}` 
          : `Your verification was rejected: ${reason}`);
        navigate('/kyc-verification');
        return;
      }
      
      toast.error(errorMsg);
      
      // Reset 2FA code on error
      if (requires2FA) {
        setTwoFactorCode('');
      }
    } finally {
      setLoading(false);
    }
  };

  // Redirect if already logged in
  useEffect(() => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        window.location.href = '/dashboard';
      }
    } catch (e) {
      // localStorage might be blocked in Safari private mode
      console.warn('localStorage not available:', e);
    }
  }, []);

  return (
    <div className="min-h-screen pt-24 pb-12 px-4 flex items-center justify-center bg-gradient-to-b from-cyan-50 to-cyan-100" data-testid="login-page">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl p-8 shadow-xl border border-gray-200">
          {/* Logo */}
          <div className="text-center mb-8">
            <Link to="/" className="inline-flex items-center gap-2">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
                <Zap className="w-7 h-7 text-white" />
              </div>
            </Link>
            <h1 className="text-2xl font-bold text-gray-800 mt-4">{texts.welcomeBack}</h1>
            <p className="text-gray-500 mt-2">
              {requires2FA ? texts.twoFactorAuth : texts.loginToContinue}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6" autoComplete="on">
            {!requires2FA ? (
              <>
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
                      autoComplete="email"
                      className="pl-10 h-12 bg-gray-50 border-gray-200 text-gray-800 placeholder:text-gray-400"
                      data-testid="email-input"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-gray-700">{texts.password}</Label>
                    <Link to="/forgot-password" className="text-sm text-amber-600 hover:underline">
                      {texts.forgotPassword}
                    </Link>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
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
              </>
            ) : (
              <div className="space-y-4">
                <div className="text-center p-4 rounded-xl bg-amber-50 border border-amber-200">
                  <Shield className="w-12 h-12 text-amber-600 mx-auto mb-3" />
                  <p className="text-gray-800 font-medium">{texts.twoFactorAuth}</p>
                  <p className="text-gray-500 text-sm">{texts.enter2FACode}</p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="twoFactorCode" className="text-gray-700">{texts.enter2FACode}</Label>
                  <Input
                    id="twoFactorCode"
                    type="text"
                    placeholder="000000"
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    required
                    autoFocus
                    className="h-14 text-center text-2xl font-mono tracking-[0.5em] bg-gray-50 border-gray-200 text-gray-800"
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
                  className="text-gray-500 hover:text-gray-800 text-sm underline w-full text-center"
                >
                  {texts.back}
                </button>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading || (requires2FA && twoFactorCode.length !== 6)}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white py-3 h-auto font-bold"
              data-testid="login-submit"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {texts.loggingIn}
                </>
              ) : requires2FA ? (
                texts.verify2FA
              ) : (
                texts.loginButton
              )}
            </Button>

            {!requires2FA && (
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">{texts.orText || (language === 'de' ? 'oder' : language === 'sq' ? 'ose' : language === 'tr' ? 'veya' : language === 'fr' ? 'ou' : 'or')}</span>
                </div>
              </div>
            )}

            {!requires2FA && (
              <Button
                type="button"
                onClick={handleGoogleLogin}
                disabled={googleLoading}
                variant="outline"
                className="w-full h-12 border-gray-300 text-gray-700 hover:bg-gray-50"
                data-testid="google-login-btn"
              >
                {googleLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                )}
                {commonT.loginWithGoogle || (language === 'de' ? 'Mit Google anmelden' : language === 'sq' || language === 'xk' ? 'Hyni me Google' : language === 'tr' ? 'Google ile Giriş' : language === 'fr' ? 'Se connecter avec Google' : 'Sign in with Google')}
              </Button>
            )}

            {/* Microsoft Login Button */}
            {!requires2FA && (
              <Button
                type="button"
                onClick={() => window.location.href = `${API}/auth/microsoft/login`}
                variant="outline"
                className="w-full h-12 border-gray-300 text-gray-700 hover:bg-gray-50"
                data-testid="microsoft-login-btn"
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path fill="#F25022" d="M1 1h10v10H1z"/>
                  <path fill="#00A4EF" d="M1 13h10v10H1z"/>
                  <path fill="#7FBA00" d="M13 1h10v10H13z"/>
                  <path fill="#FFB900" d="M13 13h10v10H13z"/>
                </svg>
                {language === 'de' ? 'Mit Microsoft anmelden' : language === 'sq' || language === 'xk' ? 'Hyni me Microsoft' : language === 'tr' ? 'Microsoft ile Giriş' : language === 'fr' ? 'Se connecter avec Microsoft' : 'Sign in with Microsoft'}
              </Button>
            )}

            {/* Apple Login */}
            {!requires2FA && (
              <Button
                type="button"
                onClick={() => toast.info(texts.appleLoginInfo || (language === 'de' 
                  ? 'Apple Login erfordert Apple Developer Credentials. Bitte in .env konfigurieren.' 
                  : language === 'sq' ? 'Apple Login kërkon kredenciale Apple Developer. Ju lutem konfiguroni në .env.'
                  : language === 'tr' ? 'Apple Giriş, Apple Developer Kimlik Bilgileri gerektirir. Lütfen .env\'de yapılandırın.'
                  : language === 'fr' ? 'Apple Login nécessite les identifiants Apple Developer. Veuillez configurer dans .env.'
                  : 'Apple Login requires Apple Developer Credentials. Please configure in .env.')
                )}
                variant="outline"
                className="w-full h-12 border-gray-300 bg-gray-800 text-white hover:bg-gray-700 mt-3"
                data-testid="apple-login-btn"
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                </svg>
                {commonT.loginWithApple || (language === 'de' ? 'Mit Apple anmelden' : language === 'sq' ? 'Hyni me Apple' : language === 'tr' ? 'Apple ile Giriş' : language === 'fr' ? 'Se connecter avec Apple' : 'Sign in with Apple')}
              </Button>
            )}
          </form>

          {!requires2FA && (
            <div className="mt-6 text-center">
              <p className="text-gray-500">
                {texts.noAccount}{' '}
                <Link to="/register" className="text-amber-600 hover:underline font-medium">
                  {texts.registerNow}
                </Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
