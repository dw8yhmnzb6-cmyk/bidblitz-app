import { useState } from 'react';
import axios from 'axios';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { 
  Settings, Save, RefreshCw, Gift, Moon, Trophy, Users,
  Wifi, WifiOff
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export function AdminGameConfig({ token, gameConfig, setGameConfig, isConnected }) {
  const [savingConfig, setSavingConfig] = useState(false);

  const handleSaveGameConfig = async () => {
    setSavingConfig(true);
    try {
      await axios.put(`${API}/admin/game-config`, gameConfig, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Einstellungen gespeichert');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler beim Speichern');
    } finally {
      setSavingConfig(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings className="w-8 h-8 text-[#7C3AED]" />
          <div>
            <h1 className="text-2xl font-bold text-white">Spiel-Einstellungen</h1>
            <p className="text-[#94A3B8]">Konfigurieren Sie Rewards, Auktionstypen und Achievements</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isConnected ? (
            <span className="flex items-center gap-1 text-green-400 text-sm">
              <Wifi className="w-4 h-4" /> Live
            </span>
          ) : (
            <span className="flex items-center gap-1 text-gray-500 text-sm">
              <WifiOff className="w-4 h-4" /> Offline
            </span>
          )}
          <Button
            onClick={handleSaveGameConfig}
            disabled={savingConfig || !gameConfig}
            className="bg-[#10B981] hover:bg-[#059669]"
          >
            {savingConfig ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Speichern
          </Button>
        </div>
      </div>

      {gameConfig ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Daily Rewards Config */}
          <div className="glass-card rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#F59E0B] to-[#EF4444] flex items-center justify-center">
                <Gift className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-white font-bold">Tägliche Belohnungen</h3>
                <p className="text-[#94A3B8] text-sm">Daily Login Rewards</p>
              </div>
              <label className="ml-auto flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={gameConfig.daily_reward_enabled}
                  onChange={(e) => setGameConfig({...gameConfig, daily_reward_enabled: e.target.checked})}
                  className="w-5 h-5 rounded"
                />
                <span className="text-white">Aktiv</span>
              </label>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-white">Min. Gebote</Label>
                  <Input
                    type="number"
                    min="1"
                    value={gameConfig.daily_reward_min_bids}
                    onChange={(e) => setGameConfig({...gameConfig, daily_reward_min_bids: parseInt(e.target.value)})}
                    className="bg-[#181824] border-white/10 text-white"
                  />
                </div>
                <div>
                  <Label className="text-white">Max. Gebote</Label>
                  <Input
                    type="number"
                    min="1"
                    value={gameConfig.daily_reward_max_bids}
                    onChange={(e) => setGameConfig({...gameConfig, daily_reward_max_bids: parseInt(e.target.value)})}
                    className="bg-[#181824] border-white/10 text-white"
                  />
                </div>
              </div>
              
              <div className="pt-4 border-t border-white/10">
                <p className="text-[#94A3B8] text-sm mb-3">Streak-Bonus (zusätzliche Gebote)</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-white text-xs">7 Tage</Label>
                    <Input
                      type="number"
                      min="0"
                      value={gameConfig.streak_bonus_day_7}
                      onChange={(e) => setGameConfig({...gameConfig, streak_bonus_day_7: parseInt(e.target.value)})}
                      className="bg-[#181824] border-white/10 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-white text-xs">14 Tage</Label>
                    <Input
                      type="number"
                      min="0"
                      value={gameConfig.streak_bonus_day_14}
                      onChange={(e) => setGameConfig({...gameConfig, streak_bonus_day_14: parseInt(e.target.value)})}
                      className="bg-[#181824] border-white/10 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-white text-xs">30 Tage</Label>
                    <Input
                      type="number"
                      min="0"
                      value={gameConfig.streak_bonus_day_30}
                      onChange={(e) => setGameConfig({...gameConfig, streak_bonus_day_30: parseInt(e.target.value)})}
                      className="bg-[#181824] border-white/10 text-white"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Beginner Auctions Config */}
          <div className="glass-card rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-purple-500 flex items-center justify-center">
                <span className="text-xl">🎓</span>
              </div>
              <div>
                <h3 className="text-white font-bold">Anfänger-Auktionen</h3>
                <p className="text-[#94A3B8] text-sm">Nur für neue Nutzer</p>
              </div>
              <label className="ml-auto flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={gameConfig.beginner_auction_enabled}
                  onChange={(e) => setGameConfig({...gameConfig, beginner_auction_enabled: e.target.checked})}
                  className="w-5 h-5 rounded"
                />
                <span className="text-white">Aktiv</span>
              </label>
            </div>
            
            <div>
              <Label className="text-white">Max. gewonnene Auktionen</Label>
              <Input
                type="number"
                min="1"
                value={gameConfig.beginner_max_wins}
                onChange={(e) => setGameConfig({...gameConfig, beginner_max_wins: parseInt(e.target.value)})}
                className="bg-[#181824] border-white/10 text-white"
              />
              <p className="text-[#94A3B8] text-xs mt-1">Nutzer mit mehr Siegen können nicht teilnehmen</p>
            </div>
          </div>

          {/* Free Auctions Config */}
          <div className="glass-card rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-green-500 flex items-center justify-center">
                <span className="text-xl">🎁</span>
              </div>
              <div>
                <h3 className="text-white font-bold">Gratis-Auktionen</h3>
                <p className="text-[#94A3B8] text-sm">Keine Gebote nötig</p>
              </div>
              <label className="ml-auto flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={gameConfig.free_auction_enabled}
                  onChange={(e) => setGameConfig({...gameConfig, free_auction_enabled: e.target.checked})}
                  className="w-5 h-5 rounded"
                />
                <span className="text-white">Aktiv</span>
              </label>
            </div>
            
            <div>
              <Label className="text-white">Max. Teilnehmer pro Auktion</Label>
              <Input
                type="number"
                min="10"
                value={gameConfig.free_auction_max_participants}
                onChange={(e) => setGameConfig({...gameConfig, free_auction_max_participants: parseInt(e.target.value)})}
                className="bg-[#181824] border-white/10 text-white"
              />
            </div>
          </div>

          {/* Night Auctions Config */}
          <div className="glass-card rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-indigo-500 flex items-center justify-center">
                <Moon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-white font-bold">Nacht-Auktionen</h3>
                <p className="text-[#94A3B8] text-sm">Weniger Gebote nötig</p>
              </div>
              <label className="ml-auto flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={gameConfig.night_auction_enabled}
                  onChange={(e) => setGameConfig({...gameConfig, night_auction_enabled: e.target.checked})}
                  className="w-5 h-5 rounded"
                />
                <span className="text-white">Aktiv</span>
              </label>
            </div>
            
            <div className="space-y-4">
              <div>
                <Label className="text-white">Gebots-Rabatt (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={gameConfig.night_auction_bid_discount}
                  onChange={(e) => setGameConfig({...gameConfig, night_auction_bid_discount: parseInt(e.target.value)})}
                  className="bg-[#181824] border-white/10 text-white"
                />
                <p className="text-[#94A3B8] text-xs mt-1">{gameConfig.night_auction_bid_discount}% weniger Gebote werden abgezogen</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-white">Start (Uhr)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="23"
                    value={gameConfig.night_auction_start_hour}
                    onChange={(e) => setGameConfig({...gameConfig, night_auction_start_hour: parseInt(e.target.value)})}
                    className="bg-[#181824] border-white/10 text-white"
                  />
                </div>
                <div>
                  <Label className="text-white">Ende (Uhr)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="23"
                    value={gameConfig.night_auction_end_hour}
                    onChange={(e) => setGameConfig({...gameConfig, night_auction_end_hour: parseInt(e.target.value)})}
                    className="bg-[#181824] border-white/10 text-white"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Achievements Config */}
          <div className="glass-card rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-[#7C3AED] flex items-center justify-center">
                <Trophy className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-white font-bold">Achievements</h3>
                <p className="text-[#94A3B8] text-sm">Belohnungen für Meilensteine</p>
              </div>
              <label className="ml-auto flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={gameConfig.achievements_enabled}
                  onChange={(e) => setGameConfig({...gameConfig, achievements_enabled: e.target.checked})}
                  className="w-5 h-5 rounded"
                />
                <span className="text-white">Aktiv</span>
              </label>
            </div>
            
            <div className="text-center py-4">
              <p className="text-[#94A3B8]">12 Achievements verfügbar</p>
              <p className="text-white font-mono text-sm mt-2">
                🏆 🎯 ⭐ 👑 🦉 🐦 💎 🍀 🔥 💪 👥 🎓
              </p>
            </div>
          </div>

          {/* Referral Config */}
          <div className="glass-card rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-[#06B6D4] flex items-center justify-center">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-white font-bold">Freunde werben</h3>
                <p className="text-[#94A3B8] text-sm">Referral-Belohnungen</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <Label className="text-white">Bonus-Gebote pro Empfehlung</Label>
                <Input
                  type="number"
                  min="0"
                  value={gameConfig.referral_reward_bids}
                  onChange={(e) => setGameConfig({...gameConfig, referral_reward_bids: parseInt(e.target.value)})}
                  className="bg-[#181824] border-white/10 text-white"
                />
                <p className="text-[#94A3B8] text-xs mt-1">Beide erhalten diese Gebote</p>
              </div>
              <div>
                <Label className="text-white">Min. Einzahlung (€)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={gameConfig.referral_min_deposit}
                  onChange={(e) => setGameConfig({...gameConfig, referral_min_deposit: parseFloat(e.target.value)})}
                  className="bg-[#181824] border-white/10 text-white"
                />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-[#7C3AED]" />
        </div>
      )}

      {/* Info Box */}
      <div className="glass-card rounded-xl p-4 border-l-4 border-[#7C3AED]">
        <div className="flex items-start gap-3">
          <Settings className="w-6 h-6 text-[#7C3AED] flex-shrink-0" />
          <div>
            <h4 className="text-white font-semibold">Tipp</h4>
            <p className="text-[#94A3B8] text-sm">
              Änderungen werden sofort wirksam. Um eine Auktion als Anfänger-, Gratis- oder Nacht-Auktion zu markieren, 
              bearbeiten Sie diese im "Auktionen" Tab.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
