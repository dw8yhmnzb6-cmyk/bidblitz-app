import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Animated,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';

const ActivityFeedScreen = ({ navigation }) => {
  const [activities, setActivities] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [winsRes, statsRes] = await Promise.all([
        api.get('/activity-feed/wins'),
        api.get('/activity-feed/stats'),
      ]);
      
      setActivities(winsRes.data?.wins || []);
      setStats(statsRes.data);
      
      // Animate in
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    } catch (error) {
      console.log('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderActivity = ({ item, index }) => (
    <Animated.View 
      style={[
        styles.activityCard,
        {
          opacity: fadeAnim,
          transform: [{
            translateY: fadeAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [20, 0],
            }),
          }],
        },
      ]}
    >
      <View style={styles.activityIcon}>
        <Ionicons name="trophy" size={24} color="#F59E0B" />
      </View>
      
      <View style={styles.activityContent}>
        <Text style={styles.activityTitle}>
          <Text style={styles.userName}>{item.winner_name}</Text> hat gewonnen!
        </Text>
        <Text style={styles.productName}>{item.product_name}</Text>
        <View style={styles.priceRow}>
          <Text style={styles.wonPrice}>€{item.final_price?.toFixed(2)}</Text>
          <Text style={styles.retailPrice}>statt €{item.retail_price?.toFixed(2)}</Text>
          <View style={styles.savingsBadge}>
            <Text style={styles.savingsText}>{item.savings_percent}% gespart</Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#8B5CF6', '#EC4899']}
        style={styles.header}
      >
        <Ionicons name="pulse" size={48} color="#fff" />
        <Text style={styles.headerTitle}>Live-Aktivität</Text>
        <Text style={styles.headerSubtitle}>Was gerade passiert</Text>
      </LinearGradient>

      {/* Stats Row */}
      {stats && (
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.active_auctions}</Text>
            <Text style={styles.statLabel}>Aktive Auktionen</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.wins_today}</Text>
            <Text style={styles.statLabel}>Gewinne heute</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.active_users}</Text>
            <Text style={styles.statLabel}>Aktive Nutzer</Text>
          </View>
        </View>
      )}

      {/* Live Pulse Indicator */}
      <View style={styles.liveIndicator}>
        <View style={styles.liveDot} />
        <Text style={styles.liveText}>LIVE</Text>
      </View>

      {/* Activity Feed */}
      <FlatList
        data={activities}
        renderItem={renderActivity}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="hourglass" size={48} color="#6B7280" />
            <Text style={styles.emptyText}>Warte auf neue Aktivitäten...</Text>
          </View>
        }
        refreshing={loading}
        onRefresh={fetchData}
      />

      {/* Total Savings Banner */}
      {stats?.total_savings > 0 && (
        <View style={styles.savingsBanner}>
          <Text style={styles.savingsBannerText}>
            💰 Unsere Nutzer haben insgesamt €{stats.total_savings.toLocaleString('de-DE')} gespart!
          </Text>
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
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    backgroundColor: '#1F2937',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#8B5CF6',
  },
  statLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  liveText: {
    color: '#EF4444',
    fontWeight: 'bold',
    fontSize: 12,
  },
  list: {
    padding: 16,
    paddingBottom: 80,
  },
  activityCard: {
    flexDirection: 'row',
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  activityIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    color: '#D1D5DB',
  },
  userName: {
    fontWeight: 'bold',
    color: '#fff',
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginTop: 4,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  wonPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#10B981',
  },
  retailPrice: {
    fontSize: 12,
    color: '#6B7280',
    textDecorationLine: 'line-through',
  },
  savingsBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  savingsText: {
    fontSize: 10,
    color: '#10B981',
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    color: '#6B7280',
    marginTop: 12,
  },
  savingsBanner: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#10B981',
    padding: 12,
  },
  savingsBannerText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '600',
  },
});

export default ActivityFeedScreen;
