import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { 
  Camera, Heart, Trophy, Star, Upload, Image,
  ChevronLeft, ChevronRight, X, Check, Sparkles
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const WinnerGallery = () => {
  const { token, isAuthenticated, user } = useAuth();
  const { language , mappedLanguage } = useLanguage();
  // Use mappedLanguage for regional variants (e.g., xk -> sq)
  const langKey = mappedLanguage || language;
  const [entries, setEntries] = useState([]);
  const [mySubmissions, setMySubmissions] = useState([]);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Upload form state
  const [uploadData, setUploadData] = useState({
    auction_id: '',
    caption: '',
    image: null,
    preview: null
  });

  const texts = {
    de: {
      title: 'Gewinner-Galerie',
      subtitle: 'Echte Gewinner, echte Ersparnisse!',
      featured: 'Featured',
      all: 'Alle',
      uploadPhoto: 'Foto hochladen',
      mySubmissions: 'Meine Fotos',
      noEntries: 'Noch keine Einträge',
      saved: 'Gespart',
      likes: 'Likes',
      pending: 'Ausstehend',
      approved: 'Freigegeben',
      rejected: 'Abgelehnt',
      selectAuction: 'Gewonnene Auktion wählen',
      caption: 'Bildunterschrift',
      captionPlaceholder: 'Erzähle uns von deinem Gewinn...',
      selectImage: 'Bild auswählen',
      submit: 'Einreichen',
      submitting: 'Wird eingereicht...',
      submitSuccess: 'Foto eingereicht! Du erhältst 5 Bonus-Gebote nach Freigabe.',
      bonusBids: '+5 Bonus-Gebote',
      close: 'Schließen'
    },
    en: {
      title: 'Winner Gallery',
      subtitle: 'Real winners, real savings!',
      featured: 'Featured',
      all: 'All',
      uploadPhoto: 'Upload Photo',
      mySubmissions: 'My Photos',
      noEntries: 'No entries yet',
      saved: 'Saved',
      likes: 'Likes',
      pending: 'Pending',
      approved: 'Approved',
      rejected: 'Rejected',
      selectAuction: 'Select won auction',
      caption: 'Caption',
      captionPlaceholder: 'Tell us about your win...',
      selectImage: 'Select Image',
      submit: 'Submit',
      submitting: 'Submitting...',
      submitSuccess: 'Photo submitted! You\'ll receive 5 bonus bids after approval.',
      bonusBids: '+5 Bonus Bids',
      close: 'Close'
    },
    sq: {
      title: 'Galeria e Fituesve',
      subtitle: 'Fitues të vërtetë, kursime të vërteta!',
      featured: 'Të Theksuara',
      all: 'Të gjitha',
      uploadPhoto: 'Ngarko Foto',
      mySubmissions: 'Fotot e Mia',
      noEntries: 'Asnjë hyrje ende',
      saved: 'Kursuar',
      likes: 'Pëlqime',
      pending: 'Në pritje',
      approved: 'Aprovuar',
      rejected: 'Refuzuar',
      selectAuction: 'Zgjidh ankand të fituar',
      caption: 'Përshkrim',
      captionPlaceholder: 'Na trego për fitoren tënde...',
      selectImage: 'Zgjidh Imazh',
      submit: 'Dorëzo',
      submitting: 'Duke dorëzuar...',
      submitSuccess: 'Foto u dorëzua! Do të marrësh 5 oferta bonus pas aprovimit.',
      bonusBids: '+5 Oferta Bonus',
      close: 'Mbyll'
    }
  };
  const t = texts[langKey] || texts.de;

  useEffect(() => {
    fetchGallery();
    if (isAuthenticated) {
      fetchMySubmissions();
    }
  }, [featuredOnly, isAuthenticated]);

  const fetchGallery = async () => {
    try {
      const res = await axios.get(`${API}/api/winner-gallery/feed`, {
        params: { limit: 50, featured_only: featuredOnly }
      });
      setEntries(res.data.entries || []);
    } catch (err) {
      console.error('Error fetching gallery:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMySubmissions = async () => {
    try {
      const res = await axios.get(`${API}/api/winner-gallery/my-submissions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMySubmissions(res.data.submissions || []);
    } catch (err) {
      console.error('Error fetching submissions:', err);
    }
  };

  const handleLike = async (galleryId) => {
    if (!isAuthenticated) {
      toast.error('Bitte einloggen');
      return;
    }

    try {
      const res = await axios.post(`${API}/api/winner-gallery/${galleryId}/like`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Update local state
      setEntries(prev => prev.map(e => 
        e.id === galleryId 
          ? { ...e, likes: e.likes + (res.data.liked ? 1 : -1) }
          : e
      ));
    } catch (err) {
      console.error('Error liking:', err);
    }
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadData(prev => ({
          ...prev,
          image: reader.result.split(',')[1], // Base64 without prefix
          preview: reader.result
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!uploadData.auction_id || !uploadData.image) {
      toast.error('Bitte Auktion und Bild auswählen');
      return;
    }

    setUploading(true);
    try {
      await axios.post(`${API}/api/winner-gallery/upload`, {
        auction_id: uploadData.auction_id,
        caption: uploadData.caption,
        image_base64: uploadData.image
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success(t.submitSuccess);
      setShowUpload(false);
      setUploadData({ auction_id: '', caption: '', image: null, preview: null });
      fetchMySubmissions();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Fehler beim Hochladen');
    } finally {
      setUploading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return 'bg-green-500/20 text-green-400';
      case 'pending': return 'bg-yellow-500/20 text-yellow-400';
      case 'rejected': return 'bg-red-500/20 text-red-400';
      default: return 'bg-gray-500/20 text-gray-500';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-cyan-50 to-cyan-100 py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-12 bg-white rounded w-1/3"></div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="aspect-square bg-white rounded-xl"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-cyan-50 to-cyan-100 py-8 px-4" data-testid="winner-gallery-page">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 mb-4">
            <Trophy className="w-5 h-5 text-yellow-400" />
            <span className="text-gray-800 font-bold">Winner Gallery</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-4">
            {t.title}
          </h1>
          <p className="text-gray-500 text-lg max-w-2xl mx-auto">
            {t.subtitle}
          </p>
        </div>

        {/* Actions Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-2">
            <Button
              variant={!featuredOnly ? 'default' : 'outline'}
              onClick={() => setFeaturedOnly(false)}
              size="sm"
            >
              {t.all}
            </Button>
            <Button
              variant={featuredOnly ? 'default' : 'outline'}
              onClick={() => setFeaturedOnly(true)}
              size="sm"
            >
              <Star className="w-4 h-4 mr-1" />
              {t.featured}
            </Button>
          </div>

          {isAuthenticated && (
            <Button
              onClick={() => setShowUpload(true)}
              className="bg-gradient-to-r from-purple-500 to-pink-500"
            >
              <Camera className="w-4 h-4 mr-2" />
              {t.uploadPhoto}
            </Button>
          )}
        </div>

        {/* Gallery Grid */}
        {entries.length === 0 ? (
          <div className="glass-card rounded-xl p-12 text-center">
            <Image className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">{t.noEntries}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {entries.map(entry => (
              <div
                key={entry.id}
                onClick={() => setSelectedEntry(entry)}
                className="group relative aspect-square rounded-xl overflow-hidden cursor-pointer hover:ring-2 hover:ring-purple-500 transition-all"
              >
                {entry.product_image ? (
                  <img
                    src={entry.product_image}
                    alt={entry.product_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-purple-900 to-pink-900 flex items-center justify-center">
                    <Trophy className="w-12 h-12 text-yellow-400" />
                  </div>
                )}

                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <p className="text-gray-800 font-bold truncate">{entry.product_name}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-green-400 font-bold">
                        -{((entry.savings / entry.retail_price) * 100).toFixed(0)}%
                      </span>
                      <div className="flex items-center gap-1">
                        <Heart className="w-4 h-4 text-pink-400" />
                        <span className="text-gray-800">{entry.likes}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Featured Badge */}
                {entry.featured && (
                  <div className="absolute top-2 right-2 px-2 py-1 bg-yellow-500 rounded-full">
                    <Star className="w-3 h-3 text-black" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* My Submissions */}
        {isAuthenticated && mySubmissions.length > 0 && (
          <section className="mt-12">
            <h2 className="text-xl font-bold text-gray-800 mb-4">{t.mySubmissions}</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {mySubmissions.map(sub => (
                <div key={sub.id} className="glass-card rounded-xl p-4">
                  <div className="aspect-video bg-white/5 rounded-lg mb-3 flex items-center justify-center">
                    {sub.product_image ? (
                      <img src={sub.product_image} alt="" className="w-full h-full object-contain" />
                    ) : (
                      <Camera className="w-8 h-8 text-gray-600" />
                    )}
                  </div>
                  <p className="text-gray-800 font-medium text-sm truncate">{sub.product_name}</p>
                  <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(sub.status)}`}>
                    {t[sub.status]}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Upload Modal */}
        {showUpload && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
            <div className="glass-card rounded-2xl p-6 max-w-lg w-full">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-800">{t.uploadPhoto}</h3>
                <Button variant="ghost" size="sm" onClick={() => setShowUpload(false)}>
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="space-y-4">
                {/* Auction Select - would need won auctions data */}
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">
                    {t.selectAuction}
                  </label>
                  <input
                    type="text"
                    placeholder="Auktion-ID eingeben"
                    value={uploadData.auction_id}
                    onChange={(e) => setUploadData(prev => ({ ...prev, auction_id: e.target.value }))}
                    className="w-full px-4 py-3 bg-white/5 border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:border-purple-500"
                  />
                </div>

                {/* Image Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">
                    {t.selectImage}
                  </label>
                  <div 
                    className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-purple-500/50 transition-colors"
                    onClick={() => document.getElementById('image-input').click()}
                  >
                    {uploadData.preview ? (
                      <img src={uploadData.preview} alt="Preview" className="w-full h-40 object-contain" />
                    ) : (
                      <>
                        <Upload className="w-12 h-12 text-gray-500 mx-auto mb-2" />
                        <p className="text-gray-500">Klicken zum Auswählen</p>
                      </>
                    )}
                    <input
                      id="image-input"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageSelect}
                    />
                  </div>
                </div>

                {/* Caption */}
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">
                    {t.caption}
                  </label>
                  <textarea
                    placeholder={t.captionPlaceholder}
                    value={uploadData.caption}
                    onChange={(e) => setUploadData(prev => ({ ...prev, caption: e.target.value }))}
                    rows={3}
                    className="w-full px-4 py-3 bg-white/5 border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:border-purple-500 resize-none"
                  />
                </div>

                {/* Bonus Info */}
                <div className="flex items-center gap-2 p-3 bg-green-500/10 rounded-lg">
                  <Sparkles className="w-5 h-5 text-green-400" />
                  <span className="text-green-400 font-medium">{t.bonusBids}</span>
                  <span className="text-gray-500 text-sm">nach Freigabe</span>
                </div>

                {/* Submit */}
                <Button
                  onClick={handleSubmit}
                  disabled={uploading || !uploadData.auction_id || !uploadData.image}
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-500"
                >
                  {uploading ? t.submitting : t.submit}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Entry Detail Modal */}
        {selectedEntry && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" onClick={() => setSelectedEntry(null)}>
            <div className="glass-card rounded-2xl p-6 max-w-2xl w-full" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-800">{selectedEntry.product_name}</h3>
                  <p className="text-gray-500">von {selectedEntry.user_name}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedEntry(null)}>
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {selectedEntry.product_image && (
                <img
                  src={selectedEntry.product_image}
                  alt={selectedEntry.product_name}
                  className="w-full h-64 object-contain bg-white/5 rounded-xl mb-4"
                />
              )}

              {selectedEntry.caption && (
                <p className="text-gray-600 mb-4">"{selectedEntry.caption}"</p>
              )}

              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-white/5 rounded-xl">
                  <p className="text-gray-500 text-sm">Endpreis</p>
                  <p className="text-2xl font-bold text-gray-800">€{selectedEntry.final_price?.toFixed(2)}</p>
                </div>
                <div className="text-center p-4 bg-white/5 rounded-xl">
                  <p className="text-gray-500 text-sm">UVP</p>
                  <p className="text-2xl font-bold text-gray-500">€{selectedEntry.retail_price?.toFixed(2)}</p>
                </div>
                <div className="text-center p-4 bg-green-500/10 rounded-xl">
                  <p className="text-gray-500 text-sm">{t.saved}</p>
                  <p className="text-2xl font-bold text-green-400">€{selectedEntry.savings?.toFixed(2)}</p>
                </div>
              </div>

              <div className="flex items-center justify-between mt-6">
                <Button
                  variant="outline"
                  onClick={() => handleLike(selectedEntry.id)}
                  className="flex items-center gap-2"
                >
                  <Heart className="w-5 h-5 text-pink-400" />
                  <span>{selectedEntry.likes} {t.likes}</span>
                </Button>
                <Button variant="ghost" onClick={() => setSelectedEntry(null)}>
                  {t.close}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WinnerGallery;
