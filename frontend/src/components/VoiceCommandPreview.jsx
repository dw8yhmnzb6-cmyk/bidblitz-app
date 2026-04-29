import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X } from 'lucide-react';

/**
 * VoiceCommandPreview — Multi-Step Bestätigung (Alexa-Style)
 * Zeigt Intent-Details vor finaler Ausführung
 */
export default function VoiceCommandPreview({ intent, isOpen, onConfirm, onCancel }) {
  if (!isOpen || !intent) return null;

  const getPreviewContent = () => {
    switch (intent.action) {
      case 'book_taxi':
        return {
          icon: '🚕',
          title: 'Taxi buchen',
          description: intent.pickup && intent.destination
            ? `Von ${intent.pickup} nach ${intent.destination}`
            : 'Aktuelle Position zu Ziel',
          details: [
            { label: 'Abholung', value: intent.pickup || 'Aktuelle Position' },
            { label: 'Ziel', value: intent.destination || 'Nicht angegeben' },
            { label: 'Fahrzeugtyp', value: intent.vehicle_type || 'Standard' },
          ],
        };
      case 'search_food':
        return {
          icon: '🍕',
          title: 'Restaurant suchen',
          description: `Suche nach: ${intent.query || 'Essen'}`,
          details: [
            { label: 'Suchbegriff', value: intent.query || '—' },
          ],
        };
      case 'open_scooter':
        return {
          icon: '🛴',
          title: 'Scooter öffnen',
          description: 'Wechsle zur Scooter-Karte',
          details: [],
        };
      case 'open_wallet':
        return {
          icon: '💰',
          title: 'Wallet öffnen',
          description: 'Guthaben anzeigen',
          details: [],
        };
      case 'open_split_pay':
        return {
          icon: '💳',
          title: 'Split-Zahlung',
          description: 'Rechnung teilen',
          details: [],
        };
      default:
        return {
          icon: '🎤',
          title: 'Befehl ausführen',
          description: intent.action || 'Unbekannt',
          details: [],
        };
    }
  };

  const content = getPreviewContent();

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onCancel}
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className="bg-[#0B0B0F] border-2 border-[#00C2FF] rounded-3xl p-6 max-w-md w-full shadow-2xl"
          onClick={(e) => e.stopPropagation()}
          data-testid="voice-command-preview"
        >
          {/* Icon */}
          <div className="text-center mb-4">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-[#00C2FF]/20 to-[#7B2CFF]/20 mb-3">
              <span className="text-4xl">{content.icon}</span>
            </div>
            <h3 className="text-2xl font-bold text-white mb-1">{content.title}</h3>
            <p className="text-gray-400 text-sm">{content.description}</p>
          </div>

          {/* Details */}
          {content.details.length > 0 && (
            <div className="bg-white/5 rounded-xl p-4 mb-5 space-y-2">
              {content.details.map((detail, idx) => (
                <div key={idx} className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">{detail.label}:</span>
                  <span className="text-white font-medium">{detail.value}</span>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 py-3 bg-white/10 border border-white/20 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-white/15 transition-colors"
              data-testid="voice-preview-cancel"
            >
              <X size={16} />
              Abbrechen
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 py-3 bg-gradient-to-r from-[#00C2FF] to-[#7B2CFF] rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
              data-testid="voice-preview-confirm"
            >
              <Check size={16} />
              Bestätigen
            </button>
          </div>

          {/* Hint */}
          <p className="text-center text-[10px] text-gray-600 mt-4">
            Sage "Bestätigen" oder "Abbrechen" für Sprachsteuerung
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
