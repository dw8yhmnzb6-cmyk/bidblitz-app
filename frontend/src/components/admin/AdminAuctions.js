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

  const handleCreateAuction = async (e) => {
    e.preventDefault();
    try {
      let durationSeconds = parseInt(newAuction.duration_value);
      if (newAuction.duration_unit === 'minutes') {
        durationSeconds = durationSeconds * 60;
      } else if (newAuction.duration_unit === 'hours') {
        durationSeconds = durationSeconds * 60 * 60;
      } else if (newAuction.duration_unit === 'days') {
        durationSeconds = durationSeconds * 60 * 60 * 24;
      }

      const auctionData = {
        product_id: newAuction.product_id,
        starting_price: parseFloat(newAuction.starting_price),
        bid_increment: parseFloat(newAuction.bid_increment),
        bot_target_price: newAuction.bot_target_price ? parseFloat(newAuction.bot_target_price) : null,
        is_night_auction: newAuction.auction_type === 'night',
        is_vip_only: newAuction.auction_type === 'vip' || newAuction.is_vip_only
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
                        <SelectItem value="minutes" className="text-white hover:bg-white/10">Minuten</SelectItem>
                        <SelectItem value="hours" className="text-white hover:bg-white/10">Stunden</SelectItem>
                        <SelectItem value="days" className="text-white hover:bg-white/10">Tage</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
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
                <Label className="text-white">Bot-Mindestpreis (€)</Label>
                <Input type="number" step="0.10" min="0" placeholder="z.B. 2.50"
                  value={newAuction.bot_target_price} 
                  onChange={(e) => setNewAuction({...newAuction, bot_target_price: e.target.value})} 
                  className="bg-[#0F0F16] border-white/10 text-white" />
                <p className="text-[#94A3B8] text-sm">Bots bieten bis zu diesem Preis. Leer = keine Bots.</p>
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
      
      {/* Auctions Table */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#181824]">
              <tr>
                <th className="px-4 py-3 text-left text-[#94A3B8] font-medium">{t('admin.product')}</th>
                <th className="px-4 py-3 text-left text-[#94A3B8] font-medium">{t('admin.price')}</th>
                <th className="px-4 py-3 text-left text-[#94A3B8] font-medium">
                  <div className="flex items-center gap-1">
                    <Bot className="w-4 h-4 text-[#FFD700]" /><span>Bot-Ziel</span>
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-[#94A3B8] font-medium">{t('admin.bids')}</th>
                <th className="px-4 py-3 text-left text-[#94A3B8] font-medium">Zeit</th>
                <th className="px-4 py-3 text-left text-[#94A3B8] font-medium">{t('admin.status')}</th>
                <th className="px-4 py-3 text-left text-[#94A3B8] font-medium">{t('admin.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {(auctions || []).map((auction) => {
                const botTarget = auction.bot_target_price || 0;
                const currentPrice = auction.current_price || 0;
                const botActive = botTarget > 0 && currentPrice < botTarget && auction.status === 'active';
                const targetReached = botTarget > 0 && currentPrice >= botTarget;
                
                return (
                  <tr key={auction.id} className="hover:bg-white/5">
                    <td className="px-4 py-3 text-white">{auction.product?.name || 'N/A'}</td>
                    <td className="px-4 py-3 text-[#06B6D4] font-mono">€{currentPrice.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleUpdateBotTarget(auction.id, botTarget)} 
                        className="flex items-center gap-2 group">
                        {botTarget > 0 ? (
                          <div className="flex items-center gap-1">
                            <span className={`font-mono ${targetReached ? 'text-[#10B981]' : 'text-[#FFD700]'}`}>
                              €{botTarget.toFixed(2)}
                            </span>
                            {botActive && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#FFD700]/20 text-[#FFD700] animate-pulse">
                                AKTIV
                              </span>
                            )}
                            {targetReached && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#10B981]/20 text-[#10B981]">
                                ERREICHT
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[#94A3B8]">-</span>
                        )}
                        <Edit className="w-3 h-3 text-[#94A3B8] opacity-0 group-hover:opacity-100" />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-white">{auction.total_bids}</td>
                    <td className="px-4 py-3 text-[#94A3B8] text-sm">
                      {auction.start_time && (
                        <div className="flex items-center gap-1">
                          <span className="text-[#7C3AED]">Start:</span>
                          <span>{new Date(auction.start_time).toLocaleString('de-DE', {dateStyle: 'short', timeStyle: 'short'})}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <span className="text-[#EF4444]">Ende:</span>
                        <span>{new Date(auction.end_time).toLocaleString('de-DE', {dateStyle: 'short', timeStyle: 'short'})}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                        auction.status === 'active' ? 'bg-[#10B981]/20 text-[#10B981]' : 
                        auction.status === 'scheduled' ? 'bg-[#F59E0B]/20 text-[#F59E0B]' : 
                        'bg-[#EF4444]/20 text-[#EF4444]'
                      }`}>
                        {auction.status === 'active' ? t('admin.active') : 
                         auction.status === 'scheduled' ? 'Geplant' : t('admin.ended')}
                      </span>
                      {auction.auto_restart?.enabled && (
                        <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#7C3AED]/20 text-[#7C3AED]">
                          AUTO
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="ghost" className="text-amber-500 hover:bg-amber-500/10"
                          onClick={() => handleSetAuctionOfTheDay(auction.id)} title="Auktion des Tages">
                          <Crown className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" 
                          className={`${auction.is_featured ? 'text-yellow-400 bg-yellow-400/20' : 'text-gray-400'} hover:bg-yellow-400/10`}
                          onClick={() => handleSetFeatured(auction.id, auction.is_featured)} title="VIP markieren">
                          <Star className={`w-4 h-4 ${auction.is_featured ? 'fill-current' : ''}`} />
                        </Button>
                        <Button size="sm" variant="ghost" 
                          className={`${auction.auto_restart?.enabled ? 'text-[#7C3AED] bg-[#7C3AED]/20' : 'text-gray-400'} hover:bg-[#7C3AED]/10`}
                          onClick={() => handleSetAutoRestart(auction.id, auction.auto_restart?.duration_minutes || 10)} 
                          title="Auto-Neustart">
                          <Repeat className="w-4 h-4" />
                        </Button>
                        {(auction.status === 'active' || auction.status === 'scheduled') && (
                          <>
                            <Button size="sm" variant="ghost" className="text-[#FFD700] hover:bg-[#FFD700]/10" 
                              onClick={() => handleUpdateBotTarget(auction.id, botTarget)} title="Bot-Ziel">
                              <Target className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="ghost" className="text-[#06B6D4] hover:bg-[#06B6D4]/10" 
                              onClick={() => handleExtendAuction(auction.id)} title="Verlängern">
                              <RefreshCw className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="ghost" className="text-[#F59E0B] hover:bg-[#F59E0B]/10" 
                              onClick={() => handleEndAuction(auction.id)} title="Beenden">
                              <Square className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                        {auction.status === 'ended' && (
                          <Button size="sm" variant="ghost" className="text-[#10B981] hover:bg-[#10B981]/10" 
                            onClick={() => handleRestartAuction(auction.id)} title="Neu starten">
                            <Play className="w-4 h-4" />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="text-[#EF4444] hover:bg-[#EF4444]/10" 
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
