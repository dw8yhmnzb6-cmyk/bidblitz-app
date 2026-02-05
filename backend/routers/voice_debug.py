"""
Voice Debug Assistant - Backend Router
AI-powered voice debugging for admin panel
Uses OpenAI Whisper for speech-to-text and GPT for analysis
"""
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import os
import tempfile
import traceback
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix="/api/admin/voice-debug", tags=["voice-debug"])

# Import authentication
from routers.auth import get_current_user

# Translations
TRANSLATIONS = {
    'de': {
        'analyzing': 'Analysiere Fehlerbeschreibung...',
        'searching': 'Durchsuche Code nach möglichen Ursachen...',
        'report_title': 'Fehler-Report',
        'description': 'Beschreibung',
        'possible_causes': 'Mögliche Ursachen',
        'affected_files': 'Betroffene Dateien',
        'recommendations': 'Empfehlungen',
        'severity': 'Schweregrad',
        'created_at': 'Erstellt am',
        'status': 'Status',
        'error_transcription': 'Fehler bei der Spracherkennung',
        'error_analysis': 'Fehler bei der Analyse',
        'no_audio': 'Keine Audiodatei empfangen',
    },
    'en': {
        'analyzing': 'Analyzing error description...',
        'searching': 'Searching code for possible causes...',
        'report_title': 'Error Report',
        'description': 'Description',
        'possible_causes': 'Possible Causes',
        'affected_files': 'Affected Files',
        'recommendations': 'Recommendations',
        'severity': 'Severity',
        'created_at': 'Created At',
        'status': 'Status',
        'error_transcription': 'Error during transcription',
        'error_analysis': 'Error during analysis',
        'no_audio': 'No audio file received',
    }
}

class DebugReport(BaseModel):
    id: str
    transcription: str
    description: str
    severity: str  # low, medium, high, critical
    possible_causes: List[str]
    affected_files: List[str]
    recommendations: List[str]
    status: str  # pending, analyzed, resolved
    created_at: str
    language: str

class TranscriptionResponse(BaseModel):
    success: bool
    transcription: Optional[str] = None
    error: Optional[str] = None

class AnalysisResponse(BaseModel):
    success: bool
    report: Optional[DebugReport] = None
    error: Optional[str] = None


async def transcribe_audio(audio_file: UploadFile) -> str:
    """Transcribe audio using OpenAI Whisper"""
    try:
        from emergentintegrations.llm.openai import OpenAISpeechToText
        
        api_key = os.getenv("EMERGENT_LLM_KEY")
        if not api_key:
            raise ValueError("EMERGENT_LLM_KEY not configured")
        
        stt = OpenAISpeechToText(api_key=api_key)
        
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as tmp:
            content = await audio_file.read()
            tmp.write(content)
            tmp_path = tmp.name
        
        try:
            # Transcribe
            with open(tmp_path, "rb") as f:
                response = await stt.transcribe(
                    file=f,
                    model="whisper-1",
                    response_format="json",
                    language="de",  # German
                    prompt="Dies ist eine Fehlerbeschreibung für eine Webseite. Der Benutzer beschreibt ein technisches Problem."
                )
            return response.text
        finally:
            # Cleanup temp file
            os.unlink(tmp_path)
            
    except Exception as e:
        print(f"Transcription error: {e}")
        traceback.print_exc()
        raise


async def analyze_error(transcription: str, language: str = 'de') -> DebugReport:
    """Analyze the error description using GPT"""
    try:
        from emergentintegrations.llm.openai import OpenAILLM, OpenAIModel
        
        api_key = os.getenv("EMERGENT_LLM_KEY")
        if not api_key:
            raise ValueError("EMERGENT_LLM_KEY not configured")
        
        llm = OpenAILLM(api_key=api_key)
        
        # System prompt for error analysis
        system_prompt = """Du bist ein erfahrener Entwickler und Debug-Assistent für eine Penny-Auction-Webseite (BidBlitz).
Die Webseite verwendet:
- Frontend: React, Tailwind CSS, Shadcn/UI
- Backend: FastAPI, Python
- Datenbank: MongoDB
- Features: Auktionen, Gebote, Benutzer-Authentifizierung, Gamification, Payments (Stripe)

Analysiere die Fehlerbeschreibung und erstelle einen strukturierten Report.
Antworte IMMER im folgenden JSON-Format:
{
    "description": "Kurze Zusammenfassung des Problems",
    "severity": "low|medium|high|critical",
    "possible_causes": ["Ursache 1", "Ursache 2", "Ursache 3"],
    "affected_files": ["Pfad/zu/datei1.js", "Pfad/zu/datei2.py"],
    "recommendations": ["Empfehlung 1", "Empfehlung 2", "Empfehlung 3"]
}

Severity-Levels:
- low: Kosmetische Fehler, keine Funktionsbeeinträchtigung
- medium: Feature funktioniert teilweise nicht
- high: Wichtige Funktion ist betroffen
- critical: Sicherheitsproblem oder kompletter Ausfall"""

        user_prompt = f"""Fehlerbeschreibung (per Spracheingabe):
"{transcription}"

Analysiere diesen Fehler und erstelle einen strukturierten Debug-Report."""

        response = await llm.generate(
            prompt=user_prompt,
            system_prompt=system_prompt,
            model=OpenAIModel.GPT_4O_MINI,
            temperature=0.3,
            max_tokens=1500
        )
        
        # Parse JSON response
        import json
        import re
        
        # Extract JSON from response
        json_match = re.search(r'\{[\s\S]*\}', response)
        if json_match:
            analysis = json.loads(json_match.group())
        else:
            # Fallback if no JSON found
            analysis = {
                "description": transcription,
                "severity": "medium",
                "possible_causes": ["Konnte nicht automatisch analysiert werden"],
                "affected_files": ["Unbekannt"],
                "recommendations": ["Manuelle Überprüfung empfohlen"]
            }
        
        # Create report
        report = DebugReport(
            id=f"DBG-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
            transcription=transcription,
            description=analysis.get("description", transcription),
            severity=analysis.get("severity", "medium"),
            possible_causes=analysis.get("possible_causes", []),
            affected_files=analysis.get("affected_files", []),
            recommendations=analysis.get("recommendations", []),
            status="analyzed",
            created_at=datetime.now(timezone.utc).isoformat(),
            language=language
        )
        
        return report
        
    except Exception as e:
        print(f"Analysis error: {e}")
        traceback.print_exc()
        raise


@router.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe_voice(
    audio: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Transcribe voice input to text"""
    # Check admin permission
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        transcription = await transcribe_audio(audio)
        return TranscriptionResponse(success=True, transcription=transcription)
    except Exception as e:
        return TranscriptionResponse(success=False, error=str(e))


@router.post("/analyze", response_model=AnalysisResponse)
async def analyze_voice_error(
    audio: UploadFile = File(...),
    language: str = "de",
    current_user: dict = Depends(get_current_user)
):
    """Transcribe and analyze voice error description"""
    # Check admin permission
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        # Step 1: Transcribe
        transcription = await transcribe_audio(audio)
        
        if not transcription or len(transcription.strip()) < 5:
            return AnalysisResponse(
                success=False, 
                error="Keine verständliche Spracheingabe erkannt"
            )
        
        # Step 2: Analyze
        report = await analyze_error(transcription, language)
        
        return AnalysisResponse(success=True, report=report)
        
    except Exception as e:
        return AnalysisResponse(success=False, error=str(e))


@router.get("/reports")
async def get_debug_reports(
    current_user: dict = Depends(get_current_user)
):
    """Get all debug reports (placeholder - would need database)"""
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Placeholder - in production, this would query MongoDB
    return {
        "reports": [],
        "total": 0,
        "message": "Debug reports would be stored in database"
    }
