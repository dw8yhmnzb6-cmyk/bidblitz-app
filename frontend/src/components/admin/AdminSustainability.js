import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import { 
  Leaf, TreePine, Heart, Globe, Users, Plus, Trash2, 
  Save, RefreshCw, TrendingUp, Calendar, MapPin, Image
} from 'lucide-react';
import { Button } from '../ui/button';

const API = process.env.REACT_APP_BACKEND_URL;

const AdminSustainability = () => {
  const { token } = useAuth();
  const [stats, setStats] = useState({
    trees_planted: 0,
    projects_supported: 0,
    co2_offset_kg: 0,
    donations_total: 0,
    last_updated: null
  });
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editedStats, setEditedStats] = useState({});
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
    category: 'trees',
    amount: 0,
    impact_value: 0,
    location: '',
    image_url: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, projectsRes] = await Promise.all([
        fetch(`${API}/api/sustainability/stats`),
        fetch(`${API}/api/sustainability/projects`)
      ]);
      
      const statsData = await statsRes.json();
      const projectsData = await projectsRes.json();
      
      setStats(statsData);
      setEditedStats(statsData);
      setProjects(projectsData);
    } catch (err) {
      console.error('Error fetching sustainability data:', err);
      toast.error('Fehler beim Laden der Daten');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveStats = async () => {
    setSaving(true);
    try {
      const response = await fetch(`${API}/api/sustainability/stats`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(editedStats)
      });
      
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
        toast.success('Statistiken gespeichert!');
      } else {
        throw new Error('Save failed');
      }
    } catch (err) {
      toast.error('Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateProject = async () => {
    if (!newProject.name || !newProject.description) {
      toast.error('Name und Beschreibung erforderlich');
      return;
    }
    
    try {
      const response = await fetch(`${API}/api/sustainability/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newProject)
      });
      
      const data = await response.json();
      
      if (response.ok) {
        toast.success('Projekt erstellt!');
        setShowNewProject(false);
        setNewProject({
          name: '',
          description: '',
          category: 'trees',
          amount: 0,
          impact_value: 0,
          location: '',
          image_url: ''
        });
        fetchData();
      } else {
        console.error('Create project error:', data);
        toast.error(data.detail || 'Fehler beim Erstellen');
      }
    } catch (err) {
      toast.error('Fehler beim Erstellen');
    }
  };

  const handleDeleteProject = async (projectId) => {
    if (!window.confirm('Projekt wirklich löschen?')) return;
    
    try {
      const response = await fetch(`${API}/api/sustainability/projects/${projectId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        toast.success('Projekt gelöscht');
        fetchData();
      }
    } catch (err) {
      toast.error('Fehler beim Löschen');
    }
  };

  const categoryIcons = {
    trees: <TreePine className="w-5 h-5 text-emerald-600" />,
    donations: <Heart className="w-5 h-5 text-rose-600" />,
    climate: <Globe className="w-5 h-5 text-teal-600" />,
    community: <Users className="w-5 h-5 text-amber-600" />
  };

  const categoryLabels = {
    trees: 'Baumpflanzung',
    donations: 'Spenden',
    climate: 'Klimaschutz',
    community: 'Community'
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Leaf className="w-8 h-8 text-emerald-600" />
          <div>
            <h2 className="text-xl font-bold text-gray-800">Nachhaltigkeit</h2>
            <p className="text-sm text-gray-500">CSR & Social Responsibility verwalten</p>
          </div>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Aktualisieren
        </Button>
      </div>

      {/* Stats Editor */}
      <div className="bg-white rounded-xl border border-emerald-200 p-4 sm:p-6 shadow-sm overflow-hidden">
        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-emerald-600" />
          Impact-Statistiken bearbeiten
        </h3>
        
        {/* Mobile: Vertical Stack, Tablet+: 2 cols, Desktop: 4 cols */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
          {/* Trees */}
          <div className="space-y-2 bg-emerald-50/50 p-3 rounded-lg">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
              <TreePine className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <span className="truncate">Bäume gepflanzt</span>
            </label>
            <input
              type="number"
              value={editedStats.trees_planted || 0}
              onChange={(e) => setEditedStats({...editedStats, trees_planted: parseInt(e.target.value) || 0})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-base"
            />
          </div>
          
          {/* Projects */}
          <div className="space-y-2 bg-rose-50/50 p-3 rounded-lg">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
              <Heart className="w-4 h-4 text-rose-500 flex-shrink-0" />
              <span className="truncate">Projekte unterstützt</span>
            </label>
            <input
              type="number"
              value={editedStats.projects_supported || 0}
              onChange={(e) => setEditedStats({...editedStats, projects_supported: parseInt(e.target.value) || 0})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-base"
            />
          </div>
          
          {/* CO2 */}
          <div className="space-y-2 bg-teal-50/50 p-3 rounded-lg">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
              <Globe className="w-4 h-4 text-teal-500 flex-shrink-0" />
              <span className="truncate">CO₂ kompensiert (kg)</span>
            </label>
            <input
              type="number"
              value={editedStats.co2_offset_kg || 0}
              onChange={(e) => setEditedStats({...editedStats, co2_offset_kg: parseInt(e.target.value) || 0})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-base"
            />
          </div>
          
          {/* Donations */}
          <div className="space-y-2 bg-amber-50/50 p-3 rounded-lg">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
              <Heart className="w-4 h-4 text-rose-500 flex-shrink-0" />
              <span className="truncate">Spenden gesamt (€)</span>
            </label>
            <input
              type="number"
              step="0.01"
              value={editedStats.donations_total || 0}
              onChange={(e) => setEditedStats({...editedStats, donations_total: parseFloat(e.target.value) || 0})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-base"
            />
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <p className="text-xs text-gray-500">
            Zuletzt aktualisiert: {stats.last_updated ? new Date(stats.last_updated).toLocaleString('de-DE') : 'Nie'}
          </p>
          <Button onClick={handleSaveStats} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 w-full sm:w-auto">
            {saving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Speichern
          </Button>
        </div>
      </div>

      {/* Projects */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <Leaf className="w-5 h-5 text-emerald-600" />
            Projekte ({projects.length})
          </h3>
          <Button onClick={() => setShowNewProject(!showNewProject)} variant="outline" size="sm" className="w-full sm:w-auto">
            <Plus className="w-4 h-4 mr-2" />
            Neues Projekt
          </Button>
        </div>

        {/* New Project Form */}
        {showNewProject && (
          <div className="bg-emerald-50 rounded-lg p-4 mb-4 border border-emerald-200">
            <h4 className="font-medium text-gray-800 mb-3">Neues Projekt erstellen</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Name *</label>
                <input
                  type="text"
                  value={newProject.name}
                  onChange={(e) => setNewProject({...newProject, name: e.target.value})}
                  placeholder="z.B. Aufforstung Schwarzwald"
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Kategorie</label>
                <select
                  value={newProject.category}
                  onChange={(e) => setNewProject({...newProject, category: e.target.value})}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="trees">🌲 Baumpflanzung</option>
                  <option value="donations">❤️ Spenden</option>
                  <option value="climate">🌍 Klimaschutz</option>
                  <option value="community">👥 Community</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-gray-700">Beschreibung *</label>
                <textarea
                  value={newProject.description}
                  onChange={(e) => setNewProject({...newProject, description: e.target.value})}
                  placeholder="Beschreiben Sie das Projekt..."
                  rows={2}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Standort</label>
                <input
                  type="text"
                  value={newProject.location}
                  onChange={(e) => setNewProject({...newProject, location: e.target.value})}
                  placeholder="z.B. Bayern, Deutschland"
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Impact-Wert</label>
                <input
                  type="number"
                  value={newProject.impact_value}
                  onChange={(e) => setNewProject({...newProject, impact_value: parseInt(e.target.value) || 0})}
                  placeholder="z.B. 500 (Bäume)"
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Betrag (€)</label>
                <input
                  type="number"
                  step="0.01"
                  value={newProject.amount}
                  onChange={(e) => setNewProject({...newProject, amount: parseFloat(e.target.value) || 0})}
                  placeholder="z.B. 5000"
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Bild-URL</label>
                <input
                  type="url"
                  value={newProject.image_url}
                  onChange={(e) => setNewProject({...newProject, image_url: e.target.value})}
                  placeholder="https://..."
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button onClick={handleCreateProject} className="bg-emerald-600 hover:bg-emerald-700">
                <Plus className="w-4 h-4 mr-2" />
                Erstellen
              </Button>
              <Button onClick={() => setShowNewProject(false)} variant="outline">
                Abbrechen
              </Button>
            </div>
          </div>
        )}

        {/* Projects List */}
        {projects.length === 0 ? (
          <p className="text-gray-500 text-center py-8">Noch keine Projekte erstellt</p>
        ) : (
          <div className="space-y-3">
            {projects.map((project) => (
              <div key={project.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                {/* Header Row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm flex-shrink-0">
                      {categoryIcons[project.category] || <Leaf className="w-5 h-5 text-emerald-600" />}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-medium text-gray-800 truncate">{project.name}</h4>
                      <span className="inline-block px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full mt-1">
                        {categoryLabels[project.category]}
                      </span>
                    </div>
                  </div>
                  <Button 
                    onClick={() => handleDeleteProject(project.id)} 
                    variant="ghost" 
                    size="sm"
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                
                {/* Description */}
                {project.description && (
                  <p className="text-sm text-gray-600 line-clamp-2 mt-3">{project.description}</p>
                )}
                
                {/* Stats Grid - Mobile optimized */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                  {project.location && (
                    <div className="bg-white rounded-lg p-2">
                      <p className="text-[10px] text-gray-400 uppercase">Standort</p>
                      <p className="text-xs text-gray-700 font-medium truncate flex items-center gap-1">
                        <MapPin className="w-3 h-3 flex-shrink-0" />
                        {project.location}
                      </p>
                    </div>
                  )}
                  {project.impact_value > 0 && (
                    <div className="bg-white rounded-lg p-2">
                      <p className="text-[10px] text-gray-400 uppercase">Impact</p>
                      <p className="text-xs text-gray-700 font-medium flex items-center gap-1">
                        <TrendingUp className="w-3 h-3 flex-shrink-0 text-emerald-500" />
                        {project.impact_value.toLocaleString()}
                      </p>
                    </div>
                  )}
                  {project.amount > 0 && (
                    <div className="bg-emerald-50 rounded-lg p-2">
                      <p className="text-[10px] text-gray-400 uppercase">Betrag</p>
                      <p className="text-sm text-emerald-600 font-bold">
                        €{project.amount.toLocaleString()}
                      </p>
                    </div>
                  )}
                  <div className="bg-white rounded-lg p-2">
                    <p className="text-[10px] text-gray-400 uppercase">Erstellt</p>
                    <p className="text-xs text-gray-700 font-medium flex items-center gap-1">
                      <Calendar className="w-3 h-3 flex-shrink-0" />
                      {new Date(project.created_at).toLocaleDateString('de-DE')}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminSustainability;
