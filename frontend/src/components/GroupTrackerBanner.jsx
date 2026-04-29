import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Check, Clock, ChevronRight, X } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

/**
 * GroupTrackerBanner — Live-Tracking aktiver Gruppen (WhatsApp-Read-Receipts Stil).
 * Zeigt für die aktivste Gruppe (status pending/confirmed) eine Avatar-Reihe
 * mit ✓ bei Bestätigung. Polling alle 10s.
 *
 * Props:
 *  - serviceType: 'food' | 'taxi'
 *  - onOpenGroup?: (group) => void  (optional Click-Through)
 */
export default function GroupTrackerBanner({ serviceType = 'food', onOpenGroup }) {
  const [group, setGroup] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  const fetchActive = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/group/my-groups`, { credentials: 'include' });
      if (!r.ok) return;
      const d = await r.json();
      const candidates = (d.groups || [])
        .filter(g => g.service_type === serviceType && (g.status === 'pending' || g.status === 'confirmed'));
      // Aktivste = neueste
      const active = candidates.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))[0] || null;
      setGroup(active);
    } catch {}
  }, [serviceType]);

  useEffect(() => {
    fetchActive();
    const t = setInterval(fetchActive, 10000);
    return () => clearInterval(t);
  }, [fetchActive]);

  if (!group || dismissed) return null;

  const total = (group.participants?.length || 0) + 1; // +1 organizer
  const confirmed = group.confirmed_by?.length || 0;
  const allConfirmed = confirmed >= total;
  const initials = (email) => (email || '?').split('@')[0].slice(0, 2).toUpperCase();

  // Reihen-Avatare: Organizer + Participants
  const slots = [
    { id: 'org', label: group.organizer_name || 'Du', confirmed: true, isYou: true },
    ...(group.participants || []).map((p, idx) => ({
      id: `p${idx}`,
      label: p,
      confirmed: (group.confirmed_by || []).some(c => c === p) || false,
    })),
  ];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -40, opacity: 0 }}
        data-testid="group-tracker-banner"
        className="mb-3 rounded-2xl bg-gradient-to-r from-emerald-500/15 to-cyan-500/15 border border-emerald-500/30 p-3 flex items-center gap-3"
      >
        <div className="w-10 h-10 rounded-full bg-emerald-500/30 flex items-center justify-center flex-shrink-0">
          <Users size={20} className="text-emerald-300" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <p className="text-white text-sm font-bold truncate">
              {serviceType === 'taxi' ? 'Group Ride' : 'Group Order'} · {confirmed}/{total} bestätigt
            </p>
            {allConfirmed ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-300 font-bold">BEREIT</span>
            ) : (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 font-bold flex items-center gap-1">
                <Clock size={10} /> wartet
              </span>
            )}
          </div>

          {/* Avatar-Reihe (WhatsApp-style) */}
          <div className="flex -space-x-2 overflow-hidden mb-1">
            {slots.slice(0, 6).map((s) => (
              <div
                key={s.id}
                title={s.label}
                className={`relative w-7 h-7 rounded-full border-2 flex items-center justify-center text-[10px] font-bold ${
                  s.confirmed
                    ? 'bg-emerald-500 border-[#0B0B0F] text-white'
                    : 'bg-[#222] border-[#0B0B0F] text-gray-400'
                }`}
              >
                {initials(s.label)}
                {s.confirmed && (
                  <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-400 border border-[#0B0B0F] flex items-center justify-center">
                    <Check size={8} className="text-black" strokeWidth={4} />
                  </span>
                )}
              </div>
            ))}
            {slots.length > 6 && (
              <div className="w-7 h-7 rounded-full bg-[#222] border-2 border-[#0B0B0F] flex items-center justify-center text-[10px] font-bold text-gray-300">
                +{slots.length - 6}
              </div>
            )}
          </div>

          {/* Wartenden-Liste */}
          {!allConfirmed && (
            <p className="text-[10px] text-gray-400 truncate">
              Warte auf: {slots.filter(s => !s.confirmed).map(s => (s.label || '').split('@')[0]).join(', ') || '—'}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => onOpenGroup?.(group)}
            data-testid="group-tracker-open-btn"
            className="px-3 py-2 bg-emerald-500/30 text-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1"
          >
            Details <ChevronRight size={12} />
          </button>
          <button
            onClick={() => setDismissed(true)}
            data-testid="group-tracker-dismiss"
            className="w-7 h-7 rounded-full bg-[#0B0B0F]/60 flex items-center justify-center"
            title="Banner ausblenden"
          >
            <X size={12} className="text-gray-400" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
