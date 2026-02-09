import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Image,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { auctionsAPI, jackpotAPI } from '../services/api';

const { width } = Dimensions.get('window');

const HomeScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [auctions, setAuctions] = useState([]);
  const [jackpot, setJackpot] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [auctionsRes, jackpotRes] = await Promise.all([
        auctionsAPI.getAll({ limit: 10, status: 'active' }),
        jackpotAPI.getStatus(),
      ]);
      
      setAuctions(auctionsRes.data || []);
      setJackpot(jackpotRes.data);
    } catch (error) {
      console.log('Error fetching data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const formatTime = (endTime) => {
    const end = new Date(endTime);
    const now = new Date();
    const diff = Math.max(0, end - now);
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8B5CF6" />
      }
    >
      {/* Welcome Banner */}
      <LinearGradient
        colors={['#8B5CF6', '#6366F1']}
        style={styles.welcomeBanner}
      >
        <Text style={styles.welcomeText}>Willkommen, {user?.name || 'Gast'}!</Text>
        <View style={styles.bidsContainer}>
          <Ionicons name="wallet" size={20} color="#fff" />
          <Text style={styles.bidsText}>{user?.bids_balance || user?.bids || 0} Gebote</Text>
        </View>
      </LinearGradient>

      {/* Jackpot Section */}
      {jackpot && (
        <View style={styles.jackpotCard}>
          <LinearGradient
            colors={['#F59E0B', '#EF4444']}
            style={styles.jackpotGradient}
          >
            <Text style={styles.jackpotLabel}>🏆 JACKPOT</Text>
            <Text style={styles.jackpotAmount}>{jackpot.current_amount || 100} Gebote</Text>
            {jackpot.last_winner && (
              <Text style={styles.jackpotWinner}>
                Letzter Gewinner: {jackpot.last_winner}
              </Text>
            )}
          </LinearGradient>
        </View>
      )}

      {/* Live Auctions */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>🔴 Live Auktionen</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Auktionen')}>
            <Text style={styles.seeAll}>Alle ansehen →</Text>
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {auctions.slice(0, 5).map((auction) => (
            <TouchableOpacity
              key={auction.id}
              style={styles.auctionCard}
              onPress={() => navigation.navigate('AuctionDetail', { auction })}
            >
              <Image
                source={{ uri: auction.product?.image_url || 'https://via.placeholder.com/150' }}
                style={styles.auctionImage}
              />
              <View style={styles.auctionInfo}>
                <Text style={styles.auctionTitle} numberOfLines={2}>
                  {auction.product?.name || 'Produkt'}
                </Text>
                <Text style={styles.auctionPrice}>€{auction.current_price?.toFixed(2)}</Text>
                <View style={styles.timerContainer}>
                  <Ionicons name="time" size={14} color="#F59E0B" />
                  <Text style={styles.timerText}>{formatTime(auction.end_time)}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: '#8B5CF6' }]}
          onPress={() => navigation.navigate('Gebote')}
        >
          <Ionicons name="cart" size={24} color="#fff" />
          <Text style={styles.actionText}>Gebote kaufen</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: '#10B981' }]}
          onPress={() => navigation.navigate('Auktionen')}
        >
          <Ionicons name="hammer" size={24} color="#fff" />
          <Text style={styles.actionText}>Jetzt bieten</Text>
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{auctions.length}</Text>
          <Text style={styles.statLabel}>Live Auktionen</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{user?.wins || 0}</Text>
          <Text style={styles.statLabel}>Ihre Gewinne</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{user?.bids_balance || user?.bids || 0}</Text>
          <Text style={styles.statLabel}>Gebote</Text>
        </View>
      </View>

      {/* New Features Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🆕 Neue Features</Text>
        <View style={styles.featuresGrid}>
          <TouchableOpacity 
            style={[styles.featureCard, { backgroundColor: '#EF4444' }]}
            onPress={() => navigation.navigate('LiveStream')}
          >
            <Text style={styles.featureEmoji}>📺</Text>
            <Text style={styles.featureTitle}>Live Stream</Text>
            <Text style={styles.featureDesc}>Sei live dabei!</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.featureCard, { backgroundColor: '#8B5CF6' }]}
            onPress={() => navigation.navigate('TeamBidding')}
          >
            <Text style={styles.featureEmoji}>👥</Text>
            <Text style={styles.featureTitle}>Team Bidding</Text>
            <Text style={styles.featureDesc}>Mit Freunden bieten</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.featureCard, { backgroundColor: '#6366F1' }]}
            onPress={() => navigation.navigate('AIAdvisor')}
          >
            <Text style={styles.featureEmoji}>🧠</Text>
            <Text style={styles.featureTitle}>KI-Berater</Text>
            <Text style={styles.featureDesc}>Smarte Tipps</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.featureCard, { backgroundColor: '#DC2626' }]}
            onPress={() => navigation.navigate('Duel')}
          >
            <Text style={styles.featureEmoji}>⚔️</Text>
            <Text style={styles.featureTitle}>Duell</Text>
            <Text style={styles.featureDesc}>1 vs 1 Kampf</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.featureCard, { backgroundColor: '#F59E0B' }]}
            onPress={() => navigation.navigate('MysteryBox')}
          >
            <Text style={styles.featureEmoji}>📦</Text>
            <Text style={styles.featureTitle}>Mystery Box</Text>
            <Text style={styles.featureDesc}>Überraschung!</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  welcomeBanner: {
    padding: 20,
    margin: 15,
    borderRadius: 15,
  },
  welcomeText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  bidsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  bidsText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 8,
  },
  jackpotCard: {
    margin: 15,
    marginTop: 0,
    borderRadius: 15,
    overflow: 'hidden',
  },
  jackpotGradient: {
    padding: 20,
    alignItems: 'center',
  },
  jackpotLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  jackpotAmount: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
    marginVertical: 5,
  },
  jackpotWinner: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
  },
  section: {
    padding: 15,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  seeAll: {
    color: '#8B5CF6',
    fontSize: 14,
  },
  auctionCard: {
    width: width * 0.45,
    backgroundColor: '#1F2937',
    borderRadius: 12,
    marginRight: 12,
    overflow: 'hidden',
  },
  auctionImage: {
    width: '100%',
    height: 120,
    backgroundColor: '#374151',
  },
  auctionInfo: {
    padding: 12,
  },
  auctionTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 5,
  },
  auctionPrice: {
    color: '#10B981',
    fontSize: 18,
    fontWeight: 'bold',
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  timerText: {
    color: '#F59E0B',
    fontSize: 12,
    marginLeft: 4,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 15,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 12,
    marginHorizontal: 5,
  },
  actionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 20,
    backgroundColor: '#1F2937',
    margin: 15,
    borderRadius: 12,
  },
  statBox: {
    alignItems: 'center',
  },
  statNumber: {
    color: '#8B5CF6',
    fontSize: 24,
    fontWeight: 'bold',
  },
  statLabel: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 4,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
  },
  featureCard: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: 12,
    margin: '1%',
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureEmoji: {
    fontSize: 28,
    marginBottom: 5,
  },
  featureTitle: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  featureDesc: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 9,
    textAlign: 'center',
    marginTop: 2,
  },
});

export default HomeScreen;
