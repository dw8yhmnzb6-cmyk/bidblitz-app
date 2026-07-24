"""
BidBlitz V2 - KYC AI Verifier
Uses Gemini Vision to:
 - Extract identity fields from front of ID (name, DOB, doc number, type, expiry)
 - Validate the back has security features
 - Compare the face on the ID vs the user's selfie (liveness)
 - Return a structured verdict + confidence score
"""
import os
import json
import base64
import logging
from typing import Optional

from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

load_dotenv()
logger = logging.getLogger(__name__)


VERIFY_PROMPT = """Du bist ein professioneller KYC-Identity-Verifier.
Du bekommst 3 Bilder:
1. VORDERSEITE eines Ausweisdokuments (Personalausweis / Reisepass / Führerschein)
2. RÜCKSEITE des gleichen Dokuments
3. SELFIE der Person, die ihren Ausweis dabei hält

Analysiere die Bilder und extrahiere die folgenden Felder. Antworte NUR in gültigem JSON, kein Markdown, keine Code-Fences:

{
  "is_real_document": true/false,        // Sieht es wie ein echtes amtliches Dokument aus?
  "document_type": "national_id|passport|drivers_license|unknown",
  "document_country": "DE|AT|CH|XK|AL|...",  // ISO-2-Code, "unknown" wenn unklar
  "full_name": "Vorname Nachname oder null",
  "date_of_birth": "YYYY-MM-DD oder null",
  "document_number": "string oder null",
  "expiry_date": "YYYY-MM-DD oder null",
  "is_expired": true/false,
  "front_quality": 0-100,                 // Schärfe / Lesbarkeit der Vorderseite
  "back_quality": 0-100,                  // Schärfe / Lesbarkeit der Rückseite
  "back_matches_front": true/false,       // Gehören Vorder- und Rückseite zum gleichen Dokument?
  "selfie_holds_document": true/false,    // Hält die Person das Dokument tatsächlich?
  "face_match_confidence": 0-100,         // Übereinstimmung Selfie-Gesicht <-> ID-Foto
  "front_issues": ["ok|too_high|too_low|too_close|too_far|cropped|tilted|blurry|glare|dark|text_unreadable"],
  "back_issues": ["ok|too_high|too_low|too_close|too_far|cropped|tilted|blurry|glare|dark|text_unreadable|mrz_unreadable"],
  "selfie_issues": ["ok|too_high|too_low|too_close|too_far|cropped|tilted|blurry|glare|dark|face_not_clear|document_not_visible|multiple_faces"],
  "user_feedback": ["2-6 kurze deutsche Sätze, was konkret falsch ist und wie der Nutzer es korrigieren soll"],
  "liveness_signals": "Beschreibung in 1 Satz",
  "fraud_signals": "Bedenken in 1 Satz oder leerer String",
  "overall_confidence": 0-100,            // Gesamtbewertung
  "recommendation": "approve|review|reject"
}

Sei streng aber fair. Wenn die Bilder zu unscharf sind, gib niedrige Quality-Werte. Wenn das Dokument abgelaufen ist, recommend "reject".
Wenn etwas falsch aufgenommen wurde, benenne es konkret in `front_issues`, `back_issues`, `selfie_issues` und `user_feedback`, z. B. "Vorderseite zu hoch fotografiert", "Rückseite abgeschnitten", "Selfie zu dunkel".
"""


async def verify_id_documents(front_path: str, back_path: str, selfie_path: str) -> dict:
    """
    Verifiziere die 3 KYC-Bilder mit Gemini.
    Returns dict mit allen Feldern oben + raw_text für Debug.
    """
    api_key = os.getenv("EMERGENT_LLM_KEY")
    if not api_key:
        return {"error": "EMERGENT_LLM_KEY missing", "recommendation": "review", "overall_confidence": 0}

    # Read & encode all 3 images
    image_contents = []
    for label, path in [("Vorderseite", front_path), ("Rückseite", back_path), ("Selfie mit Ausweis", selfie_path)]:
        if not os.path.exists(path):
            return {"error": f"file_missing: {label} ({path})", "recommendation": "review", "overall_confidence": 0}
        with open(path, "rb") as f:
            img_bytes = f.read()
        b64 = base64.b64encode(img_bytes).decode("utf-8")
        image_contents.append(ImageContent(image_base64=b64))

    try:
        chat = LlmChat(
            api_key=api_key,
            session_id=f"kyc-verify-{os.path.basename(front_path)[:20]}",
            system_message="Du bist ein professioneller KYC-Verifier. Antworte ausschließlich in gültigem JSON.",
        )
        chat.with_model("gemini", "gemini-2.5-pro")

        msg = UserMessage(text=VERIFY_PROMPT, file_contents=image_contents)
        response = await chat.send_message(msg)
        text = (response or "").strip()

        # Strip code fences if model added them
        if text.startswith("```"):
            text = text.strip("`")
            if text.startswith("json"):
                text = text[4:]
            text = text.strip()
            if text.endswith("```"):
                text = text[:-3].strip()

        try:
            verdict = json.loads(text)
        except json.JSONDecodeError:
            # Try to find JSON inside text
            start = text.find("{")
            end = text.rfind("}")
            if start >= 0 and end > start:
                try:
                    verdict = json.loads(text[start:end + 1])
                except Exception:
                    verdict = {"raw_response": text[:1000], "recommendation": "review", "overall_confidence": 30}
            else:
                verdict = {"raw_response": text[:1000], "recommendation": "review", "overall_confidence": 30}

        # Sanity: clamp confidence
        verdict["overall_confidence"] = max(0, min(100, int(verdict.get("overall_confidence", 0) or 0)))
        if "recommendation" not in verdict:
            c = verdict["overall_confidence"]
            verdict["recommendation"] = "approve" if c >= 80 else "review" if c >= 50 else "reject"

        return verdict
    except Exception as e:
        logger.exception("KYC AI verification failed")
        return {"error": str(e), "recommendation": "review", "overall_confidence": 0}


def auto_decision(verdict: dict) -> str:
    """
    Decide based on AI verdict.
    Returns: 'approved' | 'rejected' | 'pending' (manual review)
    """
    if verdict.get("error"):
        return "pending"
    rec = verdict.get("recommendation", "review")
    conf = int(verdict.get("overall_confidence", 0) or 0)
    if not verdict.get("is_real_document", False):
        return "rejected"
    if verdict.get("is_expired"):
        return "rejected"
    if rec == "approve" and conf >= 80 and verdict.get("face_match_confidence", 0) >= 75 and verdict.get("selfie_holds_document"):
        return "approved"
    if rec == "reject" or conf < 40:
        return "rejected"
    return "pending"
