import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Users, Gift, Copy, CheckCircle, Share2, Zap } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function InviteFriends() {
  const { isAuthenticated, token, user } = useAuth();
  const [referralData, setReferralData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Reward tiers - more friends = more bids
  const rewardTiers = [
    { friends: 1, bids: 5, label: '1 Freund' },
    { friends: 3, bids: 20, label: '3 Freunde' },
    { friends: 5, bids: 40, label: '5 Freunde' },
    { friends: 10, bids: 100, label: '10 Freunde' },
    { friends: 25, bids: 300, label: '25 Freunde' },
    { friends: 50, bids: 750, label: '50 Freunde' },
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
    toast.success('Link kopiert!');
    setTimeout(() => setCopied(false), 2000);
  };

  const shareLink = async () => {
    const link = referralData?.referral_link || `https://bidblitz.de/register?ref=${user?.id?.substring(0, 8).toUpperCase()}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'BidBlitz - Penny Auktionen',
          text: 'Registriere dich bei BidBlitz und erhalte 10 kostenlose Gebote!',
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
          <h2 className="text-xl font-bold text-white mb-4">Freunde einladen</h2>
          <p className="text-[#94A3B8] mb-6">Melden Sie sich an, um Freunde einzuladen und Gebote zu verdienen.</p>
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
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
            Freunde einladen
          </h1>
          <p className="text-[#94A3B8]">
            Je mehr Freunde, desto mehr Gebote!
          </p>
        </div>

        {/* Referral Link Card */}
        <div className="glass-card p-6 rounded-xl mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Share2 className="w-5 h-5 text-[#06B6D4]" />
            <span className="text-white font-medium">Dein Einladungslink</span>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 p-3 rounded-lg bg-[#181824] border border-white/10 overflow-hidden">
              <code className="text-[#06B6D4] text-sm truncate block">
                {referralData?.referral_link || `https://bidblitz.de/register?ref=${user?.id?.substring(0, 8).toUpperCase()}`}
              </code>
            </div>
            <Button onClick={copyLink} className="btn-primary whitespace-nowrap">
              {copied ? <CheckCircle className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
              {copied ? 'Kopiert!' : 'Kopieren'}
            </Button>
          </div>
          <Button onClick={shareLink} variant="outline" className="w-full mt-3 border-white/10 text-white">
            <Share2 className="w-4 h-4 mr-2" />
            Link teilen
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="glass-card p-5 rounded-xl text-center">
            <Users className="w-8 h-8 text-[#7C3AED] mx-auto mb-2" />
            <p className="text-3xl font-bold text-white">{referralData?.qualified_friends || 0}</p>
            <p className="text-[#94A3B8] text-sm">Qualifizierte Freunde</p>
            <p className="text-[#94A3B8] text-xs">(mind. €5 eingezahlt)</p>
          </div>
          <div className="glass-card p-5 rounded-xl text-center">
            <Zap className="w-8 h-8 text-[#FFD700] mx-auto mb-2" />
            <p className="text-3xl font-bold text-[#FFD700]">{bidsEarned}</p>
            <p className="text-[#94A3B8] text-sm">Gebote verdient</p>
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

        {/* Friend Gets */}
        <div className="glass-card p-5 rounded-xl mb-6 border border-[#10B981]/30 bg-[#10B981]/5">
          <div className="flex items-center gap-3">
            <Gift className="w-8 h-8 text-[#10B981]" />
            <div>
              <p className="text-white font-medium">Dein Freund bekommt</p>
              <p className="text-[#10B981] text-xl font-bold">10 kostenlose Gebote</p>
            </div>
          </div>
          <p className="text-[#94A3B8] text-sm mt-3 border-t border-white/10 pt-3">
            <span className="text-[#FFD700] font-medium">Bedingung:</span> Du erhältst deine Belohnung, sobald dein Freund mindestens <span className="text-white font-bold">€5</span> aufgeladen hat.
          </p>
        </div>

        {/* Reward Tiers */}
        <div className="glass-card p-6 rounded-xl">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
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
                        : 'bg-[#181824]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {achieved ? (
                      <CheckCircle className="w-5 h-5 text-[#10B981]" />
                    ) : (
                      <div className={`w-5 h-5 rounded-full border-2 ${isNext ? 'border-[#FFD700]' : 'border-[#475569]'}`} />
                    )}
                    <span className={achieved ? 'text-[#10B981]' : isNext ? 'text-[#FFD700]' : 'text-[#94A3B8]'}>
                      {tier.label}
                    </span>
                  </div>
                  <span className={`font-bold ${achieved ? 'text-[#10B981]' : isNext ? 'text-[#FFD700]' : 'text-white'}`}>
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
