import { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { 
  Plus, Trash2, RefreshCw, Square, Bot, Play, Target, 
  Calendar, Clock, Edit, Star, Crown, Repeat, Zap, Sun, Moon
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export function AdminAuctions({ token, t, auctions, products, fetchData }) {
  const [newAuction, setNewAuction] = useState({
    product_id: '', starting_price: '0.01', bid_increment: '0.01', 
    duration_value: '10', duration_unit: 'minutes',
    start_time: '', end_time: '', scheduling_mode: 'immediate',
    bot_target_price: '', auto_restart: false, auto_restart_duration: '10',
    auction_type: 'day', is_vip_only: false
  });
  
  // Filter state for day/night auctions
  const [auctionFilter, setAuctionFilter] = useState('all'); // 'all', 'day', 'night'
  
  // Filter auctions based on selected filter
  const filteredAuctions = (auctions || []).filter(auction => {
    if (auctionFilter === 'all') return true;
    if (auctionFilter === 'day') return !auction.is_night_auction;
    if (auctionFilter === 'night') return auction.is_night_auction;
    return true;
  });

  const handleCreateAuction = async (e) => {
    e.preventDefault();
    try {
      // Parse duration value - ensure it's a number
      const durationValue = parseInt(newAuction.duration_value, 10) || 10;
      let durationSeconds = durationValue;
      
      // Convert to seconds based on unit
      switch (newAuction.duration_unit) {
        case 'seconds':
          durationSeconds = durationValue;
          break;
        case 'minutes':
          durationSeconds = durationValue * 60;
          break;
        case 'hours':
          durationSeconds = durationValue * 3600; // 60 * 60
          break;
        case 'days':
          durationSeconds = durationValue * 86400; // 60 * 60 * 24
          break;
        default:
          durationSeconds = durationValue * 60; // Default to minutes
      }
      
      console.log(`🕐 Auktionsdauer: ${durationValue} ${newAuction.duration_unit} = ${durationSeconds} Sekunden (${durationSeconds / 3600} Stunden)`);

      const auctionData = {
        product_id: newAuction.product_id,
        starting_price: parseFloat(newAuction.starting_price),
        bid_increment: parseFloat(newAuction.bid_increment),
        bot_target_price: newAuction.bot_target_price ? parseFloat(newAuction.bot_target_price) : null,
        is_night_auction: newAuction.auction_type === 'night',
        is_vip_only: newAuction.auction_type === 'vip' || newAuction.is_vip_only,
        is_auction_of_day: newAuction.auction_type === 'aotd'
      };

      if (newAuction.scheduling_mode === 'immediate') {
        auctionData.duration_seconds = durationSeconds;
      } else if (newAuction.scheduling_mode === 'scheduled') {
        if (newAuction.start_time) {
          auctionData.start_time = new Date(newAuction.start_time).toISOString();
          auctionData.duration_seconds = durationSeconds;
        }
      } else if (newAuction.scheduling_mode === 'custom') {
        if (newAuction.start_time) {
          auctionData.start_time = new Date(newAuction.start_time).toISOString();
        }
        if (newAuction.end_time) {
          auctionData.end_time = new Date(newAuction.end_time).toISOString();
        }
      }
      
      console.log('📦 Auktionsdaten:', JSON.stringify(auctionData, null, 2));

      const response = await axios.post(`${API}/admin/auctions`, auctionData, { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      toast.success('Auktion erstellt');
      
      // Set day/night mode
      if (newAuction.auction_type === 'night') {
        try {
          await axios.post(
            `${API}/admin/auctions/${response.data.id}/set-day-night?is_night=true`,
            {},
            { headers: { Authorization: `Bearer ${token}` } }
          );
        } catch (e) {
          console.error('Failed to set night mode:', e);
        }
      }
      
      // Set as Auction of the Day
      if (newAuction.auction_type === 'aotd') {
        try {
          await axios.post(
            `${API}/admin/auction-of-the-day/${response.data.id}`,
            {},
            { headers: { Authorization: `Bearer ${token}` } }
          );
          toast.success('🏆 Als Auktion des Tages gesetzt!');
        } catch (e) {
          console.error('Failed to set auction of the day:', e);
        }
      }
      
      if (newAuction.auto_restart) {
        try {
          await axios.put(
            `${API}/admin/auctions/${response.data.id}/auto-restart?duration_minutes=${parseInt(newAuction.auto_restart_duration) || 10}&bot_target_price=${newAuction.bot_target_price ? parseFloat(newAuction.bot_target_price) : 0}`,
            {},
            { headers: { Authorization: `Bearer ${token}` } }
          );
          toast.success('Auto-Neustart aktiviert');
        } catch (err) {
          console.error('Auto-restart setup failed:', err);
        }
      }
      
      if (newAuction.bot_target_price && parseFloat(newAuction.bot_target_price) > 0) {
        try {
          await axios.post(
            `${API}/admin/bots/bid-to-price?auction_id=${response.data.id}&target_price=${newAuction.bot_target_price}`,
            {},
            { headers: { Authorization: `Bearer ${token}` } }
          );
          toast.success(`Bots bieten bis €${newAuction.bot_target_price}`);
        } catch (err) {
          toast.error('Bot-Bieten fehlgeschlagen');
        }
      }
      
      setNewAuction({ 
        product_id: '', starting_price: '0.01', bid_increment: '0.01', 
        duration_value: '10', duration_unit: 'minutes',
        start_time: '', end_time: '', scheduling_mode: 'immediate',
        bot_target_price: '', auto_restart: false, auto_restart_duration: '10',
        auction_type: 'day', is_vip_only: false
      });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler');
    }
  };

  const handleExtendAuction = async (auctionId) => {
    const seconds = prompt('Zeit verlängern um (Sekunden):', '300');
    if (!seconds) return;
    try {
      await axios.put(`${API}/admin/auctions/${auctionId}`, {
        duration_seconds: parseInt(seconds)
      }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Auktion verlängert');
      fetchData();
    } catch (error) {
      toast.error('Fehler');
    }
  };

  const handleEndAuction = async (auctionId) => {
    try {
      await axios.post(`${API}/admin/auctions/${auctionId}/end`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Auktion beendet');
      fetchData();
    } catch (error) {
      toast.error('Fehler');
    }
  };

  const handleRestartAuction = async (auctionId) => {
    const duration = prompt('Dauer in Minuten:', '10');
    if (!duration) return;
    const botPrice = prompt('Bots bieten bis (€) - Bots bieten kontinuierlich bis zu diesem Preis.\nLeer lassen = Standard €2-3:', '');
    
    try {
      const params = new URLSearchParams();
      params.append('duration_seconds', parseInt(duration) * 60);
      if (botPrice && parseFloat(botPrice) > 0) {
        params.append('bot_target_price', parseFloat(botPrice));
      }
      
      const response = await axios.post(
        `${API}/admin/auctions/${auctionId}/restart?${params.toString()}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.bot_bidding) {
        toast.success(`Auktion neu gestartet! Bots: ${response.data.bot_bidding.bids_placed} Gebote`);
      } else {
        toast.success('Auktion neu gestartet!');
      }
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler');
    }
  };

  const handleDeleteAuction = async (auctionId) => {
    if (!confirm('Auktion wirklich löschen?')) return;
    try {
      await axios.delete(`${API}/admin/auctions/${auctionId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Auktion gelöscht');
      fetchData();
    } catch (error) {
      toast.error('Fehler');
    }
  };

  const handleUpdateBotTarget = async (auctionId, currentTarget) => {
    const newTarget = prompt(
      `Bots bieten bis (€):\n\nBots werden kontinuierlich bieten bis dieser Preis erreicht ist.\n0 = Standard €2-3\n\nNeuer Zielpreis:`,
      currentTarget || '0'
    );
    if (newTarget === null) return;
    
    try {
      const res = await axios.put(
        `${API}/admin/bots/target-price/${auctionId}?target_price=${parseFloat(newTarget) || 0}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(res.data.message);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler');
    }
  };

  const handleSetFeatured = async (auctionId, currentFeatured) => {
    try {
      await axios.put(
        `${API}/admin/auctions/${auctionId}/featured?is_featured=${!currentFeatured}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(currentFeatured ? 'VIP-Status entfernt' : 'Als VIP markiert');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler');
    }
  };

  const handleSetAuctionOfTheDay = async (auctionId) => {
    try {
      await axios.post(`${API}/admin/auction-of-the-day/${auctionId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('🏆 Als Auktion des Tages gesetzt!');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler');
    }
  };

  const handleSetAutoRestart = async (auctionId, currentDuration) => {
    const duration = prompt('Auto-Neustart Dauer (Minuten):', currentDuration || '10');
    if (!duration) return;
    
    try {
      await axios.put(
        `${API}/admin/auctions/${auctionId}/auto-restart?duration_minutes=${parseInt(duration)}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Auto-Neustart konfiguriert');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler');
    }
  };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-white">{t('admin.manageAuctions')}</h1>
      
      {/* Create Auction Form */}
      <div className="glass-card rounded-xl p-6">
        <h3 className="text-lg font-bold text-white mb-4">{t('admin.newAuction')}</h3>
        <form onSubmit={handleCreateAuction} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-white">{t('admin.product')}</Label>
              <Select value={newAuction.product_id} onValueChange={(value) => setNewAuction({...newAuction, product_id: value})}>
                <SelectTrigger className="bg-[#181824] border-white/10 text-white">
                  <SelectValue placeholder={t('admin.selectProduct')} />
                </SelectTrigger>
                <SelectContent className="bg-[#181824] border-white/10">
                  {(products || []).map((product) => (
                    <SelectItem key={product.id} value={product.id} className="text-white hover:bg-white/10">
                      {product.name} (€{product.retail_price})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-white">{t('admin.startPrice')}</Label>
              <Input type="number" step="0.01" value={newAuction.starting_price} 
                onChange={(e) => setNewAuction({...newAuction, starting_price: e.target.value})} 
                required className="bg-[#181824] border-white/10 text-white" />
            </div>
            <div className="space-y-2">
              <Label className="text-white">{t('admin.bidIncrement')}</Label>
              <Input type="number" step="0.01" value={newAuction.bid_increment} 
                onChange={(e) => setNewAuction({...newAuction, bid_increment: e.target.value})} 
                required className="bg-[#181824] border-white/10 text-white" />
            </div>
            <div className="space-y-2">
              <Label className="text-white">Zeitplanung</Label>
              <Select value={newAuction.scheduling_mode} onValueChange={(value) => setNewAuction({...newAuction, scheduling_mode: value})}>
                <SelectTrigger className="bg-[#181824] border-white/10 text-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#181824] border-white/10">
                  <SelectItem value="immediate" className="text-white hover:bg-white/10">Sofort starten</SelectItem>
                  <SelectItem value="scheduled" className="text-white hover:bg-white/10">Geplanter Start</SelectItem>
                  <SelectItem value="custom" className="text-white hover:bg-white/10">Benutzerdefiniert</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Duration Settings */}
          <div className="p-4 rounded-lg bg-[#181824] space-y-4">
            <div className="flex items-center gap-2 text-[#06B6D4]">
              <Calendar className="w-5 h-5" />
              <span className="font-medium">Zeiteinstellungen</span>
            </div>

            {(newAuction.scheduling_mode === 'immediate' || newAuction.scheduling_mode === 'scheduled') && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {newAuction.scheduling_mode === 'scheduled' && (
                  <div className="space-y-2">
                    <Label className="text-white flex items-center gap-2">
                      <Clock className="w-4 h-4" /> Startzeit
                    </Label>
                    <Input type="datetime-local" value={newAuction.start_time} 
                      onChange={(e) => setNewAuction({...newAuction, start_time: e.target.value})} 
                      required className="bg-[#0F0F16] border-white/10 text-white" />
                  </div>
                )}
                <div className="space-y-2">
                  <Label className="text-white">{t('admin.duration')}</Label>
                  <div className="flex gap-2">
                    <Input type="number" min="1" value={newAuction.duration_value} 
                      onChange={(e) => setNewAuction({...newAuction, duration_value: e.target.value})} 
                      required className="bg-[#0F0F16] border-white/10 text-white w-24" />
                    <Select value={newAuction.duration_unit} onValueChange={(value) => setNewAuction({...newAuction, duration_unit: value})}>
                      <SelectTrigger className="bg-[#0F0F16] border-white/10 text-white flex-1"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-[#181824] border-white/10">
                        <SelectItem value="seconds" className="text-white hover:bg-white/10">Sekunden</SelectItem>
                        <SelectItem value="minutes" className="text-white hover:bg-white/10">Minuten</SelectItem>
                        <SelectItem value="hours" className="text-white hover:bg-white/10">Stunden</SelectItem>
                        <SelectItem value="days" className="text-white hover:bg-white/10">Tage</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-[#94A3B8] text-xs">Mindestens 5 Minuten (300 Sekunden)</p>
                </div>
              </div>
            )}

            {newAuction.scheduling_mode === 'custom' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-white flex items-center gap-2">
                    <Clock className="w-4 h-4" /> Startzeit
                  </Label>
                  <Input type="datetime-local" value={newAuction.start_time} 
                    onChange={(e) => setNewAuction({...newAuction, start_time: e.target.value})} 
                    className="bg-[#0F0F16] border-white/10 text-white" />
                </div>
                <div className="space-y-2">
                  <Label className="text-white flex items-center gap-2">
                    <Clock className="w-4 h-4" /> Endzeit
                  </Label>
                  <Input type="datetime-local" value={newAuction.end_time} 
                    onChange={(e) => setNewAuction({...newAuction, end_time: e.target.value})} 
                    required className="bg-[#0F0F16] border-white/10 text-white" />
                </div>
              </div>
            )}
          </div>

          {/* Bot Settings */}
          <div className="p-4 rounded-lg bg-[#181824] space-y-4">
            <div className="flex items-center gap-2 text-[#FFD700]">
              <Bot className="w-5 h-5" />
              <span className="font-medium">Bot-Einstellungen</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-white">Bots bieten bis (€)</Label>
                <Input type="number" step="0.10" min="0" placeholder="z.B. 20.00"
                  value={newAuction.bot_target_price} 
                  onChange={(e) => setNewAuction({...newAuction, bot_target_price: e.target.value})} 
                  className="bg-[#0F0F16] border-white/10 text-white" />
                <p className="text-[#94A3B8] text-sm">Bots bieten kontinuierlich bis dieser Preis erreicht ist. Leer = Standard €2-3.</p>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-lg bg-[#0F0F16]">
                <Zap className="w-8 h-8 text-[#FFD700]" />
                <div>
                  <p className="text-white font-medium">Inkrement: €{newAuction.bid_increment}</p>
                  <p className="text-[#94A3B8] text-sm">€0.50 pro Gebot</p>
                </div>
              </div>
            </div>
          </div>

          {/* Auction Type Settings */}
          <div className="p-4 rounded-lg bg-[#181824] space-y-4">
            <div className="flex items-center gap-2 text-[#7C3AED]">
              <Sun className="w-5 h-5" />
              <span className="font-medium">Auktionstyp</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <button
                type="button"
                onClick={() => setNewAuction({...newAuction, auction_type: 'day', is_vip_only: false})}
                className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                  newAuction.auction_type === 'day'
                    ? 'border-[#F59E0B] bg-[#F59E0B]/10'
                    : 'border-[#2D2D3D] bg-[#0F0F16] hover:border-[#3D3D4D]'
                }`}
              >
                <Sun className={`w-8 h-8 ${newAuction.auction_type === 'day' ? 'text-[#F59E0B]' : 'text-[#94A3B8]'}`} />
                <span className={`font-bold text-sm ${newAuction.auction_type === 'day' ? 'text-white' : 'text-[#94A3B8]'}`}>
                  Tagesaktion
                </span>
                <span className="text-xs text-[#666]">06:00 - 23:30</span>
              </button>

              <button
                type="button"
                onClick={() => setNewAuction({...newAuction, auction_type: 'night', is_vip_only: false})}
                className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                  newAuction.auction_type === 'night'
                    ? 'border-[#7C3AED] bg-[#7C3AED]/10'
                    : 'border-[#2D2D3D] bg-[#0F0F16] hover:border-[#3D3D4D]'
                }`}
              >
                <Moon className={`w-8 h-8 ${newAuction.auction_type === 'night' ? 'text-[#7C3AED]' : 'text-[#94A3B8]'}`} />
                <span className={`font-bold text-sm ${newAuction.auction_type === 'night' ? 'text-white' : 'text-[#94A3B8]'}`}>
                  Nachtaktion
                </span>
                <span className="text-xs text-[#666]">23:30 - 06:00</span>
              </button>

              <button
                type="button"
                onClick={() => setNewAuction({...newAuction, auction_type: 'vip', is_vip_only: true})}
                className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                  newAuction.auction_type === 'vip'
                    ? 'border-[#FFD700] bg-[#FFD700]/10'
                    : 'border-[#2D2D3D] bg-[#0F0F16] hover:border-[#3D3D4D]'
                }`}
              >
                <Crown className={`w-8 h-8 ${newAuction.auction_type === 'vip' ? 'text-[#FFD700]' : 'text-[#94A3B8]'}`} />
                <span className={`font-bold text-sm ${newAuction.auction_type === 'vip' ? 'text-white' : 'text-[#94A3B8]'}`}>
                  VIP-Aktion
                </span>
                <span className="text-xs text-[#666]">Nur VIP</span>
              </button>

              <button
                type="button"
                onClick={() => setNewAuction({...newAuction, auction_type: 'aotd', is_vip_only: false})}
                className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                  newAuction.auction_type === 'aotd'
                    ? 'border-[#EF4444] bg-[#EF4444]/10'
                    : 'border-[#2D2D3D] bg-[#0F0F16] hover:border-[#3D3D4D]'
                }`}
              >
                <Star className={`w-8 h-8 ${newAuction.auction_type === 'aotd' ? 'text-[#EF4444]' : 'text-[#94A3B8]'}`} />
                <span className={`font-bold text-sm ${newAuction.auction_type === 'aotd' ? 'text-white' : 'text-[#94A3B8]'}`}>
                  Aktion des Tages
                </span>
                <span className="text-xs text-[#666]">Hervorgehoben</span>
              </button>
            </div>
          </div>

          {/* Auto-Restart Settings */}
          <div className="p-4 rounded-lg bg-[#181824] space-y-4">
            <div className="flex items-center gap-2 text-[#7C3AED]">
              <Repeat className="w-5 h-5" />
              <span className="font-medium">Auto-Wiederholung</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <input type="checkbox" id="auto_restart" checked={newAuction.auto_restart}
                  onChange={(e) => setNewAuction({...newAuction, auto_restart: e.target.checked})}
                  className="w-5 h-5 rounded border-white/10 bg-[#0F0F16] text-[#7C3AED]" />
                <Label htmlFor="auto_restart" className="text-white cursor-pointer">
                  Automatisch neu starten
                </Label>
              </div>
              {newAuction.auto_restart && (
                <div className="space-y-2">
                  <Label className="text-white">Dauer pro Durchlauf (Min)</Label>
                  <Input type="number" min="1" value={newAuction.auto_restart_duration} 
                    onChange={(e) => setNewAuction({...newAuction, auto_restart_duration: e.target.value})} 
                    className="bg-[#0F0F16] border-white/10 text-white" />
                </div>
              )}
            </div>
          </div>

          <Button type="submit" className="btn-primary">
            <Plus className="w-4 h-4 mr-2" />{t('admin.createAuction')}
          </Button>
        </form>
      </div>
      
      {/* Auctions Section */}
      <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-slate-100">
        {/* Filter Tabs for Day/Night */}
        <div className="p-4 border-b border-slate-100 flex flex-wrap items-center gap-2">
          <span className="text-slate-500 text-sm mr-2">Filter:</span>
          <button
            onClick={() => setAuctionFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              auctionFilter === 'all' 
                ? 'bg-violet-500 text-white' 
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            Alle ({(auctions || []).length})
          </button>
          <button
            onClick={() => setAuctionFilter('day')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1 ${
              auctionFilter === 'day' 
                ? 'bg-amber-500 text-white' 
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            <Sun className="w-4 h-4" />
            Tag ({(auctions || []).filter(a => !a.is_night_auction).length})
          </button>
          <button
            onClick={() => setAuctionFilter('night')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1 ${
              auctionFilter === 'night' 
                ? 'bg-violet-500 text-white' 
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            <Moon className="w-4 h-4" />
            Nacht ({(auctions || []).filter(a => a.is_night_auction).length})
          </button>
        </div>
        
        {/* Mobile Card View */}
        <div className="md:hidden space-y-3 p-4">
          {filteredAuctions.map((auction) => {
            const botTarget = auction.bot_target_price || 0;
            const currentPrice = auction.current_price || 0;
            const botActive = botTarget > 0 && currentPrice < botTarget && auction.status === 'active';
            const targetReached = botTarget > 0 && currentPrice >= botTarget;
            
            return (
              <div key={auction.id} className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                {/* Header with product name and status */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 truncate">{auction.product?.name || 'N/A'}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {auction.is_night_auction ? (
                        <span className="flex items-center gap-1 text-violet-600 text-xs">
                          <Moon className="w-3 h-3" />Nacht
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-amber-600 text-xs">
                          <Sun className="w-3 h-3" />Tag
                        </span>
                      )}
                      {auction.auto_restart?.enabled && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-violet-100 text-violet-600">
                          AUTO
                        </span>
                      )}
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-bold flex-shrink-0 ${
                    auction.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 
                    auction.status === 'scheduled' ? 'bg-amber-100 text-amber-700' : 
                    'bg-red-100 text-red-700'
                  }`}>
                    {auction.status === 'active' ? t('admin.active') : 
                     auction.status === 'scheduled' ? 'Geplant' : t('admin.ended')}
                  </span>
                </div>
                
                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="bg-white rounded-lg p-2 text-center">
                    <p className="text-xs text-slate-400">Preis</p>
                    <p className="text-lg font-bold text-cyan-600 font-mono">€{currentPrice.toFixed(2)}</p>
                  </div>
                  <div className="bg-white rounded-lg p-2 text-center">
                    <p className="text-xs text-slate-400">Gebote</p>
                    <p className="text-lg font-bold text-slate-700">{auction.total_bids}</p>
                  </div>
                  <div className="bg-white rounded-lg p-2 text-center">
                    <p className="text-xs text-slate-400">Bot-Ziel</p>
                    {botTarget > 0 ? (
                      <p className={`text-sm font-bold ${targetReached ? 'text-emerald-600' : 'text-amber-600'}`}>
                        €{botTarget.toFixed(2)}
                        {botActive && <span className="text-[8px] ml-1">🔄</span>}
                      </p>
                    ) : (
                      <p className="text-sm text-slate-400">-</p>
                    )}
                  </div>
                </div>
                
                {/* Time Info */}
                <div className="text-xs text-slate-500 mb-3 bg-white rounded-lg p-2">
                  <div className="flex items-center justify-between">
                    <span>Ende:</span>
                    <span className="font-medium text-slate-700">
                      {new Date(auction.end_time).toLocaleString('de-DE', {dateStyle: 'short', timeStyle: 'short'})}
                    </span>
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div className="flex flex-wrap gap-1">
                  <Button size="sm" variant="outline" className="border-amber-200 text-amber-600"
                    onClick={() => handleSetAuctionOfTheDay(auction.id)} title="Auktion des Tages">
                    <Crown className="w-3 h-3" />
                  </Button>
                  <Button size="sm" variant="outline" 
                    className={auction.is_featured ? "border-yellow-300 text-yellow-600 bg-yellow-50" : "border-slate-200 text-slate-400"}
                    onClick={() => handleSetFeatured(auction.id, auction.is_featured)} title="VIP markieren">
                    <Star className={`w-3 h-3 ${auction.is_featured ? 'fill-current' : ''}`} />
                  </Button>
                  <Button size="sm" variant="outline" 
                    className={auction.auto_restart?.enabled ? "border-violet-300 text-violet-600 bg-violet-50" : "border-slate-200 text-slate-400"}
                    onClick={() => handleSetAutoRestart(auction.id, auction.auto_restart?.duration_minutes || 10)} 
                    title="Auto-Neustart">
                    <Repeat className="w-3 h-3" />
                  </Button>
                  {(auction.status === 'active' || auction.status === 'scheduled') && (
                    <>
                      <Button size="sm" variant="outline" className="border-amber-200 text-amber-600" 
                        onClick={() => handleUpdateBotTarget(auction.id, botTarget)} title="Bot-Ziel">
                        <Target className="w-3 h-3" />
                      </Button>
                      <Button size="sm" variant="outline" className="border-cyan-200 text-cyan-600" 
                        onClick={() => handleExtendAuction(auction.id)} title="Verlängern">
                        <RefreshCw className="w-3 h-3" />
                      </Button>
                      <Button size="sm" variant="outline" className="border-orange-200 text-orange-600" 
                        onClick={() => handleEndAuction(auction.id)} title="Beenden">
                        <Square className="w-3 h-3" />
                      </Button>
                    </>
                  )}
                  {auction.status === 'ended' && (
                    <Button size="sm" variant="outline" className="border-emerald-200 text-emerald-600" 
                      onClick={() => handleRestartAuction(auction.id)} title="Neu starten">
                      <Play className="w-3 h-3" />
                    </Button>
                  )}
                  <Button size="sm" variant="destructive" 
                    onClick={() => handleDeleteAuction(auction.id)} className="ml-auto">
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            );
          })}
          {filteredAuctions.length === 0 && (
            <p className="text-center text-slate-400 py-8">Keine Auktionen gefunden</p>
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-4 py-3 text-left text-slate-600 font-medium">{t('admin.product')}</th>
                <th className="px-4 py-3 text-left text-slate-600 font-medium">Typ</th>
                <th className="px-4 py-3 text-left text-slate-600 font-medium">{t('admin.price')}</th>
                <th className="px-4 py-3 text-left text-slate-600 font-medium">
                  <div className="flex items-center gap-1">
                    <Bot className="w-4 h-4 text-amber-500" /><span>Bot-Ziel</span>
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-slate-600 font-medium">{t('admin.bids')}</th>
                <th className="px-4 py-3 text-left text-slate-600 font-medium">Zeit</th>
                <th className="px-4 py-3 text-left text-slate-600 font-medium">{t('admin.status')}</th>
                <th className="px-4 py-3 text-left text-slate-600 font-medium">{t('admin.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAuctions.map((auction) => {
                const botTarget = auction.bot_target_price || 0;
                const currentPrice = auction.current_price || 0;
                const botActive = botTarget > 0 && currentPrice < botTarget && auction.status === 'active';
                const targetReached = botTarget > 0 && currentPrice >= botTarget;
                
                return (
                  <tr key={auction.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-800 font-medium">{auction.product?.name || 'N/A'}</td>
                    <td className="px-4 py-3">
                      {auction.is_night_auction ? (
                        <span className="flex items-center gap-1 text-violet-600">
                          <Moon className="w-4 h-4" />
                          <span className="text-xs">Nacht</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-amber-600">
                          <Sun className="w-4 h-4" />
                          <span className="text-xs">Tag</span>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-cyan-600 font-mono font-bold">€{currentPrice.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleUpdateBotTarget(auction.id, botTarget)} 
                        className="flex items-center gap-2 group">
                        {botTarget > 0 ? (
                          <div className="flex items-center gap-1">
                            <span className={`font-mono ${targetReached ? 'text-emerald-600' : 'text-amber-600'}`}>
                              €{botTarget.toFixed(2)}
                            </span>
                            {botActive && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-600 animate-pulse">
                                AKTIV
                              </span>
                            )}
                            {targetReached && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-600">
                                ERREICHT
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                        <Edit className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100" />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-slate-700 font-medium">{auction.total_bids}</td>
                    <td className="px-4 py-3 text-slate-500 text-sm">
                      {auction.start_time && (
                        <div className="flex items-center gap-1">
                          <span className="text-violet-600">Start:</span>
                          <span>{new Date(auction.start_time).toLocaleString('de-DE', {dateStyle: 'short', timeStyle: 'short'})}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <span className="text-red-500">Ende:</span>
                        <span>{new Date(auction.end_time).toLocaleString('de-DE', {dateStyle: 'short', timeStyle: 'short'})}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                        auction.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 
                        auction.status === 'scheduled' ? 'bg-amber-100 text-amber-700' : 
                        'bg-red-100 text-red-700'
                      }`}>
                        {auction.status === 'active' ? t('admin.active') : 
                         auction.status === 'scheduled' ? 'Geplant' : t('admin.ended')}
                      </span>
                      {auction.auto_restart?.enabled && (
                        <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-violet-100 text-violet-600">
                          AUTO
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="ghost" className="text-amber-500 hover:bg-amber-50"
                          onClick={() => handleSetAuctionOfTheDay(auction.id)} title="Auktion des Tages">
                          <Crown className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" 
                          className={`${auction.is_featured ? 'text-yellow-500 bg-yellow-50' : 'text-slate-400'} hover:bg-yellow-50`}
                          onClick={() => handleSetFeatured(auction.id, auction.is_featured)} title="VIP markieren">
                          <Star className={`w-4 h-4 ${auction.is_featured ? 'fill-current' : ''}`} />
                        </Button>
                        <Button size="sm" variant="ghost" 
                          className={`${auction.auto_restart?.enabled ? 'text-violet-600 bg-violet-50' : 'text-slate-400'} hover:bg-violet-50`}
                          onClick={() => handleSetAutoRestart(auction.id, auction.auto_restart?.duration_minutes || 10)} 
                          title="Auto-Neustart">
                          <Repeat className="w-4 h-4" />
                        </Button>
                        {(auction.status === 'active' || auction.status === 'scheduled') && (
                          <>
                            <Button size="sm" variant="ghost" className="text-amber-500 hover:bg-amber-50" 
                              onClick={() => handleUpdateBotTarget(auction.id, botTarget)} title="Bot-Ziel">
                              <Target className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="ghost" className="text-cyan-600 hover:bg-cyan-50" 
                              onClick={() => handleExtendAuction(auction.id)} title="Verlängern">
                              <RefreshCw className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="ghost" className="text-orange-500 hover:bg-orange-50" 
                              onClick={() => handleEndAuction(auction.id)} title="Beenden">
                              <Square className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                        {auction.status === 'ended' && (
                          <Button size="sm" variant="ghost" className="text-emerald-500 hover:bg-emerald-50" 
                            onClick={() => handleRestartAuction(auction.id)} title="Neu starten">
                            <Play className="w-4 h-4" />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="text-red-500 hover:bg-red-50" 
                          onClick={() => handleDeleteAuction(auction.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
