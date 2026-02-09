import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const REACTIONS = ['🔥', '😱', '👏', '💪', '🎉', '😅', '💰', '🏆'];

const AuctionChatScreen = ({ route, navigation }) => {
  const { auctionId, auctionName } = route.params || {};
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [viewers, setViewers] = useState(0);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef(null);

  useEffect(() => {
    if (auctionId) {
      fetchMessages();
      fetchViewers();
      const interval = setInterval(() => {
        fetchMessages();
        fetchViewers();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [auctionId]);

  const fetchMessages = async () => {
    try {
      const response = await api.get(`/auction-chat/${auctionId}/messages`);
      setMessages(response.data?.messages || []);
    } catch (error) {
      console.log('Error fetching messages:', error);
    }
  };

  const fetchViewers = async () => {
    try {
      const response = await api.get(`/auction-chat/${auctionId}/viewers`);
      setViewers(response.data?.viewers || 0);
    } catch (error) {
      console.log('Error fetching viewers:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || sending) return;
    
    setSending(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    try {
      await api.post('/auction-chat/send', {
        auction_id: auctionId,
        message: newMessage.trim(),
      });
      setNewMessage('');
      fetchMessages();
    } catch (error) {
      console.log('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const sendReaction = async (reaction) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    try {
      await api.post('/auction-chat/react', {
        auction_id: auctionId,
        reaction: reaction,
      });
    } catch (error) {
      console.log('Error sending reaction:', error);
    }
  };

  const renderMessage = ({ item }) => {
    const isMyMessage = item.user_id === user?.id;
    
    return (
      <View style={[
        styles.messageContainer,
        isMyMessage && styles.myMessageContainer,
      ]}>
        <View style={[
          styles.messageBubble,
          isMyMessage && styles.myMessageBubble,
        ]}>
          {!isMyMessage && (
            <Text style={styles.userName}>{item.user_name}</Text>
          )}
          <Text style={styles.messageText}>{item.message}</Text>
          <Text style={styles.messageTime}>
            {new Date(item.created_at).toLocaleTimeString('de-DE', { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      {/* Header */}
      <LinearGradient
        colors={['#8B5CF6', '#6366F1']}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>{auctionName || 'Auktions-Chat'}</Text>
        <View style={styles.viewersRow}>
          <Ionicons name="eye" size={16} color="#fff" />
          <Text style={styles.viewersText}>{viewers} Zuschauer</Text>
        </View>
      </LinearGradient>

      {/* Messages List */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles" size={48} color="#6B7280" />
            <Text style={styles.emptyText}>Noch keine Nachrichten</Text>
            <Text style={styles.emptySubtext}>Sei der Erste!</Text>
          </View>
        }
      />

      {/* Reactions Row */}
      <View style={styles.reactionsRow}>
        {REACTIONS.map((reaction, index) => (
          <TouchableOpacity
            key={index}
            style={styles.reactionBtn}
            onPress={() => sendReaction(reaction)}
          >
            <Text style={styles.reactionEmoji}>{reaction}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Input Row */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={newMessage}
          onChangeText={setNewMessage}
          placeholder="Nachricht schreiben..."
          placeholderTextColor="#6B7280"
          maxLength={100}
          onSubmitEditing={sendMessage}
          returnKeyType="send"
        />
        <TouchableOpacity 
          style={[styles.sendBtn, !newMessage.trim() && styles.sendBtnDisabled]}
          onPress={sendMessage}
          disabled={!newMessage.trim() || sending}
        >
          <Ionicons 
            name="send" 
            size={20} 
            color={newMessage.trim() ? '#fff' : '#6B7280'} 
          />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  header: {
    padding: 16,
    paddingTop: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  viewersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  viewersText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
  messagesList: {
    padding: 16,
    flexGrow: 1,
  },
  messageContainer: {
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  myMessageContainer: {
    alignItems: 'flex-end',
  },
  messageBubble: {
    backgroundColor: '#1F2937',
    padding: 12,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    maxWidth: '80%',
  },
  myMessageBubble: {
    backgroundColor: '#8B5CF6',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 4,
  },
  userName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F59E0B',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 14,
    color: '#fff',
  },
  messageTime: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 4,
    textAlign: 'right',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingTop: 100,
  },
  emptyText: {
    color: '#6B7280',
    marginTop: 12,
    fontSize: 16,
  },
  emptySubtext: {
    color: '#4B5563',
    marginTop: 4,
  },
  reactionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#1F2937',
  },
  reactionBtn: {
    padding: 8,
  },
  reactionEmoji: {
    fontSize: 24,
  },
  inputRow: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#1F2937',
    gap: 12,
  },
  input: {
    flex: 1,
    backgroundColor: '#374151',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 14,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#374151',
  },
});

export default AuctionChatScreen;
