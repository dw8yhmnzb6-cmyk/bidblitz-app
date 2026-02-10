import { useEffect, useRef } from 'react';

// Countdown sound effect for urgent auctions
export const useCountdownSound = (seconds, enabled = true) => {
  const audioRef = useRef(null);
  const lastPlayedRef = useRef(0);

  useEffect(() => {
    // Create audio context only once
    if (!audioRef.current && typeof window !== 'undefined') {
      audioRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.close();
        audioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!enabled || !audioRef.current || seconds > 10 || seconds <= 0) return;
    
    // Prevent double-playing in same second
    if (lastPlayedRef.current === seconds) return;
    lastPlayedRef.current = seconds;

    const playBeep = () => {
      try {
        const ctx = audioRef.current;
        if (ctx.state === 'suspended') {
          ctx.resume();
        }

        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        // Higher pitch for final seconds
        const frequency = seconds <= 3 ? 880 : seconds <= 5 ? 660 : 440;
        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';

        // Volume based on urgency
        const volume = seconds <= 3 ? 0.3 : 0.15;
        gainNode.gain.setValueAtTime(volume, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.1);
      } catch (e) {
        console.log('Audio not available');
      }
    };

    playBeep();
  }, [seconds, enabled]);
};

export default useCountdownSound;
