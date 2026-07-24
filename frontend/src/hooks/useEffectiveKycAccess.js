import { useEffect, useState } from "react";
import { TEST_MODE_FULL_ACCESS } from "../config/testMode";

const API = process.env.REACT_APP_BACKEND_URL;

export function useEffectiveKycAccess({ isGuest, isDemoMode, user }) {
  const [serverApproved, setServerApproved] = useState(false);

  useEffect(() => {
    if (TEST_MODE_FULL_ACCESS) {
      setServerApproved(true);
      return;
    }

    if (isGuest || isDemoMode || !user?.isAuthenticated) {
      setServerApproved(false);
      return;
    }

    let active = true;

    fetch(`${API}/api/kyc/status`, { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json();
      })
      .then((data) => {
        if (!active || !data) return;
        const approved =
          data.status === "approved" ||
          data.verification_status === "approved" ||
          data.can_use_wallet === true ||
          data.can_use_auctions === true ||
          data.can_use_trade_center === true;
        setServerApproved(Boolean(approved));
      })
      .catch(() => {
        if (active) setServerApproved(false);
      });

    return () => {
      active = false;
    };
  }, [isGuest, isDemoMode, user?.id, user?.email, user?.isAuthenticated, user?.kyc_status, user?.kyc_verified]);

  return serverApproved;
}
