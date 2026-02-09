import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const BidAlarmScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [alarms, setAlarms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAlarms();
  }, []);

  const fetchAlarms = async () => {
    try {
      const response = await api.get('/bid-alarm/my-alarms');
      setAlarms(response.data?.alarms || []);
    } catch (error) {
      console.log('Error fetching alarms:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleAlarm = async (auctionId) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    try {
      const response = await api.post(`/bid-alarm/toggle/${auctionId}`);
      fetchAlarms(); // Refresh list
      Alert.alert(
        response.data?.is_active ? '🔔 Aktiviert' : '🔕 Deaktiviert',
        response.data?.message
      );
    } catch (error) {
      Alert.alert('Fehler', 'Alarm konnte nicht geändert werden');
    }
  };

  const deleteAlarm = async (alarmId) => {
    try {
      await api.delete(`/bid-alarm/${alarmId}`);
      setAlarms(prev => prev.filter(a => a.id !== alarmId));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      Alert.alert('Fehler', 'Alarm konnte nicht gelöscht werden');
    }
  };

  const renderAlarm = ({ item }) => (
    <View style={styles.alarmCard}>
      <View style={styles.alarmInfo}>
        <Text style={styles.productName}>{item.auction?.product_name || 'Auktion'}</Text>
        <Text style={styles.priceText}>
          Aktuell: €{item.auction?.current_price?.toFixed(2) || '0.00'}
        </Text>
        <Text style={styles.notifyText}>
          ⏰ Alarm bei {item.notify_at_seconds} Sekunden
        </Text>
      </View>
      
      <View style={styles.alarmActions}>
        <Switch
          value={item.is_active}
          onValueChange={() => toggleAlarm(item.auction_id)}
          trackColor={{ false: '#374151', true: '#8B5CF6' }}
          thumbColor={item.is_active ? '#fff' : '#9CA3AF'}
        />
        <TouchableOpacity 
          style={styles.deleteBtn}
          onPress={() => deleteAlarm(item.id)}
        >
          <Ionicons name="trash-outline" size={20} color="#EF4444" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#8B5CF6', '#6366F1']}
        style={styles.header}
      >
        <Ionicons name="alarm" size={48} color="#fff" />
        <Text style={styles.headerTitle}>Bid-Alarme</Text>
        <Text style={styles.headerSubtitle}>
          Werde benachrichtigt wenn Auktionen kurz vor dem Ende stehen
        </Text>
      </LinearGradient>

      {alarms.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="notifications-off" size={64} color="#6B7280" />
          <Text style={styles.emptyTitle}>Keine Alarme</Text>
          <Text style={styles.emptyText}>
            Setze Alarme bei Auktionen, um benachrichtigt zu werden
          </Text>
          <TouchableOpacity 
            style={styles.browseBtn}
            onPress={() => navigation.navigate('Auctions')}
          >
            <Text style={styles.browseBtnText}>Auktionen durchsuchen</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={alarms}
          renderItem={renderAlarm}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshing={loading}
          onRefresh={fetchAlarms}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  header: {
    padding: 24,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 12,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginTop: 8,
  },
  list: {
    padding: 16,
  },
  alarmCard: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  alarmInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  priceText: {
    fontSize: 14,
    color: '#10B981',
    marginTop: 4,
  },
  notifyText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  alarmActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deleteBtn: {
    padding: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 8,
  },
  browseBtn: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 24,
  },
  browseBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
});

export default BidAlarmScreen;
