/**
 * BidBlitz V2 - Chat Page
 * Real-time messaging between users
 * Works across: Marketplace, Taxi, Food
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Send, MessageCircle, Search, MoreVertical, Trash2 } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function ChatPage({ onNavigate }) {
  // Navigation helper (replaces useNavigate)
  const navigate = (path) => {
    if (onNavigate) onNavigate(path);
  };
  
  // Handle search params manually
  const searchParams = new URLSearchParams(window.location.search);
  const initialChatId = searchParams.get('chat');
  const initialUserId = searchParams.get('user');
  
  // State
  const [view, setView] = useState(initialChatId ? 'chat' : 'list'); // list, chat
  const [chats, setChats] = useState([]);
  const [currentChat, setCurrentChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  
  const messagesEndRef = useRef(null);
  const pollIntervalRef = useRef(null);
  const inputRef = useRef(null);

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Fetch chat list
  const fetchChats = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/chat/list`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setChats(data.chats || []);
        setUnreadCount(data.total_unread || 0);
      }
    } catch (err) {
      console.error('Failed to fetch chats:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch messages for a chat
  const fetchMessages = useCallback(async (chatId) => {
    try {
      const res = await fetch(`${API}/api/chat/${chatId}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        setCurrentChat({
          ...data.chat,
          other_user: data.other_user,
        });
        scrollToBottom();
      }
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    }
  }, []);

  // Create or get chat with user
  const createChat = async (userId) => {
    try {
      const res = await fetch(`${API}/api/chat/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ user_id: userId }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.chat;
      }
    } catch (err) {
      console.error('Failed to create chat:', err);
    }
    return null;
  };

  // Send message
  const sendMessage = async (e) => {
    e?.preventDefault();
    if (!messageText.trim() || !currentChat || sending) return;
    
    setSending(true);
    const text = messageText;
    setMessageText('');
    
    try {
      const res = await fetch(`${API}/api/chat/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          chat_id: currentChat.chat_id,
          message: text,
        }),
      });
      
      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, data.message]);
        scrollToBottom();
      } else {
        setMessageText(text); // Restore message on error
      }
    } catch (err) {
      setMessageText(text);
    } finally {
      setSending(false);
    }
  };

  // Delete chat
  const deleteChat = async (chatId) => {
    if (!window.confirm('Chat wirklich löschen?')) return;
    
    try {
      const res = await fetch(`${API}/api/chat/${chatId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        setChats(chats.filter(c => c.chat_id !== chatId));
        if (currentChat?.chat_id === chatId) {
          setView('list');
          setCurrentChat(null);
          setMessages([]);
        }
      }
    } catch (err) {}
  };

  // Open chat
  const openChat = async (chat) => {
    setCurrentChat(chat);
    setView('chat');
    await fetchMessages(chat.chat_id);
    inputRef.current?.focus();
  };

  // Poll for new messages
  const startPolling = useCallback(() => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    
    pollIntervalRef.current = setInterval(async () => {
      if (currentChat) {
        await fetchMessages(currentChat.chat_id);
      }
      // Also update unread count
      try {
        const res = await fetch(`${API}/api/chat/unread-count`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setUnreadCount(data.unread_count || 0);
        }
      } catch (err) {}
    }, 3000);
  }, [currentChat, fetchMessages]);

  // Initial load
  useEffect(() => {
    fetchChats();
    
    // Check for initial chat/user from URL
    if (initialChatId) {
      fetchMessages(initialChatId);
      setView('chat');
    } else if (initialUserId) {
      createChat(initialUserId).then(chat => {
        if (chat) {
          openChat(chat);
        }
      });
    }
    
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [fetchChats, fetchMessages, initialChatId, initialUserId]);

  // Start polling when in chat view
  useEffect(() => {
    if (view === 'chat' && currentChat) {
      startPolling();
    } else {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    }
    
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [view, currentChat, startPolling]);

  // Scroll on new messages
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Filter chats by search
  const filteredChats = chats.filter(chat => 
    chat.other_user_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    chat.last_message?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#0A0A0A]/95 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <button 
              onClick={() => view === 'chat' ? setView('list') : navigate('/')} 
              className="p-2 -ml-2 text-gray-400 hover:text-white"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            
            {view === 'list' ? (
              <h1 className="text-xl font-bold flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-cyan-400" />
                Nachrichten
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 bg-cyan-500 text-black text-xs font-bold rounded-full">
                    {unreadCount}
                  </span>
                )}
              </h1>
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center font-bold text-sm">
                  {currentChat?.other_user?.name?.[0] || '?'}
                </div>
                <span className="font-semibold">{currentChat?.other_user?.name || 'Chat'}</span>
              </div>
            )}
            
            <div className="w-10" />
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* CHAT LIST VIEW */}
        {view === 'list' && (
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 max-w-lg mx-auto w-full"
          >
            {/* Search */}
            <div className="px-4 py-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  placeholder="Chats durchsuchen..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-[#111] border border-white/10 rounded-xl text-white placeholder-gray-500"
                />
              </div>
            </div>

            {/* Chat List */}
            {loading ? (
              <div className="text-center py-12 text-gray-500">Laden...</div>
            ) : filteredChats.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-5xl mb-4">💬</div>
                <p className="text-gray-400">Keine Chats</p>
                <p className="text-sm text-gray-600 mt-2">
                  Starte einen Chat über den Marketplace oder Taxi
                </p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {filteredChats.map((chat) => (
                  <motion.div
                    key={chat.chat_id}
                    onClick={() => openChat(chat)}
                    className="flex items-center gap-3 px-4 py-4 hover:bg-white/5 cursor-pointer transition-colors"
                    whileTap={{ scale: 0.98 }}
                  >
                    {/* Avatar */}
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center font-bold">
                        {chat.other_user_name?.[0] || '?'}
                      </div>
                      {chat.unread_count > 0 && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-cyan-500 rounded-full flex items-center justify-center text-xs font-bold text-black">
                          {chat.unread_count}
                        </div>
                      )}
                    </div>
                    
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <p className={`font-semibold truncate ${chat.unread_count > 0 ? 'text-white' : 'text-gray-300'}`}>
                          {chat.other_user_name}
                        </p>
                        {chat.last_message_at && (
                          <span className="text-xs text-gray-500 whitespace-nowrap ml-2">
                            {new Date(chat.last_message_at).toLocaleDateString('de-DE', { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </span>
                        )}
                      </div>
                      {chat.last_message && (
                        <p className={`text-sm truncate ${chat.unread_count > 0 ? 'text-gray-300' : 'text-gray-500'}`}>
                          {chat.last_sender_id === chat.other_user_id ? '' : 'Du: '}
                          {chat.last_message}
                        </p>
                      )}
                      {chat.context_title && (
                        <p className="text-xs text-cyan-400/60 truncate mt-0.5">
                          {chat.context_title}
                        </p>
                      )}
                    </div>
                    
                    {/* Delete */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteChat(chat.chat_id);
                      }}
                      className="p-2 text-gray-500 hover:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* CHAT VIEW */}
        {view === 'chat' && (
          <motion.div
            key="chat"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex-1 flex flex-col max-w-lg mx-auto w-full"
          >
            {/* Context Banner */}
            {currentChat?.context_title && (
              <div className="px-4 py-2 bg-cyan-500/10 border-b border-cyan-500/20">
                <p className="text-sm text-cyan-400 truncate">
                  📎 {currentChat.context_title}
                </p>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {messages.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>Noch keine Nachrichten</p>
                  <p className="text-sm mt-1">Schreib die erste Nachricht!</p>
                </div>
              ) : (
                messages.map((msg, idx) => {
                  const isOwn = msg.sender_id !== currentChat?.other_user?.user_id;
                  return (
                    <motion.div
                      key={msg.message_id || idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] px-4 py-2 rounded-2xl ${
                          isOwn
                            ? 'bg-cyan-500 text-black rounded-br-sm'
                            : 'bg-[#1a1a1a] text-white rounded-bl-sm'
                        }`}
                      >
                        <p className="break-words">{msg.message}</p>
                        <p className={`text-xs mt-1 ${isOwn ? 'text-cyan-900' : 'text-gray-500'}`}>
                          {new Date(msg.created_at).toLocaleTimeString('de-DE', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                          {msg.read && isOwn && ' ✓✓'}
                        </p>
                      </div>
                    </motion.div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={sendMessage} className="p-4 bg-[#0A0A0A] border-t border-white/5">
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Nachricht schreiben..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  className="flex-1 px-4 py-3 bg-[#111] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-cyan-500/50 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!messageText.trim() || sending}
                  className="p-3 bg-cyan-500 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5 text-black" />
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
