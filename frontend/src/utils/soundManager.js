/**
 * BidBlitz Sound System
 * Centralized sound effects for the app
 */

class SoundManager {
  constructor() {
    this.sounds = {};
    this.enabled = localStorage.getItem('soundEnabled') !== 'false';
    this.volume = parseFloat(localStorage.getItem('soundVolume') || '0.5');
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    
    // Create audio context on user interaction
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // Define sounds as oscillator frequencies and durations
    this.soundDefs = {
      coin: { freq: [800, 1000, 1200], duration: 0.1, type: 'sine' },
      win: { freq: [523, 659, 784, 1047], duration: 0.15, type: 'sine' },
      click: { freq: [400], duration: 0.05, type: 'square' },
      error: { freq: [200, 150], duration: 0.15, type: 'sawtooth' },
      levelUp: { freq: [400, 500, 600, 800, 1000], duration: 0.12, type: 'sine' },
      spin: { freq: [300, 350, 400, 450, 500], duration: 0.08, type: 'triangle' },
      reward: { freq: [600, 800, 1000], duration: 0.2, type: 'sine' },
      notification: { freq: [800, 600, 800], duration: 0.1, type: 'sine' },
      gameStart: { freq: [400, 500, 600, 700, 800], duration: 0.1, type: 'sine' },
      gameEnd: { freq: [800, 600, 400], duration: 0.2, type: 'sine' },
    };
    
    this.initialized = true;
  }

  playTone(frequency, duration, type = 'sine') {
    if (!this.enabled || !this.audioContext) return;
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    
    gainNode.gain.setValueAtTime(this.volume * 0.3, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration);
    
    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + duration);
  }

  play(soundName) {
    if (!this.enabled) return;
    if (!this.initialized) this.init();
    if (!this.audioContext) return;
    
    const sound = this.soundDefs[soundName];
    if (!sound) return;
    
    // Resume audio context if suspended (required for Chrome)
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    
    // Play sequence of tones
    sound.freq.forEach((freq, i) => {
      setTimeout(() => {
        this.playTone(freq, sound.duration, sound.type);
      }, i * (sound.duration * 1000 * 0.8));
    });
  }

  // Convenience methods
  coin() { this.play('coin'); }
  win() { this.play('win'); }
  click() { this.play('click'); }
  error() { this.play('error'); }
  levelUp() { this.play('levelUp'); }
  spin() { this.play('spin'); }
  reward() { this.play('reward'); }
  notification() { this.play('notification'); }
  gameStart() { this.play('gameStart'); }
  gameEnd() { this.play('gameEnd'); }

  setEnabled(enabled) {
    this.enabled = enabled;
    localStorage.setItem('soundEnabled', enabled);
  }

  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
    localStorage.setItem('soundVolume', this.volume);
  }

  toggle() {
    this.setEnabled(!this.enabled);
    return this.enabled;
  }
}

// Singleton instance
const soundManager = new SoundManager();

export default soundManager;
