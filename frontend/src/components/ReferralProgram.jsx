/**
 * ReferralProgram - Component for the referral/invite system
 * "Refer a friend, both get €10 bonus"
 */
import { useState, useEffect } from 'react';
import { Users, Gift, Copy, Check, Share2, ChevronDown, ChevronUp, Trophy, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

const translations = {
  de: {
    title: 'Freunde einladen',
    subtitle: 'Verdiene €10 für jeden Freund!',
    yourCode: 'Dein Empfehlungscode',
    copyCode: 'Code kopieren',
    copied: 'Kopiert!',
    share: 'Teilen',
    howItWorks: 'So funktioniert\'s',
    step1: 'Teile deinen Code mit Freunden',
    step2: 'Dein Freund meldet sich an und gibt den Code ein',
    step3: 'Ihr beide erhaltet €10 Bonus!',
    yourReferrals: 'Deine Einladungen',
    totalEarned: 'Gesamt verdient',
    friendsInvited: 'Freunde eingeladen',
    noReferrals: 'Noch keine Einladungen',
    noReferralsDesc: 'Teile deinen Code und verdiene €10 pro Freund!',
    reward: 'Belohnung',
    enterCode: 'Code eingeben',
    enterCodePlaceholder: 'Empfehlungscode eingeben',
    useCode: 'Code einlösen',
    haveCode: 'Du hast einen Empfehlungscode?',
    codeUsed: 'Code erfolgreich eingelöst! €10 Bonus gutgeschrieben.',
    shareText: 'Melde dich bei BidBlitz an mit meinem Code {code} und wir beide erhalten €10 Bonus!',
    shareTitle: 'BidBlitz - €10 Bonus für dich!'
  },
  en: {
    title: 'Invite Friends',
    subtitle: 'Earn €10 for every friend!',
    yourCode: 'Your Referral Code',
    copyCode: 'Copy Code',
    copied: 'Copied!',
    share: 'Share',
    howItWorks: 'How it works',
    step1: 'Share your code with friends',
    step2: 'Your friend signs up and enters the code',
    step3: 'You both get €10 bonus!',
    yourReferrals: 'Your Referrals',
    totalEarned: 'Total Earned',
    friendsInvited: 'Friends Invited',
    noReferrals: 'No referrals yet',
    noReferralsDesc: 'Share your code and earn €10 per friend!',
    reward: 'Reward',
    enterCode: 'Enter Code',
    enterCodePlaceholder: 'Enter referral code',
    useCode: 'Use Code',
    haveCode: 'Have a referral code?',
    codeUsed: 'Code successfully used! €10 bonus credited.',
    shareText: 'Sign up at BidBlitz with my code {code} and we both get €10 bonus!',
    shareTitle: 'BidBlitz - €10 Bonus for you!'
  },
  sq: {
    title: 'Ftoni Miqtë',
    subtitle: 'Fito €10 për çdo mik!',
    yourCode: 'Kodi Juaj i Referimit',
    copyCode: 'Kopjo Kodin',
    copied: 'U kopjua!',
    share: 'Ndaj',
    howItWorks: 'Si funksionon',
    step1: 'Ndani kodin tuaj me miqtë',
    step2: 'Miku juaj regjistrohet dhe fut kodin',
    step3: 'Ju të dy merrni €10 bonus!',
    yourReferrals: 'Referimet Tuaja',
    totalEarned: 'Gjithsej të Fituara',
    friendsInvited: 'Miq të Ftuar',
    noReferrals: 'Ende nuk ka referime',
    noReferralsDesc: 'Ndani kodin tuaj dhe fitoni €10 për mik!',
    reward: 'Shpërblim',
    enterCode: 'Fut Kodin',
    enterCodePlaceholder: 'Fut kodin e referimit',
    useCode: 'Përdor Kodin',
    haveCode: 'Keni një kod referimi?',
    codeUsed: 'Kodi u përdor me sukses! €10 bonus u kreditua.',
    shareText: 'Regjistrohu në BidBlitz me kodin tim {code} dhe të dy marrim €10 bonus!',
    shareTitle: 'BidBlitz - €10 Bonus për ty!'
  },
  tr: {
    title: 'Arkadaşlarını Davet Et',
    subtitle: 'Her arkadaş için €10 kazan!',
    yourCode: 'Davet Kodunuz',
    copyCode: 'Kodu Kopyala',
    copied: 'Kopyalandı!',
    share: 'Paylaş',
    howItWorks: 'Nasıl çalışır',
    step1: 'Kodunuzu arkadaşlarınızla paylaşın',
    step2: 'Arkadaşınız kaydolur ve kodu girer',
    step3: 'İkiniz de €10 bonus kazanırsınız!',
    yourReferrals: 'Davetleriniz',
    totalEarned: 'Toplam Kazanç',
    friendsInvited: 'Davet Edilen Arkadaşlar',
    noReferrals: 'Henüz davet yok',
    noReferralsDesc: 'Kodunuzu paylaşın ve arkadaş başına €10 kazanın!',
    reward: 'Ödül',
    enterCode: 'Kod Gir',
    enterCodePlaceholder: 'Davet kodunu girin',
    useCode: 'Kodu Kullan',
    haveCode: 'Davet kodunuz var mı?',
    codeUsed: 'Kod başarıyla kullanıldı! €10 bonus eklendi.',
    shareText: '{code} kodumla BidBlitz\'e kaydol ve ikimiz de €10 bonus kazanalım!',
    shareTitle: 'BidBlitz - Senin için €10 Bonus!'
  }
};

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ReferralProgram = ({ language = 'de', token, onBalanceUpdate }) => {
  const [referralData, setReferralData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showEnterCode, setShowEnterCode] = useState(false);
  const [inputCode, setInputCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showReferrals, setShowReferrals] = useState(false);
  
  const t = translations[language] || translations.de;

  const fetchReferralData = async () => {
    try {
      const res = await fetch(`${API}/referral/my-code`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setReferralData(data);
      }
    } catch (err) {
      console.error('Error fetching referral data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchReferralData();
    }
  }, [token]);

  const copyCode = () => {
    if (referralData?.code) {
      navigator.clipboard.writeText(referralData.code);
      setCopied(true);
      toast.success(t.copied);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shareCode = async () => {
    const shareText = t.shareText.replace('{code}', referralData?.code || '');
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: t.shareTitle,
          text: shareText,
          url: 'https://bidblitz.ae'
        });
      } catch (err) {
        // User cancelled or error
        copyCode();
      }
    } else {
      copyCode();
    }
  };

  const useReferralCode = async () => {
    if (!inputCode.trim()) return;
    
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/referral/use`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ referral_code: inputCode.trim().toUpperCase() })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        toast.success(t.codeUsed);
        setInputCode('');
        setShowEnterCode(false);
        if (onBalanceUpdate) onBalanceUpdate();
      } else {
        toast.error(data.detail || 'Fehler');
      }
    } catch (err) {
      toast.error('Fehler beim Einlösen des Codes');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="h-16 bg-gray-200 rounded mb-4"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden" data-testid="referral-program">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500 p-6 text-white">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center">
            <Users className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">{t.title}</h2>
            <p className="text-purple-100 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              {t.subtitle}
            </p>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Your Code */}
        <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl p-6 mb-6">
          <p className="text-sm text-purple-600 font-medium mb-2">{t.yourCode}</p>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-white rounded-xl px-5 py-4 border-2 border-purple-200 border-dashed">
              <p className="text-2xl font-bold text-purple-700 font-mono tracking-wider">
                {referralData?.code || '---'}
              </p>
            </div>
            <button
              onClick={copyCode}
              className="p-4 bg-purple-100 hover:bg-purple-200 rounded-xl transition-colors"
              title={t.copyCode}
            >
              {copied ? (
                <Check className="w-6 h-6 text-green-600" />
              ) : (
                <Copy className="w-6 h-6 text-purple-600" />
              )}
            </button>
            <button
              onClick={shareCode}
              className="p-4 bg-purple-600 hover:bg-purple-700 rounded-xl transition-colors"
              title={t.share}
            >
              <Share2 className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 text-center">
            <Trophy className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-emerald-700">
              €{(referralData?.total_earned || 0).toFixed(2)}
            </p>
            <p className="text-sm text-emerald-600">{t.totalEarned}</p>
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 text-center">
            <Users className="w-8 h-8 text-blue-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-blue-700">
              {referralData?.uses || 0}
            </p>
            <p className="text-sm text-blue-600">{t.friendsInvited}</p>
          </div>
        </div>

        {/* How it works */}
        <div className="bg-gray-50 rounded-xl p-4 mb-6">
          <h3 className="font-semibold text-gray-700 mb-3">{t.howItWorks}</h3>
          <div className="space-y-3">
            {[t.step1, t.step2, t.step3].map((step, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 font-bold text-sm">
                  {i + 1}
                </div>
                <p className="text-gray-600 text-sm flex-1">{step}</p>
                {i === 2 && <Gift className="w-5 h-5 text-purple-500" />}
              </div>
            ))}
          </div>
        </div>

        {/* Referral History */}
        {referralData?.referrals?.length > 0 && (
          <div className="border rounded-xl overflow-hidden mb-6">
            <button
              onClick={() => setShowReferrals(!showReferrals)}
              className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <span className="font-semibold text-gray-700">{t.yourReferrals}</span>
              {showReferrals ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
            </button>
            
            {showReferrals && (
              <div className="divide-y">
                {referralData.referrals.map((ref, index) => (
                  <div key={index} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                        <Users className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-700">Freund #{index + 1}</p>
                        <p className="text-sm text-gray-500">
                          {new Date(ref.date).toLocaleDateString('de-DE')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600">+€{ref.reward}</p>
                      <p className="text-xs text-gray-500">{t.reward}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Enter Code Section */}
        <div className="border-t pt-4">
          <button
            onClick={() => setShowEnterCode(!showEnterCode)}
            className="text-purple-600 hover:text-purple-700 text-sm font-medium flex items-center gap-2"
          >
            <Gift className="w-4 h-4" />
            {t.haveCode}
          </button>
          
          {showEnterCode && (
            <div className="mt-4 flex gap-2">
              <input
                type="text"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                placeholder={t.enterCodePlaceholder}
                className="flex-1 px-4 py-3 border rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 font-mono uppercase"
                maxLength={15}
              />
              <button
                onClick={useReferralCode}
                disabled={submitting || !inputCode.trim()}
                className="px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white font-semibold rounded-xl transition-colors"
              >
                {submitting ? '...' : t.useCode}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReferralProgram;
