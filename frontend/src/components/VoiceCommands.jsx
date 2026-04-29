import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Volume2 } from 'lucide-react';

export default function VoiceCommands({ onCommand }) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [recognition, setRecognition] = useState(null);

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

  const processCommand = (text) => {
    const lowerText = text.toLowerCase();

    // Taxi commands
    if (lowerText.includes('taxi') || lowerText.includes('fahrt')) {
      if (lowerText.includes('buchen') || lowerText.includes('bestellen')) {
        onCommand?.({ action: 'book_taxi', service: 'taxi' });
        speak('Taxi wird gebucht');
      }
    }

    // Food commands
    if (lowerText.includes('essen') || lowerText.includes('bestellen')) {
      if (lowerText.includes('pizza')) {
        onCommand?.({ action: 'search_food', query: 'pizza' });
        speak('Suche nach Pizza');
      } else if (lowerText.includes('burger')) {
        onCommand?.({ action: 'search_food', query: 'burger' });
        speak('Suche nach Burger');
      } else {
        onCommand?.({ action: 'open_food' });
        speak('Öffne Essen Bestellung');
      }
    }

    // Scooter commands
    if (lowerText.includes('scooter') || lowerText.includes('roller')) {
      onCommand?.({ action: 'open_scooter' });
      speak('Öffne Scooter');
    }

    // Wallet commands
    if (lowerText.includes('guthaben') || lowerText.includes('wallet')) {
      onCommand?.({ action: 'open_wallet' });
      speak('Öffne Wallet');
    }

    // Navigation
    if (lowerText.includes('zurück') || lowerText.includes('back')) {
      onCommand?.({ action: 'go_back' });
    }

    // Help
    if (lowerText.includes('hilfe') || lowerText.includes('help')) {
      speak('Sie können sagen: Taxi buchen, Essen bestellen, Scooter öffnen, oder Guthaben anzeigen');
    }
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
      {/* Voice Button */}
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
