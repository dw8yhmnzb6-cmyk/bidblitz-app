import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { API_URL } from '../../config/api';

const { width } = Dimensions.get('window');

export default function HomeScreen({ navigation }) {
  const [balance, setBalance] = useState(0);
  const [activeAuctions, setActiveAuctions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load wallet balance
      const balanceRes = await fetch(`${API_URL}/wallet/balance`, {
        credentials: 'include',
      });
      if (balanceRes.ok) {
        const data = await balanceRes.json();
        setBalance(data.balance || 0);
      }

      // Load active auctions
      const auctionsRes = await fetch(`${API_URL}/auctions/active`);
      if (auctionsRes.ok) {
        const data = await auctionsRes.json();
        setActiveAuctions(data.auctions?.slice(0, 5) || []);
      }
    } catch (err) {
      console.error('Load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    { id: 'auctions', icon: 'zap', label: 'Auktionen', color: '#00D4FF', screen: 'Auctions' },
    { id: 'taxi', icon: 'navigation', label: 'Taxi', color: '#FFB800', screen: 'Taxi' },
    { id: 'food', icon: 'shopping-bag', label: 'Essen', color: '#FF6B6B', screen: 'Food' },
    { id: 'wallet', icon: 'credit-card', label: 'Wallet', color: '#00FFA3', screen: 'Wallet' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={loadData} tintColor="#00D4FF" />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Willkommen zurück</Text>
            <Text style={styles.headerTitle}>BidBlitz</Text>
          </View>
          <TouchableOpacity
            style={styles.profileBtn}
            onPress={() => navigation.navigate('Profile')}
          >
            <Icon name="user" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Dein Guthaben</Text>
          <Text style={styles.balanceAmount}>€{balance.toFixed(2)}</Text>
          <TouchableOpacity
            style={styles.topUpBtn}
            onPress={() => navigation.navigate('Wallet')}
          >
            <Icon name="plus" size={16} color="#0A0A0F" />
            <Text style={styles.topUpText}>Aufladen</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Schnellzugriff</Text>
          <View style={styles.quickActions}>
            {quickActions.map((action) => (
              <TouchableOpacity
                key={action.id}
                style={[styles.actionCard, { backgroundColor: `${action.color}15` }]}
                onPress={() => navigation.navigate(action.screen)}
              >
                <View style={[styles.actionIcon, { backgroundColor: action.color }]}>
                  <Icon name={action.icon} size={20} color="#FFF" />
                </View>
                <Text style={styles.actionLabel}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Live Auctions */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Live Auktionen</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Auctions')}>
              <Text style={styles.seeAllLink}>Alle ansehen</Text>
            </TouchableOpacity>
          </View>
          
          {activeAuctions.length > 0 ? (
            activeAuctions.map((auction) => (
              <TouchableOpacity
                key={auction.auction_id}
                style={styles.auctionCard}
                onPress={() => navigation.navigate('AuctionDetail', { auction })}
              >
                {auction.image_url && (
                  <Image source={{ uri: auction.image_url }} style={styles.auctionImage} />
                )}
                <View style={styles.auctionInfo}>
                  <Text style={styles.auctionTitle}>{auction.title}</Text>
                  <Text style={styles.auctionPrice}>€{auction.current_price?.toFixed(2)}</Text>
                  <Text style={styles.auctionBids}>{auction.total_bids} Gebote</Text>
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <Text style={styles.emptyText}>Keine aktiven Auktionen</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
  },
  greeting: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
  },
  profileBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceCard: {
    margin: 20,
    marginTop: 0,
    padding: 24,
    borderRadius: 16,
    backgroundColor: 'rgba(0,212,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0,212,255,0.2)',
  },
  balanceLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: '700',
    color: '#00D4FF',
    marginBottom: 16,
  },
  topUpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00D4FF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  topUpText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0A0A0F',
    marginLeft: 8,
  },
  section: {
    padding: 20,
    paddingTop: 0,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 16,
  },
  seeAllLink: {
    fontSize: 14,
    color: '#00D4FF',
    fontWeight: '600',
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    width: (width - 56) / 2,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  auctionCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  auctionImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  auctionInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  auctionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 4,
  },
  auctionPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#00D4FF',
    marginBottom: 2,
  },
  auctionBids: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  emptyText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    paddingVertical: 20,
  },
});
