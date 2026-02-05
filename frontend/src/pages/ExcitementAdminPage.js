import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { 
  Trophy, Gift, Zap, Clock, Sparkles, Target, 
  Plus, RefreshCw, TrendingUp, Users
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function ExcitementAdminPage() {
  const { token } = useAuth();
  const [status, setStatus] = useState(null);
  const [auctions, setAuctions] = useState([]);
  const [products, setProducts] = useState([]);
  const [luckyHistory, setLuckyHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  // Form states
  const [jackpotForm, setJackpotForm] = useState({
    auction_id: '',
    initial_jackpot: 100,
    bid_contribution: 1
  });
  const [turboForm, setTurboForm] = useState({
    product_id: '',
    duration_seconds: 30
  });
  const [mysteryForm, setMysteryForm] = useState({
    product_id: '',
    hint: 'Wert: €100-€500'
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch excitement status
      const statusRes = await fetch(`${API}/api/excitement/status`);
      setStatus(await statusRes.json());

      // Fetch active auctions
      const auctionsRes = await fetch(`${API}/api/auctions`);
      const auctionsData = await auctionsRes.json();
      setAuctions(auctionsData.filter(a => a.status === 'active' || a.status === 'scheduled'));

      // Fetch products
      const productsRes = await fetch(`${API}/api/products`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProducts(await productsRes.json());

      // Fetch lucky bid history
      const luckyRes = await fetch(`${API}/api/excitement/lucky-bid/history`);
      const luckyData = await luckyRes.json();
      setLuckyHistory(luckyData.winners || []);
    } catch (err) {
      console.error('Fetch error:', err);
    }
  };

  const createJackpotAuction = async () => {
    if (!jackpotForm.auction_id) {
      toast.error('Bitte Auktion auswählen');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/excitement/jackpot/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(jackpotForm)
      });
      if (res.ok) {
        toast.success('🏆 Jackpot-Auktion erstellt!');
        setJackpotForm({ auction_id: '', initial_jackpot: 100, bid_contribution: 1 });
        fetchData();
      } else {
        const data = await res.json();
        toast.error(data.detail || 'Fehler');
      }
    } catch (err) {
      toast.error('Fehler beim Erstellen');
    }
    setLoading(false);
  };

  const createTurboAuction = async () => {
    if (!turboForm.product_id) {
      toast.error('Bitte Produkt auswählen');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/excitement/turbo/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(turboForm)
      });
      if (res.ok) {
        toast.success('⚡ Turbo-Auktion erstellt!');
        setTurboForm({ product_id: '', duration_seconds: 30 });
        fetchData();
      } else {
        const data = await res.json();
        toast.error(data.detail || 'Fehler');
      }
    } catch (err) {
      toast.error('Fehler beim Erstellen');
    }
    setLoading(false);
  };

  const createMysteryAuction = async () => {
    if (!mysteryForm.product_id) {
      toast.error('Bitte Produkt auswählen');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/excitement/mystery/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(mysteryForm)
      });
      if (res.ok) {
        toast.success('🎲 Mystery-Auktion erstellt!');
        setMysteryForm({ product_id: '', hint: 'Wert: €100-€500' });
        fetchData();
      } else {
        const data = await res.json();
        toast.error(data.detail || 'Fehler');
      }
    } catch (err) {
      toast.error('Fehler beim Erstellen');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-cyan-50 to-cyan-100 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
              <Sparkles className="w-8 h-8 text-[#FFD700]" />
              Spannung-Features
            </h1>
            <p className="text-gray-500">Verwalten Sie Jackpots, Turbo & Mystery-Auktionen</p>
          </div>
          <Button onClick={fetchData} variant="outline" className="border-gray-300 text-gray-800">
            <RefreshCw className="w-4 h-4 mr-2" />
            Aktualisieren
          </Button>
        </div>

        {/* Status Overview */}
        {status && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card className={`border-0 ${status.happy_hour.is_active ? 'bg-gradient-to-br from-[#FFD700] to-[#F59E0B]' : 'bg-[#1A1A2E]'}`}>
              <CardContent className="p-4 text-center">
                <Zap className={`w-8 h-8 mx-auto mb-2 ${status.happy_hour.is_active ? 'text-black' : 'text-[#FFD700]'}`} />
                <p className={`font-bold ${status.happy_hour.is_active ? 'text-black' : 'text-gray-800'}`}>
                  Happy Hour
                </p>
                <p className={`text-sm ${status.happy_hour.is_active ? 'text-black/70' : 'text-gray-500'}`}>
                  {status.happy_hour.is_active ? 'AKTIV!' : 'Inaktiv'}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-[#1A1A2E] border-0">
              <CardContent className="p-4 text-center">
                <Gift className="w-8 h-8 text-[#7C3AED] mx-auto mb-2" />
                <p className="text-gray-800 font-bold">Lucky Bid</p>
                <p className="text-gray-500 text-sm">
                  In {status.lucky_bid.bids_until_lucky} Geboten
                </p>
              </CardContent>
            </Card>

            <Card className="bg-[#1A1A2E] border-0">
              <CardContent className="p-4 text-center">
                <Trophy className="w-8 h-8 text-[#F59E0B] mx-auto mb-2" />
                <p className="text-gray-800 font-bold">Jackpots</p>
                <p className="text-gray-500 text-sm">
                  {status.active_counts.jackpot_auctions} aktiv
                </p>
              </CardContent>
            </Card>

            <Card className="bg-[#1A1A2E] border-0">
              <CardContent className="p-4 text-center">
                <Target className="w-8 h-8 text-[#EC4899] mx-auto mb-2" />
                <p className="text-gray-800 font-bold">Turbo/Mystery</p>
                <p className="text-gray-500 text-sm">
                  {status.active_counts.turbo_auctions + status.active_counts.mystery_auctions} aktiv
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Creation Forms */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {/* Jackpot Auction */}
          <Card className="bg-[#1A1A2E] border-gray-200">
            <CardHeader>
              <CardTitle className="text-gray-800 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-[#FFD700]" />
                Jackpot-Auktion
              </CardTitle>
              <CardDescription className="text-gray-500">
                Gewinner erhält Jackpot-Gebote
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-gray-800">Auktion</Label>
                <Select
                  value={jackpotForm.auction_id}
                  onValueChange={(v) => setJackpotForm({...jackpotForm, auction_id: v})}
                >
                  <SelectTrigger className="bg-gradient-to-b from-cyan-50 to-cyan-100 border-gray-200 text-gray-800">
                    <SelectValue placeholder="Auktion wählen" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1A1A2E] border-gray-200">
                    {auctions.map((a) => (
                      <SelectItem key={a.id} value={a.id} className="text-gray-800">
                        {a.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-gray-800 text-xs">Start-Jackpot</Label>
                  <Input
                    type="number"
                    value={jackpotForm.initial_jackpot}
                    onChange={(e) => setJackpotForm({...jackpotForm, initial_jackpot: parseInt(e.target.value) || 0})}
                    className="bg-gradient-to-b from-cyan-50 to-cyan-100 border-gray-200 text-gray-800"
                  />
                </div>
                <div>
                  <Label className="text-gray-800 text-xs">+Gebote/Bid</Label>
                  <Input
                    type="number"
                    value={jackpotForm.bid_contribution}
                    onChange={(e) => setJackpotForm({...jackpotForm, bid_contribution: parseInt(e.target.value) || 1})}
                    className="bg-gradient-to-b from-cyan-50 to-cyan-100 border-gray-200 text-gray-800"
                  />
                </div>
              </div>
              <Button
                onClick={createJackpotAuction}
                disabled={loading}
                className="w-full bg-gradient-to-r from-[#FFD700] to-[#F59E0B] text-black font-bold"
              >
                <Plus className="w-4 h-4 mr-1" />
                Jackpot erstellen
              </Button>
            </CardContent>
          </Card>

          {/* Turbo Auction */}
          <Card className="bg-[#1A1A2E] border-gray-200">
            <CardHeader>
              <CardTitle className="text-gray-800 flex items-center gap-2">
                <Zap className="w-5 h-5 text-[#EC4899]" />
                Turbo-Auktion
              </CardTitle>
              <CardDescription className="text-gray-500">
                Ultra-schnelle 30-Sekunden-Auktion
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-gray-800">Produkt</Label>
                <Select
                  value={turboForm.product_id}
                  onValueChange={(v) => setTurboForm({...turboForm, product_id: v})}
                >
                  <SelectTrigger className="bg-gradient-to-b from-cyan-50 to-cyan-100 border-gray-200 text-gray-800">
                    <SelectValue placeholder="Produkt wählen" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1A1A2E] border-gray-200">
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id} className="text-gray-800">
                        {p.name} (€{p.retail_price})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-gray-800">Dauer (Sekunden)</Label>
                <Input
                  type="number"
                  value={turboForm.duration_seconds}
                  onChange={(e) => setTurboForm({...turboForm, duration_seconds: parseInt(e.target.value) || 30})}
                  className="bg-gradient-to-b from-cyan-50 to-cyan-100 border-gray-200 text-gray-800"
                />
              </div>
              <Button
                onClick={createTurboAuction}
                disabled={loading}
                className="w-full bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] text-gray-800 font-bold"
              >
                <Plus className="w-4 h-4 mr-1" />
                Turbo erstellen
              </Button>
            </CardContent>
          </Card>

          {/* Mystery Auction */}
          <Card className="bg-[#1A1A2E] border-gray-200">
            <CardHeader>
              <CardTitle className="text-gray-800 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#6366F1]" />
                Mystery-Auktion
              </CardTitle>
              <CardDescription className="text-gray-500">
                Verstecktes Produkt - Spannung pur!
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-gray-800">Produkt (versteckt)</Label>
                <Select
                  value={mysteryForm.product_id}
                  onValueChange={(v) => setMysteryForm({...mysteryForm, product_id: v})}
                >
                  <SelectTrigger className="bg-gradient-to-b from-cyan-50 to-cyan-100 border-gray-200 text-gray-800">
                    <SelectValue placeholder="Produkt wählen" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1A1A2E] border-gray-200">
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id} className="text-gray-800">
                        {p.name} (€{p.retail_price})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-gray-800">Hinweis für Spieler</Label>
                <Input
                  value={mysteryForm.hint}
                  onChange={(e) => setMysteryForm({...mysteryForm, hint: e.target.value})}
                  placeholder="z.B. Wert: €100-€500"
                  className="bg-gradient-to-b from-cyan-50 to-cyan-100 border-gray-200 text-gray-800"
                />
              </div>
              <Button
                onClick={createMysteryAuction}
                disabled={loading}
                className="w-full bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] text-gray-800 font-bold"
              >
                <Plus className="w-4 h-4 mr-1" />
                Mystery erstellen
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Lucky Bid History */}
        <Card className="bg-[#1A1A2E] border-gray-200">
          <CardHeader>
            <CardTitle className="text-gray-800 flex items-center gap-2">
              <Gift className="w-5 h-5 text-[#7C3AED]" />
              Lucky Bid Gewinner
            </CardTitle>
          </CardHeader>
          <CardContent>
            {luckyHistory.length === 0 ? (
              <p className="text-gray-500 text-center py-4">Noch keine Lucky Bid Gewinner</p>
            ) : (
              <div className="space-y-2">
                {luckyHistory.map((winner, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-gradient-to-b from-cyan-50 to-cyan-100 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Gift className="w-5 h-5 text-[#7C3AED]" />
                      <div>
                        <p className="text-gray-800 font-medium">{winner.user_name}</p>
                        <p className="text-gray-500 text-xs">Gebot #{winner.bid_number}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[#10B981] font-bold">+{winner.reward} Gebote</p>
                      <p className="text-gray-500 text-xs">
                        {new Date(winner.created_at).toLocaleString('de-DE')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
