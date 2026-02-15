import { useState, useEffect } from 'react';
import { X, Download, Smartphone } from 'lucide-react';
import { Button } from './ui/button';
import { useLanguage } from '../context/LanguageContext';

// Translations
const translations = {
  de: { title: 'bidblitz.ae installieren', subtitle: 'Installiere die App für schnelleren Zugriff!', install: 'Installieren', later: 'Später', iosInstructions: 'Tippe auf', thenAddToHome: 'und dann "Zum Home-Bildschirm"', installed: 'App installiert!', share: 'Teilen' },
  en: { title: 'Install bidblitz.ae', subtitle: 'Install the app for faster access!', install: 'Install', later: 'Later', iosInstructions: 'Tap on', thenAddToHome: 'then "Add to Home Screen"', installed: 'App installed!', share: 'Share' },
  sq: { title: 'Instalo bidblitz.ae', subtitle: 'Instalo aplikacionin për qasje më të shpejtë!', install: 'Instalo', later: 'Më vonë', iosInstructions: 'Prekni', thenAddToHome: 'pastaj "Shto në Ekranin Fillestar"', installed: 'Aplikacioni u instalua!', share: 'Ndaj' },
  xk: { title: 'Instalo bidblitz.ae', subtitle: 'Instalo aplikacionin për qasje më të shpejtë!', install: 'Instalo', later: 'Më vonë', iosInstructions: 'Prekni', thenAddToHome: 'pastaj "Shto në Ekranin Fillestar"', installed: 'Aplikacioni u instalua!', share: 'Ndaj' },
  tr: { title: 'bidblitz.ae\'i Yükle', subtitle: 'Daha hızlı erişim için uygulamayı yükle!', install: 'Yükle', later: 'Sonra', iosInstructions: 'Dokunun', thenAddToHome: 'sonra "Ana Ekrana Ekle"', installed: 'Uygulama yüklendi!', share: 'Paylaş' },
  fr: { title: 'Installer bidblitz.ae', subtitle: 'Installez l\'appli pour un accès plus rapide!', install: 'Installer', later: 'Plus tard', iosInstructions: 'Appuyez sur', thenAddToHome: 'puis "Ajouter à l\'écran d\'accueil"', installed: 'Appli installée!', share: 'Partager' },
  es: { title: 'Instalar bidblitz.ae', subtitle: '¡Instala la app para acceso más rápido!', install: 'Instalar', later: 'Luego', iosInstructions: 'Toca en', thenAddToHome: 'luego "Añadir a pantalla de inicio"', installed: '¡App instalada!', share: 'Compartir' },
  it: { title: 'Installa bidblitz.ae', subtitle: 'Installa l\'app per un accesso più veloce!', install: 'Installa', later: 'Dopo', iosInstructions: 'Tocca su', thenAddToHome: 'poi "Aggiungi alla schermata Home"', installed: 'App installata!', share: 'Condividi' },
  pt: { title: 'Instalar bidblitz.ae', subtitle: 'Instale o app para acesso mais rápido!', install: 'Instalar', later: 'Depois', iosInstructions: 'Toque em', thenAddToHome: 'depois "Adicionar à Tela Inicial"', installed: 'App instalado!', share: 'Compartilhar' },
  nl: { title: 'bidblitz.ae Installeren', subtitle: 'Installeer de app voor snellere toegang!', install: 'Installeren', later: 'Later', iosInstructions: 'Tik op', thenAddToHome: 'dan "Zet op beginscherm"', installed: 'App geïnstalleerd!', share: 'Delen' },
  pl: { title: 'Zainstaluj bidblitz.ae', subtitle: 'Zainstaluj aplikację dla szybszego dostępu!', install: 'Zainstaluj', later: 'Później', iosInstructions: 'Stuknij', thenAddToHome: 'następnie "Dodaj do ekranu głównego"', installed: 'Aplikacja zainstalowana!', share: 'Udostępnij' },
  ru: { title: 'Установить bidblitz.ae', subtitle: 'Установите приложение для быстрого доступа!', install: 'Установить', later: 'Позже', iosInstructions: 'Нажмите', thenAddToHome: 'затем "На экран Домой"', installed: 'Приложение установлено!', share: 'Поделиться' },
  ar: { title: 'تثبيت bidblitz.ae', subtitle: 'قم بتثبيت التطبيق للوصول السريع!', install: 'تثبيت', later: 'لاحقاً', iosInstructions: 'اضغط على', thenAddToHome: 'ثم "إضافة إلى الشاشة الرئيسية"', installed: 'تم تثبيت التطبيق!', share: 'مشاركة' },
  ae: { title: 'تثبيت bidblitz.ae', subtitle: 'قم بتثبيت التطبيق للوصول السريع!', install: 'تثبيت', later: 'لاحقاً', iosInstructions: 'اضغط على', thenAddToHome: 'ثم "إضافة إلى الشاشة الرئيسية"', installed: 'تم تثبيت التطبيق!', share: 'مشاركة' },
  zh: { title: '安装 bidblitz.ae', subtitle: '安装应用以更快访问！', install: '安装', later: '稍后', iosInstructions: '点击', thenAddToHome: '然后"添加到主屏幕"', installed: '应用已安装！', share: '分享' },
  ja: { title: 'bidblitz.aeをインストール', subtitle: 'アプリをインストールして素早くアクセス！', install: 'インストール', later: '後で', iosInstructions: 'タップして', thenAddToHome: '「ホーム画面に追加」', installed: 'アプリがインストールされました！', share: '共有' },
  ko: { title: 'bidblitz.ae 설치', subtitle: '앱을 설치하여 빠르게 접근하세요!', install: '설치', later: '나중에', iosInstructions: '탭하세요', thenAddToHome: '그리고 "홈 화면에 추가"', installed: '앱이 설치되었습니다!', share: '공유' },
  hi: { title: 'bidblitz.ae इंस्टॉल करें', subtitle: 'तेज़ पहुंच के लिए ऐप इंस्टॉल करें!', install: 'इंस्टॉल', later: 'बाद में', iosInstructions: 'टैप करें', thenAddToHome: 'फिर "होम स्क्रीन में जोड़ें"', installed: 'ऐप इंस्टॉल हो गया!', share: 'शेयर' },
  cs: { title: 'Nainstalovat bidblitz.ae', subtitle: 'Nainstalujte aplikaci pro rychlejší přístup!', install: 'Nainstalovat', later: 'Později', iosInstructions: 'Klepněte na', thenAddToHome: 'pak "Přidat na plochu"', installed: 'Aplikace nainstalována!', share: 'Sdílet' },
  sv: { title: 'Installera bidblitz.ae', subtitle: 'Installera appen för snabbare åtkomst!', install: 'Installera', later: 'Senare', iosInstructions: 'Tryck på', thenAddToHome: 'sedan "Lägg till på hemskärmen"', installed: 'Appen installerad!', share: 'Dela' },
  da: { title: 'Installer bidblitz.ae', subtitle: 'Installer appen for hurtigere adgang!', install: 'Installer', later: 'Senere', iosInstructions: 'Tryk på', thenAddToHome: 'derefter "Føj til hjemmeskærm"', installed: 'App installeret!', share: 'Del' },
  fi: { title: 'Asenna bidblitz.ae', subtitle: 'Asenna sovellus nopeampaa käyttöä varten!', install: 'Asenna', later: 'Myöhemmin', iosInstructions: 'Napauta', thenAddToHome: 'sitten "Lisää Koti-valikkoon"', installed: 'Sovellus asennettu!', share: 'Jaa' },
  el: { title: 'Εγκατάσταση bidblitz.ae', subtitle: 'Εγκαταστήστε την εφαρμογή για ταχύτερη πρόσβαση!', install: 'Εγκατάσταση', later: 'Αργότερα', iosInstructions: 'Πατήστε', thenAddToHome: 'μετά "Προσθήκη στην αρχική οθόνη"', installed: 'Η εφαρμογή εγκαταστάθηκε!', share: 'Κοινοποίηση' }
};

export default function PWAInstallBanner() {
  const { language , mappedLanguage } = useLanguage();
  // Use mappedLanguage for regional variants (e.g., xk -> sq)
  const langKey = mappedLanguage || language;
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  
  const t = translations[langKey] || translations.de;

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Check if iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(iOS);

    // Check if dismissed recently
    const dismissed = localStorage.getItem('pwa-banner-dismissed');
    if (dismissed) {
      const dismissedTime = new Date(dismissed);
      const now = new Date();
      const hoursSinceDismissed = (now - dismissedTime) / (1000 * 60 * 60);
      if (hoursSinceDismissed < 24) return; // Don't show for 24 hours
    }

    // Listen for beforeinstallprompt
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Show iOS banner after delay
    if (iOS) {
      setTimeout(() => setShowBanner(true), 3000);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setShowBanner(false);
    }
    
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem('pwa-banner-dismissed', new Date().toISOString());
  };

  if (!showBanner || isInstalled) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 animate-slide-up" data-testid="pwa-install-banner">
      <div className="max-w-lg mx-auto bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl shadow-2xl p-4 text-white">
        <div className="flex items-start gap-4">
          {/* App Icon */}
          <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
            <Smartphone className="w-8 h-8" />
          </div>
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-bold text-lg">{t.title}</h3>
                <p className="text-white/90 text-sm">{t.subtitle}</p>
              </div>
              <button 
                onClick={handleDismiss}
                className="p-1 hover:bg-white/20 rounded-lg transition-colors flex-shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* iOS Instructions */}
            {isIOS ? (
              <div className="mt-3">
                <div className="bg-white/20 rounded-lg p-3 text-sm space-y-2">
                  <p className="font-medium">So installieren Sie die App:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>
                      Tippen Sie auf{' '}
                      <span className="inline-flex items-center justify-center w-6 h-6 bg-white/30 rounded mx-1">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M3 4a1 1 0 011-1h4a1 1 0 010 2H5v10h10v-3a1 1 0 112 0v3a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2zm9 1a1 1 0 010-2h4a1 1 0 011 1v4a1 1 0 01-2 0V5.414l-5.293 5.293a1 1 0 01-1.414-1.414L13.586 4H12z" clipRule="evenodd"/>
                        </svg>
                      </span>
                      {' '}(Teilen-Symbol) unten
                    </li>
                    <li>Scrollen Sie zu "{t.thenAddToHome.replace('dann ', '').replace('then ', '')}"</li>
                    <li>Bestätigen Sie mit "Hinzufügen"</li>
                  </ol>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button
                    onClick={handleDismiss}
                    className="flex-1 bg-white text-amber-600 hover:bg-white/90 font-semibold"
                  >
                    Verstanden
                  </Button>
                  <Button
                    onClick={handleDismiss}
                    variant="ghost"
                    className="text-white hover:bg-white/20"
                  >
                    {t.later}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-3 flex gap-2">
                <Button
                  onClick={handleInstall}
                  className="bg-white text-amber-600 hover:bg-white/90 font-semibold flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  {t.install}
                </Button>
                <Button
                  onClick={handleDismiss}
                  variant="ghost"
                  className="text-white hover:bg-white/20"
                >
                  {t.later}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
