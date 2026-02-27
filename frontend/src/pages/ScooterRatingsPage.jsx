/**
 * Scooter Rating Component + Page
 * Shows after ride ends, also accessible as standalone page for device ratings
 */
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { toast } from 'sonner';
import { Star, Send, Loader2, Bike, Sparkles, ThumbsUp, X, ArrowLeft } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const categories = [
  { key: 'cleanliness', label: 'Sauberkeit', emoji: '🧹' },
  { key: 'battery_condition', label: 'Akku-Zustand', emoji: '🔋' },
  { key: 'brakes', label: 'Bremsen', emoji: '🛑' },
];

function StarRating({ value, onChange, size = 'lg' }) {
  const [hover, setHover] = useState(0);
  const sz = size === 'lg' ? 'w-10 h-10' : 'w-6 h-6';
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(star)}
          className="transition-transform hover:scale-110"
        >
          <Star className={`${sz} ${(hover || value) >= star ? 'text-amber-400 fill-amber-400' : 'text-slate-300'} transition-colors`} />
        </button>
      ))}
    </div>
  );
}

// Modal version (after ride ends)
export function RateRideModal({ isOpen, onClose, deviceId, sessionId, deviceName }) {
  const { token } = useAuth();
  const [overall, setOverall] = useState(0);
  const [ratings, setRatings] = useState({ cleanliness: 0, battery_condition: 0, brakes: 0 });
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (overall === 0) { toast.error('Bitte Gesamtbewertung geben'); return; }
    setSubmitting(true);
    try {
      await axios.post(`${API}/scooter-features/ratings`, {
        device_id: deviceId,
        session_id: sessionId,
        overall,
        ...ratings,
        comment: comment || null
      }, { headers: { Authorization: `Bearer ${token}` } });
      setSubmitted(true);
      setTimeout(() => onClose(), 2000);
    } catch (e) { toast.error(e.response?.data?.detail || 'Fehler'); }
    finally { setSubmitting(false); }
  };

  if (submitted) {
    return (
      <div className="fixed inset-0 z-[3000] bg-black/50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 text-center max-w-sm w-full animate-in zoom-in">
          <ThumbsUp className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800">Danke!</h2>
          <p className="text-slate-500 mt-2">Deine Bewertung hilft uns, den Service zu verbessern.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[3000] bg-black/50 flex items-end sm:items-center justify-center" data-testid="rate-ride-modal">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-800">Fahrt bewerten</h2>
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-full"><X className="w-5 h-5 text-slate-400" /></button>
          </div>

          <p className="text-slate-500 text-sm mb-4">{deviceName || 'Scooter'}</p>

          {/* Overall Rating */}
          <div className="text-center mb-6">
            <p className="text-sm font-medium text-slate-700 mb-2">Gesamtbewertung</p>
            <div className="flex justify-center"><StarRating value={overall} onChange={setOverall} /></div>
            <p className="text-xs text-slate-400 mt-1">{overall > 0 ? ['', 'Schlecht', 'Geht so', 'OK', 'Gut', 'Super!'][overall] : 'Tippe auf die Sterne'}</p>
          </div>

          {/* Category Ratings */}
          <div className="space-y-3 mb-4">
            {categories.map(cat => (
              <div key={cat.key} className="flex items-center justify-between bg-slate-50 rounded-xl p-3">
                <span className="text-sm text-slate-700">{cat.emoji} {cat.label}</span>
                <StarRating value={ratings[cat.key]} onChange={(v) => setRatings(prev => ({ ...prev, [cat.key]: v }))} size="sm" />
              </div>
            ))}
          </div>

          {/* Comment */}
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Optional: Was war gut/schlecht?"
            rows={2}
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm resize-none mb-4"
            data-testid="rating-comment"
          />

          <button onClick={handleSubmit} disabled={submitting || overall === 0}
            className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
            data-testid="submit-rating-btn">
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Sparkles className="w-5 h-5" /> Bewertung abgeben</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// Standalone page showing device ratings
export default function ScooterRatingsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white p-4 pb-24" data-testid="scooter-ratings-page">
      <div className="max-w-lg mx-auto pt-4">
        <div className="text-center mb-6">
          <Star className="w-12 h-12 text-amber-400 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-slate-800">Scooter-Bewertungen</h1>
          <p className="text-slate-500 text-sm mt-1">Bewerte Scooter nach jeder Fahrt</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-6 text-center">
          <Bike className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">Nach jeder Fahrt kannst du den Scooter bewerten.</p>
          <p className="text-slate-400 text-sm mt-2">Deine Bewertungen helfen anderen Nutzern und verbessern den Service.</p>
        </div>
      </div>
    </div>
  );
}
