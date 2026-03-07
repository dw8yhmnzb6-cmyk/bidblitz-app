/**
 * BidBlitz Sound Settings
 * Configure sound effects
 */
import React, { useState } from 'react';
import BottomNav from '../components/BottomNav';
import soundManager from '../utils/SoundManager';

export default function AppSoundSettings() {
  const [enabled, setEnabled] = useState(soundManager.isEnabled());
  const [volume, setVolume] = useState(soundManager.getVolume() * 100);
  
  const toggleSound = () => {
    const newState = soundManager.toggle();
    setEnabled(newState);
    if (newState) {
      soundManager.playClick();
    }
  };
  
  const handleVolumeChange = (e) => {
    const newVolume = parseInt(e.target.value);
    setVolume(newVolume);
    soundManager.setVolume(newVolume / 100);
  };
  
  const testSound = (type) => {
    switch (type) {
      case 'coin': soundManager.playCoin(); break;
      case 'win': soundManager.playWin(); break;
      case 'lose': soundManager.playLose(); break;
      case 'click': soundManager.playClick(); break;
      case 'achievement': soundManager.playAchievement(); break;
      case 'notification': soundManager.playNotification(); break;
      case 'spin': soundManager.playSpin(); break;
      case 'mining': soundManager.playMining(); break;
      case 'levelup': soundManager.playLevelUp(); break;
      default: break;
    }
  };
  
  const soundEffects = [
    { id: 'coin', name: '💰 Coin', desc: 'Beim Verdienen von Coins' },
    { id: 'win', name: '🎉 Gewinn', desc: 'Bei Spielgewinnen' },
    { id: 'lose', name: '😢 Verlust', desc: 'Bei Spielverlusten' },
    { id: 'click', name: '👆 Klick', desc: 'Button-Klicks' },
    { id: 'achievement', name: '🏆 Achievement', desc: 'Neues Achievement' },
    { id: 'notification', name: '🔔 Benachrichtigung', desc: 'Neue Benachrichtigung' },
    { id: 'spin', name: '🎡 Spin', desc: 'Glücksrad drehen' },
    { id: 'mining', name: '⛏️ Mining', desc: 'Mining-Aktionen' },
    { id: 'levelup', name: '⬆️ Level Up', desc: 'Level-Aufstieg' },
  ];
  
  return (
    <div className="min-h-screen bg-[#0b0e24] text-white pb-20">
      <div className="p-5">
        <h2 className="text-2xl font-bold mb-5">🔊 Sound-Einstellungen</h2>
        
        {/* Master Toggle */}
        <div className="bg-[#171a3a] p-5 rounded-xl mb-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">Sound-Effekte</p>
              <p className="text-sm text-slate-400">Aktiviere oder deaktiviere alle Sounds</p>
            </div>
            <button
              onClick={toggleSound}
              className={`w-14 h-8 rounded-full transition-colors relative ${
                enabled ? 'bg-[#6c63ff]' : 'bg-slate-600'
              }`}
              data-testid="sound-toggle"
            >
              <div className={`w-6 h-6 bg-white rounded-full absolute top-1 transition-transform ${
                enabled ? 'translate-x-7' : 'translate-x-1'
              }`} />
            </button>
          </div>
        </div>
        
        {/* Volume Slider */}
        <div className={`bg-[#171a3a] p-5 rounded-xl mb-5 ${!enabled ? 'opacity-50' : ''}`}>
          <p className="font-semibold mb-3">Lautstärke: {volume}%</p>
          <input
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={handleVolumeChange}
            disabled={!enabled}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#6c63ff]"
            data-testid="volume-slider"
          />
        </div>
        
        {/* Sound Effects Test */}
        <div className={`bg-[#171a3a] p-5 rounded-xl ${!enabled ? 'opacity-50 pointer-events-none' : ''}`}>
          <h3 className="font-semibold mb-4">Sound-Effekte testen</h3>
          <div className="grid grid-cols-3 gap-3">
            {soundEffects.map((sound) => (
              <button
                key={sound.id}
                onClick={() => testSound(sound.id)}
                disabled={!enabled}
                className="p-3 bg-[#0b0e24] hover:bg-[#6c63ff]/20 rounded-xl text-center transition-colors"
                data-testid={`test-${sound.id}`}
              >
                <p className="text-lg mb-1">{sound.name.split(' ')[0]}</p>
                <p className="text-xs text-slate-400">{sound.name.split(' ')[1]}</p>
              </button>
            ))}
          </div>
        </div>
        
        {/* Info */}
        <div className="mt-5 bg-[#171a3a] p-4 rounded-xl text-sm text-slate-400">
          <h4 className="font-semibold text-white mb-2">Hinweis</h4>
          <p>Sound-Effekte werden mit dem Web Audio API generiert. 
             Keine externen Audio-Dateien erforderlich.</p>
        </div>
      </div>
      
      <BottomNav />
    </div>
  );
}
