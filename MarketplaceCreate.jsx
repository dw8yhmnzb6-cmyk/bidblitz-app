import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Camera, MapPin, Tag, Euro, Crown, CheckCircle,
  Building2, Car, Laptop, Shirt, Sofa, Briefcase, Upload, X
} from 'lucide-react';

const CATEGORIES = [
  { id: 'immobilien', name: 'Immobilien', icon: Building2 },
  { id: 'autos', name: 'Fahrzeuge', icon: Car },
  { id: 'elektronik', name: 'Elektronik', icon: Laptop },
  { id: 'mode', name: 'Mode', icon: Shirt },
  { id: 'moebel', name: 'Möbel', icon: Sofa },
  { id: 'jobs', name: 'Jobs', icon: Briefcase }
];

const COUNTRIES = {
  'Kosovo': ['Prishtina', 'Prizren', 'Peja', 'Mitrovica', 'Gjilan', 'Ferizaj'],
  'Deutschland': ['Berlin', 'München', 'Hamburg', 'Frankfurt', 'Köln', 'Stuttgart'],
  'VAE': ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman']
};

const MarketplaceCreate = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    category: '',
    country: '',
    city: '',
    isPremium: false
  });
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const cities = COUNTRIES[formData.country] || [];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setSuccess(true);
    setTimeout(() => {
      navigate('/marktplatz');
    }, 2000);
  };

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    const newImages = files.map(file => URL.createObjectURL(file));
    setImages(prev => [...prev, ...newImages].slice(0, 5));
  };

  const removeImage = (index) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  if (success) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Anzeige erstellt!</h2>
          <p className="text-slate-400">Weiterleitung zum Marktplatz...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-slate-900/90 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button 
              onClick={() => navigate('/marktplatz')}
              className="flex items-center gap-2 text-white hover:text-purple-400"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">Zurück</span>
            </button>
            <h1 className="text-lg font-bold text-white">Anzeige erstellen</h1>
            <div className="w-20" />
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Images */}
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <label className="block text-white font-semibold mb-3">
              <Camera className="w-5 h-5 inline mr-2" />
              Bilder (max. 5)
            </label>
            <div className="grid grid-cols-3 gap-3">
              {images.map((img, index) => (
                <div key={index} className="relative aspect-square rounded-lg overflow-hidden">
                  <img src={img} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="absolute top-1 right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              ))}
              {images.length < 5 && (
                <label className="aspect-square rounded-lg border-2 border-dashed border-slate-600 flex flex-col items-center justify-center cursor-pointer hover:border-purple-500 transition-colors">
                  <Upload className="w-8 h-8 text-slate-500 mb-1" />
                  <span className="text-xs text-slate-500">Hochladen</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>

          {/* Title */}
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <label className="block text-white font-semibold mb-2">Titel *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
              placeholder="z.B. iPhone 15 Pro Max neu"
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
            />
          </div>

          {/* Category */}
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <label className="block text-white font-semibold mb-3">
              <Tag className="w-5 h-5 inline mr-2" />
              Kategorie *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map(cat => {
                const Icon = cat.icon;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setFormData({...formData, category: cat.id})}
                    className={`p-3 rounded-lg flex flex-col items-center gap-1 transition-all ${
                      formData.category === cat.id
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-xs">{cat.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Price */}
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <label className="block text-white font-semibold mb-2">
              <Euro className="w-5 h-5 inline mr-2" />
              Preis *
            </label>
            <div className="relative">
              <input
                type="number"
                value={formData.price}
                onChange={(e) => setFormData({...formData, price: e.target.value})}
                placeholder="0"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                required
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">€</span>
            </div>
          </div>

          {/* Location */}
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <label className="block text-white font-semibold mb-3">
              <MapPin className="w-5 h-5 inline mr-2" />
              Standort *
            </label>
            <div className="space-y-3">
              <select
                value={formData.country}
                onChange={(e) => setFormData({...formData, country: e.target.value, city: ''})}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                required
              >
                <option value="">Land wählen</option>
                {Object.keys(COUNTRIES).map(country => (
                  <option key={country} value={country}>{country}</option>
                ))}
              </select>
              
              {cities.length > 0 && (
                <select
                  value={formData.city}
                  onChange={(e) => setFormData({...formData, city: e.target.value})}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                >
                  <option value="">Stadt wählen</option>
                  {cities.map(city => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <label className="block text-white font-semibold mb-2">Beschreibung *</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              placeholder="Beschreibe deinen Artikel ausführlich..."
              rows={5}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
              required
            />
          </div>

          {/* Premium Option */}
          <div className="bg-gradient-to-r from-yellow-600/20 to-amber-600/20 rounded-xl p-4 border border-yellow-500/30">
            <label className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-amber-600 rounded-lg flex items-center justify-center">
                  <Crown className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-white font-semibold">Premium Anzeige</p>
                  <p className="text-slate-400 text-sm">Mehr Sichtbarkeit für 9,99€/Monat</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={formData.isPremium}
                onChange={(e) => setFormData({...formData, isPremium: e.target.checked})}
                className="w-5 h-5 accent-yellow-500"
              />
            </label>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-4 rounded-xl font-bold text-lg transition-all disabled:opacity-50"
          >
            {loading ? 'Wird erstellt...' : 'Anzeige veröffentlichen'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default MarketplaceCreate;
