const SLOT_META = {
  front: {
    label: "Vorderseite",
    keywords: ["Vorderseite"],
    fallback: "Bitte die Vorderseite neu und vollständig aufnehmen.",
  },
  back: {
    label: "Rückseite",
    keywords: ["Rückseite"],
    fallback: "Bitte die Rückseite neu und vollständig aufnehmen.",
  },
  selfie: {
    label: "Selfie",
    keywords: ["Selfie", "Gesicht", "Ausweis in der Hand"],
    fallback: "Bitte das Selfie mit klar sichtbarem Gesicht und Ausweis neu aufnehmen.",
  },
};

const GENERAL_SLOT_CODES = {
  front: ["document_not_real", "document_expired", "document_mismatch", "fraud_signal"],
  back: ["document_not_real", "document_expired", "document_mismatch", "fraud_signal"],
  selfie: ["face_mismatch", "selfie_holds_document_failed", "fraud_signal"],
};

const TONES = {
  error: {
    badge: "Fehler",
    card: "rgba(255,71,87,0.08)",
    border: "rgba(255,71,87,0.24)",
    text: "#FF7C87",
  },
  warning: {
    badge: "Prüfung folgt",
    card: "rgba(255,184,0,0.08)",
    border: "rgba(255,184,0,0.24)",
    text: "#FFD166",
  },
  ok: {
    badge: "OK",
    card: "rgba(0,210,106,0.08)",
    border: "rgba(0,210,106,0.24)",
    text: "#4ADE80",
  },
};

const slotMatchesCode = (slot, code = "") => {
  if (!code) return false;
  if (code.startsWith(`${slot}_`)) return true;
  return GENERAL_SLOT_CODES[slot]?.includes(code);
};

const pickSlotMessage = (slot, userFeedback = []) => {
  const keywords = SLOT_META[slot]?.keywords || [];
  return userFeedback.find((item) => keywords.some((keyword) => item?.includes(keyword))) || "";
};

export const buildKycSlotFeedback = (failureReasons = [], userFeedback = []) => {
  const reasons = Array.isArray(failureReasons) ? failureReasons.filter(Boolean) : [];
  const feedback = Array.isArray(userFeedback) ? userFeedback.filter(Boolean) : [];

  return Object.entries(SLOT_META).map(([slot, meta]) => {
    const slotReasons = reasons.filter((code) => slotMatchesCode(slot, code));
    if (slotReasons.length) {
      return {
        id: slot,
        label: meta.label,
        tone: "error",
        detail: pickSlotMessage(slot, feedback) || meta.fallback,
      };
    }
    if (reasons.length || feedback.length) {
      return {
        id: slot,
        label: meta.label,
        tone: "ok",
        detail: "Hier wurde aktuell kein Problem erkannt.",
      };
    }
    return {
      id: slot,
      label: meta.label,
      tone: "warning",
      detail: "Noch keine automatische Bewertung verfügbar.",
    };
  });
};

export const KYCImageIssueGrid = ({ failureReasons = [], userFeedback = [], dataTestidPrefix = "kyc-image-issue" }) => {
  const items = buildKycSlotFeedback(failureReasons, userFeedback);

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" data-testid={`${dataTestidPrefix}-grid`}>
      {items.map((item) => {
        const tone = TONES[item.tone] || TONES.warning;
        return (
          <div
            key={item.id}
            className="rounded-2xl p-3"
            style={{ background: tone.card, border: `1px solid ${tone.border}` }}
            data-testid={`${dataTestidPrefix}-${item.id}`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-bold text-white">{item.label}</p>
              <span className="rounded-full px-2 py-1 text-[9px] font-bold" style={{ background: `${tone.text}18`, color: tone.text }}>
                {tone.badge}
              </span>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-white/70">{item.detail}</p>
          </div>
        );
      })}
    </div>
  );
};