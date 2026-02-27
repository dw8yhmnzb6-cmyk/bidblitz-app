/**
 * Admin Support Tickets Management - Mobile-Responsive
 */
import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  MessageSquare, Clock, User, Send, RefreshCw, Search,
  AlertCircle, CheckCircle, Hourglass, XCircle, ArrowLeft
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

const API = process.env.REACT_APP_BACKEND_URL;

const statusConfig = {
  open: { label: 'Offen', color: 'bg-blue-100 text-blue-700', icon: AlertCircle },
  in_progress: { label: 'In Bearbeitung', color: 'bg-yellow-100 text-yellow-700', icon: Hourglass },
  waiting: { label: 'Wartet auf Kunde', color: 'bg-purple-100 text-purple-700', icon: Clock },
  resolved: { label: 'Gelöst', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  closed: { label: 'Geschlossen', color: 'bg-slate-100 text-slate-700', icon: XCircle }
};

const priorityConfig = {
  low: { label: 'Niedrig', color: 'text-slate-500' },
  normal: { label: 'Normal', color: 'text-blue-500' },
  high: { label: 'Hoch', color: 'text-orange-500' },
  urgent: { label: 'Dringend', color: 'text-red-500' }
};

export default function AdminTickets({ token }) {
  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [filter, setFilter] = useState('open');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => { fetchTickets(); }, [filter]);

  const fetchTickets = async () => {
    try {
      const res = await axios.get(`${API}/api/tickets/admin/all`, {
        params: filter !== 'all' ? { status: filter } : {},
        headers: { Authorization: `Bearer ${token}` }
      });
      setTickets(res.data.tickets || []);
      setStats(res.data.stats || {});
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTicketDetails = async (ticketId) => {
    try {
      const res = await axios.get(`${API}/api/tickets/${ticketId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSelectedTicket(res.data.ticket);
      setMessages(res.data.messages || []);
    } catch (error) {
      console.error('Error fetching ticket:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedTicket) return;
    try {
      await axios.post(`${API}/api/tickets/${selectedTicket.id}/messages`, 
        { message: newMessage },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setNewMessage('');
      fetchTicketDetails(selectedTicket.id);
    } catch (error) {
      alert(error.response?.data?.detail || 'Fehler beim Senden');
    }
  };

  const handleUpdateStatus = async (ticketId, newStatus) => {
    try {
      await axios.patch(`${API}/api/tickets/admin/${ticketId}`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchTickets();
      if (selectedTicket?.id === ticketId) {
        fetchTicketDetails(ticketId);
      }
    } catch (error) {
      alert(error.response?.data?.detail || 'Fehler beim Aktualisieren');
    }
  };

  const filteredTickets = tickets.filter(t =>
    t.ticket_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.user_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 animate-spin text-violet-500" />
      </div>
    );
  }

  // Mobile: Show detail view if ticket is selected
  if (selectedTicket) {
    return (
      <div className="flex flex-col h-[calc(100vh-200px)] lg:flex-row lg:gap-6" data-testid="admin-tickets">
        {/* Desktop: Still show list on left */}
        <div className="hidden lg:flex lg:w-1/2 lg:flex-col">
          <TicketListView
            tickets={filteredTickets}
            stats={stats}
            filter={filter}
            setFilter={setFilter}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            selectedTicket={selectedTicket}
            onSelect={(id) => fetchTicketDetails(id)}
          />
        </div>

        {/* Detail Panel - Full width on mobile */}
        <div className="flex-1 flex flex-col bg-white rounded-xl border border-slate-100 min-h-0">
          {/* Back button on mobile */}
          <div className="lg:hidden p-3 border-b border-slate-100">
            <button
              onClick={() => setSelectedTicket(null)}
              className="flex items-center gap-2 text-sm text-violet-600 font-medium"
              data-testid="ticket-back-btn"
            >
              <ArrowLeft className="w-4 h-4" />
              Zurück zur Liste
            </button>
          </div>

          {/* Ticket Header */}
          <div className="p-3 sm:p-4 border-b border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
              <div className="min-w-0">
                <h2 className="font-bold text-slate-800 text-sm sm:text-base break-words">{selectedTicket.subject}</h2>
                <p className="text-xs text-slate-400 mt-1 break-all">
                  {selectedTicket.ticket_number} · {selectedTicket.user_name} · {selectedTicket.user_email}
                </p>
              </div>
              <select
                value={selectedTicket.status}
                onChange={(e) => handleUpdateStatus(selectedTicket.id, e.target.value)}
                className="text-sm border rounded-lg px-2 py-1 flex-shrink-0 w-full sm:w-auto"
              >
                <option value="open">Offen</option>
                <option value="in_progress">In Bearbeitung</option>
                <option value="waiting">Wartet auf Kunde</option>
                <option value="resolved">Gelöst</option>
                <option value="closed">Geschlossen</option>
              </select>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.sender === 'agent' || msg.sender === 'system' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[85%] rounded-xl px-3 py-2 ${
                  msg.sender === 'agent' ? 'bg-violet-500 text-white' :
                  msg.sender === 'system' ? 'bg-slate-200 text-slate-700' :
                  'bg-slate-100 text-slate-800'
                }`}>
                  <p className="text-sm break-words">{msg.message}</p>
                  <p className={`text-xs mt-1 ${msg.sender === 'agent' ? 'text-violet-200' : 'text-slate-400'}`}>
                    {msg.sender_name} · {new Date(msg.created_at).toLocaleString('de-DE')}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Reply */}
          {selectedTicket.status !== 'closed' && (
            <div className="p-3 sm:p-4 border-t border-slate-100">
              <div className="flex gap-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Antwort schreiben..."
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  className="flex-1"
                />
                <Button onClick={handleSendMessage} className="bg-violet-500 hover:bg-violet-600 flex-shrink-0">
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // No ticket selected - show list only
  return (
    <div className="flex flex-col lg:flex-row lg:gap-6 h-[calc(100vh-200px)]" data-testid="admin-tickets">
      <div className="flex-1 flex flex-col">
        <TicketListView
          tickets={filteredTickets}
          stats={stats}
          filter={filter}
          setFilter={setFilter}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          selectedTicket={selectedTicket}
          onSelect={(id) => fetchTicketDetails(id)}
        />
      </div>
      {/* Desktop: Empty state on right */}
      <div className="hidden lg:flex lg:w-1/2 bg-white rounded-xl border border-slate-100 items-center justify-center text-slate-400">
        Wählen Sie ein Ticket aus
      </div>
    </div>
  );
}

function TicketListView({ tickets, stats, filter, setFilter, searchTerm, setSearchTerm, selectedTicket, onSelect }) {
  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg flex-shrink-0">
          <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
        </div>
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-slate-800">Tickets</h1>
          <p className="text-slate-500 text-xs sm:text-sm">{tickets.length} Tickets</p>
        </div>
      </div>

      {/* Stats - scrollable on mobile */}
      <div className="flex gap-1.5 sm:gap-2 mb-4 flex-wrap">
        {Object.entries(statusConfig).map(([key, config]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-medium transition-all ${
              filter === key ? config.color + ' ring-2 ring-offset-1' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {config.label} ({stats[key] || 0})
          </button>
        ))}
        <button
          onClick={() => setFilter('all')}
          className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-medium transition-all ${
            filter === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500'
          }`}
        >
          Alle
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Suchen..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      {/* Tickets */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {tickets.map((ticket) => {
          const status = statusConfig[ticket.status] || statusConfig.open;
          const priority = priorityConfig[ticket.priority] || priorityConfig.normal;
          return (
            <div
              key={ticket.id}
              onClick={() => onSelect(ticket.id)}
              data-testid={`ticket-item-${ticket.id}`}
              className={`p-3 sm:p-4 rounded-xl border cursor-pointer transition-all ${
                selectedTicket?.id === ticket.id 
                  ? 'bg-violet-50 border-violet-200' 
                  : 'bg-white border-slate-100 hover:border-violet-200'
              }`}
            >
              <div className="flex items-start justify-between mb-1.5 gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-slate-800 text-sm truncate">{ticket.subject}</p>
                  <p className="text-[10px] sm:text-xs text-slate-400">{ticket.ticket_number}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] sm:text-xs flex-shrink-0 ${status.color}`}>
                  {status.label}
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px] sm:text-xs text-slate-500">
                <span className="flex items-center gap-1 truncate">
                  <User className="w-3 h-3 flex-shrink-0" />
                  {ticket.user_name}
                </span>
                <span className={`font-medium flex-shrink-0 ${priority.color}`}>{priority.label}</span>
              </div>
            </div>
          );
        })}
        {tickets.length === 0 && (
          <p className="text-center text-slate-400 py-8 text-sm">Keine Tickets gefunden</p>
        )}
      </div>
    </>
  );
}
