import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const BidBuddyScreen = ({ navigation, route }) => {
  const { user } = useAuth();
  const [buddies, setBuddies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedAuction, setSelectedAuction] = useState(route?.params?.auction || null);
  const [maxBids, setMaxBids] = useState('10');
  const [maxPrice, setMaxPrice] = useState('');

  useEffect(() => {
    fetchBuddies();
  }, []);

  const fetchBuddies = async () => {
    try {
      const response = await api.get('/bid-buddy/my-buddies');
      setBuddies(response.data?.bid_buddies || []);
    } catch (error) {
      console.log('Error fetching bid buddies:', error);
    } finally {
      setLoading(false);
    }
  };

  const activateBuddy = async () => {
    if (!selectedAuction) {
      Alert.alert('Fehler', 'Bitte wählen Sie eine Auktion aus');
      return;
    }

    const bidsNum = parseInt(maxBids);
    if (isNaN(bidsNum) || bidsNum < 1) {
      Alert.alert('Fehler', 'Bitte geben Sie eine gültige Anzahl an Geboten ein');
      return;
    }

    if (bidsNum > (user?.bids_balance || user?.bids || 0)) {
      Alert.alert('Fehler', 'Sie haben nicht genug Gebote');
      return;
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    try {
      const response = await api.post('/bid-buddy/activate', {
        auction_id: selectedAuction.id,
        max_bids: bidsNum,
        max_price: maxPrice ? parseFloat(maxPrice) : null,
      });

      Alert.alert(
        '🤖 Bid Buddy Aktiviert!',
        `Dein Bid Buddy bietet automatisch bis zu ${bidsNum} Mal für dich!`,
        [{ text: 'Super!' }]
      );

      setShowCreate(false);
      setSelectedAuction(null);
      setMaxBids('10');
      setMaxPrice('');
      fetchBuddies();
    } catch (error) {
      Alert.alert('Fehler', error.response?.data?.detail || 'Aktivierung fehlgeschlagen');
    }
  };

  const deactivateBuddy = async (auctionId) => {
    Alert.alert(
      'Bid Buddy deaktivieren',
      'Möchten Sie den Bid Buddy für diese Auktion stoppen?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Deaktivieren',
          style: 'destructive',
          onPress: async () => {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            try {
              await api.delete(`/bid-buddy/deactivate/${auctionId}`);
              fetchBuddies();
            } catch (error) {
              Alert.alert('Fehler', 'Deaktivierung fehlgeschlagen');
            }
          },
        },
      ]
    );
  };

  const renderBuddy = ({ item }) => {
    const remainingBids = item.max_bids - item.bids_placed;
    const progress = item.bids_placed / item.max_bids;

    return (
      <View style={styles.buddyCard}>
        <LinearGradient
          colors={['#8B5CF6', '#6366F1']}
          style={styles.buddyHeader}
        >
          <View style={styles.robotIcon}>
            <Text style={styles.robotEmoji}>🤖</Text>
          </View>
          <View style={styles.buddyInfo}>
            <Text style={styles.buddyAuction} numberOfLines={1}>
              {item.auction?.product_name || item.auction_name || 'Auktion'}
            </Text>
            <Text style={styles.buddyStatus}>
              {item.is_active ? '✅ Aktiv' : '⏸️ Pausiert'}
            </Text>
          </View>
          <Switch
            value={item.is_active}
            onValueChange={() => deactivateBuddy(item.auction_id)}
            trackColor={{ false: '#374151', true: '#10B981' }}
            thumbColor="#fff"
          />
        </LinearGradient>

        <View style={styles.buddyBody}>
          {/* Progress Bar */}
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>Gebote verwendet</Text>
              <Text style={styles.progressValue}>
                {item.bids_placed} / {item.max_bids}
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
            </View>
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Ionicons name="flash" size={18} color="#F59E0B" />
              <Text style={styles.statValue}>{remainingBids}</Text>
              <Text style={styles.statLabel}>Verbleibend</Text>
            </View>
            
            {item.max_price && (
              <View style={styles.stat}>
                <Ionicons name="trending-up" size={18} color="#EF4444" />
                <Text style={styles.statValue}>€{item.max_price.toFixed(2)}</Text>
                <Text style={styles.statLabel}>Max Preis</Text>
              </View>
            )}
            
            <View style={styles.stat}>
              <Ionicons name="pricetag" size={18} color="#10B981" />
              <Text style={styles.statValue}>
                €{item.auction?.current_price?.toFixed(2) || '0.00'}
              </Text>
              <Text style={styles.statLabel}>Aktuell</Text>
            </View>
          </View>

          {/* Action Button */}
          <TouchableOpacity
            style={styles.viewButton}
            onPress={() => navigation.navigate('AuctionDetail', { auction: item.auction })}
          >
            <Text style={styles.viewButtonText}>Auktion ansehen</Text>
            <Ionicons name="arrow-forward" size={16} color="#8B5CF6" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const EmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyEmoji}>🤖</Text>
      <Text style={styles.emptyTitle}>Kein Bid Buddy aktiv</Text>
      <Text style={styles.emptyText}>
        Aktiviere einen Bid Buddy und er bietet automatisch für dich - auch wenn du schläfst!
      </Text>
      <TouchableOpacity
        style={styles.createButton}
        onPress={() => navigation.navigate('Auktionen')}
      >
        <LinearGradient
          colors={['#8B5CF6', '#6366F1']}
          style={styles.createButtonGradient}
        >
          <Ionicons name="add-circle" size={20} color="#fff" />
          <Text style={styles.createButtonText}>Auktion wählen</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#8B5CF6', '#6366F1']}
        style={styles.header}
      >
        <View style={styles.headerIcon}>
          <Text style={styles.headerEmoji}>🤖</Text>
        </View>
        <Text style={styles.headerTitle}>Bid Buddy</Text>
        <Text style={styles.headerSubtitle}>
          Dein automatischer Bieter - bietet für dich in den letzten Sekunden!
        </Text>
        
        {/* User Bids */}
        <View style={styles.bidsInfo}>
          <Ionicons name="wallet" size={16} color="#fff" />
          <Text style={styles.bidsText}>
            {user?.bids_balance || user?.bids || 0} Gebote verfügbar
          </Text>
        </View>
      </LinearGradient>

      {/* How it works */}
      <View style={styles.howItWorks}>
        <Text style={styles.howTitle}>So funktioniert's:</Text>
        <View style={styles.howStep}>
          <View style={styles.howNumber}><Text style={styles.howNumberText}>1</Text></View>
          <Text style={styles.howText}>Wähle eine Auktion</Text>
        </View>
        <View style={styles.howStep}>
          <View style={styles.howNumber}><Text style={styles.howNumberText}>2</Text></View>
          <Text style={styles.howText}>Setze max. Gebote</Text>
        </View>
        <View style={styles.howStep}>
          <View style={styles.howNumber}><Text style={styles.howNumberText}>3</Text></View>
          <Text style={styles.howText}>Bid Buddy bietet automatisch</Text>
        </View>
      </View>

      {/* Active Buddies */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Aktive Bid Buddies</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{buddies.length}</Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#8B5CF6" style={{ padding: 40 }} />
        ) : buddies.length > 0 ? (
          <FlatList
            data={buddies}
            renderItem={renderBuddy}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.buddyList}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <EmptyState />
        )}
      </View>

      {/* Create Modal */}
      {showCreate && selectedAuction && (
        <View style={styles.modal}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>🤖 Bid Buddy aktivieren</Text>
            
            <Text style={styles.modalAuction}>{selectedAuction.product?.name || 'Auktion'}</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Maximale Gebote</Text>
              <TextInput
                style={styles.input}
                value={maxBids}
                onChangeText={setMaxBids}
                keyboardType="number-pad"
                placeholder="10"
                placeholderTextColor="#6B7280"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Max Preis (optional)</Text>
              <TextInput
                style={styles.input}
                value={maxPrice}
                onChangeText={setMaxPrice}
                keyboardType="decimal-pad"
                placeholder="z.B. 5.00"
                placeholderTextColor="#6B7280"
              />
              <Text style={styles.inputHint}>
                Bid Buddy stoppt wenn dieser Preis erreicht wird
              </Text>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowCreate(false)}
              >
                <Text style={styles.cancelText}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.activateButton]}
                onPress={activateBuddy}
              >
                <Text style={styles.activateText}>Aktivieren!</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
    padding: 25,
    alignItems: 'center',
  },
  headerIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  headerEmoji: {
    fontSize: 35,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 26,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 20,
  },
  bidsInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 15,
  },
  bidsText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  howItWorks: {
    backgroundColor: '#1F2937',
    margin: 15,
    padding: 15,
    borderRadius: 12,
  },
  howTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  howStep: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 5,
  },
  howNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#8B5CF6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  howNumberText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  howText: {
    color: '#9CA3AF',
    fontSize: 13,
  },
  section: {
    flex: 1,
    paddingHorizontal: 15,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  countBadge: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    marginLeft: 10,
  },
  countText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  buddyList: {
    paddingBottom: 20,
  },
  buddyCard: {
    backgroundColor: '#1F2937',
    borderRadius: 15,
    marginBottom: 15,
    overflow: 'hidden',
  },
  buddyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
  },
  robotIcon: {
    width: 45,
    height: 45,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  robotEmoji: {
    fontSize: 24,
  },
  buddyInfo: {
    flex: 1,
    marginLeft: 12,
  },
  buddyAuction: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  buddyStatus: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    marginTop: 2,
  },
  buddyBody: {
    padding: 15,
  },
  progressSection: {
    marginBottom: 15,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressLabel: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  progressValue: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  progressTrack: {
    height: 8,
    backgroundColor: '#374151',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#8B5CF6',
    borderRadius: 4,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#374151',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 5,
  },
  statLabel: {
    color: '#6B7280',
    fontSize: 10,
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    padding: 12,
    borderRadius: 10,
  },
  viewButtonText: {
    color: '#8B5CF6',
    fontWeight: '600',
    marginRight: 5,
  },
  emptyState: {
    alignItems: 'center',
    padding: 30,
  },
  emptyEmoji: {
    fontSize: 60,
    marginBottom: 15,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  emptyText: {
    color: '#9CA3AF',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  createButton: {
    marginTop: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  createButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 25,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  modal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  modalContent: {
    backgroundColor: '#1F2937',
    borderRadius: 15,
    padding: 25,
    width: '90%',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  modalAuction: {
    color: '#8B5CF6',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 15,
  },
  inputLabel: {
    color: '#9CA3AF',
    fontSize: 12,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#374151',
    borderRadius: 10,
    padding: 15,
    color: '#fff',
    fontSize: 16,
  },
  inputHint: {
    color: '#6B7280',
    fontSize: 11,
    marginTop: 5,
  },
  modalButtons: {
    flexDirection: 'row',
    marginTop: 10,
  },
  modalButton: {
    flex: 1,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#374151',
  },
  activateButton: {
    backgroundColor: '#8B5CF6',
  },
  cancelText: {
    color: '#9CA3AF',
    fontWeight: '600',
  },
  activateText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default BidBuddyScreen;
