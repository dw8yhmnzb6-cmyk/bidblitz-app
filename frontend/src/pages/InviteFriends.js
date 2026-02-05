import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Button } from '../components/ui/button';
import { Users, Gift, Copy, CheckCircle, Share2, Zap } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// InviteFriends translations
const inviteTexts = {
  de: {
    title: "Freunde einladen",
    subtitle: "Laden Sie Freunde ein und verdienen Sie Gratis-Gebote!",
    yourCode: "Ihr Empfehlungscode",
    copyLink: "Link kopieren",
    copied: "Kopiert!",
    share: "Teilen",
    howItWorks: "So funktioniert's",
    step1: "Teilen Sie Ihren Code",
    step1Desc: "Senden Sie Ihren Empfehlungslink an Freunde",
    step2: "Freund registriert sich",
    step2Desc: "Ihr Freund erstellt ein Konto mit Ihrem Code",
    step3: "Beide profitieren",
    step3Desc: "Sie erhalten 10 Gebote, Ihr Freund 5 Gebote!",
    yourProgress: "Ihr Fortschritt",
    friendsInvited: "Freunde eingeladen",
    bidsEarned: "Gebote verdient",
    nextMilestone: "Nächstes Ziel",
    friendsNeeded: "Freunde",
    rewardTiers: "Belohnungsstufen",
    friend: "Freund",
    friends: "Freunde",
    bids: "Gebote",
    loginRequired: "Bitte melden Sie sich an, um Freunde einzuladen",
    login: "Anmelden",
    register: "Registrieren",
    bonusInfo: "Bei erstem Kauf des Freundes:",
    youGet: "Sie erhalten",
    friendGets: "Ihr Freund erhält"
  },
  en: {
    title: "Invite Friends",
    subtitle: "Invite friends and earn free bids!",
    yourCode: "Your Referral Code",
    copyLink: "Copy Link",
    copied: "Copied!",
    share: "Share",
    howItWorks: "How it works",
    step1: "Share your code",
    step1Desc: "Send your referral link to friends",
    step2: "Friend signs up",
    step2Desc: "Your friend creates an account with your code",
    step3: "Both benefit",
    step3Desc: "You get 10 bids, your friend gets 5 bids!",
    yourProgress: "Your Progress",
    friendsInvited: "Friends invited",
    bidsEarned: "Bids earned",
    nextMilestone: "Next milestone",
    friendsNeeded: "friends",
    rewardTiers: "Reward Tiers",
    friend: "friend",
    friends: "friends",
    bids: "Bids",
    loginRequired: "Please log in to invite friends",
    login: "Log In",
    register: "Register",
    bonusInfo: "On friend's first purchase:",
    youGet: "You get",
    friendGets: "Your friend gets"
  },
  sq: {
    title: "Ftoni Miqtë",
    subtitle: "Ftoni miqtë dhe fitoni oferta falas!",
    yourCode: "Kodi Juaj i Referimit",
    copyLink: "Kopjo Linkun",
    copied: "U kopjua!",
    share: "Ndaj",
    howItWorks: "Si funksionon",
    step1: "Ndani kodin tuaj",
    step1Desc: "Dërgoni linkun tuaj të referimit miqve",
    step2: "Miku regjistrohet",
    step2Desc: "Miku juaj krijon llogari me kodin tuaj",
    step3: "Të dy përfitoni",
    step3Desc: "Ju të dy merrni oferta falas!",
    yourProgress: "Progresi Juaj",
    friendsInvited: "Miq të ftuar",
    bidsEarned: "Oferta të fituara",
    nextMilestone: "Objektivi i radhës",
    friendsNeeded: "miq",
    rewardTiers: "Nivelet e Shpërblimit",
    friend: "mik",
    friends: "miq",
    bids: "Oferta",
    loginRequired: "Ju lutem hyni për të ftuar miq",
    login: "Hyr",
    register: "Regjistrohu"
  },
  tr: {
    title: "Arkadaşları Davet Et",
    subtitle: "Arkadaşlarınızı davet edin ve ücretsiz teklifler kazanın!",
    yourCode: "Referans Kodunuz",
    copyLink: "Linki Kopyala",
    copied: "Kopyalandı!",
    share: "Paylaş",
    howItWorks: "Nasıl çalışır",
    step1: "Kodunuzu paylaşın",
    step1Desc: "Referans linkinizi arkadaşlarınıza gönderin",
    step2: "Arkadaş kaydolur",
    step2Desc: "Arkadaşınız kodunuzla hesap oluşturur",
    step3: "İkiniz de kazanın",
    step3Desc: "İkiniz de ücretsiz teklif alırsınız!",
    yourProgress: "İlerlemeniz",
    friendsInvited: "Davet edilen arkadaşlar",
    bidsEarned: "Kazanılan teklifler",
    nextMilestone: "Sonraki hedef",
    friendsNeeded: "arkadaş",
    rewardTiers: "Ödül Seviyeleri",
    friend: "arkadaş",
    friends: "arkadaş",
    bids: "Teklif",
    loginRequired: "Arkadaş davet etmek için lütfen giriş yapın",
    login: "Giriş Yap",
    register: "Kayıt Ol"
  },
  fr: {
    title: "Inviter des Amis",
    subtitle: "Invitez des amis et gagnez des enchères gratuites!",
    yourCode: "Votre Code de Parrainage",
    copyLink: "Copier le Lien",
    copied: "Copié!",
    share: "Partager",
    howItWorks: "Comment ça marche",
    step1: "Partagez votre code",
    step1Desc: "Envoyez votre lien de parrainage à vos amis",
    step2: "L'ami s'inscrit",
    step2Desc: "Votre ami crée un compte avec votre code",
    step3: "Tous les deux gagnent",
    step3Desc: "Vous recevez tous les deux des enchères gratuites!",
    yourProgress: "Votre Progression",
    friendsInvited: "Amis invités",
    bidsEarned: "Enchères gagnées",
    nextMilestone: "Prochain objectif",
    friendsNeeded: "amis",
    rewardTiers: "Niveaux de Récompense",
    friend: "ami",
    friends: "amis",
    bids: "Enchères",
    loginRequired: "Veuillez vous connecter pour inviter des amis",
    login: "Connexion",
    register: "Inscription"
  }
};

export default function InviteFriends() {
  const { isAuthenticated, token, user } = useAuth();
  const { language } = useLanguage();
  const texts = inviteTexts[language] || inviteTexts.de;
  const [referralData, setReferralData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Reward tiers - more friends = more bids
  const rewardTiers = [
    { friends: 1, bids: 5, label: `1 ${texts.friend}` },
    { friends: 3, bids: 20, label: `3 ${texts.friends}` },
    { friends: 5, bids: 40, label: `5 ${texts.friends}` },
    { friends: 10, bids: 100, label: `10 ${texts.friends}` },
    { friends: 25, bids: 300, label: `25 ${texts.friends}` },
    { friends: 50, bids: 750, label: `50 ${texts.friends}` },
  ];

  useEffect(() => {
    if (isAuthenticated) {
      fetchReferralData();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const fetchReferralData = async () => {
    try {
      const response = await axios.get(`${API}/users/referrals`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setReferralData(response.data);
    } catch (error) {
      console.error('Error fetching referral data:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyLink = () => {
    const link = referralData?.referral_link || `https://bidblitz.de/register?ref=${user?.id?.substring(0, 8).toUpperCase()}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success(texts.copied);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareLink = async () => {
    const link = referralData?.referral_link || `https://bidblitz.de/register?ref=${user?.id?.substring(0, 8).toUpperCase()}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'BidBlitz - Penny Auktionen',
          text: language === 'en' ? 'Sign up at BidBlitz and get 10 free bids!' : 'Registriere dich bei BidBlitz und erhalte 10 kostenlose Gebote!',
          url: link
        });
      } catch (err) {
        copyLink();
      }
    } else {
      copyLink();
    }
  };

  const invitedFriends = referralData?.invited_friends || 0;
  const bidsEarned = referralData?.bids_earned || 0;

  // Calculate next milestone
  const nextTier = rewardTiers.find(t => t.friends > invitedFriends) || rewardTiers[rewardTiers.length - 1];
  const currentTier = rewardTiers.filter(t => t.friends <= invitedFriends).pop();

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen pt-24 pb-12 px-4 flex items-center justify-center">
        <div className="glass-card p-8 rounded-xl text-center max-w-md">
          <Users className="w-16 h-16 text-[#FFD700] mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-4">Freunde einladen</h2>
          <p className="text-gray-500 mb-6">Melden Sie sich an, um Freunde einzuladen und Gebote zu verdienen.</p>
          <Button className="btn-primary" onClick={() => window.location.href = '/login'}>
            Anmelden
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FFD700]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-12 px-4" data-testid="invite-friends-page">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-full bg-[#FFD700]/20 flex items-center justify-center mx-auto mb-4">
            <Gift className="w-10 h-10 text-[#FFD700]" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">
            Freunde einladen
          </h1>
          <p className="text-gray-500">
            Je mehr Freunde, desto mehr Gebote!
          </p>
        </div>

        {/* Referral Link Card */}
        <div className="glass-card p-6 rounded-xl mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Share2 className="w-5 h-5 text-[#06B6D4]" />
            <span className="text-gray-800 font-medium">Dein Einladungslink</span>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 p-3 rounded-lg bg-white border border-gray-200 overflow-hidden">
              <code className="text-[#06B6D4] text-sm truncate block">
                {referralData?.referral_link || `https://bidblitz.de/register?ref=${user?.id?.substring(0, 8).toUpperCase()}`}
              </code>
            </div>
            <Button onClick={copyLink} className="btn-primary whitespace-nowrap">
              {copied ? <CheckCircle className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
              {copied ? 'Kopiert!' : 'Kopieren'}
            </Button>
          </div>
          <Button onClick={shareLink} variant="outline" className="w-full mt-3 border-gray-200 text-gray-800">
            <Share2 className="w-4 h-4 mr-2" />
            Link teilen
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="glass-card p-5 rounded-xl text-center">
            <Users className="w-8 h-8 text-[#7C3AED] mx-auto mb-2" />
            <p className="text-3xl font-bold text-gray-800">{referralData?.qualified_friends || 0}</p>
            <p className="text-gray-500 text-sm">Qualifizierte Freunde</p>
            <p className="text-gray-500 text-xs">(mind. €5 eingezahlt)</p>
          </div>
          <div className="glass-card p-5 rounded-xl text-center">
            <Zap className="w-8 h-8 text-[#FFD700] mx-auto mb-2" />
            <p className="text-3xl font-bold text-[#FFD700]">{bidsEarned}</p>
            <p className="text-gray-500 text-sm">Gebote verdient</p>
          </div>
        </div>

        {/* Pending Friends Info */}
        {invitedFriends > (referralData?.qualified_friends || 0) && (
          <div className="glass-card p-4 rounded-xl mb-6 border border-[#FFD700]/30 bg-[#FFD700]/5">
            <p className="text-[#FFD700] text-sm text-center">
              <strong>{invitedFriends - (referralData?.qualified_friends || 0)}</strong> Freund(e) haben sich registriert, aber noch keine €5 eingezahlt
            </p>
          </div>
        )}

        {/* Bonus Info - Clear explanation */}
        <div className="glass-card p-5 rounded-xl mb-6 border border-[#10B981]/30 bg-[#10B981]/5">
          <h3 className="text-gray-800 font-bold mb-3 flex items-center gap-2">
            <Gift className="w-5 h-5 text-[#10B981]" />
            {texts.bonusInfo || 'Bei erstem Kauf des Freundes:'}
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-[#FFD700]/10 rounded-lg">
              <p className="text-[#FFD700] text-2xl font-black">10</p>
              <p className="text-gray-500 text-xs">{texts.youGet || 'Sie erhalten'}</p>
              <p className="text-gray-800 text-sm font-medium">Gebote</p>
            </div>
            <div className="text-center p-3 bg-[#10B981]/10 rounded-lg">
              <p className="text-[#10B981] text-2xl font-black">5</p>
              <p className="text-gray-500 text-xs">{texts.friendGets || 'Ihr Freund erhält'}</p>
              <p className="text-gray-800 text-sm font-medium">Gebote</p>
            </div>
          </div>
          <p className="text-gray-500 text-xs mt-3 border-t border-gray-200 pt-3 text-center">
            <span className="text-[#FFD700] font-medium">Bedingung:</span> Freund muss mindestens <span className="text-gray-800 font-bold">€5</span> aufladen
          </p>
        </div>

        {/* Reward Tiers */}
        <div className="glass-card p-6 rounded-xl">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-[#FFD700]" />
            Deine Belohnungen
          </h3>
          <div className="space-y-3">
            {rewardTiers.map((tier, index) => {
              const achieved = invitedFriends >= tier.friends;
              const isCurrent = currentTier?.friends === tier.friends;
              const isNext = nextTier?.friends === tier.friends && !achieved;
              
              return (
                <div 
                  key={index} 
                  className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                    achieved 
                      ? 'bg-[#10B981]/20 border border-[#10B981]/30' 
                      : isNext 
                        ? 'bg-[#FFD700]/10 border border-[#FFD700]/30'
                        : 'bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {achieved ? (
                      <CheckCircle className="w-5 h-5 text-[#10B981]" />
                    ) : (
                      <div className={`w-5 h-5 rounded-full border-2 ${isNext ? 'border-[#FFD700]' : 'border-[#475569]'}`} />
                    )}
                    <span className={achieved ? 'text-[#10B981]' : isNext ? 'text-[#FFD700]' : 'text-gray-500'}>
                      {tier.label}
                    </span>
                  </div>
                  <span className={`font-bold ${achieved ? 'text-[#10B981]' : isNext ? 'text-[#FFD700]' : 'text-gray-800'}`}>
                    +{tier.bids} Gebote
                  </span>
                </div>
              );
            })}
          </div>
          
          {nextTier && invitedFriends < nextTier.friends && (
            <div className="mt-4 p-3 rounded-lg bg-[#FFD700]/10 border border-[#FFD700]/30">
              <p className="text-[#FFD700] text-sm text-center">
                Noch <strong>{nextTier.friends - invitedFriends}</strong> Freund{nextTier.friends - invitedFriends !== 1 ? 'e' : ''} bis zu <strong>+{nextTier.bids} Geboten</strong>!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
