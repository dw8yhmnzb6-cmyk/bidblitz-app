import { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { Video, Play, Upload, Star, User } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function VideoTestimonialsPage() {
  const { language } = useLanguage();
  const { isAuthenticated } = useAuth();
  const [testimonials, setTestimonials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState(null);

  const texts = {
    de: {
      title: 'Gewinner-Videos',
      subtitle: 'Echte Gewinner teilen ihre Erfahrungen',
      description: 'Schau dir an, was andere bei BidBlitz gewonnen haben!',
      featured: 'Empfohlen',
      uploadTitle: 'Teile dein Gewinner-Video!',
      uploadDesc: 'Hast du bei BidBlitz gewonnen? Lade ein Video hoch und erhalte 15 Gratis-Gebote!',
      uploadBtn: 'Video hochladen',
      wonFor: 'Gewonnen für',
      saved: 'Gespart',
      views: 'Aufrufe',
      noVideos: 'Noch keine Videos vorhanden',
      beFirst: 'Sei der Erste und lade dein Gewinner-Video hoch!',
      loginToUpload: 'Melde dich an um ein Video hochzuladen',
      bonus: '+15 Gebote nach Genehmigung'
    },
    en: {
      title: 'Winner Videos',
      subtitle: 'Real winners share their experiences',
      description: 'See what others have won at BidBlitz!',
      featured: 'Featured',
      uploadTitle: 'Share your winner video!',
      uploadDesc: 'Won at BidBlitz? Upload a video and get 15 free bids!',
      uploadBtn: 'Upload Video',
      wonFor: 'Won for',
      saved: 'Saved',
      views: 'Views',
      noVideos: 'No videos yet',
      beFirst: 'Be the first to upload your winner video!',
      loginToUpload: 'Log in to upload a video',
      bonus: '+15 bids after approval'
    }
  };

  const t = texts[language] || texts.de;

  const getPlaceholderVideos = () => [
    {
      id: '1',
      username: 'Max K.',
      product_name: 'iPhone 17 Pro Max',
      final_price: 12.50,
      retail_price: 1499,
      thumbnail: 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=400',
      views: 1234,
      featured: true,
      created_at: new Date().toISOString()
    },
    {
      id: '2',
      username: 'Sarah M.',
      product_name: 'MacBook Pro 14"',
      final_price: 8.75,
      retail_price: 2199,
      thumbnail: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400',
      views: 892,
      featured: true,
      created_at: new Date(Date.now() - 86400000).toISOString()
    },
    {
      id: '3',
      username: 'Tim L.',
      product_name: 'PlayStation 5 Pro',
      final_price: 5.20,
      retail_price: 799,
      thumbnail: 'https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=400',
      views: 567,
      featured: false,
      created_at: new Date(Date.now() - 172800000).toISOString()
    },
    {
      id: '4',
      username: 'Anna B.',
      product_name: 'Dyson V20 Absolute',
      final_price: 3.80,
      retail_price: 799,
      thumbnail: 'https://images.unsplash.com/photo-1558317374-067fb5f30001?w=400',
      views: 345,
      featured: false,
      created_at: new Date(Date.now() - 259200000).toISOString()
    }
  ];

  useEffect(() => {
    const fetchTestimonials = async () => {
      try {
        const res = await fetch(`${API_URL}/api/testimonials/videos`);
        if (res.ok) {
          const data = await res.json();
          setTestimonials(data.videos?.length > 0 ? data.videos : getPlaceholderVideos());
        } else {
          setTestimonials(getPlaceholderVideos());
        }
      } catch (err) {
        setTestimonials(getPlaceholderVideos());
      }
      setLoading(false);
    };
    fetchTestimonials();
  }, []);

  const handleUpload = () => {
    if (!isAuthenticated) {
      toast.error(t.loginToUpload);
      return;
    }
    toast.info('Video-Upload kommt bald!');
  };

  const calculateSavings = (retail, final) => {
    return Math.round(((retail - final) / retail) * 100);
  };

  return (
    <div className="min-h-screen bg-[#0D0D14] py-8 px-4" data-testid="video-testimonials-page">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-[#EF4444] to-[#F97316] mb-4">
            <Video className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">{t.title}</h1>
          <p className="text-xl text-[#EF4444]">{t.subtitle}</p>
          <p className="text-[#94A3B8] mt-2">{t.description}</p>
        </div>

        {/* Upload CTA */}
        <Card className="bg-gradient-to-r from-[#EF4444]/20 to-[#F97316]/20 border-[#EF4444]/30 mb-8">
          <CardContent className="p-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-[#EF4444]/20 flex items-center justify-center">
                <Upload className="w-7 h-7 text-[#EF4444]" />
              </div>
              <div>
                <h3 className="text-white font-bold text-lg">{t.uploadTitle}</h3>
                <p className="text-[#94A3B8] text-sm">{t.uploadDesc}</p>
                <Badge className="bg-[#10B981]/20 text-[#10B981] mt-1">
                  {t.bonus}
                </Badge>
              </div>
            </div>
            <Button 
              onClick={handleUpload}
              className="bg-gradient-to-r from-[#EF4444] to-[#F97316]"
            >
              <Video className="w-4 h-4 mr-2" />
              {t.uploadBtn}
            </Button>
          </CardContent>
        </Card>

        {/* Videos Grid */}
        {loading ? (
          <div className="text-center py-12 text-[#94A3B8]">Laden...</div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {testimonials.map((video) => (
              <Card 
                key={video.id} 
                className="bg-[#1A1A2E] border-white/10 overflow-hidden group cursor-pointer hover:border-[#EF4444]/30 transition-all"
                onClick={() => setSelectedVideo(video)}
              >
                {/* Thumbnail */}
                <div className="relative aspect-video bg-black">
                  <img 
                    src={video.thumbnail} 
                    alt={video.product_name}
                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-[#EF4444]/90 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Play className="w-8 h-8 text-white ml-1" />
                    </div>
                  </div>
                  {video.featured && (
                    <Badge className="absolute top-3 left-3 bg-[#F59E0B]">
                      <Star className="w-3 h-3 mr-1" />
                      {t.featured}
                    </Badge>
                  )}
                  <div className="absolute bottom-3 right-3 bg-black/70 px-2 py-1 rounded text-white text-xs flex items-center">
                    <Play className="w-3 h-3 mr-1" />
                    {video.views.toLocaleString()} {t.views}
                  </div>
                </div>

                <CardContent className="p-4">
                  {/* User Info */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#EC4899] flex items-center justify-center">
                      <User className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-white font-medium">{video.username}</p>
                      <p className="text-[#94A3B8] text-xs">
                        {new Date(video.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {/* Product */}
                  <h3 className="text-white font-bold mb-2">{video.product_name}</h3>

                  {/* Stats */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[#94A3B8] text-xs">{t.wonFor}</p>
                      <p className="text-[#10B981] font-bold">€{video.final_price.toFixed(2)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[#94A3B8] text-xs line-through">€{video.retail_price}</p>
                      <Badge className="bg-[#10B981]/20 text-[#10B981]">
                        {t.saved} {calculateSavings(video.retail_price, video.final_price)}%
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Video Modal */}
        {selectedVideo && (
          <div 
            className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedVideo(null)}
          >
            <div 
              className="bg-[#1A1A2E] rounded-xl max-w-4xl w-full overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="aspect-video bg-black flex items-center justify-center">
                <div className="text-center">
                  <Video className="w-20 h-20 text-[#94A3B8] mx-auto mb-4" />
                  <p className="text-[#94A3B8]">Video-Player kommt bald!</p>
                </div>
              </div>
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#EC4899] flex items-center justify-center">
                    <User className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-white font-bold text-lg">{selectedVideo.username}</p>
                    <p className="text-[#94A3B8] text-sm">
                      {t.wonFor} €{selectedVideo.final_price.toFixed(2)} - {t.saved} {calculateSavings(selectedVideo.retail_price, selectedVideo.final_price)}%
                    </p>
                  </div>
                </div>
                <h3 className="text-white text-xl font-bold">{selectedVideo.product_name}</h3>
                <Button 
                  className="mt-4 w-full"
                  variant="outline"
                  onClick={() => setSelectedVideo(null)}
                >
                  Schließen
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
