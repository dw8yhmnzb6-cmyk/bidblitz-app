import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Button } from '../ui/button';
import { 
  BarChart3, TrendingUp, Eye, Package, Tag, RefreshCw,
  ArrowUp, ArrowDown, Minus, Star, Users, ShoppingCart,
  Heart, Share2, Clock, Filter
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export function AdminProductAnalytics({ token }) {
  const [overview, setOverview] = useState(null);
  const [topProducts, setTopProducts] = useState([]);
  const [trending, setTrending] = useState([]);
  const [interestScores, setInterestScores] = useState([]);
  const [categoryStats, setCategoryStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('week');
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch all analytics data
  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const [overviewRes, topRes, trendingRes, interestRes, categoryRes] = await Promise.all([
        axios.get(`${API}/analytics/overview`),
        axios.get(`${API}/analytics/top-products?period=${period}&limit=15`),
        axios.get(`${API}/analytics/trending?limit=10`),
        axios.get(`${API}/analytics/interest-score?limit=15`),
        axios.get(`${API}/analytics/category-stats?period=${period}`)
      ]);
      
      setOverview(overviewRes.data);
      setTopProducts(topRes.data.products || []);
      setTrending(trendingRes.data.trending_products || []);
      setInterestScores(interestRes.data.products || []);
      setCategoryStats(categoryRes.data.categories || []);
    } catch (err) {
      console.error('Error fetching analytics:', err);
      toast.error('Fehler beim Laden der Analyse-Daten');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Change indicator component
  const ChangeIndicator = ({ value }) => {
    if (value > 0) {
      return (
        <span className="flex items-center text-green-600 text-sm">
          <ArrowUp className="w-4 h-4 mr-1" />
          +{value.toFixed(1)}%
        </span>
      );
    } else if (value < 0) {
      return (
        <span className="flex items-center text-red-600 text-sm">
          <ArrowDown className="w-4 h-4 mr-1" />
          {value.toFixed(1)}%
        </span>
      );
    }
    return (
      <span className="flex items-center text-gray-500 text-sm">
        <Minus className="w-4 h-4 mr-1" />
        0%
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-indigo-600" />
            Produkt-Analyse
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            Verfolgen Sie, welche Produkte Ihre Kunden am meisten interessieren
          </p>
        </div>
        <div className="flex gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm"
          >
            <option value="today">Heute</option>
            <option value="week">Diese Woche</option>
            <option value="month">Dieser Monat</option>
            <option value="all">Gesamt</option>
          </select>
          <Button
            onClick={fetchAnalytics}
            disabled={loading}
            variant="outline"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Aktualisieren
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      {overview && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-5 text-white">
            <div className="flex items-center justify-between mb-2">
              <Eye className="w-8 h-8 opacity-80" />
              <ChangeIndicator value={overview.day_change_percent} />
            </div>
            <div className="text-3xl font-bold">{overview.views_today.toLocaleString()}</div>
            <div className="text-blue-100 text-sm">Aufrufe heute</div>
          </div>
          
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-5 text-white">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="w-8 h-8 opacity-80" />
              <ChangeIndicator value={overview.week_change_percent} />
            </div>
            <div className="text-3xl font-bold">{overview.views_this_week.toLocaleString()}</div>
            <div className="text-purple-100 text-sm">Aufrufe diese Woche</div>
          </div>
          
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-5 text-white">
            <Package className="w-8 h-8 opacity-80 mb-2" />
            <div className="text-3xl font-bold">{overview.unique_products_viewed_today}</div>
            <div className="text-emerald-100 text-sm">Produkte angesehen heute</div>
          </div>
          
          <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-5 text-white">
            <Tag className="w-8 h-8 opacity-80 mb-2" />
            <div className="text-xl font-bold truncate">{overview.top_category_today}</div>
            <div className="text-amber-100 text-sm">Beliebteste Kategorie</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b pb-2">
        {[
          { id: 'overview', label: 'Top Produkte', icon: Star },
          { id: 'trending', label: 'Trending', icon: TrendingUp },
          { id: 'interest', label: 'Interesse-Score', icon: Heart },
          { id: 'categories', label: 'Kategorien', icon: Tag }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors ${
              activeTab === tab.id 
                ? 'bg-indigo-100 text-indigo-700' 
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Top Products Tab */}
      {activeTab === 'overview' && (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b bg-gray-50">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-500" />
              Meistgesehene Produkte
            </h3>
          </div>
          
          {loading ? (
            <div className="p-8 text-center text-gray-500">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
              Lade Daten...
            </div>
          ) : topProducts.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Eye className="w-8 h-8 mx-auto mb-2 opacity-50" />
              Noch keine Daten vorhanden
            </div>
          ) : (
            <div className="divide-y">
              {topProducts.map((product, index) => (
                <div key={product.product_id} className="px-6 py-4 flex items-center gap-4 hover:bg-gray-50">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                    index === 0 ? 'bg-yellow-500' :
                    index === 1 ? 'bg-gray-400' :
                    index === 2 ? 'bg-amber-600' :
                    'bg-gray-300'
                  }`}>
                    {index + 1}
                  </div>
                  
                  {product.product_image && (
                    <img 
                      src={product.product_image} 
                      alt={product.product_name}
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">{product.product_name}</div>
                    <div className="text-sm text-gray-500">{product.category}</div>
                  </div>
                  
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-indigo-600 font-semibold">
                      <Eye className="w-4 h-4" />
                      {product.view_count.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500">
                      <Users className="w-3 h-3 inline mr-1" />
                      {product.unique_users} Besucher
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Trending Tab */}
      {activeTab === 'trending' && (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b bg-gray-50">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-500" />
              Trending Produkte (heute vs. letzte Woche)
            </h3>
          </div>
          
          {trending.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-50" />
              Keine Trending-Daten - mehr Aufrufe erforderlich
            </div>
          ) : (
            <div className="divide-y">
              {trending.map((product, index) => (
                <div key={product.product_id} className="px-6 py-4 flex items-center gap-4 hover:bg-gray-50">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                  </div>
                  
                  {product.product_image && (
                    <img 
                      src={product.product_image} 
                      alt={product.product_name}
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">{product.product_name}</div>
                    <div className="text-sm text-gray-500">{product.category}</div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-green-600 font-bold text-lg">
                      +{product.trending_score}%
                    </div>
                    <div className="text-xs text-gray-500">
                      Heute: {product.views_today} | Ø {product.avg_daily_views}/Tag
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Interest Score Tab */}
      {activeTab === 'interest' && (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b bg-gray-50">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Heart className="w-5 h-5 text-red-500" />
              Produkt-Interesse (Aufrufe + Gebote + Wishlist + Shares)
            </h3>
          </div>
          
          {interestScores.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Heart className="w-8 h-8 mx-auto mb-2 opacity-50" />
              Noch keine Interaktionsdaten
            </div>
          ) : (
            <div className="divide-y">
              {interestScores.map((product, index) => (
                <div key={product.product_id} className="px-6 py-4 flex items-center gap-4 hover:bg-gray-50">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                    index < 3 ? 'bg-red-500' : 'bg-gray-400'
                  }`}>
                    {index + 1}
                  </div>
                  
                  {product.product_image && (
                    <img 
                      src={product.product_image} 
                      alt={product.product_name}
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">{product.product_name}</div>
                    <div className="flex gap-3 text-xs text-gray-500 mt-1">
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" /> {product.views}
                      </span>
                      <span className="flex items-center gap-1">
                        <ShoppingCart className="w-3 h-3" /> {product.bids}
                      </span>
                      <span className="flex items-center gap-1">
                        <Heart className="w-3 h-3" /> {product.wishlist_adds}
                      </span>
                      <span className="flex items-center gap-1">
                        <Share2 className="w-3 h-3" /> {product.shares}
                      </span>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-red-600 font-bold text-xl">
                      {product.interest_score.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500">Interest Score</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Categories Tab */}
      {activeTab === 'categories' && (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b bg-gray-50">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Tag className="w-5 h-5 text-purple-500" />
              Kategorie-Statistiken
            </h3>
          </div>
          
          {categoryStats.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Tag className="w-8 h-8 mx-auto mb-2 opacity-50" />
              Noch keine Kategorie-Daten
            </div>
          ) : (
            <div className="p-6">
              <div className="space-y-4">
                {categoryStats.map((cat, index) => {
                  const maxViews = categoryStats[0]?.views || 1;
                  const percentage = (cat.views / maxViews) * 100;
                  
                  return (
                    <div key={cat.category} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold ${
                            index === 0 ? 'bg-purple-100 text-purple-700' :
                            index === 1 ? 'bg-blue-100 text-blue-700' :
                            index === 2 ? 'bg-green-100 text-green-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {index + 1}
                          </span>
                          <span className="font-medium text-gray-900">{cat.category}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-semibold text-gray-900">{cat.views.toLocaleString()}</span>
                          <span className="text-gray-500 text-sm ml-2">({cat.products} Produkte)</span>
                        </div>
                      </div>
                      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${
                            index === 0 ? 'bg-purple-500' :
                            index === 1 ? 'bg-blue-500' :
                            index === 2 ? 'bg-green-500' :
                            'bg-gray-400'
                          }`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer Info */}
      <div className="text-center text-xs text-gray-400">
        <Clock className="w-3 h-3 inline mr-1" />
        Letzte Aktualisierung: {overview?.timestamp ? new Date(overview.timestamp).toLocaleString('de-DE') : '-'}
      </div>
    </div>
  );
}

export default AdminProductAnalytics;
