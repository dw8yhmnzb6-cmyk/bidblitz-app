import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Volume2 } from 'lucide-react';
import VoiceCommandPreview from './VoiceCommandPreview';

export default function VoiceCommands({ onCommand, hidden = false }) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [recognition, setRecognition] = useState(null);
  const [pendingIntent, setPendingIntent] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  // Allow external triggers via custom event (used by SuperAppOverlay hub)
  useEffect(() => {
    const handler = () => {
      if (recognition && !listening) {
        try { recognition.start(); setListening(true); } catch {}
      }
    };
    document.addEventListener('superapp:open-voice', handler);
    return () => document.removeEventListener('superapp:open-voice', handler);
  }, [recognition, listening]);

  useEffect(() => {
    // Check if browser supports Speech Recognition
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.warn('Speech Recognition not supported');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognitionInstance = new SpeechRecognition();
    
    recognitionInstance.continuous = false;
    recognitionInstance.interimResults = true;
    recognitionInstance.lang = 'de-DE'; // German

    recognitionInstance.onresult = (event) => {
      const current = event.resultIndex;
      const transcriptText = event.results[current][0].transcript;
      setTranscript(transcriptText);

      if (event.results[current].isFinal) {
        processCommand(transcriptText);
      }
    };

    recognitionInstance.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setListening(false);
    };

    recognitionInstance.onend = () => {
      setListening(false);
    };

    setRecognition(recognitionInstance);
  }, []);

  const processCommand = async (text) => {
    // 1) LLM-basiert (Multi-Step) — bevorzugt
    try {
      const r = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/voice/parse`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: text }),
      });
      if (r.ok) {
        const d = await r.json();
        const intents = (d.intents || []);
        if (intents.length > 0) {
          let i = 0;
          for (const intent of intents) {
            // Erste Intent sofort, weitere mit kleinem Delay damit UI Modals stacken kann
            setTimeout(() => onCommand?.(intent), i * 800);
            i++;
          }
          if (intents[0].action === 'book_taxi') speak('Taxi wird gebucht');
          else if (intents[0].action === 'open_food') speak('Öffne Essen');
          else if (intents[0].action === 'search_food') speak(`Suche ${intents[0].query || ''}`);
          else if (intents[0].action === 'open_scooter') speak('Öffne Scooter');
          else if (intents[0].action === 'open_wallet') speak('Öffne Wallet');
          else if (intents[0].action === 'open_loyalty') speak('Punktestand');
          else if (intents[0].action === 'open_split_pay') speak('Split-Zahlung wird vorbereitet');
          return;
        }
      }
    } catch (e) {
      // Fall-through to local heuristic
    }

    // 2) Lokales Fallback (offline / kein LLM)
    const lowerText = text.toLowerCase();
    if (lowerText.includes('bestätigen') || lowerText.includes('ja') || lowerText.includes('ok')) {
      if (pendingIntent) {
        handleConfirmCommand();
        return;
      }
    } else if (lowerText.includes('abbrechen') || lowerText.includes('nein') || lowerText.includes('stop')) {
      if (pendingIntent) {
        handleCancelCommand();
        return;
      }
    }

    if (lowerText.includes('taxi') || lowerText.includes('fahrt')) {
      if (lowerText.includes('buchen') || lowerText.includes('bestellen')) {
        const intent = { action: 'book_taxi' };
        setPendingIntent(intent);
        setShowPreview(true);
        speak('Taxi-Buchung — bitte bestätigen');
        return;
      }
    } else if (lowerText.includes('essen') || lowerText.includes('bestellen')) {
      if (lowerText.includes('pizza')) {
        const intent = { action: 'search_food', query: 'pizza' };
        setPendingIntent(intent);
        setShowPreview(true);
        speak('Pizza-Suche — bitte bestätigen');
        return;
      } else {
        onCommand?.({ action: 'open_food' });
        speak('Öffne Essen');
      }
    } else if (lowerText.includes('scooter') || lowerText.includes('roller')) {
      onCommand?.({ action: 'open_scooter' });
      speak('Öffne Scooter');
    } else if (lowerText.includes('guthaben') || lowerText.includes('wallet')) {
      onCommand?.({ action: 'open_wallet' });
      speak('Öffne Wallet');
    } else if (lowerText.includes('zurück') || lowerText.includes('back')) {
      onCommand?.({ action: 'go_back' });
    } else if (lowerText.includes('hilfe') || lowerText.includes('help')) {
      speak('Sage zum Beispiel: Taxi buchen, Pizza bestellen, oder Punktestand anzeigen');
    }
  };

  const handleConfirmCommand = () => {
    if (pendingIntent) {
      onCommand?.(pendingIntent);
      speak('Befehl wird ausgeführt');
    }
    setShowPreview(false);
    setPendingIntent(null);
  };

  const handleCancelCommand = () => {
    speak('Befehl abgebrochen');
    setShowPreview(false);
    setPendingIntent(null);
  };

  const speak = (text) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'de-DE';
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  const toggleListening = () => {
    if (!recognition) return;

    if (listening) {
      recognition.stop();
      setListening(false);
    } else {
      setTranscript('');
      recognition.start();
      setListening(true);
    }
  };

  return (
    <>
      {/* Voice Command Preview Modal */}
      <VoiceCommandPreview
        intent={pendingIntent}
        isOpen={showPreview}
        onConfirm={handleConfirmCommand}
        onCancel={handleCancelCommand}
      />

      {/* Voice Button — versteckt, wenn `hidden` Prop gesetzt (SuperAppOverlay-Hub-Modus) */}
      {!hidden && (
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={toggleListening}
          className={`fixed bottom-32 right-6 z-40 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center ${
            listening 
              ? 'bg-gradient-to-br from-red-500 to-red-600 animate-pulse' 
              : 'bg-gradient-to-br from-[#00C2FF] to-[#7B2CFF]'
          }`}
        >
          {listening ? <MicOff size={24} className="text-white" /> : <Mic size={24} className="text-white" />}
        </motion.button>
      )}

      {/* Listening Indicator */}
      <AnimatePresence>
        {listening && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="fixed bottom-52 left-1/2 -translate-x-1/2 z-40 bg-[#0B0B0F] border-2 border-[#00C2FF] rounded-2xl p-4 min-w-[280px]"
          >
            <div className="flex items-center gap-3 mb-2">
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 1 }}
                className="w-3 h-3 bg-red-500 rounded-full"
              />
              <span className="text-white font-medium">Listening...</span>
            </div>
            {transcript && (
              <p className="text-gray-300 text-sm mt-2">{transcript}</p>
            )}
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => speak('Beispiel Befehle: Taxi buchen, Essen bestellen, Scooter öffnen')}
                className="flex items-center gap-1 text-xs text-[#00C2FF] hover:underline"
              >
                <Volume2 size={12} />
                Hilfe
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// Supported Commands:
// - "Taxi buchen" / "Fahrt buchen"
// - "Essen bestellen" / "Pizza bestellen"
// - "Scooter öffnen" / "Roller"
// - "Guthaben anzeigen" / "Wallet öffnen"
// - "Zurück" / "Back"
// - "Hilfe" / "Help"
