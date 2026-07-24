/**
 * TaxiSideMenu — Slide-in drawer from left (taxi.eu-style hamburger menu).
 * Contains profile card, balance, navigation links.
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

function Item({ icon, label, badge, onClick, testId }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-white/5 active:bg-white/10 text-left"
      data-testid={testId}
    >
      <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <span className="flex-1 text-sm text-white">{label}</span>
      {badge != null && (
        <span className="text-xs text-cyan-400 font-mono">{badge}</span>
      )}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
        <path d="m9 6 6 6-6 6" />
      </svg>
    </button>
  );
}

export default function TaxiSideMenu({
  isOpen, onClose,
  user, userBalance,
  favoritesCount,
  recentAddressesCount,
  onOpenFavorites,
  onOpenHistory,
  onOpenSaved,
  onOpenDriverOnboarding,
  onNavigate,
}) {
  const initials = (user?.name || user?.email || "?").trim().slice(0, 2).toUpperCase();
  const go = (path) => {
    onClose();
    if (onNavigate) onNavigate(path);
    else window.dispatchEvent(new CustomEvent("bidblitz:navigate", { detail: path }));
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
            data-testid="sidemenu-backdrop"
          />
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
            className="fixed top-0 bottom-0 left-0 z-[65] w-[85%] max-w-sm bg-[#0A0A0F] border-r border-white/10 flex flex-col"
            data-testid="taxi-side-menu"
          >
            {/* Profile header */}
            <div className="px-5 pt-6 pb-5 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center font-bold text-black">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">
                    {user?.name || "Gast"}
                  </p>
                  <p className="text-xs text-gray-400 truncate">
                    {user?.email || ""}
                  </p>
                </div>
              </div>
              <div className="mt-4 p-3 bg-cyan-500/10 rounded-xl border border-cyan-500/20">
                <p className="text-[10px] text-cyan-400 uppercase tracking-wider font-semibold">
                  Guthaben
                </p>
                <p className="text-xl font-bold text-cyan-400">
                  €{(userBalance || 0).toFixed(2)}
                </p>
              </div>
            </div>

            {/* Nav items */}
            <div className="flex-1 overflow-y-auto py-2">
              <Item
                icon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00C2FF" strokeWidth="2">
                    <path d="M20 12 8 4v16l12-8z" />
                  </svg>
                }
                label="Letzte Adressen"
                badge={recentAddressesCount}
                onClick={() => { onClose(); }}
                testId="sm-recent"
              />
              <Item
                icon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FCD34D" strokeWidth="2">
                    <path d="m12 2 3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z" />
                  </svg>
                }
                label="Favoriten"
                badge={favoritesCount}
                onClick={() => { onClose(); onOpenFavorites?.(); }}
                testId="sm-favorites"
              />
              <Item
                icon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                }
                label="Gespeicherte Orte"
                onClick={() => { onClose(); onOpenSaved?.(); }}
                testId="sm-saved"
              />
              <Item
                icon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" />
                  </svg>
                }
                label="Fahrtverlauf"
                onClick={() => { onClose(); onOpenHistory?.(); }}
                testId="sm-history"
              />
              <Item
                icon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2"/>
                    <path d="M16 2v4M8 2v4M3 10h18"/>
                  </svg>
                }
                label="BidBlitz Pro"
                onClick={() => go('/taxi/pro')}
                testId="sm-pro-suite"
              />
              <Item
                icon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <path d="M3 9h18M9 21V9" />
                  </svg>
                }
                label="Als Fahrer registrieren"
                onClick={() => { onClose(); onOpenDriverOnboarding?.(); }}
                testId="sm-driver-onboarding"
              />

              <div className="mt-3 mx-5 border-t border-white/5" />

              <Item
                icon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                }
                label="Einstellungen"
                onClick={() => go('/account')}
                testId="sm-settings"
              />
              <Item
                icon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" />
                  </svg>
                }
                label="Hilfe & Support"
                onClick={() => go('/contact')}
                testId="sm-help"
              />
            </div>

            <div className="px-5 py-3 border-t border-white/5 text-[10px] text-gray-500 text-center">
              BidBlitz · v1.0
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
