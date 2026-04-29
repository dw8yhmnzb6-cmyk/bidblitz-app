import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, X, Camera, Send } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function ReviewModal({ isOpen, onClose, serviceType, serviceId, onSubmit }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) return;

    setLoading(true);
    try {
      const res = await fetch(`${API}/api/reviews/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          service_type: serviceType,
          service_id: serviceId,
          rating,
          comment,
          photos,
        }),
      });

      if (res.ok) {
        onSubmit?.();
        onClose();
        setRating(0);
        setComment('');
        setPhotos([]);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={e => e.stopPropagation()}
            className="bg-[#0B0B0F] rounded-3xl p-6 max-w-md w-full space-y-6"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-bold text-white">Rate Your Experience</h3>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-[#121218] flex items-center justify-center"
              >
                <X size={16} className="text-gray-400" />
              </motion.button>
            </div>

            {/* Star Rating */}
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <motion.button
                  key={star}
                  whileTap={{ scale: 1.2 }}
                  onClick={() => setRating(star)}
                  className="relative"
                >
                  <Star
                    size={40}
                    className={`transition ${
                      star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'
                    }`}
                  />
                </motion.button>
              ))}
            </div>

            {rating > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center"
              >
                <p className="text-white font-medium">
                  {rating === 5 ? 'Excellent!' : rating === 4 ? 'Great!' : rating === 3 ? 'Good' : rating === 2 ? 'Fair' : 'Poor'}
                </p>
              </motion.div>
            )}

            {/* Comment */}
            <textarea
              placeholder="Tell us more about your experience... (optional)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              className="w-full bg-[#121218] text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00C2FF]/50 resize-none"
            />

            {/* Photo Upload */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-gray-400 text-sm">
                <Camera size={16} />
                Add Photos (optional)
              </label>
              <div className="flex gap-2 flex-wrap">
                {photos.map((photo, idx) => (
                  <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden bg-gray-700">
                    <img src={photo} alt="" className="w-full h-full object-cover" />
                    <button
                      onClick={() => setPhotos(photos.filter((_, i) => i !== idx))}
                      className="absolute top-1 right-1 w-5 h-5 bg-black/70 rounded-full flex items-center justify-center"
                    >
                      <X size={12} className="text-white" />
                    </button>
                  </div>
                ))}
                {photos.length < 3 && (
                  <label className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-600 flex items-center justify-center cursor-pointer hover:border-[#00C2FF] transition">
                    <Camera size={24} className="text-gray-500" />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = () => setPhotos([...photos, reader.result]);
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Submit */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleSubmit}
              disabled={rating === 0 || loading}
              className={`w-full py-4 rounded-full font-bold text-white flex items-center justify-center gap-2 transition ${
                rating === 0 || loading
                  ? 'bg-gray-700 opacity-50'
                  : 'bg-gradient-to-r from-[#00C2FF] to-[#7B2CFF]'
              }`}
            >
              <Send size={20} />
              {loading ? 'Submitting...' : 'Submit Review'}
            </motion.button>

            <p className="text-center text-gray-500 text-xs">
              🎁 Earn +10 loyalty points for your review!
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
