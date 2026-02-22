/**
 * Admin Support Management Component
 * View and respond to tickets and chats
 */
import { useState, useEffect, useCallback } from 'react';
import { 
  Ticket, MessageCircle, Phone, Mail, CheckCircle, Clock, 
  AlertCircle, Send, RefreshCw, Settings, Users, Filter
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { toast } from 'sonner';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

export default function AdminSupportManagement({ token }) {
  const [activeTab, setActiveTab] = useState('tickets'); // tickets, chats, settings
  const [tickets, setTickets] = useState([]);
  const [chats, setChats] = useState([]);
  const [stats, setStats] = useState({ total: 0, open: 0, in_progress: 0, resolved: 0 });
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [selectedChat, setSelectedChat] = useState(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  
  // Settings
  const [settings, setSettings] = useState({ hotline: '', email: '' });
  const [editHotline, setEditHotline] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    try {
      const url = statusFilter 
        ? `${API}/api/support/admin/tickets?status=${statusFilter}`
        : `${API}/api/support/admin/tickets`;
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTickets(response.data.tickets || []);
      setStats(response.data.stats || {});
    } catch (error) {
      toast.error('Fehler beim Laden der Tickets');
    } finally {
      setLoading(false);
    }
  }, [token, statusFilter]);

  const loadChats = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/api/support/admin/chats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setChats(response.data.chats || []);
    } catch (error) {
      console.error('Failed to load chats:', error);
    }
  }, [token]);

  const loadSettings = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/api/support/settings`);
      setSettings(response.data);
      setEditHotline(response.data.hotline || '');
      setEditEmail(response.data.email || '');
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }, []);

  useEffect(() => {
    loadTickets();
    loadChats();
    loadSettings();
  }, [loadTickets, loadChats, loadSettings]);

  const replyToTicket = async () => {
    if (!replyMessage.trim() || !selectedTicket) return;
    try {
      await axios.post(`${API}/api/support/admin/tickets/${selectedTicket.id}/reply`,
        { message: replyMessage },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Antwort gesendet');
      setReplyMessage('');
      // Reload ticket
      const response = await axios.get(`${API}/api/support/admin/tickets/${selectedTicket.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSelectedTicket(response.data);
      loadTickets();
    } catch (error) {
      toast.error('Fehler beim Senden');
    }
  };

  const updateTicketStatus = async (ticketId, status) => {
    try {
      await axios.put(`${API}/api/support/admin/tickets/${ticketId}/status?status=${status}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(`Status auf "${status}" geändert`);
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket({ ...selectedTicket, status });
      }
      loadTickets();
    } catch (error) {
      toast.error('Fehler beim Status-Update');
    }
  };

  const replyToChat = async () => {
    if (!replyMessage.trim() || !selectedChat) return;
    try {
      await axios.post(`${API}/api/support/admin/chats/${selectedChat.id}/reply`,
        { message: replyMessage },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Nachricht gesendet');
      setReplyMessage('');
      loadChats();
      // Update selected chat
      const updatedChat = chats.find(c => c.id === selectedChat.id);
      if (updatedChat) {
        setSelectedChat({ ...updatedChat, messages: [...(updatedChat.messages || []), { sender: 'admin', message: replyMessage }] });
      }
    } catch (error) {
      toast.error('Fehler beim Senden');
    }
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      await axios.put(`${API}/api/support/settings`, {
        hotline: editHotline,
        email: editEmail
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Einstellungen gespeichert');
      loadSettings();
    } catch (error) {
      toast.error('Fehler beim Speichern');
    } finally {
      setSavingSettings(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'open': return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'in_progress': return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'resolved': return 'bg-green-100 text-green-700 border-green-300';
      case 'closed': return 'bg-gray-100 text-gray-600 border-gray-300';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-lg sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Ticket className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
            Support-Management
          </h2>
          <p className="text-xs sm:text-sm text-gray-500">Tickets, Chats und Einstellungen</p>
        </div>
        <Button onClick={() => { loadTickets(); loadChats(); }} variant="outline" size="sm">
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Aktualisieren
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-2 sm:gap-4">
        <div className="bg-white rounded-lg p-2 sm:p-4 border text-center">
          <div className="text-lg sm:text-2xl font-bold text-gray-800">{stats.total}</div>
          <div className="text-[10px] sm:text-xs text-gray-500">Gesamt</div>
        </div>
        <div className="bg-yellow-50 rounded-lg p-2 sm:p-4 border border-yellow-200 text-center">
          <div className="text-lg sm:text-2xl font-bold text-yellow-600">{stats.open}</div>
          <div className="text-[10px] sm:text-xs text-yellow-600">Offen</div>
        </div>
        <div className="bg-blue-50 rounded-lg p-2 sm:p-4 border border-blue-200 text-center">
          <div className="text-lg sm:text-2xl font-bold text-blue-600">{stats.in_progress}</div>
          <div className="text-[10px] sm:text-xs text-blue-600">In Bearbeitung</div>
        </div>
        <div className="bg-green-50 rounded-lg p-2 sm:p-4 border border-green-200 text-center">
          <div className="text-lg sm:text-2xl font-bold text-green-600">{stats.resolved}</div>
          <div className="text-[10px] sm:text-xs text-green-600">Gelöst</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b pb-2">
        <button
          onClick={() => setActiveTab('tickets')}
          className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 ${
            activeTab === 'tickets' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'
          }`}
        >
          <Ticket className="w-4 h-4" />
          Tickets
          {stats.open > 0 && <span className="bg-yellow-500 text-white text-xs px-1.5 rounded-full">{stats.open}</span>}
        </button>
        <button
          onClick={() => setActiveTab('chats')}
          className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 ${
            activeTab === 'chats' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'
          }`}
        >
          <MessageCircle className="w-4 h-4" />
          Chats
          {chats.length > 0 && <span className="bg-green-500 text-white text-xs px-1.5 rounded-full">{chats.length}</span>}
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 ${
            activeTab === 'settings' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'
          }`}
        >
          <Settings className="w-4 h-4" />
          Einstellungen
        </button>
      </div>

      {/* Tickets Tab */}
      {activeTab === 'tickets' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Ticket List */}
          <div className="bg-white rounded-lg border p-3">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-sm">Alle Tickets</h3>
              <select 
                value={statusFilter} 
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs border rounded px-2 py-1"
              >
                <option value="">Alle Status</option>
                <option value="open">Offen</option>
                <option value="in_progress">In Bearbeitung</option>
                <option value="resolved">Gelöst</option>
                <option value="closed">Geschlossen</option>
              </select>
            </div>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {tickets.map((ticket) => (
                <button
                  key={ticket.id}
                  onClick={() => setSelectedTicket(ticket)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedTicket?.id === ticket.id ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-500">#{ticket.id}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${getStatusColor(ticket.status)}`}>
                      {ticket.status}
                    </span>
                  </div>
                  <p className="font-medium text-sm truncate">{ticket.subject}</p>
                  <p className="text-xs text-gray-500">{ticket.user_name} • {new Date(ticket.created_at).toLocaleDateString('de-DE')}</p>
                </button>
              ))}
              {tickets.length === 0 && (
                <div className="text-center text-gray-400 py-8">Keine Tickets</div>
              )}
            </div>
          </div>

          {/* Ticket Detail */}
          <div className="bg-white rounded-lg border p-3">
            {selectedTicket ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-gray-500">#{selectedTicket.id}</span>
                    <h3 className="font-bold">{selectedTicket.subject}</h3>
                    <p className="text-xs text-gray-500">{selectedTicket.user_name} ({selectedTicket.user_email})</p>
                  </div>
                  <select
                    value={selectedTicket.status}
                    onChange={(e) => updateTicketStatus(selectedTicket.id, e.target.value)}
                    className={`text-xs px-2 py-1 rounded border ${getStatusColor(selectedTicket.status)}`}
                  >
                    <option value="open">Offen</option>
                    <option value="in_progress">In Bearbeitung</option>
                    <option value="resolved">Gelöst</option>
                    <option value="closed">Geschlossen</option>
                  </select>
                </div>
                
                <div className="space-y-2 max-h-[250px] overflow-y-auto border-t border-b py-3">
                  {selectedTicket.messages?.map((msg) => (
                    <div key={msg.id} className={`p-2 rounded-lg ${msg.sender === 'admin' ? 'bg-blue-50 border-l-4 border-blue-500' : 'bg-gray-50'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium">{msg.sender_name}</span>
                        <span className="text-[10px] text-gray-400">
                          {new Date(msg.created_at).toLocaleString('de-DE')}
                        </span>
                      </div>
                      <p className="text-sm">{msg.message}</p>
                    </div>
                  ))}
                </div>
                
                <div className="flex gap-2">
                  <Input
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    placeholder="Antwort schreiben..."
                    className="flex-1"
                    onKeyDown={(e) => e.key === 'Enter' && replyToTicket()}
                  />
                  <Button onClick={replyToTicket} size="icon">
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-400 py-12">
                <Ticket className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Wählen Sie ein Ticket aus</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Chats Tab */}
      {activeTab === 'chats' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Chat List */}
          <div className="bg-white rounded-lg border p-3">
            <h3 className="font-medium text-sm mb-3">Aktive Chats</h3>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {chats.map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => setSelectedChat(chat)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedChat?.id === chat.id ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{chat.user_name || 'Unbekannt'}</p>
                      <p className="text-xs text-gray-500">{chat.user_email}</p>
                    </div>
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                      {chat.messages?.length || 0} Nachrichten
                    </span>
                  </div>
                </button>
              ))}
              {chats.length === 0 && (
                <div className="text-center text-gray-400 py-8">Keine aktiven Chats</div>
              )}
            </div>
          </div>

          {/* Chat Detail */}
          <div className="bg-white rounded-lg border p-3">
            {selectedChat ? (
              <div className="space-y-3">
                <div className="border-b pb-2">
                  <h3 className="font-bold">{selectedChat.user_name || 'Unbekannt'}</h3>
                  <p className="text-xs text-gray-500">{selectedChat.user_email}</p>
                </div>
                
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {selectedChat.messages?.map((msg, idx) => (
                    <div key={idx} className={`p-2 rounded-lg ${msg.sender === 'admin' ? 'bg-blue-50 ml-4' : 'bg-gray-50 mr-4'}`}>
                      <p className="text-sm">{msg.message}</p>
                      <p className="text-[10px] text-gray-400 mt-1">
                        {msg.sender === 'admin' ? 'Support' : selectedChat.user_name}
                      </p>
                    </div>
                  ))}
                </div>
                
                <div className="flex gap-2 pt-2 border-t">
                  <Input
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    placeholder="Nachricht schreiben..."
                    className="flex-1"
                    onKeyDown={(e) => e.key === 'Enter' && replyToChat()}
                  />
                  <Button onClick={replyToChat} size="icon">
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-400 py-12">
                <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Wählen Sie einen Chat aus</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="bg-white rounded-lg border p-4 max-w-md">
          <h3 className="font-bold mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Support-Einstellungen
          </h3>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                <Phone className="w-4 h-4 inline mr-1" />
                Hotline-Nummer
              </label>
              <Input
                value={editHotline}
                onChange={(e) => setEditHotline(e.target.value)}
                placeholder="+49 123 456789"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                <Mail className="w-4 h-4 inline mr-1" />
                Support-E-Mail
              </label>
              <Input
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="support@example.com"
              />
            </div>
            <Button onClick={saveSettings} disabled={savingSettings} className="w-full">
              {savingSettings ? 'Wird gespeichert...' : 'Einstellungen speichern'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
