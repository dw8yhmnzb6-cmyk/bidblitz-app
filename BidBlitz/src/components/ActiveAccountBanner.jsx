import { CheckCircle2, Shield, User2 } from "lucide-react";
import { useUser } from "../store";

export const ActiveAccountBanner = () => {
  const user = useUser();

  if (!user?.isAuthenticated) return null;

  const isAdmin = user.role === "admin";
  const canonicalEmail = user.canonical_email || user.display_email || user.login_email || user.email;

  const kycText = user.kyc_status === "approved"
    ? "KYC freigegeben"
    : user.kyc_status === "pending"
      ? "Verifizierung läuft"
      : user.kyc_status === "rejected"
        ? "Aktion erforderlich"
        : "Verifizierung ausstehend";

  return (
    <div className="sticky top-[64px] z-30 mx-auto mb-2.5 w-full max-w-6xl px-4 sm:top-[72px] sm:mb-3" data-testid="active-account-banner">
      <div className="rounded-[18px] border border-[#00C2FF]/20 bg-[linear-gradient(135deg,rgba(0,194,255,0.12),rgba(7,19,29,0.92))] px-3 py-2.5 shadow-[0_18px_45px_rgba(0,0,0,0.18)] backdrop-blur sm:rounded-[22px] sm:px-4 sm:py-3">
        <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3">
          <div className="flex min-w-0 items-start gap-2.5 sm:gap-3">
            <div className="mt-0.5 rounded-full bg-[#00C2FF]/15 p-1.5 text-[#00C2FF] sm:p-2">
              <User2 size={14} className="sm:hidden" />
              <User2 size={16} className="hidden sm:block" />
            </div>
            <div className="min-w-0">
              <div className="text-[9px] uppercase tracking-[0.14em] text-white/45 sm:text-[11px] sm:tracking-[0.18em]">Aktives Konto</div>
              <div className="truncate text-[12px] font-black text-white sm:text-sm" data-testid="active-account-banner-email">{user.display_email || user.login_email || user.email}</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-white/65 sm:mt-1 sm:gap-2 sm:text-xs">
                <span data-testid="active-account-banner-canonical-email">Kanonisch: {canonicalEmail}</span>
                <span>•</span>
                <span data-testid="active-account-banner-role">Rolle: {user.role || "user"}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {isAdmin && (
              <div className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[10px] font-black text-white sm:px-3 sm:text-[11px]" data-testid="active-account-banner-kyc-status">
                <Shield size={11} className="mr-1 inline-block sm:hidden" />
                <Shield size={12} className="mr-1 hidden sm:inline-block" /> {kycText}
              </div>
            )}
            <div className="rounded-full border border-[#37FF8B]/20 bg-[#37FF8B]/10 px-2.5 py-1 text-[10px] font-black text-[#C9FFD8] sm:px-3 sm:text-[11px]" data-testid="active-account-banner-auth-status">
              <CheckCircle2 size={11} className="mr-1 inline-block sm:hidden" />
              <CheckCircle2 size={12} className="mr-1 hidden sm:inline-block" /> Erfolgreich angemeldet
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActiveAccountBanner;