import { HelpCircle } from "lucide-react";

export const PosHelpTray = ({ copy }) => {
  const items = [
    [copy.startSale, "Tippe zuerst auf ein Produkt. Es landet direkt im Warenkorb und der Gesamtbetrag aktualisiert sich sofort."],
    [copy.removeItem, "Im Warenkorb kannst du mit – und Entfernen jeden Artikel direkt korrigieren, bevor bezahlt wird."],
    [copy.printReceipt, "Nach einer bestätigten Zahlung wählst du Papierbeleg, E-Mail, QR-Code oder Kein Beleg."],
    [copy.declinedHelp, "Bleibe ruhig beim gleichen Warenkorb. Nutze Erneut versuchen oder wechsle auf eine andere Zahlungsmethode."],
  ];

  return (
    <details className="rounded-[24px] border border-white/10 bg-[#071019] p-4 text-white" data-testid="merchant-pos-help-tray">
      <summary className="flex cursor-pointer list-none items-center gap-3 text-sm font-black">
        <HelpCircle size={18} aria-hidden="true" />
        <span>{copy.help}</span>
      </summary>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {items.map(([title, text], index) => (
          <div key={title} className="rounded-[20px] border border-white/10 bg-white/5 p-4" data-testid={`merchant-pos-help-item-${index + 1}`}>
            <div className="text-sm font-black text-white">{title}</div>
            <p className="mt-2 text-sm text-white/62">{text}</p>
          </div>
        ))}
      </div>
    </details>
  );
};