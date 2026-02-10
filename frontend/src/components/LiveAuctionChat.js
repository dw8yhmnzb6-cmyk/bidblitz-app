import { useState, useEffect, useRef } from 'react';
import { MessageCircle, Send, X, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Button } from './ui/button';

const chatTexts = {
  de: {
    title: 'Live Chat',
    placeholder: 'Nachricht eingeben...',
    send: 'Senden',
    users: 'Bieter online',
    loginRequired: 'Anmelden um zu chatten'
  },
  sq: {
    title: 'Chat Live',
    placeholder: 'Shkruaj mesazhin...',
    send: 'Dërgo',
    users: 'Ofertues online',
    loginRequired: 'Identifikohu për të biseduar'
  },
  en: {
    title: 'Live Chat',
    placeholder: 'Type a message...',
    send: 'Send',
    users: 'Bidders online',
    loginRequired: 'Login to chat'
  }
};

// Demo messages
const demoMessages = [
  { id: '1', user: 'MaxM.', text: 'Viel Glück allen! 🍀', time: '12:34' },
  { id: '2', user: 'SophieK.', text: 'Wer bietet noch?', time: '12:35' },
  { id: '3', user: 'ArbenK.', text: 'Das wird spannend!', time: '12:36' },
];

export default function LiveAuctionChat({ auctionId }) {
  const { language } = useLanguage();
  const { user, isAuthenticated } = useAuth();
  const t = chatTexts[language] || chatTexts.de;
  
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState(demoMessages);
  const [newMessage, setNewMessage] = useState('');
  const [onlineCount, setOnlineCount] = useState(Math.floor(Math.random() * 20) + 5);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Scroll to bottom on new messages
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Simulate online count changes
  useEffect(() => {
    const interval = setInterval(() => {
      setOnlineCount(prev => {
        const change = Math.floor(Math.random() * 3) - 1;
        return Math.max(5, Math.min(50, prev + change));
      });
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const sendMessage = () => {
    if (!newMessage.trim() || !isAuthenticated) return;
    
    const message = {
      id: Date.now().toString(),
      user: user?.username || 'User',
      text: newMessage,
      time: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    };
    
    setMessages(prev => [...prev, message]);
    setNewMessage('');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Chat Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-20 right-4 z-40 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all ${
          isOpen 
            ? 'bg-red-500 hover:bg-red-600' 
            : 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400'
        }`}
      >
        {isOpen ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <>
            <MessageCircle className="w-6 h-6 text-white" />
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs text-white flex items-center justify-center">
              {onlineCount}
            </span>
          </>
        )}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-36 right-4 z-40 w-80 bg-white dark:bg-slate-800 rounded-xl shadow-2xl overflow-hidden border border-gray-200 dark:border-slate-700">
          {/* Header */}
          <div className="bg-gradient-to-r from-cyan-500 to-blue-500 p-3 text-white">
            <div className="flex items-center justify-between">
              <h3 className="font-bold flex items-center gap-2">
                <MessageCircle className="w-5 h-5" />
                {t.title}
              </h3>
              <div className="flex items-center gap-1 text-sm">
                <Users className="w-4 h-4" />
                <span>{onlineCount} {t.users}</span>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="h-64 overflow-y-auto p-3 space-y-2 bg-gray-50 dark:bg-slate-900">
            {messages.map((msg) => (
              <div 
                key={msg.id}
                className={`p-2 rounded-lg ${
                  msg.user === user?.username
                    ? 'bg-cyan-500 text-white ml-8'
                    : 'bg-white dark:bg-slate-800 mr-8 border border-gray-200 dark:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2 text-xs opacity-75 mb-1">
                  <span className="font-medium">{msg.user}</span>
                  <span>{msg.time}</span>
                </div>
                <p className="text-sm">{msg.text}</p>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-gray-200 dark:border-slate-700">
            {isAuthenticated ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={t.placeholder}
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-800 dark:text-white text-sm focus:outline-none focus:border-cyan-500"
                />
                <Button
                  onClick={sendMessage}
                  size="sm"
                  className="bg-cyan-500 hover:bg-cyan-600"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <p className="text-center text-gray-500 text-sm">{t.loginRequired}</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
