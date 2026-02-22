/**
 * KYC Management - Kunden-Identitätsverifizierung
 * Admin kann Benutzer freischalten oder ablehnen
 */
import { useState, useEffect, useCallback } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { 
  Shield, CheckCircle, XCircle, Clock, Search, 
  User, CreditCard, Camera, Eye, ChevronDown, ChevronUp,
  AlertTriangle, RefreshCw, Filter
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function KYCManagement({ token }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [search, setSearch] = useState('');
  const [expandedUser, setExpandedUser] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/auth/kyc/all`, {
        headers: { 'Authorization': `Bearer ${token}` },
        params: { status: filter !== 'all' ? filter : undefined }
      });
      setUsers(response.data.users || []);
    } catch (error) {
      toast.error('Fehler beim Laden');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [token, filter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleApprove = async (userId) => {
    setProcessing(userId);
    try {
      await axios.post(`${API}/auth/kyc/approve`, {
        user_id: userId,
        approved: true
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      toast.success('Benutzer freigeschaltet');
      fetchUsers();
      setExpandedUser(null);
    } catch (error) {
      toast.error('Fehler bei der Freischaltung');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (userId) => {
    if (!rejectionReason.trim()) {
      toast.error('Bitte Ablehnungsgrund angeben');
      return;
    }
    setProcessing(userId);
    try {
      await axios.post(`${API}/auth/kyc/approve`, {
        user_id: userId,
        approved: false,
        rejection_reason: rejectionReason
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      toast.success('Benutzer abgelehnt');
      fetchUsers();
      setExpandedUser(null);
      setRejectionReason('');
    } catch (error) {
      toast.error('Fehler bei der Ablehnung');
    } finally {
      setProcessing(null);
    }
  };

  const filteredUsers = users.filter(user => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      user.email?.toLowerCase().includes(searchLower) ||
      user.name?.toLowerCase().includes(searchLower)
    );
  });

  const stats = {
    pending: users.filter(u => u.kyc_status === 'pending' && u.kyc_id_front).length,
    approved: users.filter(u => u.kyc_status === 'approved').length,
    rejected: users.filter(u => u.kyc_status === 'rejected').length,
    noDocuments: users.filter(u => u.kyc_status === 'pending' && !u.kyc_id_front).length
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded-full text-xs flex items-center gap-1">
          <CheckCircle className="w-3 h-3" /> Freigeschaltet
        </span>;
      case 'rejected':
        return <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded-full text-xs flex items-center gap-1">
          <XCircle className="w-3 h-3" /> Abgelehnt
        </span>;
      default:
        return <span className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded-full text-xs flex items-center gap-1">
          <Clock className="w-3 h-3" /> Ausstehend
        </span>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-amber-400" />
          <h2 className="text-xl font-bold text-white">KYC-Freischaltung</h2>
        </div>
        <Button onClick={fetchUsers} variant="outline" size="sm" className="border-slate-600">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Aktualisieren
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-amber-500/10 rounded-lg p-3 border border-amber-500/30">
          <div className="text-2xl font-bold text-amber-400">{stats.pending}</div>
          <div className="text-xs text-amber-300">Ausstehend</div>
        </div>
        <div className="bg-green-500/10 rounded-lg p-3 border border-green-500/30">
          <div className="text-2xl font-bold text-green-400">{stats.approved}</div>
          <div className="text-xs text-green-300">Freigeschaltet</div>
        </div>
        <div className="bg-red-500/10 rounded-lg p-3 border border-red-500/30">
          <div className="text-2xl font-bold text-red-400">{stats.rejected}</div>
          <div className="text-xs text-red-300">Abgelehnt</div>
        </div>
        <div className="bg-slate-700/50 rounded-lg p-3 border border-slate-600/50">
          <div className="text-2xl font-bold text-slate-400">{stats.noDocuments}</div>
          <div className="text-xs text-slate-500">Ohne Dokumente</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Suche..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-slate-800/50 border-slate-700 text-white"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {[
            { value: 'pending', label: 'Ausstehend' },
            { value: 'approved', label: 'Freigeschaltet' },
            { value: 'rejected', label: 'Abgelehnt' },
            { value: 'all', label: 'Alle' }
          ].map(({ value, label }) => (
            <Button
              key={value}
              onClick={() => setFilter(value)}
              variant={filter === value ? 'default' : 'outline'}
              size="sm"
              className={filter === value 
                ? 'bg-amber-500 hover:bg-amber-600' 
                : 'border-slate-600 text-slate-300'
              }
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {/* User List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="w-6 h-6 text-amber-400 animate-spin" />
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <User className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p>Keine Benutzer gefunden</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredUsers.map((user) => (
            <div key={user.id} className="bg-slate-800/50 rounded-lg border border-slate-700/50 overflow-hidden">
              {/* User Header */}
              <div 
                className="p-3 flex items-center justify-between cursor-pointer hover:bg-slate-700/30"
                onClick={() => setExpandedUser(expandedUser === user.id ? null : user.id)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="w-5 h-5 text-slate-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-white truncate">{user.name || 'Unbekannt'}</div>
                    <div className="text-xs text-slate-400 truncate">{user.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {getStatusBadge(user.kyc_status)}
                  <div className="flex gap-1">
                    {user.kyc_id_front && <CreditCard className="w-4 h-4 text-green-400" />}
                    {user.kyc_selfie && <Camera className="w-4 h-4 text-green-400" />}
                  </div>
                  {expandedUser === user.id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>
              </div>

              {/* Expanded Details */}
              {expandedUser === user.id && (
                <div className="border-t border-slate-700/50 p-4">
                  {/* Documents */}
                  {(user.kyc_id_front || user.kyc_id_back || user.kyc_selfie) ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                      {/* ID Front */}
                      <div className="bg-slate-900/50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <CreditCard className="w-4 h-4 text-amber-400" />
                          <span className="text-xs font-medium text-white">Ausweis Vorderseite</span>
                        </div>
                        {user.kyc_id_front ? (
                          <a href={user.kyc_id_front} target="_blank" rel="noopener noreferrer">
                            <img src={user.kyc_id_front} alt="ID Front" className="w-full h-28 object-cover rounded hover:opacity-80" />
                          </a>
                        ) : (
                          <div className="h-28 flex items-center justify-center bg-slate-800 rounded text-slate-500 text-xs">Nicht hochgeladen</div>
                        )}
                      </div>

                      {/* ID Back */}
                      <div className="bg-slate-900/50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <CreditCard className="w-4 h-4 text-amber-400" />
                          <span className="text-xs font-medium text-white">Ausweis Rückseite</span>
                        </div>
                        {user.kyc_id_back ? (
                          <a href={user.kyc_id_back} target="_blank" rel="noopener noreferrer">
                            <img src={user.kyc_id_back} alt="ID Back" className="w-full h-28 object-cover rounded hover:opacity-80" />
                          </a>
                        ) : (
                          <div className="h-28 flex items-center justify-center bg-slate-800 rounded text-slate-500 text-xs">Nicht hochgeladen</div>
                        )}
                      </div>

                      {/* Selfie */}
                      <div className="bg-slate-900/50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Camera className="w-4 h-4 text-amber-400" />
                          <span className="text-xs font-medium text-white">Selfie mit Ausweis</span>
                        </div>
                        {user.kyc_selfie ? (
                          <a href={user.kyc_selfie} target="_blank" rel="noopener noreferrer">
                            <img src={user.kyc_selfie} alt="Selfie" className="w-full h-28 object-cover rounded hover:opacity-80" />
                          </a>
                        ) : (
                          <div className="h-28 flex items-center justify-center bg-slate-800 rounded text-slate-500 text-xs">Nicht hochgeladen</div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-900/50 rounded-lg p-4 mb-4 text-center">
                      <AlertTriangle className="w-6 h-6 text-amber-400 mx-auto mb-2" />
                      <p className="text-slate-400 text-sm">Keine Dokumente hochgeladen</p>
                    </div>
                  )}

                  {/* Rejection Reason */}
                  {user.kyc_status === 'rejected' && user.kyc_rejection_reason && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
                      <div className="flex items-center gap-2 text-red-400 mb-1">
                        <XCircle className="w-4 h-4" />
                        <span className="text-sm font-medium">Ablehnungsgrund:</span>
                      </div>
                      <p className="text-slate-300 text-sm">{user.kyc_rejection_reason}</p>
                    </div>
                  )}

                  {/* Actions */}
                  {user.kyc_status === 'pending' && user.kyc_id_front && user.kyc_id_back && user.kyc_selfie && (
                    <div className="space-y-3">
                      <div className="flex gap-3">
                        <Button
                          onClick={() => handleApprove(user.id)}
                          disabled={processing === user.id}
                          className="flex-1 bg-green-500 hover:bg-green-600"
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Freischalten
                        </Button>
                        <Button
                          onClick={() => handleReject(user.id)}
                          disabled={processing === user.id || !rejectionReason.trim()}
                          variant="outline"
                          className="flex-1 border-red-500 text-red-400 hover:bg-red-500/20"
                        >
                          <XCircle className="w-4 h-4 mr-2" />
                          Ablehnen
                        </Button>
                      </div>
                      <Input
                        placeholder="Ablehnungsgrund (erforderlich für Ablehnung)"
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        className="bg-slate-900/50 border-slate-700"
                      />
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
}
