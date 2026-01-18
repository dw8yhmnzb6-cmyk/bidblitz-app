import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Bell, Timer } from 'lucide-react';

// Store for tracking which auctions have already triggered alarms
const notifiedAuctions = new Set();

export function useAuctionAlarm(auctions, isAuthenticated) {
  const [alarmedAuctions, setAlarmedAuctions] = useState([]);
  const audioRef = useRef(null);

  useEffect(() => {
    // Create audio element for alarm sound
    if (!audioRef.current) {
      audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQIfZ8Xo45VoHRlgse3+tnBjHBJerPb/rWdHFRdXpPX/oGk/DhRMmfP/lGc3CxFCi+//g2IoCAo3fOX4cmMjBgktbNzra1oeAwcga8/YXk8UAQMUY8DBTkQPAQILWbO0QDkLAQEERaSpMC4GAQD9OZieIycDAP/yLouTFyIBAP/nIX+LDhwAAP/cFnSCBxYAAP/REWl5AhEAAP/HDGB0AA0AAP+9CF1xAQoAAP+4BlpuAQcAAP+0BFdsAQUAAP+wA1VrAAMAAP+tAlRqAAIAAP+qAVNpAAEAAP+oAFJoAAAA');
    }

    const checkAuctions = () => {
      if (!isAuthenticated || !auctions?.length) return;

      const now = new Date();
      
      auctions.forEach((auction) => {
        if (auction.status !== 'active') return;
        if (notifiedAuctions.has(auction.id)) return;

        const endTime = new Date(auction.end_time);
        const secondsLeft = Math.floor((endTime - now) / 1000);

        // Trigger alarm at 60 seconds
        if (secondsLeft > 0 && secondsLeft <= 60) {
          notifiedAuctions.add(auction.id);
          
          const productName = auction.product?.name || 'Unbekanntes Produkt';
          const currentPrice = auction.current_price?.toFixed(2) || '0.00';

          // Play sound
          if (audioRef.current) {
            audioRef.current.play().catch(() => {});
          }

          // Show toast notification
          toast.warning(
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#FF4D4D]/20 flex items-center justify-center animate-pulse">
                <Timer className="w-5 h-5 text-[#FF4D4D]" />
              </div>
              <div>
                <p className="font-bold text-white">Nur noch {secondsLeft} Sekunden!</p>
                <p className="text-sm text-[#94A3B8]">{productName} - €{currentPrice}</p>
              </div>
            </div>,
            {
              duration: 10000,
              action: {
                label: 'Jetzt bieten',
                onClick: () => window.location.href = `/auctions/${auction.id}`
              }
            }
          );

          // Also try browser notification if permitted
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('⏰ Auktion endet bald!', {
              body: `${productName} - nur noch ${secondsLeft}s! Aktuell: €${currentPrice}`,
              icon: '/favicon.ico',
              tag: auction.id
            });
          }

          setAlarmedAuctions(prev => [...prev, auction.id]);
        }
      });
    };

    // Check every second
    const interval = setInterval(checkAuctions, 1000);
    checkAuctions(); // Initial check

    return () => clearInterval(interval);
  }, [auctions, isAuthenticated]);

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      // Don't request immediately, wait for user interaction
    }
  }, []);

  return { alarmedAuctions };
}

// Component to request notification permission
export function NotificationPermissionButton() {
  const [permission, setPermission] = useState(
    'Notification' in window ? Notification.permission : 'denied'
  );

  const requestPermission = async () => {
    if ('Notification' in window) {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === 'granted') {
        toast.success('Benachrichtigungen aktiviert!');
      }
    }
  };

  if (permission === 'granted') return null;
  if (permission === 'denied') return null;

  return (
    <button
      onClick={requestPermission}
      className="fixed bottom-20 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-full bg-gradient-to-r from-[#FFD700] to-[#FF4D4D] text-black font-bold shadow-lg hover:scale-105 transition-transform"
      data-testid="enable-notifications-btn"
    >
      <Bell className="w-5 h-5" />
      Auktions-Alarm aktivieren
    </button>
  );
}
