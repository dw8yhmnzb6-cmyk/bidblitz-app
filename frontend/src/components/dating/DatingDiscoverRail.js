import { ArrowLeft, Heart, Star, X } from "lucide-react";

export const DatingDiscoverRail = ({
  current,
  handleRewind,
  handleAction,
  topPicks,
  standouts,
  startPremiumCheckout,
  focusProfile,
  profileImageOf,
}) => {
  if (!current) return null;

  return (
    <>
      <div className="mt-5 flex items-center justify-center gap-4 rounded-full border border-white/10 bg-black/35 px-4 py-3 backdrop-blur-xl shadow-[0_18px_40px_rgba(0,0,0,0.35)]">
        <button onClick={handleRewind} className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/5 shadow-lg" data-testid="dating-rewind-button">
          <ArrowLeft size={20} className="text-white/80" />
        </button>
        <button onClick={() => handleAction("pass")} className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-red-400 bg-white/5 shadow-lg" data-testid="dating-pass-button">
          <X size={28} className="text-red-400" />
        </button>
        <button onClick={() => handleAction("superlike")} className="relative flex h-12 w-12 items-center justify-center rounded-full border-2 border-blue-400 bg-white/5 shadow-lg" data-testid="dating-superlike-button">
          <Star size={22} className="text-blue-400" />
          <span className="absolute -bottom-6 whitespace-nowrap text-[10px] text-blue-300">Super Like</span>
        </button>
        <button onClick={() => handleAction("like")} className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-green-400 bg-white/5 shadow-lg" data-testid="dating-like-button">
          <Heart size={28} className="text-green-400" />
        </button>
      </div>

      <div className="mt-5 grid gap-3" data-testid="dating-discover-spotlight-grid">
        {topPicks.slice(0, 2).map((profile, index) => (
          <button
            key={profile.profile_id}
            onClick={() => (profile.locked ? startPremiumCheckout("gold_30d") : focusProfile(profile))}
            className="flex items-center gap-3 rounded-[26px] border border-fuchsia-400/15 bg-white/5 p-3 text-left backdrop-blur-xl transition-transform duration-300 hover:-translate-y-0.5"
            data-testid={`dating-top-pick-${profile.profile_id}`}
          >
            <img src={profileImageOf(profile)} alt={profile.name} className="h-16 w-16 rounded-2xl object-cover" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-[0.18em] text-fuchsia-200/60">Top Pick</p>
              <p className="mt-1 truncate text-sm font-bold text-white">
                {profile.name}
                {profile.age ? `, ${profile.age}` : ""}
              </p>
              <p className="truncate text-[11px] text-white/55">{profile.headline || `${profile.compatibility_score || 0}% Match`}</p>
            </div>
            <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${profile.locked ? "bg-yellow-500/15 text-yellow-200" : "bg-emerald-500/15 text-emerald-200"}`} data-testid={`dating-top-pick-lock-${index}`}>
              {profile.locked ? "Gold" : "Jetzt"}
            </span>
          </button>
        ))}

        {standouts.slice(0, 2).map((profile, index) => (
          <button
            key={profile.profile_id}
            onClick={() => (profile.locked ? startPremiumCheckout("gold_30d") : focusProfile(profile))}
            className="flex items-center gap-3 rounded-[26px] border border-blue-400/15 bg-white/5 p-3 text-left backdrop-blur-xl transition-transform duration-300 hover:-translate-y-0.5"
            data-testid={`dating-standout-${profile.profile_id}`}
          >
            <img src={profileImageOf(profile)} alt={profile.name} className="h-16 w-16 rounded-2xl object-cover" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-[0.18em] text-blue-200/60">Standout</p>
              <p className="mt-1 truncate text-sm font-bold text-white">
                {profile.name}
                {profile.age ? `, ${profile.age}` : ""}
              </p>
              <p className="truncate text-[11px] text-white/55">{profile.headline || "High-Intent Profil"}</p>
            </div>
            <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${profile.locked ? "bg-yellow-500/15 text-yellow-200" : "bg-rose-500/15 text-rose-200"}`} data-testid={`dating-standout-lock-${index}`}>
              {profile.locked ? "Gold" : "Rose"}
            </span>
          </button>
        ))}
      </div>
    </>
  );
};