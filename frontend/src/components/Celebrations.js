import { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { Trophy, Star, PartyPopper } from 'lucide-react';

/**
 * WinCelebration - Shows a celebration animation when user wins an auction
 * Usage: <WinCelebration show={showWin} productName="iPhone 15" savings={500} onClose={() => setShowWin(false)} />
 */
export function WinCelebration({ show, productName, savings, onClose }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setVisible(true);
      
      // Fire confetti
      const duration = 3000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

      function randomInRange(min, max) {
        return Math.random() * (max - min) + min;
      }

      const interval = setInterval(() => {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);
        
        // Left side
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
          colors: ['#FFD700', '#FFA500', '#FF4D4D', '#00CED1']
        });
        
        // Right side
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
          colors: ['#FFD700', '#FFA500', '#FF4D4D', '#00CED1']
        });
      }, 250);

      // Auto close after 5 seconds
      const timeout = setTimeout(() => {
        setVisible(false);
        if (onClose) onClose();
      }, 5000);

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
  }, [show, onClose]);

  if (!visible) return null;

  return (
    <div 
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={() => {
        setVisible(false);
        if (onClose) onClose();
      }}
    >
      <div 
        className="bg-white rounded-2xl p-8 max-w-md mx-4 text-center transform animate-bounce-in shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative">
          <div className="absolute -top-16 left-1/2 -translate-x-1/2">
            <div className="w-24 h-24 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center shadow-lg animate-pulse">
              <Trophy className="w-12 h-12 text-white" />
            </div>
          </div>
        </div>
        
        <div className="mt-12">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Star className="w-5 h-5 text-amber-500 animate-spin-slow" />
            <PartyPopper className="w-6 h-6 text-purple-500" />
            <Star className="w-5 h-5 text-amber-500 animate-spin-slow" />
          </div>
          
          <h2 className="text-3xl font-bold text-gray-800 mb-2">
            Herzlichen Glückwunsch!
          </h2>
          
          <p className="text-gray-600 mb-4">
            Du hast gewonnen:
          </p>
          
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-4 mb-4">
            <p className="text-xl font-bold text-gray-800">{productName}</p>
          </div>
          
          {savings > 0 && (
            <div className="bg-green-50 rounded-xl p-3 mb-4">
              <p className="text-green-600 font-medium">
                Du hast <span className="text-2xl font-bold">€{savings.toFixed(2)}</span> gespart!
              </p>
            </div>
          )}
          
          <p className="text-sm text-gray-500">
            Klicke irgendwo um fortzufahren
          </p>
        </div>
      </div>
      
      {/* Add CSS animation */}
      <style>{`
        @keyframes bounce-in {
          0% { transform: scale(0.5); opacity: 0; }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-bounce-in {
          animation: bounce-in 0.5s ease-out;
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 3s linear infinite;
        }
      `}</style>
    </div>
  );
}

/**
 * NewAchievementToast - Shows when user unlocks a new achievement
 */
export function NewAchievementToast({ achievement, onClose }) {
  useEffect(() => {
    // Small confetti burst
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.8 },
      colors: ['#FFD700', '#9333EA', '#22C55E']
    });

    const timeout = setTimeout(() => {
      if (onClose) onClose();
    }, 4000);

    return () => clearTimeout(timeout);
  }, [onClose]);

  return (
    <div className="fixed bottom-24 right-4 z-50 animate-slide-up">
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl p-4 shadow-2xl max-w-sm">
        <div className="flex items-center gap-3">
          <div className="text-4xl">{achievement.icon}</div>
          <div>
            <p className="text-purple-200 text-xs uppercase tracking-wide">Neuer Erfolg!</p>
            <p className="font-bold text-lg">{achievement.name}</p>
            <p className="text-purple-200 text-sm">{achievement.description}</p>
          </div>
        </div>
      </div>
      
      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-up {
          animation: slide-up 0.4s ease-out;
        }
      `}</style>
    </div>
  );
}

/**
 * DailyRewardPopup - Shows daily reward reminder
 */
export function DailyRewardPopup({ onClaim, onDismiss }) {
  return (
    <div className="fixed bottom-24 left-4 z-50 animate-slide-up">
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl p-4 shadow-2xl max-w-xs">
        <div className="flex items-start gap-3">
          <div className="text-3xl">🎁</div>
          <div className="flex-1">
            <p className="font-bold">Tägliche Belohnung!</p>
            <p className="text-amber-100 text-sm mb-2">Hole dir jetzt deine kostenlosen Gebote ab!</p>
            <div className="flex gap-2">
              <button 
                onClick={onClaim}
                className="bg-white text-amber-600 px-3 py-1 rounded-lg text-sm font-medium hover:bg-amber-50"
              >
                Abholen
              </button>
              <button 
                onClick={onDismiss}
                className="text-amber-200 text-sm hover:text-white"
              >
                Später
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-up {
          animation: slide-up 0.4s ease-out;
        }
      `}</style>
    </div>
  );
}

export default WinCelebration;
