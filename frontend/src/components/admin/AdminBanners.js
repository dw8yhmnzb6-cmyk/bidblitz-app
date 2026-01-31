import { useState } from 'react';
import axios from 'axios';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Eye, Plus, Edit, Trash2, Save } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export function AdminBanners({ token, banners, setBanners }) {
  const [editingBanner, setEditingBanner] = useState(null);
  const [showBannerModal, setShowBannerModal] = useState(false);

  const handleDeleteBanner = async (bannerId) => {
    if (!window.confirm('Banner wirklich löschen?')) return;
    try {
      await axios.delete(`${API}/admin/banners/${bannerId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Banner gelöscht');
      setBanners(banners.filter(b => b.id !== bannerId));
    } catch (e) {
      toast.error('Fehler beim Löschen');
    }
  };

  const handleSaveBanner = async () => {
    try {
      if (editingBanner.id) {
        const res = await axios.put(`${API}/admin/banners/${editingBanner.id}`, editingBanner, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setBanners(banners.map(b => b.id === editingBanner.id ? res.data : b));
        toast.success('Banner aktualisiert');
      } else {
        const res = await axios.post(`${API}/admin/banners`, editingBanner, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setBanners([...banners, res.data]);
        toast.success('Banner erstellt');
      }
      setShowBannerModal(false);
      setEditingBanner(null);
    } catch (e) {
      toast.error('Fehler beim Speichern');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Eye className="w-6 h-6 text-[#7C3AED]" />
          Werbebanner verwalten
        </h1>
        <Button
          onClick={() => {
            setEditingBanner({
              title: '',
              image_url: '',
              link_url: '',
              position: 'homepage_middle',
              is_active: true
            });
            setShowBannerModal(true);
          }}
          className="bg-[#10B981] hover:bg-[#10B981]/80"
        >
          <Plus className="w-4 h-4 mr-1" />
          Neuer Banner
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {(banners || []).map((banner) => (
          <div key={banner.id} className="glass-card rounded-xl p-4">
            <div className="flex items-start gap-4">
              <div className="w-32 h-20 rounded-lg overflow-hidden bg-[#181824] flex-shrink-0">
                {banner.image_url ? (
                  <img src={banner.image_url} alt={banner.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[#94A3B8]">
                    <Eye className="w-8 h-8" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-bold truncate">{banner.title || 'Ohne Titel'}</h3>
                <p className="text-[#94A3B8] text-sm">Position: {banner.position}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`px-2 py-0.5 rounded text-xs ${banner.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {banner.is_active ? 'Aktiv' : 'Inaktiv'}
                  </span>
                  <span className="text-[#94A3B8] text-xs">{banner.views || 0} Views</span>
                  <span className="text-[#94A3B8] text-xs">{banner.clicks || 0} Klicks</span>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingBanner(banner);
                    setShowBannerModal(true);
                  }}
                  className="border-[#7C3AED] text-[#7C3AED]"
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDeleteBanner(banner.id)}
                  className="border-red-500 text-red-500"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
        
        {(!banners || banners.length === 0) && (
          <div className="col-span-2 glass-card rounded-xl p-8 text-center">
            <Eye className="w-12 h-12 text-[#94A3B8] mx-auto mb-4" />
            <p className="text-[#94A3B8]">Noch keine Werbebanner vorhanden</p>
            <p className="text-[#94A3B8] text-sm mt-1">Klicken Sie auf "Neuer Banner" um einen zu erstellen</p>
          </div>
        )}
      </div>

      {/* Banner Modal */}
      {showBannerModal && editingBanner && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#0F0F16] rounded-xl p-6 max-w-md w-full border border-white/10">
            <h3 className="text-xl font-bold text-white mb-4">
              {editingBanner.id ? 'Banner bearbeiten' : 'Neuer Banner'}
            </h3>
            <div className="space-y-4">
              <div>
                <Label className="text-white">Titel</Label>
                <Input
                  value={editingBanner.title}
                  onChange={(e) => setEditingBanner({...editingBanner, title: e.target.value})}
                  placeholder="z.B. Willkommensbonus"
                  className="bg-[#181824] border-white/10 text-white"
                />
              </div>
              <div>
                <Label className="text-white">Bild-URL</Label>
                <Input
                  value={editingBanner.image_url}
                  onChange={(e) => setEditingBanner({...editingBanner, image_url: e.target.value})}
                  placeholder="https://..."
                  className="bg-[#181824] border-white/10 text-white"
                />
              </div>
              <div>
                <Label className="text-white">Link-URL (optional)</Label>
                <Input
                  value={editingBanner.link_url || ''}
                  onChange={(e) => setEditingBanner({...editingBanner, link_url: e.target.value})}
                  placeholder="/buy-bids oder https://..."
                  className="bg-[#181824] border-white/10 text-white"
                />
              </div>
              <div>
                <Label className="text-white">Position</Label>
                <Select
                  value={editingBanner.position}
                  onValueChange={(v) => setEditingBanner({...editingBanner, position: v})}
                >
                  <SelectTrigger className="bg-[#181824] border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#181824] border-white/10">
                    <SelectItem value="homepage_middle">Startseite Mitte</SelectItem>
                    <SelectItem value="homepage_top">Startseite Oben</SelectItem>
                    <SelectItem value="sidebar">Seitenleiste</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editingBanner.is_active}
                  onChange={(e) => setEditingBanner({...editingBanner, is_active: e.target.checked})}
                  className="w-4 h-4"
                />
                <Label className="text-white">Aktiv</Label>
              </div>
              
              {editingBanner.image_url && (
                <div className="rounded-lg overflow-hidden border border-white/10">
                  <img src={editingBanner.image_url} alt="Vorschau" className="w-full h-auto" />
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setShowBannerModal(false);
                  setEditingBanner(null);
                }}
                className="border-white/20 text-white"
              >
                Abbrechen
              </Button>
              <Button
                onClick={handleSaveBanner}
                className="bg-[#10B981] hover:bg-[#10B981]/80"
              >
                <Save className="w-4 h-4 mr-1" />
                Speichern
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
