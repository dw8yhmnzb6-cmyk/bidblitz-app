export { WalletProvider, useWallet } from './WalletContext';
export { MerchantProvider, useMerchant } from './MerchantContext';
export { UserProvider, useUser } from './UserContext';
export { I18nProvider, useI18n, LANGUAGES } from './I18nContext';
export { NetworkProvider, useNetwork } from './NetworkContext';
export { FeatureFlagProvider, useFeatureFlags } from './FeatureFlagContext';

import React from 'react';
import { WalletProvider } from './WalletContext';
import { MerchantProvider } from './MerchantContext';
import { UserProvider } from './UserContext';
import { I18nProvider } from './I18nContext';
import { NetworkProvider } from './NetworkContext';
import { FeatureFlagProvider } from './FeatureFlagContext';

export function AppProvider({ children }) {
  return (
    <I18nProvider>
      <UserProvider>
        <NetworkProvider>
          <FeatureFlagProvider>
            <WalletProvider>
              <MerchantProvider>
                {children}
              </MerchantProvider>
            </WalletProvider>
          </FeatureFlagProvider>
        </NetworkProvider>
      </UserProvider>
    </I18nProvider>
  );
}
