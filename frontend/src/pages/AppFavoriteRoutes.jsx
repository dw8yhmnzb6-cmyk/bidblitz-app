/**
 * BidBlitz Favorite Routes
 * Save and manage favorite routes
 */
import React, { useState, useEffect } from 'react';
import BottomNav from '../components/BottomNav';

export default function AppFavoriteRoutes() {
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRoute, setNewRoute] = useState({ name: '', pickup: '', destination: '' });
  const [message, setMessage] = useState('');
  
  useEffect(() => {
    loadFavorites();
  }, []);
  
  const loadFavorites = () => {
    // Load from localStorage
    const saved = localStorage.getItem('favoriteRoutes');
    if (saved) {
      setFavorites(JSON.parse(saved));
    } else {
      // Default favorites
      setFavorites([
        { id: 1, name: '🏠 Nach Hause', pickup: 'Aktueller Standort', destination: 'Hauptstraße 42', usageCount: 12 },
        { id: 2, name: '💼 Zur Arbeit', pickup: 'Hauptstraße 42', destination: 'Bürozentrum', usageCount: 25 },
        { id: 3, name: '🛒 Einkaufen', pickup: 'Aktueller Standort', destination: 'Einkaufszentrum', usageCount: 8 },
      ]);
    }
  };
  
  const saveFavorites = (newFavorites) => {
    localStorage.setItem('favoriteRoutes', JSON.stringify(newFavorites));
    setFavorites(newFavorites);
  };
  
  const addFavorite = () => {
    if (!newRoute.name.trim() || !newRoute.pickup.trim() || !newRoute.destination.trim()) {
      setMessage('Bitte alle Felder ausfüllen');
      return;
    }
    
    const newFav = {
      id: Date.now(),
      name: newRoute.name,
      pickup: newRoute.pickup,
      destination: newRoute.destination,
      usageCount: 0
    };
    
    saveFavorites([...favorites, newFav]);
    setNewRoute({ name: '', pickup: '', destination: '' });
    setShowAddForm(false);
    setMessage('Route gespeichert!');
    setTimeout(() => setMessage(''), 2000);
  };
  
  const deleteFavorite = (id) => {
    saveFavorites(favorites.filter(f => f.id !== id));
    setMessage('Route gelöscht');
    setTimeout(() => setMessage(''), 2000);
  };
  
  const useFavorite = (fav) => {
    // Update usage count
    const updated = favorites.map(f => 
      f.id === fav.id ? { ...f, usageCount: f.usageCount + 1 } : f
    );
    saveFavorites(updated);
    
    // Navigate to taxi with pre-filled route - using window.location for simplicity
    window.location.href = `/taxi?pickup=${encodeURIComponent(fav.pickup)}&destination=${encodeURIComponent(fav.destination)}`;
  };
  
  return (
    <div className="min-h-screen bg-[#0b0e24] text-white pb-20">
      <div className="p-5">
        <h2 className="text-2xl font-bold mb-5">⭐ Favoriten-Routen</h2>
        
        {message && (
          <div className={`mb-4 p-3 rounded-xl text-center ${
            message.includes('gelöscht') ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'
          }`}>
            {message}
          </div>
        )}
        
        {/* Favorites List */}
        <div className="space-y-3 mb-5">
          {favorites.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <p className="text-4xl mb-2">📍</p>
              <p>Keine Favoriten gespeichert</p>
            </div>
          ) : (
            favorites.map((fav) => (
              <div 
                key={fav.id}
                className="bg-[#171a3a] p-4 rounded-2xl"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="font-semibold">{fav.name}</p>
                    <p className="text-xs text-slate-500">{fav.usageCount}x verwendet</p>
                  </div>
                  <button
                    onClick={() => deleteFavorite(fav.id)}
                    className="text-red-400 hover:text-red-300 text-sm"
                  >
                    ✕
                  </button>
                </div>
                
                <div className="flex items-center gap-2 mb-3 text-sm">
                  <div className="flex flex-col items-center">
                    <div className="w-2 h-2 rounded-full bg-green-400"></div>
                    <div className="w-0.5 h-4 bg-slate-600"></div>
                    <div className="w-2 h-2 rounded-full bg-red-400"></div>
                  </div>
                  <div className="flex-1">
                    <p className="text-slate-400 truncate">{fav.pickup}</p>
                    <p className="text-slate-400 truncate mt-2">{fav.destination}</p>
                  </div>
                </div>
                
                <button
                  onClick={() => useFavorite(fav)}
                  className="w-full py-2 bg-[#6c63ff] hover:bg-[#8b6dff] rounded-xl font-medium text-sm"
                >
                  Route verwenden
                </button>
              </div>
            ))
          )}
        </div>
        
        {/* Add Form */}
        {showAddForm ? (
          <div className="bg-[#171a3a] p-5 rounded-2xl">
            <h3 className="font-semibold mb-4">Neue Route hinzufügen</h3>
            
            <div className="space-y-3">
              <input
                type="text"
                value={newRoute.name}
                onChange={(e) => setNewRoute({ ...newRoute, name: e.target.value })}
                placeholder="Name (z.B. 🏠 Nach Hause)"
                className="w-full p-3 rounded-xl bg-[#0b0e24] border border-slate-700 text-white"
              />
              <input
                type="text"
                value={newRoute.pickup}
                onChange={(e) => setNewRoute({ ...newRoute, pickup: e.target.value })}
                placeholder="Abholort"
                className="w-full p-3 rounded-xl bg-[#0b0e24] border border-slate-700 text-white"
              />
              <input
                type="text"
                value={newRoute.destination}
                onChange={(e) => setNewRoute({ ...newRoute, destination: e.target.value })}
                placeholder="Ziel"
                className="w-full p-3 rounded-xl bg-[#0b0e24] border border-slate-700 text-white"
              />
              
              <div className="flex gap-2">
                <button
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 rounded-xl"
                >
                  Abbrechen
                </button>
                <button
                  onClick={addFavorite}
                  className="flex-1 py-2 bg-[#6c63ff] hover:bg-[#8b6dff] rounded-xl"
                >
                  Speichern
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowAddForm(true)}
            className="w-full py-3 bg-[#171a3a] hover:bg-[#252b4d] rounded-xl font-medium border-2 border-dashed border-slate-600"
          >
            + Neue Route hinzufügen
          </button>
        )}
      </div>
      
      <BottomNav />
    </div>
  );
}
