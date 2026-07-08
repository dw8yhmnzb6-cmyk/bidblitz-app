import React from "react";
import { Home } from "lucide-react";
import { useI18n } from "../store";

export default function BackToHomeBar({ onHome, label = "Startseite", testId = "back-to-home" }) {
  const { t } = useI18n();

  return (
    <button
      type="button"
      onClick={onHome}
      data-testid={testId}
      className="sticky top-0 z-40 w-full flex items-center justify-center gap-2 py-2.5 bg-black/70 backdrop-blur-md border-b border-white/10 text-sm font-semibold text-cyan-300 hover:text-cyan-200 active:bg-white/5 transition-colors"
    >
      <Home className="w-4 h-4" />
      <span>{t("nav.back_to_label", { label }) || `Zur ${label} zurück`}</span>
    </button>
  );
}
