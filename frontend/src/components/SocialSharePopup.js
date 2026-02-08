import React, { useState, memo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Share2, Facebook, Twitter, Send, MessageCircle, Instagram, Gift, Check, X } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const translations = {
  de: {
    shareYourWin: "Teile deinen Gewinn!",
    earnBids: "Verdiene 3 Gratis-Gebote",
    shareOn: "Teilen auf",
    shareText: "Ich habe gerade bei BidBlitz gewonnen! 🎉",
    bonusEarned: "Bonus erhalten!",
    bonusBids: "+3 Gebote gutgeschrieben",
    alreadyShared: "Bereits geteilt",
    close: "Schließen"
  },
  en: {
    shareYourWin: "Share your win!",
    earnBids: "Earn 3 free bids",
    shareOn: "Share on",
    shareText: "I just won at BidBlitz! 🎉",
    bonusEarned: "Bonus earned!",
    bonusBids: "+3 bids credited",
    alreadyShared: "Already shared",
    close: "Close"
  },
  sq: {
    shareYourWin: "Shpërndaj fitoren tënde!",
    earnBids: "Fito 3 oferta falas",
    shareOn: "Shpërndaj në",
    shareText: "Sapo fitova në BidBlitz! 🎉",
    bonusEarned: "Bonus i fituar!",
    bonusBids: "+3 oferta të kredituar",
    alreadyShared: "Tashmë e shpërndarë",
    close: "Mbyll"
  },
  xk: {
    shareYourWin: "Shpërndaj fitoren tënde!",
    earnBids: "Fito 3 oferta falas",
    shareOn: "Shpërndaj në",
    shareText: "Sapo fitova në BidBlitz! 🎉",
    bonusEarned: "Bonus i fituar!",
    bonusBids: "+3 oferta të kredituar",
    alreadyShared: "Tashmë e shpërndarë",
    close: "Mbyll"
  },
  tr: {
    shareYourWin: "Kazancını paylaş!",
    earnBids: "3 ücretsiz teklif kazan",
    shareOn: "Paylaş",
    shareText: "BidBlitz'de kazandım! 🎉",
    bonusEarned: "Bonus kazanıldı!",
    bonusBids: "+3 teklif eklendi",
    alreadyShared: "Zaten paylaşıldı",
    close: "Kapat"
  },
  fr: {
    shareYourWin: "Partagez votre gain!",
    earnBids: "Gagnez 3 enchères gratuites",
    shareOn: "Partager sur",
    shareText: "Je viens de gagner sur BidBlitz! 🎉",
    bonusEarned: "Bonus gagné!",
    bonusBids: "+3 enchères créditées",
    alreadyShared: "Déjà partagé",
    close: "Fermer"
  }
};

const platforms = [
  { 
    id: 'facebook', 
    name: 'Facebook', 
    icon: Facebook, 
    color: 'bg-blue-600 hover:bg-blue-700',
    shareUrl: (text, url) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(text)}`
  },
  { 
    id: 'twitter', 
    name: 'Twitter/X', 
    icon: Twitter, 
    color: 'bg-black hover:bg-gray-800',
    shareUrl: (text, url) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`
  },
  { 
    id: 'whatsapp', 
    name: 'WhatsApp', 
    icon: MessageCircle, 
    color: 'bg-green-500 hover:bg-green-600',
    shareUrl: (text, url) => `https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`
  },
  { 
    id: 'telegram', 
    name: 'Telegram', 
    icon: Send, 
    color: 'bg-sky-500 hover:bg-sky-600',
    shareUrl: (text, url) => `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`
  }
];

const SocialSharePopup = memo(({ isOpen, onClose, auctionId, productName, winPrice }) => {
  const { token } = useAuth();
  const { language , mappedLanguage } = useLanguage();
  // Use mappedLanguage for regional variants (e.g., xk -> sq)
  const langKey = mappedLanguage || language;
  const [bonusEarned, setBonusEarned] = useState(false);
  const [sharedPlatforms, setSharedPlatforms] = useState([]);
  
  const t = translations[langKey] || translations.de;
  
  if (!isOpen) return null;
  
  const shareUrl = `${window.location.origin}/gewinner`;
  const shareText = `${t.shareText} ${productName} für nur €${winPrice?.toFixed(2)}!`;
  
  const handleShare = async (platform) => {
    // Open share window
    const url = platform.shareUrl(shareText, shareUrl);
    window.open(url, '_blank', 'width=600,height=400');
    
    // Record share on backend
    try {
      await axios.post(`${API}/social/share/${auctionId}`, null, {
        params: { platform: platform.id },
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setBonusEarned(true);
      setSharedPlatforms(prev => [...prev, platform.id]);
      toast.success(t.bonusBids);
    } catch (err) {
      // Might already be shared
      if (err.response?.status === 400) {
        setSharedPlatforms(prev => [...prev, platform.id]);
      }
    }
  };
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>
        
        {/* Header */}
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-6 text-center text-white">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/20 mb-3">
            {bonusEarned ? <Check className="w-8 h-8" /> : <Share2 className="w-8 h-8" />}
          </div>
          <h2 className="text-xl font-bold">{bonusEarned ? t.bonusEarned : t.shareYourWin}</h2>
          <p className="text-green-100 mt-1 flex items-center justify-center gap-2">
            <Gift className="w-4 h-4" />
            {t.earnBids}
          </p>
        </div>
        
        {/* Share Buttons */}
        <div className="p-6">
          <p className="text-center text-gray-600 mb-4">{t.shareOn}</p>
          
          <div className="grid grid-cols-2 gap-3">
            {platforms.map((platform) => {
              const Icon = platform.icon;
              const isShared = sharedPlatforms.includes(platform.id);
              
              return (
                <button
                  key={platform.id}
                  onClick={() => !isShared && handleShare(platform)}
                  disabled={isShared}
                  className={`flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-white font-semibold transition-colors ${
                    isShared ? 'bg-gray-400 cursor-not-allowed' : platform.color
                  }`}
                >
                  {isShared ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                  {isShared ? t.alreadyShared : platform.name}
                </button>
              );
            })}
          </div>
          
          {/* Close Button */}
          <button
            onClick={onClose}
            className="w-full mt-4 py-2 text-gray-500 hover:text-gray-700 text-sm"
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
});

// Small share button for inline use
const ShareWinButton = memo(({ auctionId, productName, winPrice }) => {
  const [showPopup, setShowPopup] = useState(false);
  const { language , mappedLanguage } = useLanguage();
  // Use mappedLanguage for regional variants (e.g., xk -> sq)
  const langKey = mappedLanguage || language;
  const t = translations[langKey] || translations.de;
  
  return (
    <>
      <button
        onClick={() => setShowPopup(true)}
        className="flex items-center gap-1 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold rounded-lg transition-colors"
        data-testid="share-win-button"
      >
        <Share2 className="w-4 h-4" />
        +3 {t.earnBids?.split(' ')[0]}
      </button>
      
      <SocialSharePopup 
        isOpen={showPopup}
        onClose={() => setShowPopup(false)}
        auctionId={auctionId}
        productName={productName}
        winPrice={winPrice}
      />
    </>
  );
});

export { SocialSharePopup, ShareWinButton };
export default SocialSharePopup;
