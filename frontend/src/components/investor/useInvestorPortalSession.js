import { useCallback, useEffect, useState } from "react";
import { api } from "../../services/api";

export function useInvestorPortalSession(onNavigate) {
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    try {
      const data = await api.investorPortalMe();
      setAccount(data.account || null);
      return data.account || null;
    } catch (error) {
      setAccount(null);
      if (error?.status === 401 && onNavigate) {
        onNavigate("/investor-login");
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, [onNavigate]);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  return { account, loading, refreshSession };
}