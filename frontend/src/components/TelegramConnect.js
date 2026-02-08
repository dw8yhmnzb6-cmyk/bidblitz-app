import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { 
  MessageCircle, Link2, Unlink, Bell, Copy, 
  CheckCircle, ExternalLink, RefreshCw
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const TelegramConnect = () => {
  const { token } = useAuth();
  const { language, mappedLanguage } = useLanguage();
  const [status, setStatus] = useState(null);
  const [linkCode, setLinkCode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [preferences, setPreferences] = useState({
    auction_ending: true,
    outbid: true,
    won: true,
    deals: true
  });

  // Use mappedLanguage for regional variants (e.g., xk -> sq)
  const langKey = mappedLanguage || language;

  const texts = {
    de: {
      title: 'Telegram Benachrichtigungen',
      description: 'Erhalte Auktions-Alerts direkt auf dein Handy!',
      linked: 'Verknüpft',
      notLinked: 'Nicht verknüpft',
      linkAccount: 'Telegram verbinden',
      unlinkAccount: 'Trennen',
      generateCode: 'Code generieren',
      yourCode: 'Dein Verknüpfungscode',
      expiresIn: 'Gültig für',
      minutes: 'Minuten',
      copyCode: 'Code kopieren',
      copied: 'Kopiert!',
      openTelegram: 'Telegram öffnen',
      instructions: 'Anleitung',
      step1: '1. Öffne Telegram',
      step2: '2. Suche nach @BidBlitzBot',
      step3: '3. Starte den Bot mit /start',
      step4: '4. Sende: /link',
      preferences: 'Benachrichtigungen',
      auctionEnding: 'Auktion endet bald',
      outbid: 'Überboten',
      won: 'Gewonnen',
      deals: 'Neue Deals',
      saved: 'Gespeichert',
      refresh: 'Status aktualisieren'
    },
    en: {
      title: 'Telegram Notifications',
      description: 'Get auction alerts directly on your phone!',
      linked: 'Linked',
      notLinked: 'Not linked',
      linkAccount: 'Connect Telegram',
      unlinkAccount: 'Disconnect',
      generateCode: 'Generate Code',
      yourCode: 'Your link code',
      expiresIn: 'Valid for',
      minutes: 'minutes',
      copyCode: 'Copy code',
      copied: 'Copied!',
      openTelegram: 'Open Telegram',
      instructions: 'Instructions',
      step1: '1. Open Telegram',
      step2: '2. Search for @BidBlitzBot',
      step3: '3. Start the bot with /start',
      step4: '4. Send: /link',
      preferences: 'Notifications',
      auctionEnding: 'Auction ending soon',
      outbid: 'Outbid',
      won: 'Won',
      deals: 'New deals',
      saved: 'Saved',
      refresh: 'Refresh status'
    },
    sq: {
      title: 'Njoftimet Telegram',
      description: 'Merr njoftime ankandit direkt në telefonin tënd!',
      linked: 'I lidhur',
      notLinked: 'Jo i lidhur',
      linkAccount: 'Lidh Telegram',
      unlinkAccount: 'Shkëput',
      generateCode: 'Gjenero Kodin',
      yourCode: 'Kodi yt i lidhjes',
      expiresIn: 'I vlefshëm për',
      minutes: 'minuta',
      copyCode: 'Kopjo kodin',
      copied: 'Kopjuar!',
      openTelegram: 'Hap Telegram',
      instructions: 'Udhëzimet',
      step1: '1. Hap Telegram',
      step2: '2. Kërko @BidBlitzBot',
      step3: '3. Fillo botin me /start',
      step4: '4. Dërgo: /link',
      preferences: 'Njoftimet',
      auctionEnding: 'Ankandi përfundon së shpejti',
      outbid: 'Tejkaluar',
      won: 'Fituar',
      deals: 'Oferta të reja',
      saved: 'Ruajtur',
      refresh: 'Rifresko statusin'
    },
    xk: {
      title: 'Njoftimet Telegram',
      description: 'Merr njoftime ankandit direkt në telefonin tënd!',
      linked: 'I lidhur',
      notLinked: 'Jo i lidhur',
      linkAccount: 'Lidh Telegram',
      unlinkAccount: 'Shkëput',
      generateCode: 'Gjenero Kodin',
      yourCode: 'Kodi yt i lidhjes',
      expiresIn: 'I vlefshëm për',
      minutes: 'minuta',
      copyCode: 'Kopjo kodin',
      copied: 'Kopjuar!',
      openTelegram: 'Hap Telegram',
      instructions: 'Udhëzimet',
      step1: '1. Hap Telegram',
      step2: '2. Kërko @BidBlitzBot',
      step3: '3. Fillo botin me /start',
      step4: '4. Dërgo: /link',
      preferences: 'Njoftimet',
      auctionEnding: 'Ankandi përfundon së shpejti',
      outbid: 'Tejkaluar',
      won: 'Fituar',
      deals: 'Oferta të reja',
      saved: 'Ruajtur',
      refresh: 'Rifresko statusin'
    },
    tr: {
      title: 'Telegram Bildirimleri',
      description: 'Açık artırma uyarılarını doğrudan telefonunuza alın!',
      linked: 'Bağlı',
      notLinked: 'Bağlı değil',
      linkAccount: 'Telegram Bağla',
      unlinkAccount: 'Bağlantıyı Kes',
      generateCode: 'Kod Oluştur',
      yourCode: 'Bağlantı kodunuz',
      expiresIn: 'Geçerlilik',
      minutes: 'dakika',
      copyCode: 'Kodu kopyala',
      copied: 'Kopyalandı!',
      openTelegram: 'Telegram aç',
      instructions: 'Talimatlar',
      step1: '1. Telegram\'ı açın',
      step2: '2. @BidBlitzBot arayin',
      step3: '3. Botu /start ile başlatın',
      step4: '4. Gönderin: /link',
      preferences: 'Bildirimler',
      auctionEnding: 'Yakında biten açık artırma',
      outbid: 'Geçildi',
      won: 'Kazandı',
      deals: 'Yeni fırsatlar',
      saved: 'Kaydedildi',
      refresh: 'Durumu yenile'
    },
    fr: {
      title: 'Notifications Telegram',
      description: 'Recevez des alertes d\'enchères directement sur votre téléphone!',
      linked: 'Lié',
      notLinked: 'Non lié',
      linkAccount: 'Connecter Telegram',
      unlinkAccount: 'Déconnecter',
      generateCode: 'Générer le code',
      yourCode: 'Votre code de liaison',
      expiresIn: 'Valide pour',
      minutes: 'minutes',
      copyCode: 'Copier le code',
      copied: 'Copié!',
      openTelegram: 'Ouvrir Telegram',
      instructions: 'Instructions',
      step1: '1. Ouvrir Telegram',
      step2: '2. Chercher @BidBlitzBot',
      step3: '3. Démarrer le bot avec /start',
      step4: '4. Envoyer: /link',
      preferences: 'Notifications',
      auctionEnding: 'Enchère se terminant bientôt',
      outbid: 'Surenchéri',
      won: 'Gagné',
      deals: 'Nouvelles offres',
      saved: 'Enregistré',
      refresh: 'Actualiser le statut'
    }
  };
  const t = texts[language] || texts.de;

  useEffect(() => {
    if (token) {
      fetchStatus();
    }
  }, [token]);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/api/telegram/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStatus(res.data);
      if (res.data.preferences) {
        setPreferences(res.data.preferences);
      }
    } catch (err) {
      console.error('Error fetching Telegram status:', err);
    } finally {
      setLoading(false);
    }
  };

  const generateLinkCode = async () => {
    try {
      const res = await axios.get(`${API}/api/telegram/link-code`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLinkCode(res.data);
    } catch (err) {
      toast.error('Fehler beim Generieren des Codes');
    }
  };

  const copyCode = () => {
    if (linkCode?.code) {
      navigator.clipboard.writeText(`/link ${linkCode.code}`);
      toast.success(t.copied);
    }
  };

  const updatePreference = async (key, value) => {
    try {
      await axios.put(
        `${API}/api/telegram/preferences`,
        { [key]: value },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setPreferences(prev => ({ ...prev, [key]: value }));
      toast.success(t.saved);
    } catch (err) {
      toast.error('Fehler beim Speichern');
    }
  };

  const unlinkAccount = async () => {
    try {
      await axios.delete(`${API}/api/telegram/unlink`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStatus({ linked: false });
      setLinkCode(null);
      toast.success('Telegram getrennt');
    } catch (err) {
      toast.error('Fehler beim Trennen');
    }
  };

  if (loading) {
    return (
      <div className="glass-card rounded-xl p-6 animate-pulse">
        <div className="h-6 bg-gray-700 rounded w-1/3 mb-4"></div>
        <div className="h-4 bg-gray-700 rounded w-2/3"></div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-xl p-6" data-testid="telegram-connect">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
            <MessageCircle className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-white font-bold text-lg">{t.title}</h3>
            <p className="text-gray-400 text-sm">{t.description}</p>
          </div>
        </div>
        
        {/* Status Badge */}
        <div className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1 ${
          status?.linked 
            ? 'bg-green-500/20 text-green-400' 
            : 'bg-gray-600/20 text-gray-400'
        }`}>
          {status?.linked ? <CheckCircle className="w-4 h-4" /> : <Unlink className="w-4 h-4" />}
          {status?.linked ? t.linked : t.notLinked}
        </div>
      </div>

      {/* Not Linked State */}
      {!status?.linked && (
        <div className="space-y-4">
          {!linkCode ? (
            <Button 
              onClick={generateLinkCode}
              className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500"
            >
              <Link2 className="w-4 h-4 mr-2" />
              {t.generateCode}
            </Button>
          ) : (
            <div className="space-y-4">
              {/* Code Display */}
              <div className="p-4 bg-[#1A1A2E] rounded-lg border border-blue-500/30">
                <p className="text-gray-400 text-sm mb-1">{t.yourCode}</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-2xl font-mono text-blue-400 font-bold">
                    {linkCode.code}
                  </code>
                  <Button variant="outline" size="sm" onClick={copyCode}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-gray-500 text-xs mt-2">
                  {t.expiresIn}: {Math.floor(linkCode.expires_in / 60)} {t.minutes}
                </p>
              </div>

              {/* Instructions */}
              <div className="p-4 bg-white/5 rounded-lg">
                <p className="text-white font-medium mb-2">{t.instructions}:</p>
                <ol className="text-sm text-gray-400 space-y-1">
                  <li>{t.step1}</li>
                  <li>{t.step2}</li>
                  <li>{t.step3}</li>
                  <li>{t.step4} <code className="text-blue-400">{linkCode.code}</code></li>
                </ol>
              </div>

              {/* Open Telegram Button */}
              <a 
                href={`https://t.me/${linkCode.bot_username || 'BidBlitzBot'}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-lg transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                {t.openTelegram}
              </a>

              {/* Refresh Status */}
              <Button 
                variant="outline" 
                className="w-full"
                onClick={fetchStatus}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                {t.refresh}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Linked State - Preferences */}
      {status?.linked && (
        <div className="space-y-4">
          {/* Username */}
          {status.telegram_username && (
            <p className="text-gray-400 text-sm">
              @{status.telegram_username}
            </p>
          )}

          {/* Notification Preferences */}
          <div className="space-y-3">
            <p className="text-white font-medium flex items-center gap-2">
              <Bell className="w-4 h-4 text-yellow-400" />
              {t.preferences}
            </p>
            
            {[
              { key: 'auction_ending', label: t.auctionEnding, icon: '⏰' },
              { key: 'outbid', label: t.outbid, icon: '⚡' },
              { key: 'won', label: t.won, icon: '🏆' },
              { key: 'deals', label: t.deals, icon: '🔥' }
            ].map(pref => (
              <label 
                key={pref.key}
                className="flex items-center justify-between p-3 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10 transition-colors"
              >
                <span className="text-gray-300 flex items-center gap-2">
                  <span>{pref.icon}</span>
                  {pref.label}
                </span>
                <input
                  type="checkbox"
                  checked={preferences[pref.key]}
                  onChange={(e) => updatePreference(pref.key, e.target.checked)}
                  className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-blue-500 focus:ring-blue-500"
                />
              </label>
            ))}
          </div>

          {/* Unlink Button */}
          <Button 
            variant="outline" 
            onClick={unlinkAccount}
            className="w-full text-red-400 border-red-400/30 hover:bg-red-500/10"
          >
            <Unlink className="w-4 h-4 mr-2" />
            {t.unlinkAccount}
          </Button>
        </div>
      )}
    </div>
  );
};

export default TelegramConnect;
