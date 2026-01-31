import { useState } from 'react';
import axios from 'axios';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { FileText, Globe, RotateCcw, Save, Eye } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export function AdminPages({ token, pages, fetchData }) {
  const [selectedPage, setSelectedPage] = useState(null);
  const [pageContent, setPageContent] = useState('');
  const [pageTitle, setPageTitle] = useState('');

  const handleSelectPage = (page) => {
    setSelectedPage(page);
    setPageTitle(page.title);
    setPageContent(page.content);
  };

  const handleSavePage = async () => {
    if (!selectedPage) return;
    try {
      await axios.put(`${API}/admin/pages/${selectedPage.page_id}`, {
        title: pageTitle,
        content: pageContent
      }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Seite gespeichert');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler beim Speichern');
    }
  };

  const handleResetPage = async () => {
    if (!selectedPage) return;
    if (!window.confirm(`Seite "${selectedPage.title}" auf Standardinhalt zurücksetzen?`)) return;
    try {
      await axios.post(`${API}/admin/pages/${selectedPage.page_id}/reset`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Seite zurückgesetzt');
      setSelectedPage(null);
      setPageContent('');
      setPageTitle('');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler beim Zurücksetzen');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <FileText className="w-6 h-6 text-[#7C3AED]" />
          Seiten-Inhalte verwalten
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Page List */}
        <div className="glass-card rounded-xl p-4">
          <h3 className="text-lg font-bold text-white mb-4">Verfügbare Seiten</h3>
          <div className="space-y-2">
            {(pages || []).map((page) => (
              <button
                key={page.page_id}
                onClick={() => handleSelectPage(page)}
                className={`w-full text-left p-3 rounded-lg transition-colors ${
                  selectedPage?.page_id === page.page_id
                    ? 'bg-[#7C3AED]/20 border border-[#7C3AED]'
                    : 'bg-[#181824] hover:bg-white/5 border border-transparent'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-white font-medium">{page.title}</span>
                  {page.is_default && (
                    <span className="text-xs px-2 py-0.5 bg-[#94A3B8]/20 text-[#94A3B8] rounded">Standard</span>
                  )}
                </div>
                <span className="text-[#94A3B8] text-xs">{page.page_id}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Page Editor */}
        <div className="lg:col-span-2 glass-card rounded-xl p-6">
          {selectedPage ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">
                  {selectedPage.title} bearbeiten
                </h3>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleResetPage}
                    variant="outline"
                    size="sm"
                    className="border-[#F59E0B] text-[#F59E0B] hover:bg-[#F59E0B]/10"
                  >
                    <RotateCcw className="w-4 h-4 mr-1" />
                    Zurücksetzen
                  </Button>
                  <Button
                    onClick={handleSavePage}
                    className="bg-[#10B981] hover:bg-[#10B981]/80"
                  >
                    <Save className="w-4 h-4 mr-1" />
                    Speichern
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-white">Seitentitel</Label>
                <Input
                  value={pageTitle}
                  onChange={(e) => setPageTitle(e.target.value)}
                  className="bg-[#181824] border-white/10 text-white"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-white">Inhalt (HTML)</Label>
                <textarea
                  value={pageContent}
                  onChange={(e) => setPageContent(e.target.value)}
                  className="w-full h-[400px] rounded-lg bg-[#181824] border border-white/10 text-white p-4 text-sm font-mono"
                  placeholder="<h2>Überschrift</h2><p>Ihr Inhalt hier...</p>"
                />
                <p className="text-[#94A3B8] text-xs">
                  Verwenden Sie HTML-Tags für Formatierung: &lt;h2&gt;, &lt;h3&gt;, &lt;p&gt;, &lt;strong&gt;, &lt;a href=&quot;...&quot;&gt;
                </p>
              </div>

              {/* Preview */}
              <div className="space-y-2">
                <Label className="text-white flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  Vorschau
                </Label>
                <div 
                  className="p-4 rounded-lg bg-white text-gray-900 prose prose-sm max-w-none overflow-auto max-h-[300px]"
                  dangerouslySetInnerHTML={{ __html: pageContent }}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-[400px] text-center">
              <FileText className="w-16 h-16 text-[#94A3B8] mb-4" />
              <p className="text-[#94A3B8] text-lg">Wählen Sie eine Seite aus der Liste</p>
              <p className="text-[#94A3B8] text-sm mt-2">
                Bearbeiten Sie Impressum, AGB, Datenschutz und weitere Seiten
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Info Box */}
      <div className="glass-card rounded-xl p-4 border-l-4 border-[#06B6D4]">
        <div className="flex items-start gap-3">
          <Globe className="w-6 h-6 text-[#06B6D4] flex-shrink-0" />
          <div>
            <h4 className="text-white font-semibold">Hinweis</h4>
            <p className="text-[#94A3B8] text-sm">
              Änderungen werden sofort auf der Website sichtbar. Bitte prüfen Sie die Vorschau vor dem Speichern.
              Das Zurücksetzen stellt den ursprünglichen Standardinhalt wieder her.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
