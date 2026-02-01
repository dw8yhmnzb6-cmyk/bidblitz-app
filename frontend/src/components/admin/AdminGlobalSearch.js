import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { 
  Search, X, User, Package, Gavel, FileText, 
  Loader2, ArrowRight, Mail, Hash
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AdminGlobalSearch({ onNavigate, isOpen, onClose }) {
  const { token } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ users: [], auctions: [], products: [] });
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const searchTimeout = setTimeout(async () => {
      if (query.length >= 2) {
        setLoading(true);
        try {
          // Search users
          const usersRes = await axios.get(`${API}/admin/users?search=${query}&limit=5`, {
            headers: { Authorization: `Bearer ${token}` }
          }).catch(() => ({ data: [] }));

          // Search auctions
          const auctionsRes = await axios.get(`${API}/auctions?search=${query}&limit=5`, {
            headers: { Authorization: `Bearer ${token}` }
          }).catch(() => ({ data: [] }));

          // Search products
          const productsRes = await axios.get(`${API}/products?search=${query}&limit=5`, {
            headers: { Authorization: `Bearer ${token}` }
          }).catch(() => ({ data: [] }));

          setResults({
            users: usersRes.data?.users || usersRes.data || [],
            auctions: auctionsRes.data || [],
            products: productsRes.data || []
          });
        } catch (error) {
          console.error('Search error:', error);
        } finally {
          setLoading(false);
        }
      } else {
        setResults({ users: [], auctions: [], products: [] });
      }
    }, 300);

    return () => clearTimeout(searchTimeout);
  }, [query, token]);

  const handleSelect = (type, item) => {
    if (onNavigate) {
      onNavigate(type, item);
    }
    onClose();
    setQuery('');
  };

  const totalResults = results.users.length + results.auctions.length + results.products.length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-start justify-center z-50 p-4 pt-20">
      <div className="w-full max-w-2xl">
        {/* Search Input */}
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="flex items-center p-4 border-b border-white/10">
            <Search className="w-5 h-5 text-gray-400 mr-3" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Suche nach Benutzern, Auktionen, Produkten..."
              className="flex-1 bg-transparent text-white text-lg outline-none placeholder-gray-500"
              autoFocus
            />
            {loading && <Loader2 className="w-5 h-5 text-gray-400 animate-spin mr-2" />}
            <button onClick={onClose} className="text-gray-400 hover:text-white p-1">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Category Tabs */}
          {query.length >= 2 && (
            <div className="flex gap-2 p-3 border-b border-white/10">
              {[
                { id: 'all', label: 'Alle', count: totalResults },
                { id: 'users', label: 'Benutzer', count: results.users.length },
                { id: 'auctions', label: 'Auktionen', count: results.auctions.length },
                { id: 'products', label: 'Produkte', count: results.products.length }
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                    activeCategory === cat.id
                      ? 'bg-yellow-500 text-black'
                      : 'bg-white/10 text-gray-400 hover:bg-white/20'
                  }`}
                >
                  {cat.label} ({cat.count})
                </button>
              ))}
            </div>
          )}

          {/* Results */}
          <div className="max-h-96 overflow-y-auto">
            {query.length < 2 ? (
              <div className="p-8 text-center text-gray-500">
                <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Mindestens 2 Zeichen eingeben...</p>
                <p className="text-xs mt-2">Tipp: Drücken Sie "/" zum schnellen Suchen</p>
              </div>
            ) : totalResults === 0 && !loading ? (
              <div className="p-8 text-center text-gray-500">
                <p>Keine Ergebnisse für "{query}"</p>
              </div>
            ) : (
              <div className="p-2">
                {/* Users */}
                {(activeCategory === 'all' || activeCategory === 'users') && results.users.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs text-gray-500 px-3 py-2 font-medium">BENUTZER</p>
                    {results.users.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => handleSelect('users', user)}
                        className="w-full flex items-center gap-3 p-3 hover:bg-white/5 rounded-lg transition-colors text-left"
                      >
                        <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center">
                          <User className="w-5 h-5 text-cyan-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium truncate">{user.name}</p>
                          <p className="text-gray-400 text-sm truncate flex items-center gap-1">
                            <Mail className="w-3 h-3" /> {user.email}
                          </p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-gray-500" />
                      </button>
                    ))}
                  </div>
                )}

                {/* Auctions */}
                {(activeCategory === 'all' || activeCategory === 'auctions') && results.auctions.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs text-gray-500 px-3 py-2 font-medium">AUKTIONEN</p>
                    {results.auctions.map((auction) => (
                      <button
                        key={auction.id}
                        onClick={() => handleSelect('auctions', auction)}
                        className="w-full flex items-center gap-3 p-3 hover:bg-white/5 rounded-lg transition-colors text-left"
                      >
                        <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                          <Gavel className="w-5 h-5 text-yellow-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium truncate">{auction.product?.name || 'Auktion'}</p>
                          <p className="text-gray-400 text-sm flex items-center gap-2">
                            <span className="text-yellow-400">€{auction.current_price?.toFixed(2)}</span>
                            <span className={`px-2 py-0.5 rounded text-xs ${
                              auction.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                            }`}>
                              {auction.status}
                            </span>
                          </p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-gray-500" />
                      </button>
                    ))}
                  </div>
                )}

                {/* Products */}
                {(activeCategory === 'all' || activeCategory === 'products') && results.products.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 px-3 py-2 font-medium">PRODUKTE</p>
                    {results.products.map((product) => (
                      <button
                        key={product.id}
                        onClick={() => handleSelect('products', product)}
                        className="w-full flex items-center gap-3 p-3 hover:bg-white/5 rounded-lg transition-colors text-left"
                      >
                        <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center overflow-hidden">
                          {product.image_url ? (
                            <img src={product.image_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Package className="w-5 h-5 text-purple-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium truncate">{product.name}</p>
                          <p className="text-gray-400 text-sm">€{product.retail_price?.toFixed(2)}</p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-gray-500" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-white/10 flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-4">
              <span><kbd className="px-1.5 py-0.5 bg-white/10 rounded">↑↓</kbd> Navigation</span>
              <span><kbd className="px-1.5 py-0.5 bg-white/10 rounded">Enter</kbd> Auswählen</span>
              <span><kbd className="px-1.5 py-0.5 bg-white/10 rounded">Esc</kbd> Schließen</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
