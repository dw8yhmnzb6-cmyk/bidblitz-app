// Admin Bots Tab Component
import { Bot, Target, Plus, Play, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

export default function AdminBots({ 
  bots, 
  auctions,
  newBot, 
  setNewBot, 
  botBid,
  setBotBid,
  handleCreateBot, 
  handleSeedBots,
  handleDeleteBot,
  handleBotBidToPrice,
  handleBotQuickBids,
  t 
}) {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Bot className="w-8 h-8 text-[#7C3AED]" />
          Bot-System (Preis erhöhen)
        </h1>
        <Button onClick={handleSeedBots} variant="outline" className="border-[#7C3AED]/50 text-[#7C3AED] hover:bg-[#7C3AED]/10">
          <Plus className="w-4 h-4 mr-2" />20 Standard-Bots erstellen
        </Button>
      </div>

      {/* Quick Bot Actions */}
      <div className="glass-card rounded-xl p-6">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Target className="w-5 h-5 text-[#06B6D4]" />
          Preis automatisch erhöhen
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label className="text-white">Auktion wählen</Label>
            <Select value={botBid.auction_id} onValueChange={(value) => setBotBid({...botBid, auction_id: value})}>
              <SelectTrigger className="bg-[#181824] border-white/10 text-white">
                <SelectValue placeholder="Auktion wählen..." />
              </SelectTrigger>
              <SelectContent className="bg-[#181824] border-white/10">
                {(auctions || []).filter(a => a.status === 'active').map((auction) => (
                  <SelectItem key={auction.id} value={auction.id} className="text-white hover:bg-white/10">
                    {auction.product?.name} (€{auction.current_price?.toFixed(2)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-white">Zielpreis (€)</Label>
            <Input
              type="number"
              step="0.01"
              value={botBid.target_price}
              onChange={(e) => setBotBid({...botBid, target_price: e.target.value})}
              placeholder="z.B. 5.00"
              className="bg-[#181824] border-white/10 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-white">&nbsp;</Label>
            <Button onClick={handleBotBidToPrice} className="w-full bg-gradient-to-r from-[#7C3AED] to-[#06B6D4] hover:opacity-90">
              <Play className="w-4 h-4 mr-2" />
              Preis erhöhen
            </Button>
          </div>
        </div>
      </div>

      {/* Active Auctions with Quick Bot Actions */}
      <div className="glass-card rounded-xl p-6">
        <h3 className="text-lg font-bold text-white mb-4">Aktive Auktionen - Schnellaktionen</h3>
        <div className="space-y-4">
          {(auctions || []).filter(a => a.status === 'active').map((auction) => (
            <div key={auction.id} className="flex items-center justify-between p-4 rounded-lg bg-[#181824]">
              <div className="flex items-center gap-4">
                <img src={auction.product?.image_url} alt="" className="w-12 h-12 rounded-lg object-cover" />
                <div>
                  <p className="text-white font-medium">{auction.product?.name}</p>
                  <p className="text-[#06B6D4] font-mono">€{auction.current_price?.toFixed(2)} • {auction.total_bids} Gebote</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={() => handleBotQuickBids(auction.id, 1)} className="bg-[#181824] border border-white/10 hover:bg-white/10 text-white">+1</Button>
                <Button size="sm" onClick={() => handleBotQuickBids(auction.id, 5)} className="bg-[#181824] border border-white/10 hover:bg-white/10 text-white">+5</Button>
                <Button size="sm" onClick={() => handleBotQuickBids(auction.id, 10)} className="bg-[#181824] border border-white/10 hover:bg-white/10 text-white">+10</Button>
                <Button size="sm" onClick={() => handleBotQuickBids(auction.id, 50)} className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white">+50</Button>
              </div>
            </div>
          ))}
          {(auctions || []).filter(a => a.status === 'active').length === 0 && (
            <p className="text-center text-[#94A3B8] py-8">Keine aktiven Auktionen</p>
          )}
        </div>
      </div>

      {/* Bot List */}
      <div className="glass-card rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <h3 className="text-lg font-bold text-white">Verfügbare Bots ({(bots || []).length})</h3>
          
          {/* Bot Creation Form */}
          <form onSubmit={handleCreateBot} className="flex gap-2 w-full md:w-auto">
            <Input
              value={newBot.name}
              onChange={(e) => setNewBot({name: e.target.value})}
              placeholder="Neuer Bot-Name (z.B. Bardh K.)"
              className="bg-[#181824] border-white/10 text-white flex-1 md:w-64"
              required
            />
            <Button type="submit" className="bg-gradient-to-r from-[#7C3AED] to-[#EC4899] hover:opacity-90 whitespace-nowrap">
              <Plus className="w-4 h-4 mr-1" />
              Bot erstellen
            </Button>
          </form>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {(bots || []).map((bot) => (
            <div key={bot.id} className="flex items-center justify-between p-3 rounded-lg bg-[#181824] group">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#06B6D4] flex items-center justify-center text-white text-xs font-bold">
                  {bot.name.charAt(0)}
                </div>
                <div>
                  <p className="text-white text-sm font-medium">{bot.name}</p>
                  <p className="text-[#94A3B8] text-xs">{bot.total_bids_placed} Gebote</p>
                </div>
              </div>
              <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100 text-[#EF4444] hover:bg-[#EF4444]/10" onClick={() => handleDeleteBot(bot.id)}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
        {(bots || []).length === 0 && (
          <p className="text-center text-[#94A3B8] py-8">Keine Bots erstellt. Klicken Sie oben auf "20 Standard-Bots erstellen"</p>
        )}
      </div>
    </div>
  );
}
