import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { MessageCircle, X, Send, Mail } from 'lucide-react';
import './LandingChatbot.css';

export function LandingChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [email, setEmail] = useState('');
  const [sessionId] = useState(() => `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const [loading, setLoading] = useState(false);
  const [showEmailInput, setShowEmailInput] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      // Initial greeting
      setMessages([{
        role: 'assistant',
        content: '👋 Hallo! Ich bin der BidBlitz AI-Assistent. Wie kann ich dir helfen?',
        timestamp: new Date().toISOString(),
      }]);
    }
  }, [isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage = {
      role: 'user',
      content: inputMessage,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setLoading(true);

    try {
      const response = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/api/landing-chatbot/chat`,
        {
          session_id: sessionId,
          message: inputMessage,
          email: email || undefined,
        }
      );

      const botMessage = {
        role: 'assistant',
        content: response.data.message,
        timestamp: new Date().toISOString(),
      };

      setMessages(prev => [...prev, botMessage]);

      if (response.data.requires_email && !email) {
        setShowEmailInput(true);
      }

      // Show suggested actions
      if (response.data.suggested_actions.length > 0) {
        // Could display these as quick reply buttons
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Entschuldigung, es gab einen Fehler. Bitte versuche es erneut.',
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickReply = (message) => {
    setInputMessage(message);
    setTimeout(() => handleSendMessage(), 100);
  };

  return (
    <>
      {/* Chatbot Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="chatbot-toggle-btn"
          aria-label="Chat öffnen"
        >
          <MessageCircle className="w-6 h-6" />
          <span className="notification-badge">1</span>
        </button>
      )}

      {/* Chatbot Window */}
      {isOpen && (
        <div className="chatbot-window">
          {/* Header */}
          <div className="chatbot-header">
            <div className="flex items-center gap-3">
              <div className="chatbot-avatar">
                <MessageCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">BidBlitz AI-Assistent</h3>
                <span className="text-xs text-green-400">● Online</span>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="chatbot-messages">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`message ${msg.role === 'user' ? 'message-user' : 'message-bot'}`}
              >
                <div className="message-bubble">
                  {msg.content}
                </div>
                <span className="message-time">
                  {new Date(msg.timestamp).toLocaleTimeString('de-DE', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            ))}
            {loading && (
              <div className="message message-bot">
                <div className="message-bubble">
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Replies */}
          <div className="quick-replies">
            <button
              onClick={() => handleQuickReply('Was ist BidBlitz?')}
              className="quick-reply-btn"
            >
              Was ist BidBlitz?
            </button>
            <button
              onClick={() => handleQuickReply('Demo anfordern')}
              className="quick-reply-btn"
            >
              Demo anfordern
            </button>
            <button
              onClick={() => handleQuickReply('Preise')}
              className="quick-reply-btn"
            >
              Preise
            </button>
          </div>

          {/* Email Input (if required) */}
          {showEmailInput && !email && (
            <div className="email-input-container">
              <Mail className="w-4 h-4 text-gray-400" />
              <input
                type="email"
                placeholder="deine@email.de"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="email-input"
              />
            </div>
          )}

          {/* Input */}
          <div className="chatbot-input-container">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Nachricht schreiben..."
              className="chatbot-input"
              disabled={loading}
            />
            <button
              onClick={handleSendMessage}
              disabled={loading || !inputMessage.trim()}
              className="chatbot-send-btn"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
