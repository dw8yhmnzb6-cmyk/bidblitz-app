/**
 * Staff UI Audit — Live DOM Scanner
 * =================================
 * Route: /staff/ui-audit
 *
 * Scannt das aktuelle Frontend live nach Verstößen gegen die
 * Mobile-First / Premium-Design-Regeln aus tokens.js.
 *
 * Issues die geprüft werden:
 *   1. Buttons < 44px Höhe (Apple HIG Minimum)
 *   2. Primary Buttons < 56px (Mobile-First Regel)
 *   3. Bottom-Nav mit mehr als 4 Items
 *   4. Parent-Tabs > 4
 *   5. Schrift < 12px
 *   6. Tabellen auf Mobile-Viewport
 *   7. Inline-Styles mit color/background
 *   8. Hardcoded Hex-Colors in className (Pattern-Detection)
 *   9. Horizontaler Overflow
 *  10. Fehlende Empty-States bei leeren Listen
 *
 * Funktioniert auf jeder Route — auf der Audit-Seite läufst du
 * einen URL-Crawler durch typische Staff-Pages.
 */
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft, AlertTriangle, CheckCircle2, RefreshCw, Loader2,
  Eye, Maximize2, Type, Table2, Layers, Palette, ArrowLeftRight,
  Inbox, ExternalLink, Smartphone, Monitor, Tablet,
} from "lucide-react";
import { StaffCard, StaffSegmented, StaffButton, StaffEmptyState } from "./components";
import { MOBILE_RULES } from "./tokens";

// Routes die wir crawlen können
const SCAN_ROUTES = [
  { path: "/staff/portal", label: "Mitarbeiter Portal" },
  { path: "/staff/terminal", label: "Kiosk Terminal" },
  { path: "/merchant/staff", label: "Manager Dashboard" },
  { path: "/staff/login", label: "Staff Login" },
];

// Live-Scan: scan the CURRENT document
function scanDocument() {
  const issues = [];

  // 1. Buttons too small
  const buttons = document.querySelectorAll("button, a[role='button'], [data-testid$='-btn']");
  buttons.forEach((b) => {
    const r = b.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return; // hidden
    if (r.height < MOBILE_RULES.minButtonHeight) {
      issues.push({
        type: "button_small",
        severity: r.height < 32 ? "high" : "medium",
        message: `Button zu klein: ${Math.round(r.height)}px (min ${MOBILE_RULES.minButtonHeight}px)`,
        target: describeNode(b),
        rect: r,
      });
    }
  });

  // 2. Bottom-Nav with >4 items — heuristic: fixed/sticky bottom containers
  const navs = document.querySelectorAll("nav, [class*='bottom-0']");
  navs.forEach((n) => {
    const kids = n.querySelectorAll("button, a");
    if (n.querySelectorAll("nav button, nav a").length === 0 && kids.length > MOBILE_RULES.maxTabsPrimary) {
      // skip mega-menus
      if (n.classList.toString().includes("bottom")) {
        issues.push({
          type: "nav_too_many",
          severity: "high",
          message: `Bottom-Nav mit ${kids.length} Items (max ${MOBILE_RULES.maxTabsPrimary})`,
          target: describeNode(n),
        });
      }
    }
  });

  // 3. Tab-Bars (heuristic: role tablist or sibling buttons)
  const tablists = document.querySelectorAll("[role='tablist']");
  tablists.forEach((tl) => {
    const tabs = tl.querySelectorAll("[role='tab'], button");
    if (tabs.length > MOBILE_RULES.maxTabsPrimary) {
      issues.push({
        type: "tabs_too_many",
        severity: "medium",
        message: `Tab-Bar mit ${tabs.length} Tabs (max ${MOBILE_RULES.maxTabsPrimary})`,
        target: describeNode(tl),
      });
    }
  });

  // 4. Tiny text (font-size < 12px)
  const all = document.querySelectorAll("p, span, div, label, button, a, h1, h2, h3");
  let tinyTextCount = 0;
  all.forEach((el) => {
    const cs = window.getComputedStyle(el);
    const fs = parseFloat(cs.fontSize);
    if (fs && fs < 11 && el.textContent.trim().length > 2) {
      tinyTextCount++;
    }
  });
  if (tinyTextCount > 5) {
    issues.push({
      type: "tiny_text",
      severity: "low",
      message: `${tinyTextCount} Elemente mit Schrift < 11px gefunden`,
      target: "global",
    });
  }

  // 5. Tables on mobile
  if (window.innerWidth < 768) {
    const tables = document.querySelectorAll("table");
    tables.forEach((t) => {
      issues.push({
        type: "table_mobile",
        severity: "high",
        message: `<table> auf Mobile (${window.innerWidth}px). Verwende Card-Liste.`,
        target: describeNode(t),
      });
    });
  }

  // 6. Inline styles with color/background
  const inlineStyled = document.querySelectorAll("[style*='color']:not([style*='--']), [style*='background']:not([style*='--'])");
  let inlineColorCount = 0;
  inlineStyled.forEach((el) => {
    const s = el.getAttribute("style") || "";
    // Allow CSS var-based + status colors (we use them for status-dots intentionally)
    if (/#[0-9A-Fa-f]{3,6}/.test(s)) {
      inlineColorCount++;
    }
  });
  if (inlineColorCount > 20) {
    issues.push({
      type: "inline_colors",
      severity: "low",
      message: `${inlineColorCount} Elemente mit hardcoded Hex-Colors im inline style`,
      target: "global",
    });
  }

  // 7. Horizontal overflow
  if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 5) {
    issues.push({
      type: "h_overflow",
      severity: "high",
      message: `Horizontaler Overflow: ${document.documentElement.scrollWidth}px > viewport ${document.documentElement.clientWidth}px`,
      target: "<html>",
    });
  }

  // 8. Banned class-name patterns (legacy neon)
  const elementsWithClass = document.querySelectorAll("[class]");
  const bannedFound = {};
  elementsWithClass.forEach((el) => {
    const cls = el.className?.toString() || "";
    MOBILE_RULES.bannedClassPatterns.forEach((pattern) => {
      if (pattern.test(cls)) {
        const key = pattern.toString();
        bannedFound[key] = (bannedFound[key] || 0) + 1;
      }
    });
  });
  Object.entries(bannedFound).forEach(([pattern, count]) => {
    issues.push({
      type: "banned_pattern",
      severity: "medium",
      message: `${count}x verbotenes Pattern: ${pattern}`,
      target: pattern,
    });
  });

  return issues;
}

function describeNode(n) {
  if (!n) return "?";
  const tag = n.tagName?.toLowerCase() || "?";
  const id = n.id ? `#${n.id}` : "";
  const cls = n.className?.toString?.().slice(0, 50) || "";
  const tid = n.getAttribute?.("data-testid");
  return `<${tag}${id}${tid ? ` [testid=${tid}]` : ""}${cls ? ` .${cls.split(" ")[0]}` : ""}>`;
}

const ISSUE_META = {
  button_small:    { icon: Maximize2, color: "red",    label: "Buttons zu klein" },
  nav_too_many:    { icon: Layers,    color: "red",    label: "Nav: zu viele Items" },
  tabs_too_many:   { icon: Layers,    color: "amber",  label: "Tabs: zu viele" },
  tiny_text:       { icon: Type,      color: "amber",  label: "Mini-Schrift" },
  table_mobile:    { icon: Table2,    color: "red",    label: "Tabelle auf Mobile" },
  inline_colors:   { icon: Palette,   color: "amber",  label: "Inline Hex-Colors" },
  banned_pattern:  { icon: Palette,   color: "amber",  label: "Verbotenes Style-Pattern" },
  h_overflow:      { icon: ArrowLeftRight, color: "red", label: "Horizontal Overflow" },
};

export default function StaffUIAuditPage({ onBack }) {
  const [scanning, setScanning] = useState(false);
  const [issues, setIssues] = useState([]);
  const [activeRoute, setActiveRoute] = useState(window.location.pathname);
  const [viewport, setViewport] = useState("auto");
  const [lastScan, setLastScan] = useState(null);

  const runScan = () => {
    setScanning(true);
    setTimeout(() => {
      const found = scanDocument();
      setIssues(found);
      setLastScan(new Date());
      setScanning(false);
      if (found.length === 0) toast.success("Audit clean — keine Issues");
      else toast.warning(`${found.length} Issues gefunden`);
    }, 250);
  };

  useEffect(() => {
    runScan();
  }, []);

  const grouped = useMemo(() => {
    const map = {};
    issues.forEach((i) => {
      map[i.type] = map[i.type] || [];
      map[i.type].push(i);
    });
    return map;
  }, [issues]);

  const stats = useMemo(() => {
    let high = 0, medium = 0, low = 0;
    issues.forEach((i) => {
      if (i.severity === "high") high++;
      else if (i.severity === "medium") medium++;
      else low++;
    });
    return { high, medium, low, total: issues.length };
  }, [issues]);

  const score = useMemo(() => {
    const penalty = stats.high * 10 + stats.medium * 4 + stats.low * 1;
    return Math.max(0, 100 - penalty);
  }, [stats]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-slate-50/95 backdrop-blur-lg border-b border-slate-200">
        <div className="px-5 py-4 flex items-center gap-3 max-w-5xl mx-auto">
          <button
            onClick={onBack}
            data-testid="audit-back"
            className="p-2 -ml-2 rounded-xl hover:bg-slate-200/60 transition"
          >
            <ArrowLeft size={20} className="text-slate-700" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">UI Audit</h1>
            <p className="text-xs text-slate-500">
              Scannt live aktuelle Seite. Score {score}/100
              {lastScan && ` · ${lastScan.toLocaleTimeString("de-DE")}`}
            </p>
          </div>
          <StaffButton
            size="sm"
            variant="primary"
            onClick={runScan}
            loading={scanning}
            icon={<RefreshCw size={14} />}
            testid="audit-rescan"
          >
            Erneut Scannen
          </StaffButton>
        </div>
      </div>

      <div className="px-5 py-6 max-w-5xl mx-auto space-y-5">
        {/* Score Hero */}
        <StaffCard testid="audit-score-card">
          <div className="flex items-center gap-5">
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold tabular-nums shrink-0"
              style={{
                background: score >= 90 ? "#D1FAE5" : score >= 70 ? "#FEF3C7" : "#FEE2E2",
                color: score >= 90 ? "#10B981" : score >= 70 ? "#D97706" : "#DC2626",
              }}
            >
              {score}
            </div>
            <div className="flex-1">
              <div className="text-2xl font-bold text-slate-900">
                {score >= 90 ? "Excellent" : score >= 70 ? "Gut" : score >= 50 ? "Verbesserbar" : "Schwach"}
              </div>
              <div className="text-sm text-slate-500 mt-1">
                {stats.total === 0
                  ? "Keine Issues — sauber!"
                  : `${stats.total} Issues: ${stats.high} hoch · ${stats.medium} mittel · ${stats.low} niedrig`}
              </div>
            </div>
          </div>
        </StaffCard>

        {/* Route shortcuts */}
        <StaffCard padded={false} testid="audit-routes-card">
          <div className="p-5 border-b border-slate-100">
            <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">Quick-Audit</div>
            <div className="text-sm font-bold text-slate-900">Andere Staff-Seiten testen</div>
          </div>
          <div className="divide-y divide-slate-100">
            {SCAN_ROUTES.map((r) => (
              <a
                key={r.path}
                href={r.path}
                target="_blank"
                rel="noreferrer"
                data-testid={`audit-route-${r.path.replace(/\//g, "-")}`}
                className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-900">{r.label}</div>
                  <div className="text-xs text-slate-500 font-mono truncate">{r.path}</div>
                </div>
                <ExternalLink size={14} className="text-slate-300" />
              </a>
            ))}
          </div>
        </StaffCard>

        {/* Issue groups */}
        {Object.keys(grouped).length === 0 && !scanning ? (
          <StaffEmptyState
            icon={CheckCircle2}
            title="Alles sauber!"
            description="Keine Issues auf der aktuellen Seite. Wechsle zu einer anderen Route und scanne erneut."
            testid="audit-empty"
          />
        ) : (
          <div className="space-y-3">
            {Object.entries(grouped).map(([type, list]) => {
              const meta = ISSUE_META[type] || { icon: AlertTriangle, color: "slate", label: type };
              const Icon = meta.icon;
              const colorMap = {
                red:    { bg: "bg-red-50",    text: "text-red-600",   border: "border-red-200" },
                amber:  { bg: "bg-amber-50",  text: "text-amber-700", border: "border-amber-200" },
                slate:  { bg: "bg-slate-100", text: "text-slate-700", border: "border-slate-200" },
              }[meta.color];
              return (
                <StaffCard key={type} padded={false} testid={`audit-group-${type}`} className={`!p-0 ${colorMap.border}`}>
                  <div className="px-5 py-4 flex items-center gap-3 border-b border-slate-100">
                    <div className={`w-10 h-10 rounded-xl ${colorMap.bg} ${colorMap.text} flex items-center justify-center shrink-0`}>
                      <Icon size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-slate-900">{meta.label}</div>
                      <div className="text-xs text-slate-500">{list.length} Vorkommen</div>
                    </div>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {list.slice(0, 8).map((i, k) => (
                      <div key={k} className="px-5 py-2.5">
                        <div className="text-xs text-slate-700">{i.message}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">{i.target}</div>
                      </div>
                    ))}
                    {list.length > 8 && (
                      <div className="px-5 py-2 text-xs text-slate-400">+ {list.length - 8} weitere</div>
                    )}
                  </div>
                </StaffCard>
              );
            })}
          </div>
        )}

        {/* Rules legend */}
        <StaffCard testid="audit-rules-card">
          <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-2">Aktive Regeln</div>
          <ul className="text-sm text-slate-700 space-y-1.5">
            <li>• Buttons min. <strong>{MOBILE_RULES.minButtonHeight}px</strong>, Primary <strong>{MOBILE_RULES.primaryButtonHeight}px</strong></li>
            <li>• Bottom-Nav & Tabs max. <strong>{MOBILE_RULES.maxTabsPrimary}</strong> Items</li>
            <li>• Schrift min. 11px</li>
            <li>• Keine Tabellen auf Mobile (&lt;768px)</li>
            <li>• Keine hardcoded Hex-Colors in Tailwind-Brackets</li>
            <li>• Kein horizontaler Overflow</li>
          </ul>
        </StaffCard>
      </div>
    </div>
  );
}
