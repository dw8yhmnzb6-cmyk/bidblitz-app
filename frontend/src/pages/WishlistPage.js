import { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import { Lightbulb, ThumbsUp, Check, Send, TrendingUp, Star } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function WishlistPage() {
  const { language } = useLanguage();
  const { token, isAuthenticated } = useAuth();
  const [wishes, setWishes] = useState([]);
  const [myVotes, setMyVotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSuggest, setShowSuggest] = useState(false);
  const [newWish, setNewWish] = useState({ product_name: '', category: 'electronics', description: '' });

  const texts = {
    de: {
      title: 'Produkt-Wünsche',
      subtitle: 'Stimme ab welche Produkte versteigert werden sollen!',
      suggest: 'Produkt vorschlagen',
      topWishes: 'Top Wünsche',
      votes: 'Stimmen',
      vote: 'Abstimmen',
      voted: 'Abgestimmt',
      productName: 'Produktname',
      category: 'Kategorie',
      description: 'Beschreibung (optional)',
      submit: 'Einreichen',
      suggestedBy: 'Vorgeschlagen von',
      loginRequired: 'Bitte melde dich an um abzustimmen',
      noWishes: 'Noch keine Wünsche. Sei der Erste!'
    },
    en: {
      title: 'Product Wishlist',
      subtitle: 'Vote for products you want to see auctioned!',
      suggest: 'Suggest Product',
      topWishes: 'Top Wishes',
      votes: 'Votes',
      vote: 'Vote',
      voted: 'Voted',
      productName: 'Product Name',
      category: 'Category',
      description: 'Description (optional)',
      submit: 'Submit',
      suggestedBy: 'Suggested by',
      loginRequired: 'Please log in to vote',
      noWishes: 'No wishes yet. Be the first!'
    }
  };

  const t = texts[language] || texts.de;

  const categories = [
    { id: 'electronics', name: 'Elektronik', icon: '📱' },
    { id: 'gaming', name: 'Gaming', icon: '🎮' },
    { id: 'home', name: 'Haushalt', icon: '🏠' },
    { id: 'fashion', name: 'Mode', icon: '👗' },
    { id: 'sports', name: 'Sport', icon: '⚽' },
    { id: 'beauty', name: 'Beauty', icon: '💄' },
    { id: 'other', name: 'Sonstiges', icon: '📦' }
  ];

  useEffect(() => {
    fetchWishes();
    if (token) {
      fetchMyVotes();
    }
  }, [token]);

  const fetchWishes = async () => {
    try {
      const res = await fetch(`${API_URL}/api/wishlist/top?limit=30`);
      const data = await res.json();
      setWishes(data.wishes || []);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const fetchMyVotes = async () => {
    try {
      const res = await fetch(`${API_URL}/api/wishlist/my-votes`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setMyVotes((data.wishes || []).map(w => w.id));
    } catch (err) {
      console.error(err);
    }
  };

  const handleVote = async (wishId) => {
    if (!isAuthenticated) {
      toast.error(t.loginRequired);
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/wishlist/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ wish_id: wishId })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        fetchWishes();
        setMyVotes([...myVotes, wishId]);
      } else {
        toast.error(data.detail || 'Fehler');
      }
    } catch (err) {
      toast.error('Fehler');
    }
  };

  const handleSubmitWish = async () => {
    if (!newWish.product_name.trim()) {
      toast.error('Produktname erforderlich');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/wishlist/suggest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(newWish)
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        fetchWishes();
        setShowSuggest(false);
        setNewWish({ product_name: '', category: 'electronics', description: '' });
      } else {
        toast.error(data.detail || 'Fehler');
      }
    } catch (err) {
      toast.error('Fehler');
    }
  };

  const getCategoryIcon = (categoryId) => {
    const cat = categories.find(c => c.id === categoryId);
    return cat?.icon || '📦';
  };

  return (
    <div className="min-h-screen bg-[#0D0D14] py-8 px-4" data-testid="wishlist-page">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-[#F59E0B] to-[#EF4444] mb-4">
            <Lightbulb className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">{t.title}</h1>
          <p className="text-[#94A3B8]">{t.subtitle}</p>
        </div>

        {/* Suggest Button */}
        {isAuthenticated && !showSuggest && (
          <Button 
            onClick={() => setShowSuggest(true)}
            className="w-full mb-6 bg-gradient-to-r from-[#F59E0B] to-[#EF4444]"
          >
            <Lightbulb className="w-4 h-4 mr-2" />
            {t.suggest}
          </Button>
        )}

        {/* Suggest Form */}
        {showSuggest && (
          <Card className="bg-[#1A1A2E] border-white/10 mb-6">
            <CardContent className="p-6">
              <h3 className="text-white font-bold mb-4">{t.suggest}</h3>
              <div className="space-y-4">
                <Input
                  value={newWish.product_name}
                  onChange={(e) => setNewWish({...newWish, product_name: e.target.value})}
                  placeholder={t.productName}
                  className="bg-[#0D0D14] border-white/10 text-white"
                />
                <select
                  value={newWish.category}
                  onChange={(e) => setNewWish({...newWish, category: e.target.value})}
                  className="w-full bg-[#0D0D14] border border-white/10 rounded-md p-2 text-white"
                >
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                  ))}
                </select>
                <Textarea
                  value={newWish.description}
                  onChange={(e) => setNewWish({...newWish, description: e.target.value})}
                  placeholder={t.description}
                  className="bg-[#0D0D14] border-white/10 text-white"
                  rows={3}
                />
                <div className="flex gap-2">
                  <Button onClick={handleSubmitWish} className="flex-1 bg-[#10B981]">
                    <Send className="w-4 h-4 mr-2" />
                    {t.submit}
                  </Button>
                  <Button onClick={() => setShowSuggest(false)} variant="outline" className="flex-1">
                    Abbrechen
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Wishes List */}
        <Card className="bg-[#1A1A2E] border-white/10">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <TrendingUp className="w-5 h-5 mr-2 text-[#F59E0B]" />
              {t.topWishes}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-[#94A3B8]">Laden...</div>
            ) : wishes.length === 0 ? (
              <div className="text-center py-8">
                <Lightbulb className="w-12 h-12 text-[#94A3B8] mx-auto mb-3 opacity-50" />
                <p className="text-[#94A3B8]">{t.noWishes}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {wishes.map((wish, i) => (
                  <div 
                    key={wish.id} 
                    className="flex items-center justify-between bg-[#0D0D14] rounded-lg p-4"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl ${
                        i < 3 ? 'bg-[#F59E0B]/20' : 'bg-[#1A1A2E]'
                      }`}>
                        {i < 3 ? <Star className="w-5 h-5 text-[#F59E0B]" /> : getCategoryIcon(wish.category)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-white font-medium">{wish.product_name}</p>
                          {wish.status === 'approved' && (
                            <Badge className="bg-[#10B981]/20 text-[#10B981] text-xs">
                              <Check className="w-3 h-3 mr-1" />
                              Genehmigt
                            </Badge>
                          )}
                        </div>
                        <p className="text-[#94A3B8] text-sm">
                          {t.suggestedBy} {wish.suggested_by_name}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className="bg-[#7C3AED]/20 text-[#7C3AED]">
                        {wish.vote_count} {t.votes}
                      </Badge>
                      {isAuthenticated && (
                        <Button
                          size="sm"
                          onClick={() => handleVote(wish.id)}
                          disabled={myVotes.includes(wish.id)}
                          className={myVotes.includes(wish.id) 
                            ? 'bg-[#10B981]/20 text-[#10B981]' 
                            : 'bg-[#7C3AED]'
                          }
                        >
                          <ThumbsUp className="w-4 h-4 mr-1" />
                          {myVotes.includes(wish.id) ? t.voted : t.vote}
                        </Button>
                      )}
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
