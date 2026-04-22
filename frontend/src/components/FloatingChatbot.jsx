import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Loader, ThumbsUp, ThumbsDown } from 'lucide-react';

const STORAGE_KEY = 'bidblitz-chatbot-hidden';

export default function FloatingChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [isHidden, setIsHidden] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
  });
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const hideBubble = (e) => {
    if (e) { e.stopPropagation(); e.preventDefault(); }
    setIsHidden(true);
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch {}
  };

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      // Welcome message
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: 'Hallo! 👋 Ich bin dein BidBlitz AI-Assistent. Wie kann ich dir helfen?',
        timestamp: new Date().toISOString(),
        suggestions: [
          'Was kann BidBlitz?',
          'Wie funktionieren Auktionen?',
          'Welche Services gibt es?'
        ]
      }]);
    }
  }, [isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (text = input) => {
    if (!text.trim()) return;

    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/chatbot/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message: text,
          language: 'de',
          context: {
            balance: 0,  // TODO: Get from wallet context
            services_used: []
          }
        })
      });

      if (res.ok) {
        const data = await res.json();
        const aiMessage = {
          id: data.message_id,
          role: 'assistant',
          content: data.response,
          timestamp: data.timestamp,
          suggestions: data.suggestions
        };
        setMessages(prev => [...prev, aiMessage]);
        setSuggestions(data.suggestions || []);
      } else {
        throw new Error('AI response failed');
      }
    } catch (err) {
      console.error('Chat error:', err);
      const errorMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: '❌ Entschuldigung, es gab einen Fehler. Bitte versuche es erneut.',
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    sendMessage(suggestion);
    setSuggestions([]);
  };

  const handleFeedback = async (messageId, rating) => {
    try {
      await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/chatbot/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message_id: messageId, rating })
      });
    } catch (err) {
      console.error('Feedback error:', err);
    }
  };

  return (
    <>
      {/* Floating Button - COMPACT with dismiss */}
      <AnimatePresence>
        {!isOpen && !isHidden && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="fixed bottom-24 right-4 z-50"
            data-testid="floating-chatbot-bubble"
          >
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.92 }}
              onClick={() => setIsOpen(true)}
              aria-label="KI-Assistent öffnen"
              className="relative w-12 h-12 bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-500 rounded-full shadow-xl flex items-center justify-center cursor-pointer hover:shadow-cyan-400/40"
            >
              <MessageCircle className="w-5 h-5 text-white" />
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-br from-red-500 to-pink-600 rounded-full flex items-center justify-center text-[8px] font-black text-white shadow-lg border border-white/30">
                AI
              </span>
            </motion.button>
            <button
              onClick={hideBubble}
              aria-label="Assistent ausblenden"
              data-testid="floating-chatbot-hide"
              className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-gray-800/90 border border-white/20 flex items-center justify-center hover:bg-gray-700"
            >
              <X className="w-2.5 h-2.5 text-white/80" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Window - SMALLER & COMPACT */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-4 left-4 md:left-auto md:w-96 md:right-6 z-50 h-[50vh] max-h-[450px] bg-gray-900/95 backdrop-blur-xl rounded-2xl shadow-2xl flex flex-col border border-cyan-500/20"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-emerald-400 rounded-full flex items-center justify-center">
                  <MessageCircle className="w-5 h-5 text-gray-900" />
                </div>
                <div>
                  <h3 className="font-bold text-white">BidBlitz AI</h3>
                  <p className="text-xs text-gray-400">Powered by GPT-5.1</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-br from-cyan-500 to-emerald-500 text-gray-900'
                        : 'bg-gray-800 text-white'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    
                    {/* AI Message Feedback */}
                    {msg.role === 'assistant' && msg.id !== 'welcome' && (
                      <div className="flex gap-2 mt-2 pt-2 border-t border-gray-700">
                        <button
                          onClick={() => handleFeedback(msg.id, 5)}
                          className="text-gray-400 hover:text-emerald-400 transition-colors"
                        >
                          <ThumbsUp className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleFeedback(msg.id, 1)}
                          className="text-gray-400 hover:text-red-400 transition-colors"
                        >
                          <ThumbsDown className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Suggestions */}
              {suggestions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((suggestion, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="px-3 py-2 text-xs rounded-lg bg-gray-800 text-cyan-400 hover:bg-gray-700 transition-colors border border-cyan-500/20"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}

              {loading && (
                <div className="flex justify-start">
                  <div className="bg-gray-800 rounded-2xl px-4 py-3">
                    <Loader className="w-5 h-5 text-cyan-400 animate-spin" />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-gray-800">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendMessage();
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Schreib eine Nachricht..."
                  disabled={loading}
                  className="flex-1 px-4 py-3 bg-gray-800 text-white rounded-xl border border-gray-700 focus:outline-none focus:border-cyan-500 transition-colors disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-emerald-500 rounded-xl flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5 text-gray-900" />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
