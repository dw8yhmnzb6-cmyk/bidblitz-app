import React, { useState, useEffect } from 'react';
import { 
  Building2, Check, X, Mail, Phone, Globe, MapPin, 
  FileText, Clock, User, Utensils, Percent, Euro,
  ChevronDown, ChevronUp, Trash2, RefreshCw
} from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'sonner';

const AdminRestaurantApplications = () => {
  const [applications, setApplications] = useState([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [processing, setProcessing] = useState(null);

  // Try both storage keys for token
  const token = localStorage.getItem('token') || sessionStorage.getItem('token') || localStorage.getItem('bidblitz_token');

  useEffect(() => {
    fetchApplications();
  }, [filter]);

  const fetchApplications = async () => {
    try {
      setLoading(true);
      const url = filter === 'all' 
        ? `${process.env.REACT_APP_BACKEND_URL}/api/admin/restaurant-applications`
        : `${process.env.REACT_APP_BACKEND_URL}/api/admin/restaurant-applications?status=${filter}`;
      
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setApplications(data.applications || []);
        setStats(data.stats || { total: 0, pending: 0, approved: 0, rejected: 0 });
      } else {
        console.error('Failed to fetch applications:', response.status);
      }
    } catch (error) {
      console.error('Error fetching applications:', error);
      toast.error('Fehler beim Laden der Bewerbungen');
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (applicationId, action) => {
    setProcessing(applicationId);
    try {
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/admin/restaurant-applications/${applicationId}/review?action=${action}`,
        {
          method: 'PUT',
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        toast.success(action === 'approve' ? 'Bewerbung genehmigt! 5 Gutscheine erstellt.' : 'Bewerbung abgelehnt');
        fetchApplications();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Fehler beim Verarbeiten');
      }
    } catch (error) {
      console.error('Error reviewing application:', error);
      toast.error('Fehler beim Verarbeiten');
    } finally {
      setProcessing(null);
    }
  };

  const handleDelete = async (applicationId) => {
    if (!window.confirm('Bewerbung wirklich löschen?')) return;
    
    try {
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/admin/restaurant-applications/${applicationId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.ok) {
        toast.success('Bewerbung gelöscht');
        fetchApplications();
      }
    } catch (error) {
      console.error('Error deleting application:', error);
      toast.error('Fehler beim Löschen');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: 'bg-yellow-100 text-yellow-700 border-yellow-300',
      approved: 'bg-green-100 text-green-700 border-green-300',
      rejected: 'bg-red-100 text-red-700 border-red-300'
    };
    const labels = {
      pending: 'Ausstehend',
      approved: 'Genehmigt',
      rejected: 'Abgelehnt'
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${badges[status] || badges.pending}`}>
        {labels[status] || status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-orange-500" />
            Restaurant-Partner Bewerbungen
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            Verwalten Sie eingehende Partner-Anfragen
          </p>
        </div>
        <Button
          onClick={fetchApplications}
          variant="outline"
          size="sm"
          className="border-orange-300 text-orange-600 hover:bg-orange-50"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Aktualisieren
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-gray-100 rounded-xl p-4 border border-gray-200">
          <p className="text-gray-500 text-sm">Gesamt</p>
          <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
        </div>
        <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
          <p className="text-yellow-600 text-sm">Ausstehend</p>
          <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4 border border-green-200">
          <p className="text-green-600 text-sm">Genehmigt</p>
          <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
        </div>
        <div className="bg-red-50 rounded-xl p-4 border border-red-200">
          <p className="text-red-600 text-sm">Abgelehnt</p>
          <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'pending', 'approved', 'rejected'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              filter === f
                ? 'bg-orange-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f === 'all' ? 'Alle' : f === 'pending' ? 'Ausstehend' : f === 'approved' ? 'Genehmigt' : 'Abgelehnt'}
          </button>
        ))}
      </div>

      {/* Applications List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-500 mt-2">Lade Bewerbungen...</p>
        </div>
      ) : applications.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-200">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Keine Bewerbungen gefunden</p>
        </div>
      ) : (
        <div className="space-y-4">
          {applications.map((app) => (
            <div
              key={app.id}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm"
            >
              {/* Application Header */}
              <div 
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setExpandedId(expandedId === app.id ? null : app.id)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center">
                    <Utensils className="w-6 h-6 text-orange-500" />
                  </div>
                  <div>
                    <h3 className="text-gray-800 font-semibold">{app.restaurant_name}</h3>
                    <p className="text-gray-500 text-sm">{app.city} • {app.contact_name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {getStatusBadge(app.status)}
                  {expandedId === app.id ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </div>

              {/* Expanded Details */}
              {expandedId === app.id && (
                <div className="border-t border-gray-200 p-4 space-y-4 bg-gray-50">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex items-start gap-2">
                      <User className="w-4 h-4 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-gray-500 text-xs">Ansprechpartner</p>
                        <p className="text-gray-800 text-sm">{app.contact_name}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Mail className="w-4 h-4 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-gray-500 text-xs">E-Mail</p>
                        <a href={`mailto:${app.email}`} className="text-orange-500 text-sm hover:underline">
                          {app.email}
                        </a>
                      </div>
                    </div>
                    {app.phone && (
                      <div className="flex items-start gap-2">
                        <Phone className="w-4 h-4 text-gray-400 mt-0.5" />
                        <div>
                          <p className="text-gray-500 text-xs">Telefon</p>
                          <p className="text-gray-800 text-sm">{app.phone}</p>
                        </div>
                      </div>
                    )}
                    {app.website && (
                      <div className="flex items-start gap-2">
                        <Globe className="w-4 h-4 text-gray-400 mt-0.5" />
                        <div>
                          <p className="text-gray-500 text-xs">Website</p>
                          <a href={app.website} target="_blank" rel="noopener noreferrer" className="text-orange-500 text-sm hover:underline">
                            {app.website}
                          </a>
                        </div>
                      </div>
                    )}
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-gray-500 text-xs">Adresse</p>
                        <p className="text-gray-800 text-sm">{app.address}, {app.city}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      {app.voucher_type === 'discount' ? (
                        <Percent className="w-4 h-4 text-gray-400 mt-0.5" />
                      ) : (
                        <Euro className="w-4 h-4 text-gray-400 mt-0.5" />
                      )}
                      <div>
                        <p className="text-gray-500 text-xs">Gutschein-Angebot</p>
                        <p className="text-gray-800 text-sm">
                          {app.voucher_value}{app.voucher_type === 'discount' ? '%' : '€'} {app.voucher_type === 'discount' ? 'Rabatt' : 'Gutschein'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <FileText className="w-4 h-4 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-gray-500 text-xs">Beschreibung</p>
                      <p className="text-gray-800 text-sm">{app.description}</p>
                    </div>
                  </div>

                  {app.message && (
                    <div className="flex items-start gap-2">
                      <FileText className="w-4 h-4 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-gray-500 text-xs">Nachricht</p>
                        <p className="text-gray-600 text-sm italic">"{app.message}"</p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-gray-500 text-xs">
                    <Clock className="w-3 h-3" />
                    <span>Eingereicht: {formatDate(app.created_at)}</span>
                    {app.reviewed_at && (
                      <span className="ml-4">Bearbeitet: {formatDate(app.reviewed_at)} von {app.reviewed_by}</span>
                    )}
                  </div>

                  {/* Action Buttons */}
                  {app.status === 'pending' && (
                    <div className="flex gap-3 pt-4 border-t border-gray-200">
                      <Button
                        onClick={() => handleReview(app.id, 'approve')}
                        disabled={processing === app.id}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                      >
                        {processing === app.id ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <Check className="w-4 h-4 mr-2" />
                            Genehmigen
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={() => handleReview(app.id, 'reject')}
                        disabled={processing === app.id}
                        variant="outline"
                        className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
                      >
                        <X className="w-4 h-4 mr-2" />
                        Ablehnen
                      </Button>
                    </div>
                  )}

                  {app.status !== 'pending' && (
                    <div className="flex justify-end pt-4 border-t border-gray-200">
                      <Button
                        onClick={() => handleDelete(app.id)}
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Löschen
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminRestaurantApplications;
