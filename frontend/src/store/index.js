/**
 * BidBlitz V2 - Store Index
 * Export all contexts and providers
 */

export { WalletProvider, useWallet } from './WalletContext';
export { MerchantProvider, useMerchant } from './MerchantContext';
export { UserProvider, useUser } from './UserContext';

// Combined provider for convenience
import React from 'react';
import { WalletProvider } from './WalletContext';
import { MerchantProvider } from './MerchantContext';
import { UserProvider } from './UserContext';

export function AppProvider({ children }) {
  return (
    <UserProvider>
      <WalletProvider>
        <MerchantProvider>
          {children}
        </MerchantProvider>
      </WalletProvider>
    </UserProvider>
  );
}
