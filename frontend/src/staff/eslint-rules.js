/**
 * ESLint Custom Rules for BidBlitz Staff UI
 * =========================================
 * Placeholder configuration — kann später als ESLint plugin
 * eingebunden werden via `eslint-plugin-bidblitz-staff`.
 *
 * Aktuelle Form: dokumentiert die Regeln + bietet Pattern-Strings
 * die in CI-Linting verwendet werden können (z.B. ripgrep).
 *
 * Aktiviere CI-Check:
 *   cd /app/frontend && node src/staff/eslint-rules.js
 */

// ──────────────────────────────────────────────────────────
// REGELN
// ──────────────────────────────────────────────────────────
export const STAFF_LINT_RULES = {
  noHardcodedHexColors: {
    severity: "warn",
    pattern: /(?:bg|text|border|from|to|via)-\[#[0-9A-Fa-f]{3,6}\]/g,
    message: "Verwende Token-basierte Farbe statt hardcoded Hex (#...). Siehe staff/tokens.js.",
  },
  noLegacyNeonColors: {
    severity: "error",
    patterns: [/\[#00C2FF\]/g, /\[#A855F7\]/g, /\[#0A0A0A\]/g],
    message: "Neon-Cyan/Violet/ERP-Dark sind im Staff-Modul verboten. Nutze tokens.COLORS.",
  },
  noTinyText: {
    severity: "warn",
    pattern: /text-\[(?:8|9|10)px\]/g,
    message: "Schrift < 11px ist auf Mobile unleserlich. Mindestens text-xs.",
  },
  noInlineStyleColors: {
    severity: "warn",
    pattern: /style=\{[^}]*(?:color|backgroundColor|background):\s*['"]#[0-9A-Fa-f]{3,6}/g,
    message: "Inline-Style mit Hex-Farbe. Verwende className mit Token.",
  },
  buttonMinHeight: {
    severity: "warn",
    pattern: /<button[^>]*className=['"][^'"]*\bh-[1-7]\b[^'"]*['"]/g,
    message: "Button-Höhe h-1 bis h-7 ist zu klein (<= 28px). Min h-10 (40px).",
  },
  noOwnCardStyles: {
    severity: "info",
    pattern: /className=['"][^'"]*\b(bg-white|bg-slate-50)\b[^'"]*\b(border|rounded)\b[^'"]*\b(shadow|p-[0-9])/g,
    message: "Eigene Card-Styles erkannt. Bitte <StaffCard /> verwenden.",
  },
};

// ──────────────────────────────────────────────────────────
// CLI-Runner (vereinfacht — für Pre-Commit nutzbar)
// ──────────────────────────────────────────────────────────
// Verwendung: node src/staff/eslint-rules.js
if (typeof process !== "undefined" && process.argv && process.argv[1]?.includes("eslint-rules.js")) {
  // Node-only CLI mode
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require("fs");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const path = require("path");

  const SCAN_DIRS = [
    path.resolve(__dirname, "../pages"),
    path.resolve(__dirname, "../components/staff"),
    path.resolve(__dirname, "."),
  ];

  let totalIssues = 0;
  let totalErrors = 0;

  function scanFile(filepath) {
    const content = fs.readFileSync(filepath, "utf8");
    Object.entries(STAFF_LINT_RULES).forEach(([rule, cfg]) => {
      const patterns = cfg.patterns || [cfg.pattern];
      patterns.forEach((p) => {
        const matches = content.match(p) || [];
        if (matches.length > 0) {
          totalIssues += matches.length;
          if (cfg.severity === "error") totalErrors += matches.length;
          const rel = path.relative(process.cwd(), filepath);
          console.log(`[${cfg.severity.toUpperCase()}] ${rel}: ${rule} (${matches.length}x)`);
        }
      });
    });
  }

  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f);
      const stat = fs.statSync(p);
      if (stat.isDirectory()) walk(p);
      else if (/\.(jsx?|tsx?)$/.test(f)) scanFile(p);
    }
  }

  console.log("=== BidBlitz Staff UI Lint ===");
  SCAN_DIRS.forEach(walk);
  console.log(`\nTotal: ${totalIssues} issues (${totalErrors} errors)`);
  process.exit(totalErrors > 0 ? 1 : 0);
}

export default STAFF_LINT_RULES;
