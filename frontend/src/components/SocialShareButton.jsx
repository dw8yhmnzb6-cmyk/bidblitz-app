import React from 'react';
import { motion } from 'framer-motion';
import { Share2, Copy, QrCode as QrCodeIcon, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';

/**
 * SocialShareButton — WhatsApp, Instagram, Referral-Links
 * Uber/Lieferando-Style "Freunde einladen"
 */
export default function SocialShareButton({ referralCode, shareUrl, shareText }) {
  const [copied, setCopied] = useState(false);

  const defaultUrl = shareUrl || `https://bidblitz.ae/r/${referralCode || 'DEMO'}`;
  const defaultText = shareText || `Hey! Probier BidBlitz - Die Super-App für Taxi, Food & mehr. Nutze meinen Code ${referralCode || 'DEMO'} für 10€ Bonus! 🎁`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${defaultText}\n\n${defaultUrl}`);
      setCopied(true);
      toast.success('Link kopiert!');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Kopieren fehlgeschlagen');
    }
  };

  const handleShareWhatsApp = () => {
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${defaultText}\n\n${defaultUrl}`)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleShareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'BidBlitz - Super-App',
          text: defaultText,
          url: defaultUrl
        });
      } catch (error) {
        console.error('Share failed:', error);
      }
    } else {
      handleCopy();
    }
  };

  return (
    <div className="space-y-3">
      {/* Primary Share Button */}
      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={handleShareWhatsApp}
        className="w-full py-4 bg-gradient-to-r from-green-500 to-green-600 rounded-2xl text-white font-bold text-lg flex items-center justify-center gap-3 shadow-lg hover:shadow-green-500/30 transition-all"
      >
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
        </svg>
        WhatsApp teilen
      </motion.button>

      {/* Secondary Actions */}
      <div className="grid grid-cols-2 gap-3">
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={handleCopy}
          className="py-3 bg-white/5 border border-white/10 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-white/10 transition-colors"
        >
          {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
          {copied ? 'Kopiert!' : 'Link kopieren'}
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={handleShareNative}
          className="py-3 bg-white/5 border border-white/10 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-white/10 transition-colors"
        >
          <Share2 size={16} />
          Teilen
        </motion.button>
      </div>

      {/* QR Code (placeholder - implement QR generation) */}
      <div className="p-4 bg-white/5 rounded-xl border border-white/10 text-center">
        <div className="w-32 h-32 mx-auto bg-white rounded-xl flex items-center justify-center mb-3">
          <QrCodeIcon size={64} className="text-gray-400" />
        </div>
        <p className="text-xs text-white/60">
          QR-Code für schnelles Teilen<br />
          <span className="text-cyan-400 font-mono">{referralCode || 'DEMO123'}</span>
        </p>
      </div>

      {/* Social Share Buttons */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { name: 'Instagram', icon: '📷', color: '#E1306C', disabled: true },
          { name: 'Facebook', icon: '👍', color: '#1877F2', disabled: true },
          { name: 'Twitter', icon: '🐦', color: '#1DA1F2', disabled: true },
          { name: 'Telegram', icon: '✈️', color: '#0088CC', disabled: true },
        ].map((social) => (
          <button
            key={social.name}
            disabled={social.disabled}
            className="py-3 bg-white/5 border border-white/10 rounded-xl flex flex-col items-center justify-center gap-1 opacity-50 cursor-not-allowed"
            title={`${social.name} coming soon`}
          >
            <span className="text-2xl">{social.icon}</span>
            <span className="text-[9px] text-white/40">{social.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
