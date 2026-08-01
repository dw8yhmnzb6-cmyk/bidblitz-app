# BidBlitz Visual QA & AI Repair Architecture

## Scope
- Visual route audits with Playwright across public and authenticated pages
- Responsive overflow/layout/translation/number/design detection
- Product image validation
- Optional AI screenshot review with strict JSON output
- Safe repair PR preparation only, never direct production deployment

## Core layers
1. **Playwright route scanner**
   - `frontend/playwright.config.cjs`
   - `frontend/tests/visual-qa/global.setup.cjs`
   - `frontend/tests/visual-qa/visual-routes.spec.cjs`
2. **Post-processing validators**
   - `frontend/scripts/visual-qa/*.mjs`
3. **Backend report + AI services**
   - `backend/routes/visual_qa.py`
   - `backend/services/visual_qa_ai.py`
4. **Investor/Admin dashboards**
   - `/investor-dashboard`
   - `/admin/investor-dashboard`
   - `/admin/visual-qa`
5. **CI orchestration**
   - `.github/workflows/visual-qa.yml`

## Routes covered
- `/`
- `/login`
- `/register`
- `/wallet`
- `/send`
- `/receive`
- `/merchant`
- `/auctions`
- `/auction/:id`
- `/taxi`
- `/scooter`
- `/investieren`
- `/investor-login`
- `/investor-portal`
- `/admin`
- `/investor-dashboard`

## Viewports covered
- `320x568`
- `375x812`
- `390x844`
- `430x932`
- `768x1024`
- `1440x900`

## Safety model
- Auto-fix only for layout/spacing/overflow/text wrapping/font sizing/safe-area/translation keys/broken image fallback/high-confidence image mismatch
- Never auto-fix wallet/payment/auth/KYC/permissions/roles/production data
- PRs stay draft and unmerged until human approval