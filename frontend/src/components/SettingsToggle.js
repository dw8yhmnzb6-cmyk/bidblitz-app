import { Moon, Sun, Volume2, VolumeX } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useState, useEffect } from 'react';

export default function SettingsToggle() {
  const { darkMode, toggleDarkMode } = useTheme();
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('soundEnabled');
      return saved ? JSON.parse(saved) : true;
    }
    return true;
  });

  useEffect(() => {
    localStorage.setItem('soundEnabled', JSON.stringify(soundEnabled));
    window.soundEnabled = soundEnabled;
  }, [soundEnabled]);

  return (
    <div className="flex items-center gap-2">
      {/* Sound Toggle */}
      <button
        onClick={() => setSoundEnabled(!soundEnabled)}
        className={`p-2 rounded-full transition-all ${
          soundEnabled 
            ? 'bg-green-500/20 text-green-500' 
            : 'bg-gray-500/20 text-gray-500'
        }`}
        title={soundEnabled ? 'Sound aus' : 'Sound an'}
      >
        {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
      </button>
      
      {/* Dark Mode Toggle */}
      <button
        onClick={toggleDarkMode}
        className={`p-2 rounded-full transition-all ${
          darkMode 
            ? 'bg-yellow-500/20 text-yellow-500' 
            : 'bg-slate-700/20 text-slate-700'
        }`}
        title={darkMode ? 'Hell-Modus' : 'Dunkel-Modus'}
      >
        {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>
    </div>
  );
}
