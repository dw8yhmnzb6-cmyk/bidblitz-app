/**
 * BidBlitz V2 - Referral Page
 * Share, track referrals, claim daily bonus, view earnings
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../store/I18nContext';
import { 
  ChevronLeft, Copy, Share2, Gift, Users, Wallet, 
  Check, Clock, Flame, Calendar, TrendingUp, Star
} from 'lucide-react';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

// Translations
const TEXTS = {
  de: {
    title: "Freunde einladen",
    subtitle: "Verdiene Geld für jeden Freund",
    your_code: "Dein Code",
    copy_link: "Link kopieren",
    copied: "Kopiert!",
    share_via: "Teilen via",
    whatsapp: "WhatsApp",
    email: "E-Mail",
    telegram: "Telegram",
    rewards_title: "Belohnungen",
    new_user_gets: "Neuer Nutzer erhält",
    you_get: "Du erhältst",
    stats_title: "Deine Statistik",
    total_invited: "Eingeladen",
    pending: "Ausstehend",
    completed: "Abgeschlossen",
    total_earned: "Verdient",
    history_title: "Einladungsverlauf",
    no_referrals: "Noch keine Einladungen",
    daily_bonus: "Täglicher Bonus",
    claim_now: "Jetzt abholen",
    claimed: "Bereits abgeholt",
    streak: "Streak",
    days: "Tage",
    streak_bonus: "Streak Bonus",
    influencer: "Influencer",
    commission: "Provision",
  },
  en: {
    title: "Invite Friends",
    subtitle: "Earn money for every friend",
    your_code: "Your Code",
    copy_link: "Copy Link",
    copied: "Copied!",
    share_via: "Share via",
    whatsapp: "WhatsApp",
    email: "Email",
    telegram: "Telegram",
    rewards_title: "Rewards",
    new_user_gets: "New user gets",
    you_get: "You get",
    stats_title: "Your Stats",
    total_invited: "Invited",
    pending: "Pending",
    completed: "Completed",
    total_earned: "Earned",
    history_title: "Referral History",
    no_referrals: "No referrals yet",
    daily_bonus: "Daily Bonus",
    claim_now: "Claim Now",
    claimed: "Already Claimed",
    streak: "Streak",
    days: "Days",
    streak_bonus: "Streak Bonus",
    influencer: "Influencer",
    commission: "Commission",
  },
  sq: {
    title: "Fto Miqtë",
    subtitle: "Fito para për çdo mik",
    your_code: "Kodi Yt",
    copy_link: "Kopjo Linkun",
    copied: "U kopjua!",
    share_via: "Shpërndaj me",
    whatsapp: "WhatsApp",
    email: "Email",
    telegram: "Telegram",
    rewards_title: "Shpërblimet",
    new_user_gets: "Përdoruesi i ri merr",
    you_get: "Ti merr",
    stats_title: "Statistikat e Tua",
    total_invited: "Të ftuar",
    pending: "Në pritje",
    completed: "Të përfunduara",
    total_earned: "Fituar",
    history_title: "Historia e Referimeve",
    no_referrals: "Ende pa referime",
    daily_bonus: "Bonusi Ditor",
    claim_now: "Merr Tani",
    claimed: "Tashmë e marrë",
    streak: "Streak",
    days: "Ditë",
    streak_bonus: "Bonus Streak",
    influencer: "Influencer",
    commission: "Komision",
  },
};

export default function ReferralSystemPage({ onNavigate }) {
  const { lang } = useI18n();
  
  // Navigation helper (replaces useNavigate)
  const navigate = (path) => {
    if (onNavigate) onNavigate(path);
  };
  
  const t = TEXTS[lang] || TEXTS.de;
  
  const [loading, setLoading] = useState(true);
  const [codeData, setCodeData] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [dailyStatus, setDailyStatus] = useState(null);
  const [claiming, setClaiming] = useState(false);
  const [copied, setCopied] = useState(false);

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      const [codeRes, dashRes, dailyRes] = await Promise.all([
        fetch(`${API}/api/referral/my-code`, { credentials: 'include' }),
        fetch(`${API}/api/referral/dashboard`, { credentials: 'include' }),
        fetch(`${API}/api/referral/daily-status`, { credentials: 'include' }),
      ]);
      
      if (codeRes.ok) setCodeData(await codeRes.json());
      if (dashRes.ok) setDashboard(await dashRes.json());
      if (dailyRes.ok) setDailyStatus(await dailyRes.json());
    } catch (err) {
      console.error('Failed to fetch referral data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Copy to clipboard
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(t.copied);
    setTimeout(() => setCopied(false), 2000);
  };

  // Share
  const share = (platform) => {
    if (!codeData?.share_links) return;
    
    const url = codeData.share_links[platform];
    if (url) {
      if (platform === 'copy') {
        copyToClipboard(codeData.share_url);
      } else {
        window.open(url, '_blank');
      }
    }
  };

  // Web Share API
  const nativeShare = async () => {
    if (!codeData) return;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'BidBlitz Einladung',
          text: `Nutze meinen Code ${codeData.referral_code} und erhalte Bonus!`,
          url: codeData.share_url,
        });
      } catch (err) {}
    } else {
      copyToClipboard(codeData.share_url);
    }
  };

  // Claim daily bonus
  const claimDaily = async () => {
    if (claiming || !dailyStatus?.can_claim) return;
    
    setClaiming(true);
    try {
      const res = await fetch(`${API}/api/referral/claim-daily`, {
        method: 'POST',
        credentials: 'include',
      });
      
      if (res.ok) {
        const data = await res.json();
        toast.success(`€${data.amount.toFixed(2)} gutgeschrieben! 🎉`);
        setDailyStatus(prev => ({
          ...prev,
          can_claim: false,
          already_claimed: true,
          current_streak: data.streak,
        }));
      } else {
        const err = await res.json();
        toast.error(err.detail || 'Fehler');
      }
    } catch (err) {
      toast.error('Fehler beim Abholen');
    } finally {
      setClaiming(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#0A0A0A]/95 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <button onClick={() => navigate('/more')} className="p-2 -ml-2 text-gray-400 hover:text-white">
              <ChevronLeft className="w-6 h-6" />
            </button>
            <h1 className="text-xl font-bold">{t.title}</h1>
            <div className="w-10" />
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Daily Bonus Card */}
        {dailyStatus && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-yellow-500/20 to-orange-500/10 rounded-2xl p-4 border border-yellow-500/30"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-yellow-500/20 rounded-xl flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-yellow-400" />
                </div>
                <div>
                  <p className="font-semibold">{t.daily_bonus}</p>
                  <p className="text-sm text-gray-400">
                    €{dailyStatus.bonus_amount?.toFixed(2)} / {t.days.toLowerCase()}
                  </p>
                </div>
              </div>
              
              <button
                onClick={claimDaily}
                disabled={!dailyStatus.can_claim || claiming}
                className={`px-4 py-2 rounded-xl font-semibold flex items-center gap-2 ${
                  dailyStatus.can_claim
                    ? 'bg-yellow-500 text-black'
                    : 'bg-white/10 text-gray-400'
                }`}
              >
                {dailyStatus.already_claimed ? (
                  <>
                    <Check className="w-4 h-4" />
                    {t.claimed}
                  </>
                ) : (
                  <>
                    <Gift className="w-4 h-4" />
                    {t.claim_now}
                  </>
                )}
              </button>
            </div>
            
            {/* Streak */}
            {dailyStatus.current_streak > 0 && (
              <div className="mt-3 pt-3 border-t border-yellow-500/20 flex items-center gap-2">
                <Flame className="w-5 h-5 text-orange-400" />
                <span className="text-orange-400 font-bold">{dailyStatus.current_streak}</span>
                <span className="text-gray-400">{t.streak} 🔥</span>
              </div>
            )}
          </motion.div>
        )}

        {/* Referral Code Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-[#111] rounded-2xl p-5 border border-white/5"
        >
          <p className="text-sm text-gray-400 mb-2">{t.your_code}</p>
          <div className="flex items-center justify-between bg-[#0A0A0A] rounded-xl p-4">
            <span className="text-2xl font-bold text-cyan-400 tracking-wider">
              {codeData?.referral_code || '---'}
            </span>
            <button
              onClick={() => copyToClipboard(codeData?.referral_code || '')}
              className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
            >
              {copied ? <Check className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5" />}
            </button>
          </div>
          
          {/* Share Buttons */}
          <div className="mt-4">
            <p className="text-sm text-gray-400 mb-3">{t.share_via}</p>
            <div className="grid grid-cols-4 gap-2">
              <button
                onClick={() => share('whatsapp')}
                className="p-3 bg-green-500/20 rounded-xl hover:bg-green-500/30 transition-colors flex flex-col items-center gap-1"
              >
                <span className="text-xl">📱</span>
                <span className="text-xs text-gray-400">WhatsApp</span>
              </button>
              <button
                onClick={() => share('telegram')}
                className="p-3 bg-blue-500/20 rounded-xl hover:bg-blue-500/30 transition-colors flex flex-col items-center gap-1"
              >
                <span className="text-xl">✈️</span>
                <span className="text-xs text-gray-400">Telegram</span>
              </button>
              <button
                onClick={() => share('email')}
                className="p-3 bg-purple-500/20 rounded-xl hover:bg-purple-500/30 transition-colors flex flex-col items-center gap-1"
              >
                <span className="text-xl">📧</span>
                <span className="text-xs text-gray-400">E-Mail</span>
              </button>
              <button
                onClick={nativeShare}
                className="p-3 bg-cyan-500/20 rounded-xl hover:bg-cyan-500/30 transition-colors flex flex-col items-center gap-1"
              >
                <Share2 className="w-5 h-5 text-cyan-400" />
                <span className="text-xs text-gray-400">Mehr</span>
              </button>
            </div>
          </div>
        </motion.div>

        {/* Rewards Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-cyan-500/10 to-blue-500/5 rounded-2xl p-5 border border-cyan-500/20"
        >
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Gift className="w-5 h-5 text-cyan-400" />
            {t.rewards_title}
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#0A0A0A] rounded-xl p-4 text-center">
              <p className="text-sm text-gray-400 mb-1">{t.new_user_gets}</p>
              <p className="text-2xl font-bold text-green-400">
                €{dashboard?.rewards?.new_user_gets?.toFixed(2) || '2.00'}
              </p>
            </div>
            <div className="bg-[#0A0A0A] rounded-xl p-4 text-center">
              <p className="text-sm text-gray-400 mb-1">{t.you_get}</p>
              <p className="text-2xl font-bold text-cyan-400">
                €{dashboard?.rewards?.inviter_gets?.toFixed(2) || '3.00'}
              </p>
            </div>
          </div>
          
          {dashboard?.is_influencer && (
            <div className="mt-4 p-3 bg-purple-500/20 rounded-xl flex items-center gap-3">
              <Star className="w-5 h-5 text-purple-400" />
              <div>
                <p className="font-semibold text-purple-400">{t.influencer}</p>
                <p className="text-sm text-gray-400">5% {t.commission}</p>
              </div>
            </div>
          )}
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-[#111] rounded-2xl p-5 border border-white/5"
        >
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-400" />
            {t.stats_title}
          </h3>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#0A0A0A] rounded-xl p-3 text-center">
              <Users className="w-5 h-5 text-blue-400 mx-auto mb-1" />
              <p className="text-2xl font-bold">{dashboard?.stats?.total_invited || 0}</p>
              <p className="text-xs text-gray-500">{t.total_invited}</p>
            </div>
            <div className="bg-[#0A0A0A] rounded-xl p-3 text-center">
              <Clock className="w-5 h-5 text-yellow-400 mx-auto mb-1" />
              <p className="text-2xl font-bold">{dashboard?.stats?.pending || 0}</p>
              <p className="text-xs text-gray-500">{t.pending}</p>
            </div>
            <div className="bg-[#0A0A0A] rounded-xl p-3 text-center">
              <Check className="w-5 h-5 text-green-400 mx-auto mb-1" />
              <p className="text-2xl font-bold">{dashboard?.stats?.completed || 0}</p>
              <p className="text-xs text-gray-500">{t.completed}</p>
            </div>
            <div className="bg-[#0A0A0A] rounded-xl p-3 text-center">
              <Wallet className="w-5 h-5 text-cyan-400 mx-auto mb-1" />
              <p className="text-2xl font-bold text-cyan-400">€{dashboard?.stats?.total_earnings?.toFixed(2) || '0.00'}</p>
              <p className="text-xs text-gray-500">{t.total_earned}</p>
            </div>
          </div>
        </motion.div>

        {/* Referral History */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-[#111] rounded-2xl p-5 border border-white/5"
        >
          <h3 className="font-semibold mb-4">{t.history_title}</h3>
          
          {!dashboard?.referrals || dashboard.referrals.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>{t.no_referrals}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {dashboard.referrals.slice(0, 10).map((ref, idx) => (
                <div
                  key={ref.referral_id || idx}
                  className="flex items-center justify-between p-3 bg-[#0A0A0A] rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center font-bold">
                      {ref.invited_name?.[0] || '?'}
                    </div>
                    <div>
                      <p className="font-medium">{ref.invited_name || 'Nutzer'}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(ref.created_at).toLocaleDateString('de-DE')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      ref.status === 'completed'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {ref.status === 'completed' ? '✓' : '⏳'}
                    </span>
                    {ref.inviter_reward > 0 && (
                      <p className="text-sm text-green-400 mt-1">+€{ref.inviter_reward.toFixed(2)}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
