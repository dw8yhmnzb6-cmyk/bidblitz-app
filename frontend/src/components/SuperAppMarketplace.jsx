import React, { useState } from 'react';
import axios from 'axios';
import { 
  ShoppingBag, 
  Car, 
  Ticket, 
  Wrench, 
  GraduationCap,
  Plane,
  Hotel,
  Taxi,
  UtensilsCrossed,
  Home,
  Plus,
  Search
} from 'lucide-react';

const CATEGORY_ICONS = {
  flights: Plane,
  hotels: Hotel,
  shopping: ShoppingBag,
  taxi: Taxi,
  food: UtensilsCrossed,
  real_estate: Home,
  car_rental: Car,
  event_tickets: Ticket,
  services: Wrench,
  education: GraduationCap,
};

export function SuperAppMarketplace() {
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  React.useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/api/super-app/marketplace/categories`
      );
      setCategories(response.data.categories);
    } catch (error) {
      console.error('Error fetching categories:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">
            BidBlitz Marketplace
          </h1>
          <p className="text-gray-400">
            Alles an einem Ort — Flüge, Hotels, Shopping & mehr
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-5 h-5" />
          Listing erstellen
        </button>
      </div>

      {/* Search Bar */}
      <div className="mb-8">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Suche nach Produkten, Services, Hotels..."
            className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {categories.map((category) => {
          const Icon = CATEGORY_ICONS[category.id] || ShoppingBag;
          return (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`p-6 rounded-xl border transition-all ${
                selectedCategory === category.id
                  ? 'bg-blue-600/20 border-blue-500'
                  : 'bg-white/5 border-white/10 hover:bg-white/10'
              }`}
            >
              <div className="flex flex-col items-center text-center gap-3">
                <div className={`p-3 rounded-lg ${
                  selectedCategory === category.id 
                    ? 'bg-blue-500' 
                    : 'bg-white/10'
                }`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="font-semibold text-white text-sm">
                    {category.name}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {category.count} Angebote
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Items Grid (Placeholder) */}
      {selectedCategory && (
        <div>
          <h2 className="text-xl font-bold text-white mb-4">
            {categories.find(c => c.id === selectedCategory)?.name}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:bg-white/10 transition-all"
              >
                <div className="aspect-video bg-gradient-to-br from-blue-500/20 to-purple-500/20" />
                <div className="p-4">
                  <h3 className="font-semibold text-white mb-2">
                    Beispiel Listing {item}
                  </h3>
                  <p className="text-sm text-gray-400 mb-4">
                    Beschreibung des Angebots...
                  </p>
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-bold text-blue-400">
                      €99.99
                    </span>
                    <button className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
                      Details
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Listing Modal (Placeholder) */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-white/10 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-white mb-4">
              Neues Listing erstellen
            </h3>
            <p className="text-gray-400 mb-4">
              Erstelle ein neues Marketplace-Angebot...
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20"
              >
                Abbrechen
              </button>
              <button className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Erstellen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
