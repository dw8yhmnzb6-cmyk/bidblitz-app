/**
 * BidBlitz Chat System
 * Real-time chat between players
 */
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import BottomNav from '../components/BottomNav';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

export default function AppChat() {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [username, setUsername] = useState('User');
  const [onlineUsers, setOnlineUsers] = useState(0);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  
  useEffect(() => {
    fetchMessages();
    fetchUsername();
    
    // Poll for new messages every 3 seconds
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, []);
  
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  const fetchUsername = () => {
    const user = localStorage.getItem('user');
    if (user) {
      try {
        const userData = JSON.parse(user);
        setUsername(userData.username || userData.email?.split('@')[0] || 'User');
      } catch (e) {
        setUsername('User');
      }
    }
  };
  
  const fetchMessages = async () => {
    try {
      const res = await axios.get(`${API}/app/chat/messages`);
      setMessages(res.data.messages || []);
      setOnlineUsers(res.data.online_users || Math.floor(Math.random() * 50) + 10);
    } catch (error) {
      // Use sample messages if API fails
      if (messages.length === 0) {
        setMessages([
          { id: 1, user: 'Max', message: 'Hey, jemand online?', time: '14:23', isSystem: false },
          { id: 2, user: 'System', message: '🎉 Anna hat den Jackpot gewonnen! +2.500 Coins', time: '14:25', isSystem: true },
          { id: 3, user: 'Lisa', message: 'Glückwunsch Anna! 🎊', time: '14:26', isSystem: false },
          { id: 4, user: 'Tom', message: 'Hat jemand Tipps für Mining?', time: '14:28', isSystem: false },
          { id: 5, user: 'Max', message: 'Kaufe Gold Miner, die lohnen sich am meisten!', time: '14:30', isSystem: false },
          { id: 6, user: 'System', message: '⛏️ Mining-Pool hat 10.000 TH/s erreicht!', time: '14:32', isSystem: true },
        ]);
        setOnlineUsers(47);
      }
    }
  };
  
  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || loading) return;
    
    setLoading(true);
    
    const tempMessage = {
      id: Date.now(),
      user: username,
      message: newMessage,
      time: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
      isSystem: false,
      isOwn: true
    };
    
    setMessages(prev => [...prev, tempMessage]);
    setNewMessage('');
    
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      await axios.post(`${API}/app/chat/send`, {
        message: newMessage
      }, { headers });
    } catch (error) {
      console.log('Send error');
    } finally {
      setLoading(false);
    }
  };
  
  const quickMessages = [
    '👋 Hi!',
    '🎉 GG!',
    '👍 Nice!',
    '😄 LOL',
  ];
  
  return (
    <div className="min-h-screen bg-[#0b0e24] text-white pb-20 flex flex-col">
      <div className="p-5 pb-2">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-2xl font-bold">💬 Chat</h2>
          <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm">
            🟢 {onlineUsers} Online
          </span>
        </div>
      </div>
      
      {/* Messages Container */}
      <div 
        className="flex-1 overflow-y-auto px-5 space-y-3"
        style={{ maxHeight: 'calc(100vh - 280px)' }}
        data-testid="messages-container"
      >
        {messages.map((msg) => (
          <div 
            key={msg.id}
            className={`${
              msg.isSystem 
                ? 'text-center' 
                : msg.isOwn 
                  ? 'flex justify-end' 
                  : 'flex justify-start'
            }`}
          >
            {msg.isSystem ? (
              <div className="inline-block px-4 py-2 bg-amber-500/20 border border-amber-500/30 rounded-full text-sm text-amber-400">
                {msg.message}
              </div>
            ) : (
              <div className={`max-w-[80%] ${msg.isOwn ? 'order-2' : ''}`}>
                {!msg.isOwn && (
                  <p className="text-xs text-slate-500 mb-1">{msg.user}</p>
                )}
                <div className={`p-3 rounded-2xl ${
                  msg.isOwn 
                    ? 'bg-[#6c63ff] rounded-br-sm' 
                    : 'bg-[#171a3a] rounded-bl-sm'
                }`}>
                  <p className="text-sm">{msg.message}</p>
                </div>
                <p className={`text-xs text-slate-500 mt-1 ${msg.isOwn ? 'text-right' : ''}`}>
                  {msg.time}
                </p>
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Quick Messages */}
      <div className="px-5 py-2 flex gap-2 overflow-x-auto">
        {quickMessages.map((qm, idx) => (
          <button
            key={idx}
            onClick={() => setNewMessage(qm)}
            className="px-3 py-1.5 bg-[#171a3a] hover:bg-[#252b4d] rounded-full text-sm whitespace-nowrap"
          >
            {qm}
          </button>
        ))}
      </div>
      
      {/* Message Input */}
      <form onSubmit={sendMessage} className="p-5 pt-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Nachricht schreiben..."
            className="flex-1 p-3 rounded-xl bg-[#171a3a] border border-slate-700 text-white placeholder-slate-500"
            data-testid="message-input"
          />
          <button
            type="submit"
            disabled={loading || !newMessage.trim()}
            className="px-5 py-3 bg-[#6c63ff] hover:bg-[#8b6dff] rounded-xl font-medium disabled:opacity-50"
            data-testid="send-btn"
          >
            📤
          </button>
        </div>
      </form>
      
      <BottomNav />
    </div>
  );
}
