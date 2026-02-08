// Admin Jackpot Management Component - Extracted from Admin.js
import { Trophy, Save } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

export default function AdminJackpot({ 
  token, 
  jackpotData, 
  jackpotAmount, 
  setJackpotAmount, 
  jackpotHistory, 
  happyHourConfig,
  luckyIn50Config,
  users, 
  fetchData 
}) {
  
  const handleToggleJackpot = async () => {
    const newStatus = jackpotData?.is_active === false;
    try {
      await axios.post(`${API}/api/excitement/global-jackpot/toggle`, 
        { is_active: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(newStatus ? 'Jackpot aktiviert!' : 'Jackpot deaktiviert!');
      fetchData();
    } catch (err) {
      toast.error('Fehler beim Umschalten');
    }
  };

  const handleSetJackpot = async () => {
    try {
      await axios.post(`${API}/api/excitement/global-jackpot/set`, 
        { amount: jackpotAmount },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Jackpot auf ${jackpotAmount} Gebote gesetzt!`);
      fetchData();
    } catch (err) {
      toast.error('Fehler beim Setzen');
    }
  };

  const handleAwardJackpot = async (userId) => {
    if (!userId) return;
    if (!window.confirm(`Jackpot von ${jackpotData?.current_amount || 0} Geboten wirklich vergeben?`)) return;
    try {
      const res = await axios.post(
        `${API}/api/excitement/global-jackpot/award/${userId}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`🏆 ${res.data.winner} hat ${res.data.amount} Gebote gewonnen!`);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Fehler');
    }
  };

  const handleToggleHappyHour = async () => {
    try {
      await axios.put(`${API}/api/gamification/happy-hour/config?enabled=${!happyHourConfig?.enabled}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(happyHourConfig?.enabled ? 'Happy Hour deaktiviert' : 'Happy Hour aktiviert');
      fetchData();
    } catch (err) {
      toast.error('Fehler');
    }
  };

  const handleSetMultiplier = async (val) => {
    try {
      await axios.put(`${API}/api/gamification/happy-hour/config?multiplier=${val}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(`Multiplikator auf ${val}x gesetzt`);
      fetchData();
    } catch (err) {
      toast.error('Fehler');
    }
  };

  const handleSetHappyHourTime = async (field, val) => {
    const intVal = parseInt(val);
    const isValid = field === 'start_hour' ? (intVal >= 0 && intVal <= 23) : (intVal >= 1 && intVal <= 24);
    if (isValid) {
      try {
        await axios.put(`${API}/api/gamification/happy-hour/config?${field}=${intVal}`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        fetchData();
      } catch (err) {}
    }
  };

  const handleToggleLuckyIn50 = async () => {
    try {
      await axios.put(`${API}/api/gamification/lucky-in-50/config?enabled=${!luckyIn50Config?.enabled}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(luckyIn50Config?.enabled ? 'Lucky in 50 deaktiviert' : 'Lucky in 50 aktiviert');
      fetchData();
    } catch (err) {
      toast.error('Fehler');
    }
  };

  const handleSetLucky50Prize = async (prize) => {
    try {
      await axios.put(`${API}/api/gamification/lucky-in-50/config?prize_bids=${prize}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(`Preis auf ${prize} Gebote gesetzt`);
      fetchData();
    } catch (err) {
      toast.error('Fehler');
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-2">
        <Trophy className="w-6 h-6 text-[#FFD700]" />
        Jackpot Verwaltung
      </h1>

      {/* Current Jackpot */}
      <div className="glass-card rounded-xl p-4 sm:p-6 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-yellow-500/30">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-500 text-sm">Aktueller Jackpot</p>
            <p className="text-3xl sm:text-4xl font-black text-[#FFD700]">
              {jackpotData?.current_amount?.toLocaleString('de-DE') || 0} Gebote
            </p>
            <p className="text-gray-800 text-lg mt-1">
              Wert: €{((jackpotData?.current_amount || 0) * 0.50).toFixed(2)}
            </p>
          </div>
          <Trophy className="w-12 h-12 sm:w-16 sm:h-16 text-[#FFD700] opacity-50" />
        </div>
      </div>

      {/* Jackpot On/Off Toggle */}
      <div className="glass-card rounded-xl p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-gray-800 font-bold">Jackpot Status</h3>
            <p className="text-gray-500 text-sm">
              {jackpotData?.is_active !== false ? 'Jackpot ist aktiv und wird bei Geboten erhöht' : 'Jackpot ist deaktiviert'}
            </p>
          </div>
          <button
            onClick={handleToggleJackpot}
            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
              jackpotData?.is_active !== false ? 'bg-[#10B981]' : 'bg-[#374151]'
            }`}
          >
            <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
              jackpotData?.is_active !== false ? 'translate-x-7' : 'translate-x-1'
            }`} />
          </button>
        </div>
      </div>

      {/* Jackpot Controls */}
      <div className="glass-card rounded-xl p-4 sm:p-6">
        <h3 className="text-gray-800 font-bold mb-4">Jackpot anpassen</h3>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
          <div className="flex-1">
            <Label className="text-gray-500">Neuer Jackpot-Betrag (Gebote)</Label>
            <Input
              type="number"
              value={jackpotAmount}
              onChange={(e) => setJackpotAmount(parseInt(e.target.value) || 0)}
              className="bg-white border-gray-200 text-gray-800 text-lg"
              min={0}
            />
          </div>
          <Button onClick={handleSetJackpot} className="bg-[#FFD700] text-black hover:bg-[#FFD700]/80 h-10">
            <Save className="w-4 h-4 mr-1" />
            Setzen
          </Button>
        </div>
        <p className="text-gray-500 text-xs mt-2">
          Aktuell: {jackpotData?.current_amount || 0} Gebote = €{((jackpotData?.current_amount || 0) * 0.50).toFixed(2)}
        </p>
      </div>

      {/* Award Jackpot */}
      <div className="glass-card rounded-xl p-4 sm:p-6">
        <h3 className="text-gray-800 font-bold mb-4">🏆 Jackpot vergeben</h3>
        <div className="space-y-3">
          <div>
            <Label className="text-gray-500">Benutzer auswählen ({users.length} verfügbar)</Label>
            <Select onValueChange={handleAwardJackpot}>
              <SelectTrigger className="bg-white border-gray-200 text-gray-800">
                <SelectValue placeholder="Benutzer wählen zum Vergeben..." />
              </SelectTrigger>
              <SelectContent className="bg-white border-gray-200 max-h-60">
                {users.length === 0 ? (
                  <SelectItem value="none" disabled className="text-gray-500">
                    Keine Benutzer geladen
                  </SelectItem>
                ) : (
                  users.map((user) => (
                    <SelectItem key={user.id} value={user.id} className="text-gray-800">
                      {user.name} ({user.email})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="text-[#F59E0B] text-sm mt-3 p-2 bg-[#F59E0B]/10 rounded">
          ⚠️ Der ausgewählte Benutzer erhält sofort <strong>{jackpotData?.current_amount || 0} Gebote</strong> (€{((jackpotData?.current_amount || 0) * 0.50).toFixed(2)})
        </p>
      </div>

      {/* Jackpot History */}
      <div className="glass-card rounded-xl p-4 sm:p-6">
        <h3 className="text-gray-800 font-bold mb-4">Jackpot-Gewinner Historie</h3>
        {jackpotHistory.length === 0 ? (
          <p className="text-gray-500 text-center py-4">Noch keine Jackpot-Gewinner</p>
        ) : (
          <div className="space-y-2">
            {jackpotHistory.map((winner, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-white rounded-lg">
                <div className="flex items-center gap-3">
                  <Trophy className="w-5 h-5 text-[#FFD700]" />
                  <div>
                    <p className="text-gray-800 font-medium">{winner.user_name}</p>
                    <p className="text-gray-500 text-xs">
                      {new Date(winner.won_at).toLocaleString('de-DE')}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[#FFD700] font-bold">{winner.amount} Gebote</p>
                  <p className="text-gray-500 text-xs">€{(winner.amount * 0.50).toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Last Winner Info */}
      {jackpotData?.last_winner && jackpotData?.last_won_amount && (
        <div className="glass-card rounded-xl p-4 sm:p-6 border border-[#FFD700]/30">
          <h3 className="text-gray-800 font-bold mb-2">Letzter Gewinner</h3>
          <div className="flex items-center gap-4">
            <Trophy className="w-10 h-10 text-[#FFD700]" />
            <div>
              <p className="text-xl font-bold text-gray-800">{jackpotData.last_winner}</p>
              <p className="text-gray-500">
                Gewonnen: {jackpotData.last_won_amount || 0} Gebote (€{((jackpotData.last_won_amount || 0) * 0.50).toFixed(2)})
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* ==================== HAPPY HOUR SETTINGS ==================== */}
      <div className="glass-card rounded-xl p-4 sm:p-6 border border-orange-500/30 bg-gradient-to-r from-orange-500/10 to-yellow-500/10">
        <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <span className="text-2xl">⚡</span> Happy Hour Einstellungen
        </h3>
        <p className="text-gray-500 text-sm mb-4">
          Während der Happy Hour erhalten Kunden Bonus-Gebote bei jedem Kauf!
        </p>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <Label className="text-gray-500">Status</Label>
            <div className="flex items-center gap-3 mt-2">
              <button
                onClick={handleToggleHappyHour}
                className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                  happyHourConfig?.enabled ? 'bg-[#F59E0B]' : 'bg-[#374151]'
                }`}
              >
                <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                  happyHourConfig?.enabled ? 'translate-x-7' : 'translate-x-1'
                }`} />
              </button>
              <span className={happyHourConfig?.enabled ? 'text-[#F59E0B] font-bold' : 'text-gray-500'}>
                {happyHourConfig?.enabled ? 'AKTIV' : 'Inaktiv'}
              </span>
            </div>
          </div>
          
          <div>
            <Label className="text-gray-500">Bonus-Multiplikator</Label>
            <Select 
              value={String(happyHourConfig?.multiplier || 2)}
              onValueChange={handleSetMultiplier}
            >
              <SelectTrigger className="bg-white border-gray-200 text-gray-800 mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white border-gray-200">
                <SelectItem value="1.5" className="text-gray-800">1.5x Gebote</SelectItem>
                <SelectItem value="2" className="text-gray-800">2x Gebote (Standard)</SelectItem>
                <SelectItem value="2.5" className="text-gray-800">2.5x Gebote</SelectItem>
                <SelectItem value="3" className="text-gray-800">3x Gebote</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <Label className="text-gray-500">Startzeit (Uhr)</Label>
            <Input
              type="number"
              min={0}
              max={23}
              value={happyHourConfig?.start_hour || 18}
              onChange={(e) => handleSetHappyHourTime('start_hour', e.target.value)}
              className="bg-white border-gray-200 text-gray-800"
            />
          </div>
          <div>
            <Label className="text-gray-500">Endzeit (Uhr)</Label>
            <Input
              type="number"
              min={1}
              max={24}
              value={happyHourConfig?.end_hour || 20}
              onChange={(e) => handleSetHappyHourTime('end_hour', e.target.value)}
              className="bg-white border-gray-200 text-gray-800"
            />
          </div>
        </div>
        
        <p className="text-[#F59E0B] text-sm p-2 bg-[#F59E0B]/10 rounded">
          ⚡ Happy Hour: Täglich von <strong>{happyHourConfig?.start_hour || 18}:00</strong> bis <strong>{happyHourConfig?.end_hour || 20}:00</strong> Uhr - Kunden erhalten <strong>{happyHourConfig?.multiplier || 2}x</strong> Gebote!
        </p>
      </div>
      
      {/* ==================== LUCKY IN 50 SETTINGS ==================== */}
      <div className="glass-card rounded-xl p-4 sm:p-6 border border-green-500/30 bg-gradient-to-r from-green-500/10 to-emerald-500/10">
        <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <span className="text-2xl">🎁</span> Lucky in 50 Einstellungen
        </h3>
        <p className="text-gray-500 text-sm mb-4">
          Jedes 50. Gebot gewinnt automatisch Bonus-Gebote!
        </p>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <Label className="text-gray-500">Status</Label>
            <div className="flex items-center gap-3 mt-2">
              <button
                onClick={handleToggleLuckyIn50}
                className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                  luckyIn50Config?.enabled ? 'bg-[#10B981]' : 'bg-[#374151]'
                }`}
              >
                <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                  luckyIn50Config?.enabled ? 'translate-x-7' : 'translate-x-1'
                }`} />
              </button>
              <span className={luckyIn50Config?.enabled ? 'text-[#10B981] font-bold' : 'text-gray-500'}>
                {luckyIn50Config?.enabled ? 'AKTIV' : 'Inaktiv'}
              </span>
            </div>
          </div>
          
          <div>
            <Label className="text-gray-500">Preis (Gebote)</Label>
            <Select 
              value={String(luckyIn50Config?.prize_bids || 5)}
              onValueChange={handleSetLucky50Prize}
            >
              <SelectTrigger className="bg-white border-gray-200 text-gray-800 mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white border-gray-200">
                <SelectItem value="3" className="text-gray-800">3 Gebote</SelectItem>
                <SelectItem value="5" className="text-gray-800">5 Gebote (Standard)</SelectItem>
                <SelectItem value="10" className="text-gray-800">10 Gebote</SelectItem>
                <SelectItem value="15" className="text-gray-800">15 Gebote</SelectItem>
                <SelectItem value="20" className="text-gray-800">20 Gebote</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <p className="text-[#10B981] text-sm p-2 bg-[#10B981]/10 rounded">
          🎁 Jedes 50. Gebot gewinnt automatisch <strong>{luckyIn50Config?.prize_bids || 5} Bonus-Gebote</strong>!
        </p>
      </div>
    </div>
  );
}
