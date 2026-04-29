import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, X, MessageCircle } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function LiveChat({ rideId, userRole = 'passenger', onClose }) {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [ws, setWs] = useState(null);
  const [connected, setConnected] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    connectWebSocket();
    fetchChatHistory();
    
    return () => {
      if (ws) ws.close();
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const connectWebSocket = () => {
    const wsUrl = API.replace('http', 'ws') + `/api/chat/ws/${rideId}`;
    const websocket = new WebSocket(wsUrl);

    websocket.onopen = () => {
      console.log('WebSocket connected');
      setConnected(true);
    };

    websocket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      setMessages(prev => [...prev, message]);
    };

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
      setConnected(false);
    };

    websocket.onclose = () => {
      console.log('WebSocket disconnected');
      setConnected(false);
      // Reconnect after 3 seconds
      setTimeout(connectWebSocket, 3000);
    };

    setWs(websocket);
  };

  const fetchChatHistory = async () => {
    try {
      const res = await fetch(`${API}/api/chat/messages/${rideId}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch {}
  };

  const sendMessage = () => {
    if (!inputMessage.trim() || !ws || !connected) return;

    const message = {
      sender_id: 'user_123', // Replace with actual user ID
      sender_name: userRole === 'driver' ? 'Driver' : 'Passenger',
      message: inputMessage,
      type: 'text',
    };

    ws.send(JSON.stringify(message));
    setInputMessage('');
  };

  const sendQuickReply = async (replyType) => {
    try {
      const res = await fetch(`${API}/api/chat/quick-reply?ride_id=${rideId}&reply_type=${replyType}`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        // Message will be received via WebSocket
      }
    } catch {}
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const quickReplies = [
    { type: 'arriving', label: 'Arriving in 2 min', icon: '🚗' },
    { type: 'waiting', label: 'Waiting outside', icon: '⏰' },
    { type: 'thank_you', label: 'Thank you!', icon: '🙏' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-[#0B0B0F] flex flex-col"
    >
      {/* Header */}
      <div className="bg-[#121218] p-4 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-3">
          <MessageCircle size={24} className="text-[#00C2FF]" />
          <div>
            <h3 className="text-white font-bold">Live Chat</h3>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
              <span className="text-xs text-gray-400">{connected ? 'Connected' : 'Connecting...'}</span>
            </div>
          </div>
        </div>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onClose}
          className="w-8 h-8 rounded-full bg-[#0B0B0F] flex items-center justify-center"
        >
          <X size={16} className="text-gray-400" />
        </motion.button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => {
          const isOwn = msg.sender_name === (userRole === 'driver' ? 'Driver' : 'Passenger');
          
          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[70%] ${isOwn ? 'order-2' : 'order-1'}`}>
                {!isOwn && (
                  <p className="text-xs text-gray-500 mb-1 ml-2">{msg.sender_name}</p>
                )}
                <div className={`p-3 rounded-2xl ${
                  isOwn 
                    ? 'bg-gradient-to-br from-[#00C2FF] to-[#7B2CFF] text-white' 
                    : 'bg-[#121218] text-white'
                }`}>
                  {msg.type === 'location' ? (
                    <div className="flex items-center gap-2">
                      <span>📍</span>
                      <span className="text-sm">Shared location</span>
                    </div>
                  ) : (
                    <p className="text-sm">{msg.message}</p>
                  )}
                </div>
                <p className="text-xs text-gray-600 mt-1 ml-2">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </motion.div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Replies */}
      <div className="px-4 py-2 bg-[#121218] border-t border-white/10">
        <div className="flex gap-2 overflow-x-auto">
          {quickReplies.map((reply) => (
            <motion.button
              key={reply.type}
              whileTap={{ scale: 0.95 }}
              onClick={() => sendQuickReply(reply.type)}
              className="flex-shrink-0 px-3 py-2 bg-[#0B0B0F] rounded-full text-sm text-gray-300 hover:bg-[#00C2FF]/20 transition"
            >
              {reply.icon} {reply.label}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="p-4 bg-[#121218] border-t border-white/10">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Type a message..."
            className="flex-1 bg-[#0B0B0F] text-white px-4 py-3 rounded-full focus:outline-none focus:ring-2 focus:ring-[#00C2FF]/50"
          />
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={sendMessage}
            disabled={!inputMessage.trim() || !connected}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition ${
              inputMessage.trim() && connected
                ? 'bg-gradient-to-r from-[#00C2FF] to-[#7B2CFF]'
                : 'bg-gray-700 opacity-50'
            }`}
          >
            <Send size={20} className="text-white" />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
