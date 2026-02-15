/**
 * WhatsApp Notification Settings Component
 * Allows users to enable/disable WhatsApp notifications for various events
 */
import { useState, useEffect, memo } from 'react';
import { MessageCircle, Bell, BellOff, Check, AlertCircle, Phone, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const translations = {
  de: {
    title: 'WhatsApp Benachrichtigungen',
    subtitle: 'Erhalte wichtige Updates direkt auf WhatsApp',
    phoneLabel: 'WhatsApp Nummer',
    phonePlaceholder: '+49 123 456789',
    phoneHint: 'Mit Ländervorwahl (z.B. +49 für Deutschland)',
    saveNumber: 'Nummer speichern',
    enabled: 'Aktiviert',
    disabled: 'Deaktiviert',
    saving: 'Speichern...',
    saved: 'Gespeichert!',
    error: 'Fehler beim Speichern',
    notifications: {
      outbid: { label: 'Überboten', desc: 'Wenn jemand dich überboten hat' },
      won: { label: 'Gewonnen', desc: 'Wenn du eine Auktion gewinnst' },
      ending: { label: 'Auktion endet', desc: '5 Minuten vor Auktionsende' },
      newAuction: { label: 'Neue Auktionen', desc: 'Bei neuen interessanten Auktionen' },
      promo: { label: 'Angebote', desc: 'Exklusive WhatsApp-Angebote' }
    },
    verifyHint: 'Du erhältst eine Verifizierungsnachricht',
    privacyNote: 'Deine Nummer wird nur für Benachrichtigungen verwendet'
  },
  en: {
    title: 'WhatsApp Notifications',
    subtitle: 'Get important updates directly on WhatsApp',
    phoneLabel: 'WhatsApp Number',
    phonePlaceholder: '+1 234 567890',
    phoneHint: 'Include country code (e.g. +1 for USA)',
    saveNumber: 'Save Number',
    enabled: 'Enabled',
    disabled: 'Disabled',
    saving: 'Saving...',
    saved: 'Saved!',
    error: 'Error saving',
    notifications: {
      outbid: { label: 'Outbid', desc: 'When someone outbids you' },
      won: { label: 'Won', desc: 'When you win an auction' },
      ending: { label: 'Auction Ending', desc: '5 minutes before auction ends' },
      newAuction: { label: 'New Auctions', desc: 'For new interesting auctions' },
      promo: { label: 'Offers', desc: 'Exclusive WhatsApp offers' }
    },
    verifyHint: 'You will receive a verification message',
    privacyNote: 'Your number is only used for notifications'
  },
  tr: {
    title: 'WhatsApp Bildirimleri',
    subtitle: 'Önemli güncellemeleri WhatsApp\'tan al',
    phoneLabel: 'WhatsApp Numarası',
    phonePlaceholder: '+90 532 123 4567',
    phoneHint: 'Ülke kodu ile birlikte',
    saveNumber: 'Numarayı Kaydet',
    enabled: 'Aktif',
    disabled: 'Kapalı',
    saving: 'Kaydediliyor...',
    saved: 'Kaydedildi!',
    error: 'Kaydetme hatası',
    notifications: {
      outbid: { label: 'Geçildin', desc: 'Biri seni geçtiğinde' },
      won: { label: 'Kazandın', desc: 'Bir açık artırma kazandığında' },
      ending: { label: 'Bitiyor', desc: 'Bitmeden 5 dakika önce' },
      newAuction: { label: 'Yeni Açık Artırmalar', desc: 'İlginç yeni açık artırmalar için' },
      promo: { label: 'Teklifler', desc: 'Özel WhatsApp teklifleri' }
    },
    verifyHint: 'Bir doğrulama mesajı alacaksınız',
    privacyNote: 'Numaranız sadece bildirimler için kullanılır'
  },
  sq: {
    title: 'Njoftimet WhatsApp',
    subtitle: 'Merr përditësime të rëndësishme direkt në WhatsApp',
    phoneLabel: 'Numri WhatsApp',
    phonePlaceholder: '+383 44 123 456',
    phoneHint: 'Me kodin e vendit',
    saveNumber: 'Ruaj Numrin',
    enabled: 'Aktiv',
    disabled: 'Joaktiv',
    saving: 'Duke ruajtur...',
    saved: 'U ruajt!',
    error: 'Gabim gjatë ruajtjes',
    notifications: {
      outbid: { label: 'U kalove', desc: 'Kur dikush të kalon' },
      won: { label: 'Fitove', desc: 'Kur fiton një ankand' },
      ending: { label: 'Përfundon', desc: '5 minuta para përfundimit' },
      newAuction: { label: 'Ankande të Reja', desc: 'Për ankande të reja interesante' },
      promo: { label: 'Oferta', desc: 'Oferta ekskluzive WhatsApp' }
    },
    verifyHint: 'Do të marrësh një mesazh verifikimi',
    privacyNote: 'Numri yt përdoret vetëm për njoftime'
  }
};

const WhatsAppSettings = memo(({ language = 'de' }) => {
  const { user, token } = useAuth();
  const [phone, setPhone] = useState('');
  const [settings, setSettings] = useState({
    outbid: true,
    won: true,
    ending: true,
    newAuction: false,
    promo: false
  });
  const [saving, setSaving] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  
  const t = translations[language] || translations.de;
  
  // Load existing settings
  useEffect(() => {
    const loadSettings = async () => {
      if (!token) return;
      try {
        const res = await axios.get(`${API}/whatsapp/status`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.data) {
          setPhone(res.data.phone || '');
          setPhoneVerified(res.data.subscribed || false);
          if (res.data.preferences) {
            setSettings({
              outbid: res.data.preferences.outbid ?? true,
              won: res.data.preferences.auction_won ?? true,
              ending: res.data.preferences.auction_ending ?? true,
              newAuction: res.data.preferences.deals ?? false,
              promo: res.data.preferences.daily_digest ?? false
            });
          }
        }
      } catch (err) {
        console.error('Error loading WhatsApp settings:', err);
      }
    };
    loadSettings();
  }, [token]);
  
  const handleSavePhone = async () => {
    if (!phone.trim()) {
      toast.error('Bitte Nummer eingeben');
      return;
    }
    
    setSaving(true);
    try {
      // Use the correct endpoint: /subscribe instead of /register
      await axios.post(`${API}/whatsapp/subscribe?phone_number=${encodeURIComponent(phone)}`, 
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(t.saved);
      setPhoneVerified(true);
    } catch (err) {
      console.error('WhatsApp save error:', err);
      toast.error(t.error);
    } finally {
      setSaving(false);
    }
  };
  
  const toggleNotification = async (key) => {
    const newValue = !settings[key];
    setSettings(prev => ({ ...prev, [key]: newValue }));
    
    try {
      await axios.put(`${API}/whatsapp/settings`, 
        { notifications: { ...settings, [key]: newValue } },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (err) {
      // Revert on error
      setSettings(prev => ({ ...prev, [key]: !newValue }));
      toast.error(t.error);
    }
  };
  
  return (
    <div 
      className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden"
      data-testid="whatsapp-settings"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-green-500 to-emerald-500 p-4 text-white">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/20 rounded-full">
            <MessageCircle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-lg">{t.title}</h3>
            <p className="text-sm text-white/80">{t.subtitle}</p>
          </div>
        </div>
      </div>
      
      {/* Phone Input */}
      <div className="p-4 border-b border-gray-100">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t.phoneLabel}
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t.phonePlaceholder}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 
                focus:ring-green-500 focus:border-green-500 outline-none"
              data-testid="whatsapp-phone-input"
            />
          </div>
          <button
            onClick={handleSavePhone}
            disabled={saving}
            className="px-4 py-2 bg-green-500 text-white font-medium rounded-lg 
              hover:bg-green-600 disabled:opacity-50 flex items-center gap-2"
            data-testid="whatsapp-save-btn"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t.saving}
              </>
            ) : phoneVerified ? (
              <>
                <Check className="w-4 h-4" />
                {t.saved}
              </>
            ) : (
              t.saveNumber
            )}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1">{t.phoneHint}</p>
      </div>
      
      {/* Notification Settings */}
      <div className="p-4 space-y-3">
        {Object.entries(t.notifications).map(([key, { label, desc }]) => (
          <div 
            key={key}
            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center gap-3">
              {settings[key] ? (
                <Bell className="w-5 h-5 text-green-500" />
              ) : (
                <BellOff className="w-5 h-5 text-gray-400" />
              )}
              <div>
                <p className="font-medium text-gray-800">{label}</p>
                <p className="text-xs text-gray-500">{desc}</p>
              </div>
            </div>
            <button
              onClick={() => toggleNotification(key)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                settings[key] ? 'bg-green-500' : 'bg-gray-300'
              }`}
              data-testid={`whatsapp-toggle-${key}`}
            >
              <span 
                className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  settings[key] ? 'left-7' : 'left-1'
                }`}
              />
            </button>
          </div>
        ))}
      </div>
      
      {/* Privacy Note */}
      <div className="px-4 pb-4">
        <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg text-blue-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p className="text-xs">{t.privacyNote}</p>
        </div>
      </div>
    </div>
  );
});

WhatsAppSettings.displayName = 'WhatsAppSettings';

export default WhatsAppSettings;
