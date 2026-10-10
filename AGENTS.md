# BidBlitz AI coding and test agent

Use this repository and its existing architecture. Do not create another application, database, bridge or deployment pipeline.

## Safety rules
- Never change or deploy production, server DNS, payment credentials or secrets.
- Never place real trades, bids, top-ups, bookings, refunds or payments during tests.
- Trade-specific tests must remain DEMO/SHADOW only with LIVE_EXECUTION=OFF.
- Tests must use synthetic data and local services. Treat unknown third-party systems as read-only.
- Never auto-merge pull requests; request review before production release.
- Do not suppress test failures or hide warnings in the CI quality gate.

## Agent workflow
1. Read failing GitHub Actions jobs, reproduce with the same command and record errors.
2. Group related failures. Fix only proven root causes on a separate branch.
3. Re-run targeted checks, then backend/ESLint/build/browser checks.
4. Report exact commands, results, changed files, blockers and commit SHA.
5. Prefer read-only Playwright browser actions. Stop before destructive UI actions.

## Browser robot
- Run: `cd frontend && npx playwright test --config=playwright.robot.config.cjs`.
- This starts a local app on 127.0.0.1:3000; no live URL is accepted by the robot config.
- Failure artifacts are stored in `frontend/robot-artifacts`, `frontend/robot-report`, and `frontend/robot-results.json`.
- Playwright MCP is available for an MCP-capable Codex/agent client using the root `.mcp.json`; this config does not itself launch Codex.
