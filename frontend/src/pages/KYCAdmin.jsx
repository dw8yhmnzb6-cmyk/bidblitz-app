import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, CheckCircle, XCircle, User, Clock,
  CreditCard, Eye, Search, Filter, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Übersetzungen
const translations = {
  de: {
    title: 'KYC-Verifizierung',
    pendingUsers: 'Ausstehende Verifizierungen',
    allUsers: 'Alle Benutzer',
    noPending: 'Keine ausstehenden Verifizierungen',
    approve: 'Freischalten',
    reject: 'Ablehnen',
    viewDocs: 'Dokumente ansehen',
    idFront: 'Ausweis Vorderseite',
    idBack: 'Ausweis Rückseite',
    selfie: 'Selfie mit Ausweis',
    submittedAt: 'Eingereicht am',
    rejectionReason: 'Ablehnungsgrund',
    rejectionPlaceholder: 'Grund für Ablehnung eingeben...',
    approved: 'Benutzer freigeschaltet',
    rejected: 'Benutzer abgelehnt',
    pending: 'Ausstehend',
    approvedStatus: 'Freigeschalten',
    rejectedStatus: 'Abgelehnt',
    filter: 'Filter',
    all: 'Alle',
    refresh: 'Aktualisieren',
    back: 'Zurück'
  },
  en: {
    title: 'KYC Verification',
    pendingUsers: 'Pending Verifications',
    allUsers: 'All Users',
    noPending: 'No pending verifications',
    approve: 'Approve',
    reject: 'Reject',
    viewDocs: 'View Documents',
    idFront: 'ID Front',
    idBack: 'ID Back',
    selfie: 'Selfie with ID',
    submittedAt: 'Submitted on',
    rejectionReason: 'Rejection Reason',
    rejectionPlaceholder: 'Enter rejection reason...',
    approved: 'User approved',
    rejected: 'User rejected',
    pending: 'Pending',
    approvedStatus: 'Approved',
    rejectedStatus: 'Rejected',
    filter: 'Filter',
    all: 'All',
    refresh: 'Refresh',
    back: 'Back'
  }
};

export default function KYCAdmin() {
  const navigate = useNavigate();
  const [language] = useState(localStorage.getItem('language') || 'de');
  const t = translations[language] || translations.de;
  
  const [pendingUsers, setPendingUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [filter, setFilter] = useState('pending'); // pending, approved, rejected, all
  const [viewTab, setViewTab] = useState('pending'); // pending, all
  
  const token = localStorage.getItem('bidblitz_token');

  const fetchPendingUsers = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/auth/kyc/pending`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPendingUsers(data.pending_users || []);
      }
    } catch (err) {
      console.error('Error fetching pending users:', err);
    }
  }, [token]);

  const fetchAllUsers = useCallback(async () => {
    try {
      const statusParam = filter !== 'all' ? `?status=${filter}` : '';
      const res = await fetch(`${API_URL}/api/auth/kyc/all${statusParam}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAllUsers(data.users || []);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  }, [token, filter]);

  useEffect(() => {
    fetchPendingUsers();
    fetchAllUsers();
  }, [fetchPendingUsers, fetchAllUsers]);

  const handleApprove = async (userId) => {
    try {
      const res = await fetch(`${API_URL}/api/auth/kyc/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: userId,
          approved: true
        })
      });
      
      if (res.ok) {
        toast.success(t.approved);
        fetchPendingUsers();
        fetchAllUsers();
        setSelectedUser(null);
      }
    } catch (err) {
      toast.error('Error');
    }
  };

  const handleReject = async () => {
    if (!selectedUser || !rejectionReason.trim()) return;
    
    try {
      const res = await fetch(`${API_URL}/api/auth/kyc/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: selectedUser.id,
          approved: false,
          rejection_reason: rejectionReason
        })
      });
      
      if (res.ok) {
        toast.success(t.rejected);
        fetchPendingUsers();
        fetchAllUsers();
        setSelectedUser(null);
        setShowRejectModal(false);
        setRejectionReason('');
      }
    } catch (err) {
      toast.error('Error');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded-full text-xs">{t.approvedStatus}</span>;
      case 'rejected':
        return <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded-full text-xs">{t.rejectedStatus}</span>;
      default:
        return <span className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded-full text-xs">{t.pending}</span>;
    }
  };

  // User Card Component
  const UserCard = ({ user, showActions = true }) => (
    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-medium text-white">{user.name || 'Unbekannt'}</h3>
          <p className="text-sm text-slate-400">{user.email}</p>
        </div>
        {getStatusBadge(user.kyc_status)}
      </div>
      
      {user.kyc_submitted_at && (
        <p className="text-xs text-slate-500 mb-3">
          <Clock className="w-3 h-3 inline mr-1" />
          {t.submittedAt}: {new Date(user.kyc_submitted_at).toLocaleDateString('de-DE')}
        </p>
      )}
      
      {/* Document Previews */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {user.kyc_id_front && (
          <div className="relative group">
            <img 
              src={user.kyc_id_front} 
              alt="ID Front" 
              className="w-full h-16 object-cover rounded cursor-pointer"
              onClick={() => window.open(user.kyc_id_front, '_blank')}
            />
            <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs text-center py-0.5">
              {t.idFront}
            </span>
          </div>
        )}
        {user.kyc_id_back && (
          <div className="relative group">
            <img 
              src={user.kyc_id_back} 
              alt="ID Back" 
              className="w-full h-16 object-cover rounded cursor-pointer"
              onClick={() => window.open(user.kyc_id_back, '_blank')}
            />
            <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs text-center py-0.5">
              {t.idBack}
            </span>
          </div>
        )}
        {user.kyc_selfie && (
          <div className="relative group">
            <img 
              src={user.kyc_selfie} 
              alt="Selfie" 
              className="w-full h-16 object-cover rounded cursor-pointer"
              onClick={() => window.open(user.kyc_selfie, '_blank')}
            />
            <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs text-center py-0.5">
              {t.selfie}
            </span>
          </div>
        )}
      </div>
      
      {/* Actions */}
      {showActions && user.kyc_status === 'pending' && (
        <div className="flex gap-2">
          <Button
            onClick={() => handleApprove(user.id)}
            className="flex-1 bg-green-500 hover:bg-green-600"
            size="sm"
          >
            <CheckCircle className="w-4 h-4 mr-1" />
            {t.approve}
          </Button>
          <Button
            onClick={() => {
              setSelectedUser(user);
              setShowRejectModal(true);
            }}
            variant="outline"
            className="flex-1 border-red-500 text-red-400 hover:bg-red-500/20"
            size="sm"
          >
            <XCircle className="w-4 h-4 mr-1" />
            {t.reject}
          </Button>
        </div>
      )}
      
      {user.kyc_rejection_reason && (
        <div className="mt-3 p-2 bg-red-500/10 border border-red-500/30 rounded text-sm text-red-400">
          <strong>{t.rejectionReason}:</strong> {user.kyc_rejection_reason}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-4 md:p-8">
      {/* Header */}
      <div className="max-w-4xl mx-auto mb-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/admin')}
              className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
                <CreditCard className="w-8 h-8 text-amber-500" />
                {t.title}
              </h1>
              <p className="text-slate-400 text-sm mt-1">
                {pendingUsers.length} {t.pending.toLowerCase()}
              </p>
            </div>
          </div>
          
          <Button
            onClick={() => { fetchPendingUsers(); fetchAllUsers(); }}
            variant="outline"
            className="border-slate-600"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            {t.refresh}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-4xl mx-auto mb-6">
        <div className="flex gap-2 p-1 bg-slate-800 rounded-lg">
          <button
            onClick={() => setViewTab('pending')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              viewTab === 'pending' 
                ? 'bg-amber-500 text-white' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {t.pendingUsers} ({pendingUsers.length})
          </button>
          <button
            onClick={() => setViewTab('all')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              viewTab === 'all' 
                ? 'bg-amber-500 text-white' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {t.allUsers}
          </button>
        </div>
      </div>

      {/* Filter for All Users */}
      {viewTab === 'all' && (
        <div className="max-w-4xl mx-auto mb-6 flex gap-2">
          {['all', 'pending', 'approved', 'rejected'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                filter === f 
                  ? 'bg-amber-500 text-white' 
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {f === 'all' ? t.all : f === 'pending' ? t.pending : f === 'approved' ? t.approvedStatus : t.rejectedStatus}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="max-w-4xl mx-auto">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : viewTab === 'pending' ? (
          pendingUsers.length === 0 ? (
            <div className="text-center py-12 bg-slate-800/50 rounded-2xl">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <p className="text-slate-400">{t.noPending}</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {pendingUsers.map((user) => (
                <UserCard key={user.id} user={user} showActions={true} />
              ))}
            </div>
          )
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {allUsers.map((user) => (
              <UserCard key={user.id} user={user} showActions={user.kyc_status === 'pending'} />
            ))}
          </div>
        )}
      </div>

      {/* Rejection Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <XCircle className="w-6 h-6 text-red-400" />
              {t.reject}: {selectedUser?.email}
            </h3>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder={t.rejectionPlaceholder}
              className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white mb-4 h-32"
            />
            <div className="flex gap-3">
              <Button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectionReason('');
                }}
                variant="outline"
                className="flex-1"
              >
                Abbrechen
              </Button>
              <Button
                onClick={handleReject}
                disabled={!rejectionReason.trim()}
                className="flex-1 bg-red-500 hover:bg-red-600"
              >
                {t.reject}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
