"""
ElevenLabs Voiceover für Taxi-Ansagen
Falls API Key fehlt: Browser TTS Fallback
"""
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
import os
import io

router = APIRouter(prefix="/api/taxi/voiceover", tags=["Taxi Voiceover"])

ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")


class VoiceoverRequest(BaseModel):
    text: str
    voice: Optional[str] = "Rachel"  # ElevenLabs voice ID


@router.post("/announce")
async def generate_voiceover(req: VoiceoverRequest, request: Request):
    """
    Generiere Voiceover für Taxi-Ansagen.
    Nutzt ElevenLabs falls API Key vorhanden, sonst Browser-TTS Fallback.
    """
    
    if not ELEVENLABS_API_KEY:
        # Fallback: Return SSML für Browser TTS
        return {
            "mode": "browser_tts",
            "text": req.text,
            "ssml": f'<speak><prosody rate="medium" pitch="medium">{req.text}</prosody></speak>',
            "message": "ElevenLabs API Key fehlt. Nutze Browser TTS."
        }
    
    # ElevenLabs API Integration
    try:
        import httpx
        
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{req.voice}"
        headers = {
            "xi-api-key": ELEVENLABS_API_KEY,
            "Content-Type": "application/json"
        }
        payload = {
            "text": req.text,
            "model_id": "eleven_multilingual_v2",
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.75
            }
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, headers=headers, timeout=30.0)
            
            if response.status_code != 200:
                raise HTTPException(500, f"ElevenLabs API Error: {response.text}")
            
            # Return audio stream
            return StreamingResponse(
                io.BytesIO(response.content),
                media_type="audio/mpeg",
                headers={"Content-Disposition": f'inline; filename="voiceover.mp3"'}
            )
    
    except ImportError:
        # httpx nicht installiert
        return {
            "mode": "browser_tts",
            "text": req.text,
            "message": "httpx library fehlt. Nutze Browser TTS."
        }
    
    except Exception as e:
        # Fallback bei Fehler
        return {
            "mode": "browser_tts",
            "text": req.text,
            "error": str(e),
            "message": "ElevenLabs Fehler. Nutze Browser TTS."
        }


@router.get("/test")
async def test_voiceover():
    """Test ob ElevenLabs konfiguriert ist."""
    return {
        "elevenlabs_configured": bool(ELEVENLABS_API_KEY),
        "api_key_present": "ELEVENLABS_API_KEY" in os.environ,
        "fallback": "Browser TTS" if not ELEVENLABS_API_KEY else None,
    }


# Preset Ansagen für Taxi
TAXI_ANNOUNCEMENTS = {
    "driver_arriving": "Dein Fahrer ist in 2 Minuten da.",
    "driver_arrived": "Dein Fahrer ist angekommen.",
    "trip_started": "Die Fahrt hat begonnen. Gute Fahrt!",
    "trip_completed": "Ihr Ziel wurde erreicht. Vielen Dank für die Nutzung!",
    "payment_success": "Zahlung erfolgreich. Vielen Dank!",
}


@router.post("/preset/{announcement_key}")
async def preset_announcement(announcement_key: str, request: Request):
    """Vordefinierte Ansagen für Taxi-Events."""
    
    if announcement_key not in TAXI_ANNOUNCEMENTS:
        raise HTTPException(404, "Ansage nicht gefunden")
    
    text = TAXI_ANNOUNCEMENTS[announcement_key]
    
    # Wiederverwendung der generate_voiceover Logik
    req = VoiceoverRequest(text=text)
    return await generate_voiceover(req, request)
