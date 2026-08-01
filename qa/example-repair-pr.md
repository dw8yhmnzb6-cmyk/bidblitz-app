# Example Repair Pull Request

- Problem: Horizontal overflow detected on `/wallet` at `320x568`
- Root cause: Fixed-width summary card plus non-wrapping labels
- Files changed:
  - `frontend/src/pages/WalletPage.jsx`
  - `frontend/src/components/wallet/WalletSummaryCard.jsx`
- Tests passed:
  - `npm ci`
  - `npm run build`
  - `npm run lint`
  - `npx playwright test`
- Before screenshot: `artifacts/screenshots/320x568-_wallet-before.png`
- After screenshot: `artifacts/screenshots/320x568-_wallet-after.png`
- Risk level: low
- Branch: `ai-fix/wallet-horizontal-overflow`

This PR must stay draft until human review is complete. No automatic merge.