import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { 
  Heart, Trash2, Bell, BellOff, Package, Tag, 
  ArrowRight, Plus, Search, Filter, X, Zap
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Wishlist() {
  const { isAuthenticated, token } = useAuth();
  const [wishlist, setWishlist] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  const fetchData = async () => {
    try {
      const [wishlistRes, productsRes, categoriesRes] = await Promise.all([
        axios.get(`${API}/wishlist`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/products`),
        axios.get(`${API}/categories`)
      ]);
      setWishlist(wishlistRes.data);
      setProducts(productsRes.data);
      // Extract category names from the API response
      const cats = categoriesRes.data.map(c => c.name || c);
      setCategories(cats);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const addToWishlist = async (productId = null, category = null) => {
    try {
      await axios.post(
        `${API}/wishlist/add`,
        { product_id: productId, category: category },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Zur Wunschliste hinzugefügt!');
      setShowAddModal(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler beim Hinzufügen');
    }
  };

  const removeFromWishlist = async (itemId) => {
    try {
      await axios.delete(`${API}/wishlist/${itemId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Von Wunschliste entfernt');
      fetchData();
    } catch (error) {
      toast.error('Fehler beim Entfernen');
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || p.category === selectedCategory;
    const notInWishlist = !wishlist.some(w => w.product_id === p.id);
    return matchesSearch && matchesCategory && notInWishlist;
  });

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen pt-24 pb-12 px-4 flex items-center justify-center">
        <div className="glass-card p-8 rounded-xl text-center max-w-md">
          <Heart className="w-16 h-16 text-[#FF4D4D] mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-4">Wunschliste</h2>
          <p className="text-gray-500 mb-6">Melden Sie sich an, um Ihre Wunschliste zu sehen.</p>
          <Button className="btn-primary" onClick={() => window.location.href = '/login'}>
            Anmelden
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF4D4D]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-12 px-4" data-testid="wishlist-page">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800 flex items-center gap-3">
              <Heart className="w-8 h-8 text-[#FF4D4D]" />
              Meine Wunschliste
            </h1>
            <p className="text-gray-500 mt-1">
              Werde benachrichtigt, wenn deine Wunschprodukte versteigert werden!
            </p>
          </div>
          <Button 
            onClick={() => setShowAddModal(true)}
            className="bg-[#FF4D4D] hover:bg-[#EF4444] text-gray-800"
            data-testid="add-wishlist-btn"
          >
            <Plus className="w-5 h-5 mr-2" />
            Hinzufügen
          </Button>
        </div>

        {/* Wishlist Items */}
        {wishlist.length === 0 ? (
          <div className="glass-card p-12 rounded-xl text-center">
            <Heart className="w-16 h-16 text-[#475569] mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-800 mb-2">Deine Wunschliste ist leer</h3>
            <p className="text-gray-500 mb-6">
              Füge Produkte oder Kategorien hinzu, um benachrichtigt zu werden, wenn sie versteigert werden.
            </p>
            <Button 
              onClick={() => setShowAddModal(true)}
              className="bg-[#FF4D4D] hover:bg-[#EF4444] text-gray-800"
            >
              <Plus className="w-5 h-5 mr-2" />
              Erstes Produkt hinzufügen
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {wishlist.map((item) => (
              <div 
                key={item.id}
                className="glass-card p-4 rounded-xl flex items-center justify-between gap-4"
                data-testid={`wishlist-item-${item.id}`}
              >
                <div className="flex items-center gap-4">
                  {item.product ? (
                    <>
                      <img 
                        src={item.product.image_url} 
                        alt={item.product.name}
                        className="w-16 h-16 rounded-lg object-cover"
                      />
                      <div>
                        <h3 className="font-bold text-gray-800">{item.product.name}</h3>
                        <p className="text-gray-500 text-sm flex items-center gap-1">
                          <Tag className="w-3 h-3" />
                          {item.product.category}
                        </p>
                        <p className="text-[#FFD700] text-sm font-mono">
                          UVP: €{item.product.retail_price?.toFixed(2)}
                        </p>
                      </div>
                    </>
                  ) : item.category ? (
                    <>
                      <div className="w-16 h-16 rounded-lg bg-[#7C3AED]/20 flex items-center justify-center">
                        <Tag className="w-8 h-8 text-[#7C3AED]" />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-800">Kategorie: {item.category}</h3>
                        <p className="text-gray-500 text-sm">
                          Benachrichtigung für alle Produkte dieser Kategorie
                        </p>
                      </div>
                    </>
                  ) : null}
                </div>
                
                <div className="flex items-center gap-2">
                  <div className={`px-3 py-1 rounded-full text-xs flex items-center gap-1 ${
                    item.notified 
                      ? 'bg-[#10B981]/20 text-[#10B981]' 
                      : 'bg-[#FFD700]/20 text-[#FFD700]'
                  }`}>
                    {item.notified ? (
                      <><Bell className="w-3 h-3" /> Benachrichtigt</>
                    ) : (
                      <><BellOff className="w-3 h-3" /> Wartend</>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFromWishlist(item.id)}
                    className="text-[#FF4D4D] hover:bg-[#FF4D4D]/10"
                    data-testid={`remove-wishlist-${item.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Info Card */}
        <div className="glass-card p-6 rounded-xl mt-8 border border-[#7C3AED]/30 bg-[#7C3AED]/5">
          <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
            <Bell className="w-5 h-5 text-[#7C3AED]" />
            So funktioniert's
          </h3>
          <ul className="text-gray-500 text-sm space-y-2">
            <li>• Füge Produkte oder ganze Kategorien zu deiner Wunschliste hinzu</li>
            <li>• Du wirst per E-Mail benachrichtigt, sobald eine passende Auktion startet</li>
            <li>• Sei der Erste, der bietet und sichere dir die besten Deals!</li>
          </ul>
        </div>

        {/* Add Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] overflow-hidden">
              <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-800">Zur Wunschliste hinzufügen</h2>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowAddModal(false)}
                  className="text-gray-500 hover:text-gray-800"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
              
              <div className="p-6 space-y-6">
                {/* Category Selection */}
                <div>
                  <h3 className="font-bold text-gray-800 mb-3">Kategorie beobachten</h3>
                  <div className="flex flex-wrap gap-2">
                    {categories.map((cat) => (
                      <Button
                        key={cat}
                        variant="outline"
                        size="sm"
                        onClick={() => addToWishlist(null, cat)}
                        className="border-[#7C3AED]/30 text-[#7C3AED] hover:bg-[#7C3AED]/10"
                      >
                        <Tag className="w-3 h-3 mr-1" />
                        {cat}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Product Search */}
                <div>
                  <h3 className="font-bold text-gray-800 mb-3">Produkt suchen</h3>
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      type="text"
                      placeholder="Produktname..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-gradient-to-b from-cyan-50 to-cyan-100 border border-gray-200 rounded-lg text-gray-800 placeholder:text-[#475569] focus:border-[#FF4D4D] focus:outline-none"
                    />
                  </div>
                  
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {filteredProducts.slice(0, 10).map((product) => (
                      <div
                        key={product.id}
                        onClick={() => addToWishlist(product.id, null)}
                        className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-b from-cyan-50 to-cyan-100 hover:bg-white/5 cursor-pointer transition-colors"
                      >
                        <img 
                          src={product.image_url} 
                          alt={product.name}
                          className="w-12 h-12 rounded-lg object-cover"
                        />
                        <div className="flex-1">
                          <p className="text-gray-800 font-medium text-sm">{product.name}</p>
                          <p className="text-gray-500 text-xs">{product.category}</p>
                        </div>
                        <Plus className="w-5 h-5 text-[#FF4D4D]" />
                      </div>
                    ))}
                    {filteredProducts.length === 0 && (
                      <p className="text-gray-500 text-center py-4">Keine Produkte gefunden</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
