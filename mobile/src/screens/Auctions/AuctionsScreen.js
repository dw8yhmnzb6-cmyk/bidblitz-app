import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { API_URL } from '../../config/api';

export default function AuctionsScreen({ navigation }) {
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('active'); // active | ended

  useEffect(() => {
    loadAuctions();
  }, [filter]);

  const loadAuctions = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auctions/${filter === 'active' ? 'active' : 'list?status=ended'}`);
      if (res.ok) {
        const data = await res.json();
        setAuctions(data.auctions || []);
      }
    } catch (err) {
      console.error('Load auctions error:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatTimeRemaining = (seconds) => {
    if (!seconds || seconds <= 0) return 'Beendet';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  };

  const renderAuction = ({ item }) => (
    <TouchableOpacity
      style={styles.auctionCard}
      onPress={() => navigation.navigate('AuctionDetail', { auction: item })}
    >
      <Image
        source={{ uri: item.image_url || 'https://via.placeholder.com/300' }}
        style={styles.auctionImage}
      />
      
      <View style={styles.auctionOverlay}>
        {item.status === 'active' && item.remaining_seconds && (
          <View style={styles.timerBadge}>
            <Icon name="clock" size={12} color="#FFB800" />
            <Text style={styles.timerText}>{formatTimeRemaining(item.remaining_seconds)}</Text>
          </View>
        )}
        
        {item.status === 'ended' && (
          <View style={[styles.timerBadge, { backgroundColor: 'rgba(255,107,107,0.9)' }]}>
            <Text style={styles.timerText}>Beendet</Text>
          </View>
        )}
      </View>

      <View style={styles.auctionInfo}>
        <Text style={styles.auctionTitle} numberOfLines={2}>{item.title}</Text>
        
        <View style={styles.priceRow}>
          <View>
            <Text style={styles.priceLabel}>Aktuelles Gebot</Text>
            <Text style={styles.currentPrice}>€{item.current_price?.toFixed(2) || '0.00'}</Text>
          </View>
          
          <View style={styles.retailPrice}>
            <Text style={styles.retailLabel}>UVP</Text>
            <Text style={styles.retailValue}>€{item.retail_price?.toFixed(2) || '0'}</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Icon name="users" size={14} color="rgba(255,255,255,0.5)" />
            <Text style={styles.statText}>{item.total_bids || 0} Gebote</Text>
          </View>
          
          {item.winner_name && (
            <View style={styles.stat}>
              <Icon name="award" size={14} color="#FFB800" />
              <Text style={styles.statText}>{item.winner_name}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Auktionen</Text>
        <TouchableOpacity onPress={() => navigation.navigate('AuctionHistory')}>
          <Icon name="clock" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, filter === 'active' && styles.tabActive]}
          onPress={() => setFilter('active')}
        >
          <Text style={[styles.tabText, filter === 'active' && styles.tabTextActive]}>
            Live ({auctions.filter(a => a.status === 'active').length})
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, filter === 'ended' && styles.tabActive]}
          onPress={() => setFilter('ended')}
        >
          <Text style={[styles.tabText, filter === 'ended' && styles.tabTextActive]}>
            Beendet
          </Text>
        </TouchableOpacity>
      </View>

      {/* Auctions List */}
      <FlatList
        data={auctions}
        renderItem={renderAuction}
        keyExtractor={(item) => item.auction_id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={loadAuctions} tintColor="#00D4FF" />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="package" size={48} color="rgba(255,255,255,0.2)" />
            <Text style={styles.emptyText}>Keine Auktionen gefunden</Text>
          </View>
        }
      />
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
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#00D4FF',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
  },
  tabTextActive: {
    color: '#0A0A0F',
  },
  listContent: {
    padding: 20,
    paddingTop: 0,
  },
  auctionCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },
  auctionImage: {
    width: '100%',
    height: 200,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  auctionOverlay: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    gap: 4,
  },
  timerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFF',
  },
  auctionInfo: {
    padding: 16,
  },
  auctionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 12,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  priceLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 4,
  },
  currentPrice: {
    fontSize: 24,
    fontWeight: '700',
    color: '#00D4FF',
  },
  retailPrice: {
    alignItems: 'flex-end',
  },
  retailLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 2,
  },
  retailValue: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    textDecorationLine: 'line-through',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 12,
  },
});
