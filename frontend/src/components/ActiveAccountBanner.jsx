import { CheckCircle2, Shield, User2 } from "lucide-react";
import { useUser } from "../store";

export const ActiveAccountBanner = () => {
  const user = useUser();

  if (!user?.isAuthenticated) return null;

  const kycText = user.kyc_status === "approved"
    ? "KYC freigegeben"
    : user.kyc_status === "pending"
      ? "Verifizierung läuft"
      : user.kyc_status === "rejected"
        ? "Aktion erforderlich"
        : "Verifizierung ausstehend";

  return (
    <div className="sticky top-[72px] z-30 mx-auto mb-3 w-full max-w-6xl px-4" data-testid="active-account-banner">
      <div className="rounded-[22px] border border-[#00C2FF]/20 bg-[linear-gradient(135deg,rgba(0,194,255,0.12),rgba(7,19,29,0.92))] px-4 py-3 shadow-[0_18px_45px_rgba(0,0,0,0.18)] backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="mt-0.5 rounded-full bg-[#00C2FF]/15 p-2 text-[#00C2FF]">
              <User2 size={16} />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">Aktives Konto</div>
              <div className="truncate text-sm font-black text-white" data-testid="active-account-banner-email">{user.display_email || user.login_email || user.email}</div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/65">
                <span data-testid="active-account-banner-canonical-email">Kanonisch: admin@bidblitz.ae</span>
                <span>•</span>
                <span data-testid="active-account-banner-role">Rolle: {user.role || "user"}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-black text-white" data-testid="active-account-banner-kyc-status">
              <Shield size={12} className="mr-1 inline-block" /> {kycText}
            </div>
            <div className="rounded-full border border-[#37FF8B]/20 bg-[#37FF8B]/10 px-3 py-1 text-[11px] font-black text-[#C9FFD8]" data-testid="active-account-banner-auth-status">
              <CheckCircle2 size={12} className="mr-1 inline-block" /> Erfolgreich angemeldet
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActiveAccountBanner;