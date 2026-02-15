import { useState } from 'react';
import { Share2, Gift, Twitter, Facebook, MessageCircle, Copy, Check, X } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/button';
import { safeCopyToClipboard } from '../utils/clipboard';
import { toast } from 'sonner';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const shareTexts = {
  de: {
    title: 'Teilen & Gebote gewinnen!',
    subtitle: 'Teile bidblitz.ae und erhalte Gratis-Gebote',
    shareOn: 'Teilen auf',
    copyLink: 'Link kopieren',
    copied: 'Kopiert!',
    reward: '+5 Gebote pro Teilen',
    twitter: 'Twitter/X',
    facebook: 'Facebook',
    whatsapp: 'WhatsApp',
    shareMessage: 'Ich spare bis zu 90% bei bidblitz.ae! Probier es aus:',
    thankYou: 'Danke fürs Teilen!'
  },
  sq: {
    title: 'Ndaj & Fito Oferta!',
    subtitle: 'Ndaj bidblitz.ae dhe merr oferta falas',
    shareOn: 'Ndaj në',
    copyLink: 'Kopjo linkun',
    copied: 'Kopjuar!',
    reward: '+5 Oferta për ndarje',
    twitter: 'Twitter/X',
    facebook: 'Facebook',
    whatsapp: 'WhatsApp',
    shareMessage: 'Po kursej deri 90% në bidblitz.ae! Provoje:',
    thankYou: 'Faleminderit për ndarjen!'
  },
  en: {
    title: 'Share & Win Bids!',
    subtitle: 'Share bidblitz.ae and get free bids',
    shareOn: 'Share on',
    copyLink: 'Copy link',
    copied: 'Copied!',
    reward: '+5 Bids per share',
    twitter: 'Twitter/X',
    facebook: 'Facebook',
    whatsapp: 'WhatsApp',
    shareMessage: "I'm saving up to 90% on bidblitz.ae! Try it:",
    thankYou: 'Thanks for sharing!'
  }
};

export default function ShareAndWin({ onClose, compact = false }) {
  const { language } = useLanguage();
  const { token, user, refreshUser } = useAuth();
  const t = shareTexts[language] || shareTexts.de;
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);

  const referralCode = user?.id?.substring(0, 8).toUpperCase() || 'BIDBLITZ';
  const shareUrl = `https://bidblitz.de/register?ref=${referralCode}`;
  const shareMessage = `${t.shareMessage} ${shareUrl}`;

  const trackShare = async (platform) => {
    if (!token) return;
    
    try {
      await axios.post(`${API}/social-share/track`, {
        platform,
        referral_code: referralCode
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Refresh user to update bids
      if (refreshUser) refreshUser();
    } catch (error) {
      console.log('Share tracking error:', error);
    }
  };

  const handleShare = async (platform) => {
    setSharing(true);
    
    let shareUrlFinal = '';
    const encodedMessage = encodeURIComponent(shareMessage);
    const encodedUrl = encodeURIComponent(shareUrl);

    switch (platform) {
      case 'twitter':
        shareUrlFinal = `https://twitter.com/intent/tweet?text=${encodedMessage}`;
        break;
      case 'facebook':
        shareUrlFinal = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedMessage}`;
        break;
      case 'whatsapp':
        shareUrlFinal = `https://wa.me/?text=${encodedMessage}`;
        break;
      case 'copy':
        const success = await safeCopyToClipboard(shareUrl);
        if (success) {
          setCopied(true);
          toast.success(t.copied);
          setTimeout(() => setCopied(false), 2000);
          await trackShare('copy');
        }
        setSharing(false);
        return;
      default:
        break;
    }

    if (shareUrlFinal) {
      window.open(shareUrlFinal, '_blank', 'width=600,height=400');
      await trackShare(platform);
      toast.success(t.thankYou);
    }
    
    setSharing(false);
  };

  const platforms = [
    { id: 'twitter', icon: Twitter, label: t.twitter, color: 'bg-black hover:bg-gray-800' },
    { id: 'facebook', icon: Facebook, label: t.facebook, color: 'bg-blue-600 hover:bg-blue-700' },
    { id: 'whatsapp', icon: MessageCircle, label: t.whatsapp, color: 'bg-green-500 hover:bg-green-600' },
  ];

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {platforms.map((platform) => (
          <button
            key={platform.id}
            onClick={() => handleShare(platform.id)}
            className={`w-10 h-10 rounded-full ${platform.color} text-white flex items-center justify-center transition-all hover:scale-110`}
            title={platform.label}
          >
            <platform.icon className="w-5 h-5" />
          </button>
        ))}
        <button
          onClick={() => handleShare('copy')}
          className="w-10 h-10 rounded-full bg-gray-500 hover:bg-gray-600 text-white flex items-center justify-center transition-all hover:scale-110"
          title={t.copyLink}
        >
          {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
        </button>
      </div>
    );
  }

  return (
    <div className="relative bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-cyan-500/10 border border-cyan-500/30 rounded-xl p-4 mb-6 overflow-hidden">
      {/* Close button */}
      {onClose && (
        <button 
          onClick={onClose}
          className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 transition-colors z-10"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-4">
        {/* Icon */}
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-cyan-500/30">
          <Share2 className="w-7 h-7 text-white" />
        </div>

        {/* Content */}
        <div className="flex-1">
          <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
            {t.title}
            <span className="px-2 py-0.5 bg-green-500 text-white text-xs rounded-full flex items-center gap-1">
              <Gift className="w-3 h-3" />
              {t.reward}
            </span>
          </h3>
          <p className="text-gray-500 text-sm mb-3">{t.subtitle}</p>
          
          {/* Share buttons */}
          <div className="flex flex-wrap gap-2">
            {platforms.map((platform) => (
              <Button
                key={platform.id}
                onClick={() => handleShare(platform.id)}
                disabled={sharing}
                size="sm"
                className={`${platform.color} text-white`}
              >
                <platform.icon className="w-4 h-4 mr-1" />
                {platform.label}
              </Button>
            ))}
            <Button
              onClick={() => handleShare('copy')}
              disabled={sharing}
              size="sm"
              variant="outline"
              className="border-gray-300 text-gray-600"
            >
              {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
              {copied ? t.copied : t.copyLink}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
