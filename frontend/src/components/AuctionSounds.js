/**
 * Auction Sound Alerts - Audio notifications for auction events
 * - Outbid alerts
 * - Countdown sounds
 * - Win celebration
 */
import { useEffect, useRef, useCallback } from 'react';

// Sound URLs (using Web Audio API with generated tones for better reliability)
const SOUND_CONFIG = {
  outbid: { frequency: 440, duration: 0.3, type: 'sine' },
  countdown: { frequency: 880, duration: 0.1, type: 'square' },
  win: { frequency: 523.25, duration: 0.5, type: 'sine' },
  bid: { frequency: 660, duration: 0.15, type: 'triangle' }
};

// Create Audio Context
let audioContext = null;

const getAudioContext = () => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
};

// Generate a tone using Web Audio API
const playTone = (config) => {
  try {
    const ctx = getAudioContext();
    
    // Resume context if suspended (browser autoplay policy)
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    oscillator.type = config.type || 'sine';
    oscillator.frequency.setValueAtTime(config.frequency, ctx.currentTime);
    
    // Envelope for smoother sound
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + config.duration);
    
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + config.duration);
  } catch (error) {
    console.error('Sound playback error:', error);
  }
};

// Play outbid sound
export const playOutbidSound = () => {
  // Play two quick beeps
  playTone(SOUND_CONFIG.outbid);
  setTimeout(() => playTone({ ...SOUND_CONFIG.outbid, frequency: 330 }), 150);
};

// Play countdown sound (for last 10 seconds)
export const playCountdownSound = (secondsLeft) => {
  if (secondsLeft <= 10 && secondsLeft > 0) {
    const frequency = secondsLeft <= 3 ? 1000 : 880;
    playTone({ ...SOUND_CONFIG.countdown, frequency });
  }
};

// Play win celebration sound
export const playWinSound = () => {
  // Play ascending notes for celebration
  const notes = [523.25, 659.25, 783.99, 1046.50]; // C, E, G, C (octave)
  notes.forEach((freq, i) => {
    setTimeout(() => playTone({ frequency: freq, duration: 0.2, type: 'sine' }), i * 150);
  });
};

// Play bid placed sound
export const playBidSound = () => {
  playTone(SOUND_CONFIG.bid);
};

// Hook for managing sound settings
export const useSoundSettings = () => {
  const soundEnabled = typeof window !== 'undefined' 
    ? localStorage.getItem('auction_sounds_enabled') !== 'false'
    : true;
  
  const setSoundEnabled = (enabled) => {
    localStorage.setItem('auction_sounds_enabled', enabled ? 'true' : 'false');
  };
  
  return { soundEnabled, setSoundEnabled };
};

// Hook for auction sounds
export const useAuctionSounds = (options = {}) => {
  const { 
    enabled = true,
    onOutbid = null,
    onCountdown = null,
    onWin = null
  } = options;
  
  const lastCountdown = useRef(null);
  
  const soundEnabled = typeof window !== 'undefined' 
    ? localStorage.getItem('auction_sounds_enabled') !== 'false' && enabled
    : enabled;
  
  const handleOutbid = useCallback(() => {
    if (soundEnabled) {
      playOutbidSound();
      onOutbid?.();
    }
  }, [soundEnabled, onOutbid]);
  
  const handleCountdown = useCallback((seconds) => {
    if (soundEnabled && seconds <= 10 && seconds !== lastCountdown.current) {
      lastCountdown.current = seconds;
      playCountdownSound(seconds);
      onCountdown?.(seconds);
    }
  }, [soundEnabled, onCountdown]);
  
  const handleWin = useCallback(() => {
    if (soundEnabled) {
      playWinSound();
      onWin?.();
    }
  }, [soundEnabled, onWin]);
  
  const handleBid = useCallback(() => {
    if (soundEnabled) {
      playBidSound();
    }
  }, [soundEnabled]);
  
  return {
    playOutbid: handleOutbid,
    playCountdown: handleCountdown,
    playWin: handleWin,
    playBid: handleBid,
    soundEnabled
  };
};

// Sound Settings Component
export const SoundSettings = ({ className = '' }) => {
  const { soundEnabled, setSoundEnabled } = useSoundSettings();
  
  const toggleSound = () => {
    const newValue = !soundEnabled;
    setSoundEnabled(newValue);
    
    // Play test sound when enabling
    if (newValue) {
      playBidSound();
    }
    
    // Force re-render by dispatching custom event
    window.dispatchEvent(new CustomEvent('soundSettingsChanged', { detail: newValue }));
  };
  
  return (
    <button
      onClick={toggleSound}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
        soundEnabled 
          ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' 
          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
      } ${className}`}
      title={soundEnabled ? 'Sounds deaktivieren' : 'Sounds aktivieren'}
    >
      {soundEnabled ? (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
        </svg>
      ) : (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
        </svg>
      )}
      <span className="text-sm font-medium hidden sm:inline">
        {soundEnabled ? 'Sound An' : 'Sound Aus'}
      </span>
    </button>
  );
};

export default {
  playOutbidSound,
  playCountdownSound,
  playWinSound,
  playBidSound,
  useSoundSettings,
  useAuctionSounds,
  SoundSettings
};
