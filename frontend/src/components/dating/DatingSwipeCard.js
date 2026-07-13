import { motion } from "framer-motion";
import { Ban, Check, Crown, MapPin, Play, Shield, Video, Zap } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

export const DatingSwipeCard = ({
  current,
  currentPhoto,
  dir,
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
}) => {
  if (!current) return null;

  const canUseOpener = Boolean(
    monetization?.entitlements?.is_platinum || userProfile?.premium_plan === "platinum_30d"
  );

  return (
    <motion.div
      key={current.profile_id}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{
        opacity: 1,
        scale: 1,
        x: dir === "right" ? 260 : dir === "left" ? -260 : 0,
        rotate: dir === "right" ? 12 : dir === "left" ? -12 : 0,
      }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full overflow-hidden rounded-[32px] border border-white/10 bg-[#12151C] shadow-[0_30px_80px_rgba(0,0,0,0.4)]"
      data-testid={`dating-profile-${current.profile_id}`}
    >
      <div className="relative">
        <img src={currentPhoto} alt={current.name} className="h-[72vh] min-h-[520px] w-full max-h-[780px] object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/28 to-black/8" />

        {current.spotlight ? (
          <div
            className="absolute left-4 top-4 inline-flex items-center gap-1 rounded-full bg-yellow-300 px-3 py-1 text-[11px] font-bold text-black"
            data-testid={`dating-spotlight-badge-${current.profile_id}`}
          >
            <Zap size={12} />
            Spotlight
          </div>
        ) : null}

        <div className="absolute right-4 top-4 flex flex-col items-end gap-2">
          <div
            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-bold ${safetyTone(current?.safety_summary?.scam_level)}`}
            data-testid={`dating-scam-badge-${current.profile_id}`}
          >
            <Shield size={11} />
            Scam {safetyLabel(current?.safety_summary?.scam_level)}
          </div>
          <div
            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-bold ${safetyTone(current?.safety_summary?.nudity_level)}`}
            data-testid={`dating-nudity-badge-${current.profile_id}`}
          >
            <Ban size={11} />
            Foto {safetyLabel(current?.safety_summary?.nudity_level)}
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-[30px] font-black leading-none text-[#F5F5F0] drop-shadow-lg">
                  {current.name}
                  {current.age ? `, ${current.age}` : ""}
                </h2>
                {current.verified ? <Check size={18} className="text-[#81B29A]" /> : null}
                {current.premium ? <Crown size={17} className="text-yellow-300" /> : null}
              </div>
              <div className="mt-2 flex items-center gap-1 text-sm text-[#F5F5F0]/78">
                <MapPin size={14} />
                {current.city || "Unbekannt"}
              </div>
            </div>

            {current.compatibility_score || current.distance_km !== undefined ? (
              <div className="rounded-2xl border border-white/10 bg-black/35 px-3 py-2 text-right backdrop-blur-xl">
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/40">Match</p>
                <p className="text-sm font-bold text-white">{current.compatibility_score || 0}%</p>
                {current.distance_km !== undefined && current.distance_km !== null ? (
                  <p className="text-[10px] text-emerald-200">{current.distance_km} km</p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <p className="mb-3 text-[15px] leading-relaxed text-[#F5F5F0]/86">{current.bio || "Noch keine Bio"}</p>

        {canUseOpener ? (
          <div
            className="mb-3 rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/10 p-3"
            data-testid="dating-message-before-match-card"
          >
            <p className="text-[11px] uppercase tracking-[0.16em] text-fuchsia-200/70">Platinum</p>
            <p className="mt-1 text-xs text-white/75">Sende vor dem Match direkt eine starke erste Nachricht.</p>
            <textarea
              value={openerText}
              onChange={(event) => setOpenerText(event.target.value)}
              rows={2}
              maxLength={180}
              className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/15 px-3 py-2 text-xs text-white outline-none"
              placeholder="Schreib eine erste Nachricht vor dem Match..."
              data-testid="dating-opener-input"
            />
          </div>
        ) : null}

        {current.occupation ||
        current.profile_prompt ||
        current.compatibility_score ||
        current.distance_km !== undefined ||
        current.voice_intro?.media_id ||
        current.video_profile?.media_id ||
        current?.safety_summary ? (
          <div className="mb-3 space-y-2">
            {current.occupation ? <p className="text-xs text-white/55">{current.occupation}</p> : null}
            {current.profile_prompt ? <p className="text-xs text-blue-200/80">“{current.profile_prompt}”</p> : null}
            {current.compatibility_score ? (
              <p className="text-xs font-semibold text-green-300">
                {current.compatibility_score}% Match · Rank {current.discover_rank || 0}
              </p>
            ) : null}
            {current.distance_km !== undefined && current.distance_km !== null ? (
              <p className="text-[11px] text-emerald-200">{current.distance_km} km entfernt</p>
            ) : null}
            {current.is_recently_active ? <p className="text-[11px] text-emerald-300">Jetzt aktiv</p> : null}

            {current?.safety_summary ? (
              <div className="flex flex-wrap gap-2" data-testid={`dating-safety-summary-${current.profile_id}`}>
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[10px] font-semibold ${safetyTone(current.safety_summary.scam_level)}`}
                >
                  Scam {current.safety_summary.scam_score}/100
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[10px] font-semibold ${safetyTone(current.safety_summary.nudity_level)}`}
                >
                  Foto {current.safety_summary.nudity_score}/100
                </span>
              </div>
            ) : null}

            {current.voice_intro?.media_id ? (
              <button
                onClick={() => togglePlayVoiceIntro(current.voice_intro.media_id)}
                className="inline-flex items-center gap-1 rounded-full bg-violet-500/15 px-3 py-1 text-[11px] font-semibold text-violet-200"
                data-testid={`dating-card-voice-play-${current.profile_id}`}
              >
                <Play size={11} />
                Voice Intro · {current.voice_intro.duration_seconds}s
              </button>
            ) : null}

            {current.video_profile?.media_id ? (
              <button
                onClick={() => togglePlayVideoProfile(current.video_profile.media_id)}
                className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-3 py-1 text-[11px] font-semibold text-sky-200"
                data-testid={`dating-card-video-play-${current.profile_id}`}
              >
                <Video size={11} />
                Video · {current.video_profile.duration_seconds}s
              </button>
            ) : null}

            {current.voice_intro?.media_id ? (
              <audio
                id={`dating-voice-audio-${current.voice_intro.media_id}`}
                data-dating-voice-audio="true"
                src={`${API}/api/dating/voice-intro/${current.voice_intro.media_id}`}
                onEnded={onVoiceEnded}
              />
            ) : null}

            {current.video_profile?.media_id ? (
              <video
                id={`dating-video-player-${current.video_profile.media_id}`}
                data-dating-video-player="true"
                className="hidden"
                src={`${API}/api/dating/video-profile/${current.video_profile.media_id}`}
                onEnded={onVideoEnded}
                playsInline
              />
            ) : null}
          </div>
        ) : null}

        {current?.match_reasons?.length ? (
          <div className="mb-3 flex flex-wrap gap-2" data-testid={`dating-match-reasons-${current.profile_id}`}>
            {current.match_reasons.map((reason, index) => (
              <span
                key={`${reason}-${index}`}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold text-white/80"
                data-testid={`dating-match-reason-${current.profile_id}-${index}`}
              >
                {reason}
              </span>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {(current.interests || []).map((interest) => (
            <span key={interest} className="rounded-full bg-pink-500/15 px-3 py-1 text-xs text-pink-300">
              {interest}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
};