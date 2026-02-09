import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Image,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auctionsAPI } from '../services/api';

const AuctionsScreen = ({ navigation }) => {
  const [auctions, setAuctions] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const fetchAuctions = useCallback(async () => {
    try {
      const params = { limit: 50, status: 'active' };
      if (filter === 'night') params.is_night = true;
      if (filter === 'vip') params.is_vip = true;
      
      const response = await auctionsAPI.getAll(params);
      setAuctions(response.data || []);
    } catch (error) {
      console.log('Error fetching auctions:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchAuctions();
    const interval = setInterval(fetchAuctions, 10000);
    return () => clearInterval(interval);
  }, [fetchAuctions]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAuctions();
  };

  const formatTime = (endTime) => {
    const end = new Date(endTime);
    const now = new Date();
    const diff = Math.max(0, end - now);
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const filteredAuctions = auctions.filter(auction => {
    if (!search) return true;
    const productName = auction.product?.name || '';
    return productName.toLowerCase().includes(search.toLowerCase());
  });

  const renderAuction = ({ item: auction }) => (
    <TouchableOpacity
      style={styles.auctionCard}
      onPress={() => navigation.navigate('AuctionDetail', { auction })}
    >
      <Image
        source={{ uri: auction.product?.image_url || 'https://via.placeholder.com/100' }}
        style={styles.auctionImage}
      />
      <View style={styles.auctionInfo}>
        <Text style={styles.auctionTitle} numberOfLines={2}>
          {auction.product?.name || 'Produkt'}
        </Text>
        
        <View style={styles.priceRow}>
          <Text style={styles.currentPrice}>€{auction.current_price?.toFixed(2)}</Text>
          <Text style={styles.retailPrice}>
            UVP: €{auction.product?.retail_price?.toFixed(0)}
          </Text>
        </View>
        
        <View style={styles.bottomRow}>
          <View style={styles.timerBadge}>
            <Ionicons name="time" size={12} color="#F59E0B" />
            <Text style={styles.timerText}>{formatTime(auction.end_time)}</Text>
          </View>
          
          <View style={styles.bidderBadge}>
            <Ionicons name="person" size={12} color="#9CA3AF" />
            <Text style={styles.bidderText}>
              {auction.last_bidder_name || '-'}
            </Text>
          </View>
        </View>
        
        {auction.is_night_auction && (
          <View style={styles.nightBadge}>
            <Text style={styles.nightText}>🌙 Nacht</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  const FilterButton = ({ label, value }) => (
    <TouchableOpacity
      style={[styles.filterButton, filter === value && styles.filterButtonActive]}
      onPress={() => setFilter(value)}
    >
      <Text style={[styles.filterText, filter === value && styles.filterTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#9CA3AF" />
        <TextInput
          style={styles.searchInput}
          placeholder="Suchen..."
          placeholderTextColor="#9CA3AF"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <FilterButton label="Alle" value="all" />
        <FilterButton label="🌙 Nacht" value="night" />
        <FilterButton label="⭐ VIP" value="vip" />
      </View>

      {/* Auctions Count */}
      <Text style={styles.countText}>
        {filteredAuctions.length} Auktionen gefunden
      </Text>

      {/* Auctions List */}
      <FlatList
        data={filteredAuctions}
        renderItem={renderAuction}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8B5CF6" />
        }
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    margin: 15,
    marginBottom: 10,
    padding: 12,
    borderRadius: 10,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    marginLeft: 10,
    fontSize: 16,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    marginBottom: 10,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1F2937',
    marginRight: 10,
  },
  filterButtonActive: {
    backgroundColor: '#8B5CF6',
  },
  filterText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  filterTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  countText: {
    color: '#9CA3AF',
    fontSize: 12,
    paddingHorizontal: 15,
    marginBottom: 10,
  },
  listContainer: {
    padding: 15,
    paddingTop: 5,
  },
  auctionCard: {
    flexDirection: 'row',
    backgroundColor: '#1F2937',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  auctionImage: {
    width: 100,
    height: 100,
    backgroundColor: '#374151',
  },
  auctionInfo: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  auctionTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 4,
  },
  currentPrice: {
    color: '#10B981',
    fontSize: 18,
    fontWeight: 'bold',
  },
  retailPrice: {
    color: '#6B7280',
    fontSize: 12,
    marginLeft: 8,
    textDecorationLine: 'line-through',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    marginRight: 8,
  },
  timerText: {
    color: '#F59E0B',
    fontSize: 11,
    marginLeft: 4,
    fontWeight: '600',
  },
  bidderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bidderText: {
    color: '#9CA3AF',
    fontSize: 11,
    marginLeft: 4,
  },
  nightBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(99, 102, 241, 0.3)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  nightText: {
    color: '#A5B4FC',
    fontSize: 10,
  },
});

export default AuctionsScreen;
