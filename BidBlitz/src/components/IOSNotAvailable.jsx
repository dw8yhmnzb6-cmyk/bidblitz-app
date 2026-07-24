/**
 * IOSNotAvailableBanner — simple notice shown when a feature is blocked
 * on the iOS App Store launch build.
 */
import { AlertCircle, Globe } from "lucide-react";

export const IOSNotAvailable = ({ feature = "Diese Funktion", testId = "ios-blocked" }) => (
  <div
    className="mx-4 my-6 p-4 rounded-2xl border border-yellow-500/30 bg-yellow-500/5 flex gap-3"
    data-testid={testId}
  >
    <AlertCircle size={20} className="text-yellow-400 shrink-0 mt-0.5" />
    <div className="text-sm">
      <div className="font-semibold text-yellow-200 mb-1">
        {feature} ist auf iOS derzeit nicht verfügbar
      </div>
      <p className="text-yellow-100/70 text-xs leading-relaxed">
        Aufgrund der Apple App Store Richtlinien für digitale Käufe kannst du
        diesen Bereich aktuell nur im Browser unter{" "}
        <span className="font-semibold">bidblitz.ae</span> nutzen.
      </p>
      <a
        href="https://bidblitz.ae"
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-yellow-300 hover:underline"
      >
        <Globe size={12} /> Im Browser öffnen
      </a>
    </div>
  </div>
);

export default IOSNotAvailable;
