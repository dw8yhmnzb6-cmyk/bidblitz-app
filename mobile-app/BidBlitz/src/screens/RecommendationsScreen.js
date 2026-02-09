import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const RecommendationsScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [forYou, setForYou] = useState([]);
  const [trending, setTrending] = useState([]);
  const [endingSoon, setEndingSoon] = useState([]);
  const [hotDeals, setHotDeals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecommendations();
  }, []);

  const fetchRecommendations = async () => {
    try {
      const [forYouRes, trendingRes, endingRes, hotRes] = await Promise.all([
        api.get('/recommendations/for-you').catch(() => ({ data: { recommendations: [] } })),
        api.get('/recommendations/trending'),
        api.get('/recommendations/ending-soon?minutes=30'),
        api.get('/recommendations/hot-deals'),
      ]);
      
      setForYou(forYouRes.data?.recommendations || []);
      setTrending(trendingRes.data?.trending || []);
      setEndingSoon(endingRes.data?.ending_soon || []);
      setHotDeals(hotRes.data?.hot_deals || []);
    } catch (error) {
      console.log('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderAuctionCard = (auction, showReason = false, showTime = false) => (
    <TouchableOpacity
      key={auction.id}
      style={styles.auctionCard}
      onPress={() => navigation.navigate('AuctionDetail', { auctionId: auction.id })}
    >
      <Image
        source={{ uri: auction.product_image || 'https://via.placeholder.com/100' }}
        style={styles.productImage}
      />
      <View style={styles.auctionInfo}>
        <Text style={styles.productName} numberOfLines={2}>
          {auction.product_name}
        </Text>
        <Text style={styles.priceText}>
          €{auction.current_price?.toFixed(2)}
        </Text>
        {showReason && auction.recommendation_reasons?.[0] && (
          <Text style={styles.reasonText}>{auction.recommendation_reasons[0]}</Text>
        )}
        {showTime && auction.minutes_remaining !== undefined && (
          <Text style={styles.timeText}>
            ⏰ {auction.minutes_remaining} Min übrig
          </Text>
        )}
        {auction.savings_percent > 0 && (
          <View style={styles.savingsBadge}>
            <Text style={styles.savingsText}>{auction.savings_percent}% gespart</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderSection = (title, icon, data, showReason = false, showTime = false) => {
    if (!data?.length) return null;
    
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name={icon} size={24} color="#8B5CF6" />
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
        <FlatList
          horizontal
          data={data.slice(0, 5)}
          renderItem={({ item }) => renderAuctionCard(item, showReason, showTime)}
          keyExtractor={item => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalList}
        />
      </View>
    );
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#8B5CF6', '#EC4899']}
        style={styles.header}
      >
        <Ionicons name="sparkles" size={48} color="#fff" />
        <Text style={styles.headerTitle}>Für dich empfohlen</Text>
        <Text style={styles.headerSubtitle}>
          Personalisierte Auktionen basierend auf deinen Interessen
        </Text>
      </LinearGradient>

      {/* For You Section */}
      {renderSection('🎯 Für dich', 'heart', forYou, true)}

      {/* Trending Section */}
      {renderSection('🔥 Trending', 'trending-up', trending)}

      {/* Ending Soon Section */}
      {renderSection('⏰ Bald endend', 'time', endingSoon, false, true)}

      {/* Hot Deals Section */}
      {renderSection('💰 Beste Deals', 'pricetag', hotDeals)}

      {/* Empty State */}
      {!loading && !forYou.length && !trending.length && !endingSoon.length && (
        <View style={styles.emptyState}>
          <Ionicons name="search" size={64} color="#6B7280" />
          <Text style={styles.emptyTitle}>Keine Empfehlungen</Text>
          <Text style={styles.emptyText}>
            Biete auf Auktionen um personalisierte Empfehlungen zu erhalten
          </Text>
          <TouchableOpacity 
            style={styles.browseBtn}
            onPress={() => navigation.navigate('Auctions')}
          >
            <Text style={styles.browseBtnText}>Auktionen entdecken</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
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
  section: {
    marginTop: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  horizontalList: {
    paddingHorizontal: 16,
    gap: 12,
  },
  auctionCard: {
    width: 160,
    backgroundColor: '#1F2937',
    borderRadius: 12,
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    height: 120,
    backgroundColor: '#374151',
  },
  auctionInfo: {
    padding: 12,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  priceText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#10B981',
    marginTop: 4,
  },
  reasonText: {
    fontSize: 10,
    color: '#8B5CF6',
    marginTop: 4,
  },
  timeText: {
    fontSize: 12,
    color: '#F59E0B',
    marginTop: 4,
  },
  savingsBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  savingsText: {
    fontSize: 10,
    color: '#10B981',
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    marginTop: 40,
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

export default RecommendationsScreen;
