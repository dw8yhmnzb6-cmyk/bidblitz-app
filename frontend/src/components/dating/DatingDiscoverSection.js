import { AnimatePresence } from "framer-motion";
import { Heart } from "lucide-react";
import { DatingDiscoverRail } from "./DatingDiscoverRail";
import { DatingSwipeCard } from "./DatingSwipeCard";

export const DatingDiscoverSection = ({
  loading,
  current,
  dir,
  currentPhotos,
  openerText,
  setOpenerText,
  userProfile,
  monetization,
  safetyTone,
  safetyLabel,
  togglePlayVoiceIntro,
  togglePlayVideoProfile,
  onVoiceEnded,
  onVideoEnded,
  handleRewind,
  handleAction,
  topPicks,
  standouts,
  startPremiumCheckout,
  focusProfile,
  profileImageOf,
}) => {
  return (
    <div className="flex flex-col items-center px-4 pb-8">
      <div className="w-full max-w-md">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-pink-400 border-t-transparent" />
          </div>
        ) : !current ? (
          <div className="py-20 text-center">
            <Heart size={48} className="mx-auto mb-3 text-white/20" />
            <p className="text-sm text-white/60">Keine Profile mehr. Filter ändern oder später wiederkommen.</p>
          </div>
        ) : (
          <>
            <AnimatePresence mode="wait">
              <DatingSwipeCard
                current={current}
                currentPhoto={currentPhotos[0]}
                dir={dir}
                openerText={openerText}
                setOpenerText={setOpenerText}
                userProfile={userProfile}
                monetization={monetization}
                safetyTone={safetyTone}
                safetyLabel={safetyLabel}
                togglePlayVoiceIntro={togglePlayVoiceIntro}
                togglePlayVideoProfile={togglePlayVideoProfile}
                onVoiceEnded={onVoiceEnded}
                onVideoEnded={onVideoEnded}
              />
            </AnimatePresence>

            <DatingDiscoverRail
              current={current}
              handleRewind={handleRewind}
              handleAction={handleAction}
              topPicks={topPicks}
              standouts={standouts}
              startPremiumCheckout={startPremiumCheckout}
              focusProfile={focusProfile}
              profileImageOf={profileImageOf}
            />
          </>
        )}
      </div>
    </div>
  );
};