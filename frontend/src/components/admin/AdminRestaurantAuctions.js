// Admin Restaurant Voucher Auctions Component
import { useState, useEffect, useRef } from 'react';
import { 
  Utensils, Plus, ExternalLink, Trash2, Loader2, 
  MapPin, Globe, Gavel, Euro, Clock, Image,
  TrendingUp, RefreshCw, X, Upload, Edit2, Save, Camera
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { toast } from 'sonner';

export default function AdminRestaurantAuctions({ token, API }) {
  const [auctions, setAuctions] = useState([]);
  const [stats, setStats] = useState({ total: 0, active: 0, ended: 0 });
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState('all');
  const [uploading, setUploading] = useState(false);
  
  // Edit mode state
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState(null);
  
  // File input ref
  const fileInputRef = useRef(null);
  const logoInputRef = useRef(null);
  const editFileInputRef = useRef(null);
  
  const [newAuction, setNewAuction] = useState({
    restaurant_name: '',
    restaurant_url: '',
    restaurant_logo: '',
    restaurant_address: '',
    restaurant_images: [], // Array für mehrere Restaurant-Fotos
    restaurant_category: 'restaurant', // NEU: Kategorie
    voucher_value: 25,  // Standard: Euro-Wert (nicht Prozent)
    discount_percent: 0,  // Prozent-Rabatt nur optional
    description: 'Genießen Sie ein leckeres Essen bei uns!',
    duration_hours: 24,
    start_price: 0.01,
    bot_target_price: 8
  });

  // Restaurant Kategorien mit passenden Beschreibungen
  const restaurantCategories = {
    restaurant: {
      label: '🍽️ Restaurant',
      defaultDescription: 'Genießen Sie ein leckeres Essen bei uns!',
      emoji: '🍽️'
    },
    cafe: {
      label: '☕ Café',
      defaultDescription: 'Genießen Sie leckeren Kaffee und Kuchen bei uns!',
      emoji: '☕'
    },
    eiscafe: {
      label: '🍦 Eiscafé',
      defaultDescription: 'Genießen Sie leckeres Eis bei uns!',
      emoji: '🍦'
    },
    bar: {
      label: '🍸 Bar',
      defaultDescription: 'Genießen Sie erfrischende Getränke bei uns!',
      emoji: '🍸'
    },
    pizzeria: {
      label: '🍕 Pizzeria',
      defaultDescription: 'Genießen Sie köstliche Pizza bei uns!',
      emoji: '🍕'
    },
    fastfood: {
      label: '🍔 Fast Food',
      defaultDescription: 'Genießen Sie schnelles und leckeres Essen bei uns!',
      emoji: '🍔'
    }
  };

  // Handle category change - update description automatically
  const handleCategoryChange = (category) => {
    const categoryData = restaurantCategories[category];
    setNewAuction({
      ...newAuction,
      restaurant_category: category,
      description: categoryData?.defaultDescription || newAuction.description
    });
  };

  // Image URL input state
  const [imageUrlInput, setImageUrlInput] = useState('');

  // Handle file upload
  const handleFileUpload = async (e, isLogo = false, isEdit = false) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setUploading(true);
    
    try {
      const formData = new FormData();
      
      if (files.length === 1) {
        // Single file upload
        formData.append('file', files[0]);
        
        const response = await fetch(`${API}/admin/upload-image`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });
        
        if (response.ok) {
          const data = await response.json();
          
          if (isEdit && editData) {
            if (isLogo) {
              setEditData({ ...editData, restaurant_logo: data.image_url });
            } else {
              const currentImages = editData.restaurant_images || [];
              if (currentImages.length < 5) {
                setEditData({ ...editData, restaurant_images: [...currentImages, data.image_url] });
              }
            }
          } else {
            if (isLogo) {
              setNewAuction({ ...newAuction, restaurant_logo: data.image_url });
            } else {
              if (newAuction.restaurant_images.length < 5) {
                setNewAuction({
                  ...newAuction,
                  restaurant_images: [...newAuction.restaurant_images, data.image_url]
                });
              }
            }
          }
          toast.success(`${isLogo ? 'Logo' : 'Bild'} hochgeladen!`);
        } else {
          toast.error('Fehler beim Hochladen');
        }
      } else {
        // Multiple files upload
        for (let file of files) {
          formData.append('files', file);
        }
        
        const response = await fetch(`${API}/admin/upload-images`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });
        
        if (response.ok) {
          const data = await response.json();
          const urls = data.images.map(img => img.image_url);
          
          if (isEdit && editData) {
            const currentImages = editData.restaurant_images || [];
            const newImages = [...currentImages, ...urls].slice(0, 5);
            setEditData({ ...editData, restaurant_images: newImages });
          } else {
            const currentImages = newAuction.restaurant_images;
            const newImages = [...currentImages, ...urls].slice(0, 5);
            setNewAuction({ ...newAuction, restaurant_images: newImages });
          }
          toast.success(`${data.count} Bilder hochgeladen!`);
        }
      }
    } catch (err) {
      console.error(err);
      toast.error('Fehler beim Hochladen');
    } finally {
      setUploading(false);
      // Reset file input
      e.target.value = '';
    }
  };

  // Add image to restaurant images
  const addRestaurantImage = () => {
    if (imageUrlInput.trim() && newAuction.restaurant_images.length < 5) {
      setNewAuction({
        ...newAuction,
        restaurant_images: [...newAuction.restaurant_images, imageUrlInput.trim()]
      });
      setImageUrlInput('');
    }
  };

  // Remove image from restaurant images
  const removeRestaurantImage = (index, isEdit = false) => {
    if (isEdit && editData) {
      setEditData({
        ...editData,
        restaurant_images: editData.restaurant_images.filter((_, i) => i !== index)
      });
    } else {
      setNewAuction({
        ...newAuction,
        restaurant_images: newAuction.restaurant_images.filter((_, i) => i !== index)
      });
    }
  };

  // Vordefinierte Restaurant-Bilder zur Auswahl
  const presetImages = [
    { url: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400", label: "Restaurant 1" },
    { url: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400", label: "Restaurant 2" },
    { url: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400", label: "Essen 1" },
    { url: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400", label: "Essen 2" },
    { url: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400", label: "Pizza" },
    { url: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400", label: "Salat" },
    { url: "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=400", label: "Außen 1" },
    { url: "https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?w=400", label: "Terrasse" },
    { url: "https://images.unsplash.com/photo-1590846406792-0adc7f938f1d?w=400", label: "Cafe" },
    { url: "https://images.unsplash.com/photo-1579027989536-b7b1f875659b?w=400", label: "Eiscafe" },
    { url: "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=400", label: "Tische" },
    { url: "https://images.unsplash.com/photo-1600891964092-4316c288032e?w=400", label: "Steak" }
  ];

  // Add preset image
  const addPresetImage = (url, isEdit = false) => {
    if (isEdit && editData) {
      const currentImages = editData.restaurant_images || [];
      if (currentImages.length < 5 && !currentImages.includes(url)) {
        setEditData({ ...editData, restaurant_images: [...currentImages, url] });
      }
    } else {
      if (newAuction.restaurant_images.length < 5 && !newAuction.restaurant_images.includes(url)) {
        setNewAuction({
          ...newAuction,
          restaurant_images: [...newAuction.restaurant_images, url]
        });
      }
    }
  };

  // Start editing
  const startEditing = (auction) => {
    setEditingId(auction.id);
    setEditData({
      restaurant_name: auction.restaurant_info?.name || '',
      restaurant_url: auction.restaurant_info?.url || '',
      restaurant_logo: auction.restaurant_info?.logo || '',
      restaurant_address: auction.restaurant_info?.address || '',
      restaurant_images: auction.restaurant_info?.images || [],
      voucher_value: auction.restaurant_info?.voucher_value || 25,
      description: auction.description || '',
      bot_target_price: auction.bot_target_price || 8,
      restaurant_category: auction.restaurant_info?.category || 'restaurant'
    });
  };

  // Handle category change in edit mode
  const handleEditCategoryChange = (category) => {
    const categoryData = restaurantCategories[category];
    setEditData({
      ...editData,
      restaurant_category: category,
      description: categoryData?.defaultDescription || editData.description
    });
  };

  // Save edit
  const saveEdit = async () => {
    if (!editingId || !editData) return;
    
    try {
      const response = await fetch(`${API}/admin/restaurant-auctions/${editingId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(editData)
      });
      
      if (response.ok) {
        toast.success('Auktion aktualisiert!');
        setEditingId(null);
        setEditData(null);
        fetchAuctions();
      } else {
        const data = await response.json();
        toast.error(data.detail || 'Fehler beim Speichern');
      }
    } catch (err) {
      console.error(err);
      toast.error('Fehler beim Speichern');
    }
  };

  // Cancel edit
  const cancelEdit = () => {
    setEditingId(null);
    setEditData(null);
  };

  // Delete restaurant auction
  const handleDelete = async (auctionId) => {
    if (!window.confirm('Diese Auktion wirklich löschen?')) return;
    
    try {
      const response = await fetch(`${API}/admin/restaurant-auctions/${auctionId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        toast.success('Auktion gelöscht!');
        fetchAuctions();
      } else {
        toast.error('Fehler beim Löschen');
      }
    } catch (err) {
      console.error(err);
      toast.error('Fehler beim Löschen');
    }
  };

  // Fetch existing restaurant auctions
  const fetchAuctions = async () => {
    setLoading(true);
    try {
      const url = filter === 'all' 
        ? `${API}/admin/restaurant-auctions`
        : `${API}/admin/restaurant-auctions?status=${filter}`;
      
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setAuctions(data.auctions || []);
        setStats(data.stats || { total: 0, active: 0, ended: 0 });
      }
    } catch (err) {
      console.error(err);
      toast.error('Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuctions();
  }, [filter]);

  // Create restaurant auction
  const handleCreate = async (e) => {
    e.preventDefault();
    
    if (!newAuction.restaurant_name || !newAuction.restaurant_address) {
      toast.error('Bitte Restaurant-Name und Adresse eingeben');
      return;
    }
    
    setCreating(true);
    try {
      const response = await fetch(`${API}/admin/restaurant-auctions/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newAuction)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Fehler beim Erstellen');
      }
      
      const data = await response.json();
      toast.success(`🍽️ Gutschein-Auktion für "${newAuction.restaurant_name}" erstellt!`);
      
      // Reset form
      setNewAuction({
        restaurant_name: '',
        restaurant_url: '',
        restaurant_logo: '',
        restaurant_address: '',
        voucher_value: 25,
        discount_percent: 0,
        description: 'Genießen Sie ein leckeres Essen bei uns!',
        duration_hours: 24,
        start_price: 0.01,
        bot_target_price: 8
      });
      setShowForm(false);
      fetchAuctions();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTimeLeft = (endTime) => {
    if (!endTime) return '-';
    const end = new Date(endTime);
    const now = new Date();
    const diff = end - now;
    
    if (diff <= 0) return 'Beendet';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Gavel className="w-6 h-6 text-orange-500" />
            Restaurant-Gutschein Auktionen
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            Erstelle Auktionen für Restaurant-Gutscheine
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={fetchAuctions}
            variant="outline"
            size="sm"
            className="border-orange-300 text-orange-600 hover:bg-orange-50"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Aktualisieren
          </Button>
          <Button 
            onClick={() => setShowForm(!showForm)}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Neue Auktion
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-100 rounded-xl p-4 border border-gray-200">
          <p className="text-gray-500 text-sm">Gesamt</p>
          <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4 border border-green-200">
          <p className="text-green-600 text-sm">Aktiv</p>
          <p className="text-2xl font-bold text-green-600">{stats.active}</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
          <p className="text-gray-500 text-sm">Beendet</p>
          <p className="text-2xl font-bold text-gray-500">{stats.ended}</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'active', 'ended'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              filter === f
                ? 'bg-orange-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f === 'all' ? 'Alle' : f === 'active' ? 'Aktiv' : 'Beendet'}
          </button>
        ))}
      </div>

      {/* Create Form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-orange-50 rounded-xl p-6 border border-orange-200">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Utensils className="w-5 h-5 text-orange-500" />
            Neue Restaurant-Gutschein Auktion
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {/* Restaurant Name */}
            <div className="space-y-1">
              <Label className="text-gray-700 text-sm">Restaurant-Name *</Label>
              <Input 
                value={newAuction.restaurant_name}
                onChange={(e) => setNewAuction({...newAuction, restaurant_name: e.target.value})}
                className="bg-white border-gray-200"
                placeholder="z.B. Pizza Roma"
                required
              />
            </div>
            
            {/* Restaurant Kategorie - NEU */}
            <div className="space-y-1">
              <Label className="text-gray-700 text-sm">Kategorie *</Label>
              <select
                value={newAuction.restaurant_category}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-gray-200 bg-white text-gray-800 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                {Object.entries(restaurantCategories).map(([key, cat]) => (
                  <option key={key} value={key}>{cat.label}</option>
                ))}
              </select>
            </div>
            
            {/* Restaurant Address */}
            <div className="space-y-1">
              <Label className="text-gray-700 text-sm flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                Adresse *
              </Label>
              <Input 
                value={newAuction.restaurant_address}
                onChange={(e) => setNewAuction({...newAuction, restaurant_address: e.target.value})}
                className="bg-white border-gray-200"
                placeholder="Musterstr. 1, Berlin"
                required
              />
            </div>
            
            {/* Restaurant URL */}
            <div className="space-y-1">
              <Label className="text-gray-700 text-sm flex items-center gap-1">
                <Globe className="w-3 h-3" />
                Website (optional)
              </Label>
              <Input 
                value={newAuction.restaurant_url}
                onChange={(e) => setNewAuction({...newAuction, restaurant_url: e.target.value})}
                className="bg-white border-gray-200"
                placeholder="https://..."
                type="url"
              />
            </div>
            
            {/* Voucher Value - NUR EURO */}
            <div className="space-y-1">
              <Label className="text-gray-700 text-sm flex items-center gap-1">
                <Euro className="w-3 h-3" />
                Gutscheinwert (€) *
              </Label>
              <Input 
                type="number"
                value={newAuction.voucher_value}
                onChange={(e) => setNewAuction({...newAuction, voucher_value: parseInt(e.target.value) || 25})}
                className="bg-white border-gray-200"
                min="5"
                max="500"
                required
              />
              <p className="text-xs text-gray-400">z.B. 25€, 50€, 100€</p>
            </div>
            
            {/* Duration */}
            <div className="space-y-1">
              <Label className="text-gray-700 text-sm flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Dauer (Stunden)
              </Label>
              <Input 
                type="number"
                value={newAuction.duration_hours}
                onChange={(e) => setNewAuction({...newAuction, duration_hours: parseInt(e.target.value) || 24})}
                className="bg-white border-gray-200"
                min="1"
                max="168"
              />
            </div>
            
            {/* Bot Target Price */}
            <div className="space-y-1">
              <Label className="text-gray-700 text-sm flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                Bot-Zielpreis (€)
              </Label>
              <Input 
                type="number"
                step="0.01"
                value={newAuction.bot_target_price}
                onChange={(e) => setNewAuction({...newAuction, bot_target_price: parseFloat(e.target.value) || 8})}
                className="bg-white border-gray-200"
                min="1"
              />
            </div>
            
            {/* Description */}
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-gray-700 text-sm">Beschreibung</Label>
              <Input 
                value={newAuction.description}
                onChange={(e) => setNewAuction({...newAuction, description: e.target.value})}
                className="bg-white border-gray-200"
                placeholder="z.B. Genießen Sie ein leckeres Essen..."
              />
            </div>
          </div>

          {/* Restaurant Fotos */}
          <div className="mb-6">
            <Label className="text-gray-700 text-sm flex items-center gap-1 mb-2">
              <Image className="w-3 h-3" />
              Restaurant-Fotos (bis zu 5)
            </Label>
            
            {/* UPLOAD BUTTON - NEU */}
            {(!newAuction.restaurant_images || newAuction.restaurant_images.length < 5) && (
              <div className="mb-4 p-4 border-2 border-dashed border-orange-300 rounded-xl bg-orange-50/50">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => handleFileUpload(e, false, false)}
                  className="hidden"
                />
                <div className="text-center">
                  <Upload className="w-8 h-8 mx-auto mb-2 text-orange-400" />
                  <p className="text-sm font-medium text-gray-700 mb-2">Eigene Fotos hochladen</p>
                  <Button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="bg-orange-500 hover:bg-orange-600 text-white"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Wird hochgeladen...
                      </>
                    ) : (
                      <>
                        <Camera className="w-4 h-4 mr-2" />
                        Vom Gerät auswählen
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-gray-400 mt-2">JPG, PNG, WebP • Max. 5MB pro Bild</p>
                </div>
              </div>
            )}
            
            {/* Ausgewählte Bilder */}
            {newAuction.restaurant_images && newAuction.restaurant_images.length > 0 && (
              <div className="mb-3">
                <p className="text-xs text-green-600 mb-2">✓ {newAuction.restaurant_images.length} Bild(er) ausgewählt:</p>
                <div className="flex flex-wrap gap-2">
                  {newAuction.restaurant_images.map((img, idx) => (
                    <div key={idx} className="relative group">
                      <img 
                        src={img} 
                        alt={`Restaurant ${idx + 1}`}
                        className="w-16 h-16 object-cover rounded-lg border-2 border-green-500"
                      />
                      <button
                        type="button"
                        onClick={() => removeRestaurantImage(idx)}
                        className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-bold"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Vorauswahl-Grid */}
            {(!newAuction.restaurant_images || newAuction.restaurant_images.length < 5) && (
              <div>
                <p className="text-xs text-gray-500 mb-2">Oder vordefinierte Bilder anklicken:</p>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {presetImages.map((img, idx) => {
                    const isSelected = newAuction.restaurant_images?.includes(img.url);
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => !isSelected && addPresetImage(img.url)}
                        className={`relative group overflow-hidden rounded-lg border-2 transition-all ${
                          isSelected 
                            ? 'border-green-500 opacity-50 cursor-not-allowed' 
                            : 'border-gray-200 hover:border-orange-400 cursor-pointer'
                        }`}
                        disabled={isSelected}
                      >
                        <img 
                          src={img.url} 
                          alt={img.label}
                          className="w-full h-14 object-cover"
                        />
                        <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] py-0.5 text-center">
                          {img.label}
                        </span>
                        {isSelected && (
                          <div className="absolute inset-0 bg-green-500/30 flex items-center justify-center">
                            <span className="text-green-700 font-bold">✓</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            
            {/* Eigene URL (optional) */}
            {(!newAuction.restaurant_images || newAuction.restaurant_images.length < 5) && (
              <div className="mt-3">
                <p className="text-xs text-gray-400 mb-1">Oder Bild-URL einfügen:</p>
                <div className="flex gap-2">
                  <Input 
                    value={imageUrlInput}
                    onChange={(e) => setImageUrlInput(e.target.value)}
                    className="bg-white border-gray-200 flex-1 text-sm"
                    placeholder="https://..."
                    type="url"
                  />
                  <Button
                    type="button"
                    onClick={addRestaurantImage}
                    variant="outline"
                    size="sm"
                    className="border-orange-300 text-orange-600"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
            <p className="text-xs text-gray-400 mt-1">
              Fügen Sie Fotos vom Restaurant hinzu (Innenraum, Essen, Außenansicht)
            </p>
          </div>
          
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowForm(false)}
              className="flex-1"
            >
              Abbrechen
            </Button>
            <Button 
              type="submit"
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
              disabled={creating}
            >
              {creating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Wird erstellt...
                </>
              ) : (
                <>
                  <Gavel className="w-4 h-4 mr-2" />
                  Auktion erstellen
                </>
              )}
            </Button>
          </div>
        </form>
      )}

      {/* Auctions List */}
      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 text-orange-500 animate-spin mx-auto mb-2" />
          <p className="text-gray-500">Lade Auktionen...</p>
        </div>
      ) : auctions.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-200">
          <Gavel className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Keine Restaurant-Auktionen vorhanden</p>
          <Button 
            onClick={() => setShowForm(true)}
            className="mt-4 bg-orange-500 hover:bg-orange-600 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Erste Auktion erstellen
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {auctions.map((auction) => (
            <div 
              key={auction.id}
              className={`bg-white rounded-xl border p-4 ${
                (auction.status === 'active' || auction.status === 'day_paused')
                  ? 'border-green-200 shadow-sm' 
                  : 'border-gray-200'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  {/* Restaurant Icon/Logo */}
                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    (auction.status === 'active' || auction.status === 'day_paused') ? 'bg-orange-100' : 'bg-gray-100'
                  }`}>
                    {auction.restaurant_info?.logo ? (
                      <img 
                        src={auction.restaurant_info.logo} 
                        alt="" 
                        className="w-10 h-10 object-contain rounded-lg"
                      />
                    ) : (
                      <Utensils className={`w-7 h-7 ${(auction.status === 'active' || auction.status === 'day_paused') ? 'text-orange-500' : 'text-gray-400'}`} />
                    )}
                  </div>
                  
                  {/* Info */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-800 truncate">
                        {auction.restaurant_info?.name || 'Restaurant'}
                      </h3>
                      {/* Kategorie Badge */}
                      {auction.restaurant_info?.category && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                          {restaurantCategories[auction.restaurant_info.category]?.label || '🍽️ Restaurant'}
                        </span>
                      )}
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        (auction.status === 'active' || auction.status === 'day_paused')
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {(auction.status === 'active' || auction.status === 'day_paused') ? 'Aktiv' : 'Beendet'}
                      </span>
                    </div>
                    
                    <p className="text-sm text-gray-500 mt-0.5 truncate">
                      {auction.product?.specifications?.value || `${auction.product?.retail_price}€`} Gutschein
                    </p>
                    
                    {/* Beschreibung anzeigen */}
                    {auction.description && (
                      <p className="text-xs text-gray-500 mt-1 italic truncate">
                        "{auction.description}"
                      </p>
                    )}
                    
                    {auction.restaurant_info?.address && (
                      <p className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                        <MapPin className="w-3 h-3" />
                        {auction.restaurant_info.address}
                      </p>
                    )}
                  </div>
                </div>
                
                {/* Auction Stats */}
                <div className="flex items-center gap-6 text-sm">
                  <div className="text-center">
                    <p className="text-gray-400 text-xs">Preis</p>
                    <p className={`font-bold ${(auction.status === 'active' || auction.status === 'day_paused') ? 'text-green-600' : 'text-gray-600'}`}>
                      €{(auction.current_price || 0).toFixed(2)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-400 text-xs">Gebote</p>
                    <p className="font-semibold text-gray-700">{auction.total_bids || 0}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-400 text-xs">Restzeit</p>
                    <p className={`font-semibold ${
                      (auction.status === 'active' || auction.status === 'day_paused') ? 'text-orange-600' : 'text-gray-500'
                    }`}>
                      {getTimeLeft(auction.end_time)}
                    </p>
                  </div>
                  
                  {auction.winner_name && (
                    <div className="text-center">
                      <p className="text-gray-400 text-xs">Gewinner</p>
                      <p className="font-semibold text-purple-600 truncate max-w-20">
                        {auction.winner_name}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Voucher Code */}
              {auction.voucher_code && (
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs text-gray-500">
                    Gutschein-Code: <code className="bg-gray-100 px-2 py-0.5 rounded font-mono">{auction.voucher_code}</code>
                  </span>
                  
                  <div className="flex items-center gap-2">
                    {auction.restaurant_info?.url && (
                      <a 
                        href={auction.restaurant_info.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-orange-500 hover:text-orange-600 text-xs flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Website
                      </a>
                    )}
                    
                    {/* Bearbeiten Button */}
                    <Button
                      onClick={() => startEditing(auction)}
                      variant="outline"
                      size="sm"
                      className="border-blue-300 text-blue-600 hover:bg-blue-50"
                    >
                      <Edit2 className="w-3 h-3 mr-1" />
                      Bearbeiten
                    </Button>
                    
                    {/* Löschen Button */}
                    <Button
                      onClick={() => handleDelete(auction.id)}
                      variant="outline"
                      size="sm"
                      className="border-red-300 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      {/* BEARBEITEN MODAL */}
      {editingId && editData && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-blue-500" />
                Restaurant-Auktion bearbeiten
              </h3>
              <button
                onClick={cancelEdit}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Restaurant Name */}
              <div>
                <Label className="text-gray-700 text-sm">Restaurant-Name</Label>
                <Input 
                  value={editData.restaurant_name || ''}
                  onChange={(e) => setEditData({...editData, restaurant_name: e.target.value})}
                  className="bg-white border-gray-200"
                />
              </div>
              
              {/* Kategorie - NEU */}
              <div>
                <Label className="text-gray-700 text-sm">Kategorie</Label>
                <select
                  value={editData.restaurant_category || 'restaurant'}
                  onChange={(e) => handleEditCategoryChange(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-gray-200 bg-white text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {Object.entries(restaurantCategories).map(([key, cat]) => (
                    <option key={key} value={key}>{cat.label}</option>
                  ))}
                </select>
              </div>
              
              {/* Adresse */}
              <div>
                <Label className="text-gray-700 text-sm">Adresse</Label>
                <Input 
                  value={editData.restaurant_address || ''}
                  onChange={(e) => setEditData({...editData, restaurant_address: e.target.value})}
                  className="bg-white border-gray-200"
                />
              </div>
              
              {/* Website */}
              <div>
                <Label className="text-gray-700 text-sm">Website</Label>
                <Input 
                  value={editData.restaurant_url || ''}
                  onChange={(e) => setEditData({...editData, restaurant_url: e.target.value})}
                  className="bg-white border-gray-200"
                  type="url"
                />
              </div>
              
              {/* Gutscheinwert */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-700 text-sm">Gutscheinwert (€)</Label>
                  <Input 
                    type="number"
                    value={editData.voucher_value || 25}
                    onChange={(e) => setEditData({...editData, voucher_value: parseInt(e.target.value) || 25})}
                    className="bg-white border-gray-200"
                    min="5"
                  />
                </div>
                <div>
                  <Label className="text-gray-700 text-sm">Bot-Zielpreis (€)</Label>
                  <Input 
                    type="number"
                    step="0.01"
                    value={editData.bot_target_price || 8}
                    onChange={(e) => setEditData({...editData, bot_target_price: parseFloat(e.target.value) || 8})}
                    className="bg-white border-gray-200"
                  />
                </div>
              </div>
              
              {/* Beschreibung */}
              <div>
                <Label className="text-gray-700 text-sm">Beschreibung</Label>
                <Input 
                  value={editData.description || ''}
                  onChange={(e) => setEditData({...editData, description: e.target.value})}
                  className="bg-white border-gray-200"
                />
              </div>
              
              {/* Bilder bearbeiten */}
              <div>
                <Label className="text-gray-700 text-sm mb-2 block">Restaurant-Fotos</Label>
                
                {/* Upload Button für Edit */}
                {(!editData.restaurant_images || editData.restaurant_images.length < 5) && (
                  <div className="mb-3">
                    <input
                      ref={editFileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => handleFileUpload(e, false, true)}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      onClick={() => editFileInputRef.current?.click()}
                      variant="outline"
                      className="border-orange-300 text-orange-600 w-full"
                      disabled={uploading}
                    >
                      {uploading ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4 mr-2" />
                      )}
                      Eigene Fotos hochladen
                    </Button>
                  </div>
                )}
                
                {/* Vorhandene Bilder */}
                {editData.restaurant_images && editData.restaurant_images.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {editData.restaurant_images.map((img, idx) => (
                      <div key={idx} className="relative">
                        <img 
                          src={img} 
                          alt={`Restaurant ${idx + 1}`}
                          className="w-20 h-20 object-cover rounded-lg border border-gray-200"
                        />
                        <button
                          type="button"
                          onClick={() => removeRestaurantImage(idx, true)}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-sm font-bold"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Preset Bilder hinzufügen */}
                {(!editData.restaurant_images || editData.restaurant_images.length < 5) && (
                  <div>
                    <p className="text-xs text-gray-500 mb-2">Oder vordefinierte Bilder:</p>
                    <div className="grid grid-cols-6 gap-1">
                      {presetImages.slice(0, 6).map((img, idx) => {
                        const isSelected = editData.restaurant_images?.includes(img.url);
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => !isSelected && addPresetImage(img.url, true)}
                            className={`relative overflow-hidden rounded border ${
                              isSelected ? 'border-green-500 opacity-50' : 'border-gray-200 hover:border-orange-400'
                            }`}
                            disabled={isSelected}
                          >
                            <img src={img.url} alt={img.label} className="w-full h-10 object-cover" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex gap-3 mt-6 pt-4 border-t border-gray-200">
              <Button
                onClick={cancelEdit}
                variant="outline"
                className="flex-1"
              >
                Abbrechen
              </Button>
              <Button
                onClick={saveEdit}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
              >
                <Save className="w-4 h-4 mr-2" />
                Speichern
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
