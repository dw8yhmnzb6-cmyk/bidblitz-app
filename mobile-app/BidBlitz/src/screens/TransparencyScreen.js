import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';

const TransparencyScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState(null);
  const [recentWins, setRecentWins] = useState([]);
  const [fairness, setFairness] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [statsRes, winsRes, fairnessRes] = await Promise.all([
        api.get('/transparency/stats'),
        api.get('/transparency/recent-wins'),
        api.get('/transparency/fairness-report')
      ]);
      setStats(statsRes.data);
      setRecentWins(winsRes.data.recent_wins || []);
      setFairness(fairnessRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8B5CF6" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor="#8B5CF6" />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="shield-checkmark" size={48} color="#10B981" />
        <Text style={styles.headerTitle}>Transparenz-Dashboard</Text>
        <Text style={styles.headerSubtitle}>
          Echte Zahlen, echte Gewinner
        </Text>
      </View>

      {/* Trust Score */}
      <View style={styles.trustSection}>
        <View style={styles.trustScore}>
          <Text style={styles.trustNumber}>{stats?.trust_score || 4.8}</Text>
          <View style={styles.starsContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Ionicons
                key={star}
                name={star <= Math.floor(stats?.trust_score || 4.8) ? 'star' : 'star-outline'}
                size={20}
                color="#F59E0B"
              />
            ))}
          </View>
          <Text style={styles.trustLabel}>Vertrauens-Score</Text>
        </View>
        {fairness?.fairness_certified && (
          <View style={styles.certifiedBadge}>
            <Ionicons name="ribbon" size={16} color="#10B981" />
            <Text style={styles.certifiedText}>Fairness-Zertifiziert</Text>
          </View>
        )}
      </View>

      {/* Stats Cards */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Ionicons name="trophy" size={32} color="#F59E0B" />
          <Text style={styles.statNumber}>{stats?.winners?.total || 0}</Text>
          <Text style={styles.statLabel}>Echte Gewinner</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="hammer" size={32} color="#8B5CF6" />
          <Text style={styles.statNumber}>{stats?.auctions?.total_completed || 0}</Text>
          <Text style={styles.statLabel}>Abgeschlossene Auktionen</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="people" size={32} color="#EC4899" />
          <Text style={styles.statNumber}>{stats?.users?.total_registered || 0}</Text>
          <Text style={styles.statLabel}>Registrierte Nutzer</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="cash" size={32} color="#10B981" />
          <Text style={styles.statNumber}>
            €{(stats?.savings?.total_saved || 0).toLocaleString()}
          </Text>
          <Text style={styles.statLabel}>Gesamt gespart</Text>
        </View>
      </View>

      {/* Recent Winners */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Letzte Gewinner</Text>
        {recentWins.map((win, index) => (
          <View key={index} style={styles.winnerCard}>
            <View style={styles.winnerInfo}>
              <Ionicons name="person-circle" size={40} color="#8B5CF6" />
              <View style={styles.winnerText}>
                <Text style={styles.winnerName}>{win.winner}</Text>
                <Text style={styles.productName}>{win.product}</Text>
              </View>
            </View>
            <View style={styles.winnerStats}>
              <Text style={styles.finalPrice}>€{win.final_price?.toFixed(2)}</Text>
              <Text style={styles.savings}>{win.savings_percent}% gespart</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Fairness Report */}
      <View style={styles.fairnessSection}>
        <Text style={styles.sectionTitle}>Fairness-Bericht</Text>
        <View style={styles.fairnessCard}>
          <View style={styles.fairnessItem}>
            <Text style={styles.fairnessLabel}>Echte Gewinner-Quote</Text>
            <Text style={styles.fairnessValue}>{fairness?.real_winner_rate || 0}%</Text>
          </View>
          <View style={styles.fairnessItem}>
            <Text style={styles.fairnessLabel}>Ø Gebote pro Auktion</Text>
            <Text style={styles.fairnessValue}>
              {fairness?.average_bids_per_auction || 0}
            </Text>
          </View>
          <View style={styles.fairnessItem}>
            <Text style={styles.fairnessLabel}>Letzte Prüfung</Text>
            <Text style={styles.fairnessValue}>
              {fairness?.last_audit ? new Date(fairness.last_audit).toLocaleDateString('de') : '-'}
            </Text>
          </View>
        </View>
      </View>

      {/* Savings Stats */}
      <View style={styles.savingsSection}>
        <Text style={styles.sectionTitle}>Ersparnis-Statistik</Text>
        <View style={styles.savingsCard}>
          <View style={styles.savingsRow}>
            <Text style={styles.savingsLabel}>Durchschnittliche Ersparnis</Text>
            <Text style={styles.savingsValueGreen}>
              €{stats?.savings?.average_per_auction?.toFixed(2) || 0}
            </Text>
          </View>
          <View style={styles.savingsRow}>
            <Text style={styles.savingsLabel}>Gesamter Warenwert</Text>
            <Text style={styles.savingsValue}>
              €{stats?.savings?.total_retail_value?.toLocaleString() || 0}
            </Text>
          </View>
          <View style={styles.savingsRow}>
            <Text style={styles.savingsLabel}>Tatsächlich bezahlt</Text>
            <Text style={styles.savingsValue}>
              €{stats?.savings?.total_paid?.toLocaleString() || 0}
            </Text>
          </View>
        </View>
      </View>

      <Text style={styles.lastUpdated}>
        Aktualisiert: {stats?.last_updated ? new Date(stats.last_updated).toLocaleString('de') : '-'}
      </Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111827',
  },
  header: {
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 12,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
  },
  trustSection: {
    alignItems: 'center',
    padding: 20,
  },
  trustScore: {
    alignItems: 'center',
  },
  trustNumber: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#10B981',
  },
  starsContainer: {
    flexDirection: 'row',
    marginTop: 8,
  },
  trustLabel: {
    color: '#9CA3AF',
    marginTop: 8,
  },
  certifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#064E3B',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 16,
  },
  certifiedText: {
    color: '#10B981',
    marginLeft: 6,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
  },
  statCard: {
    width: '50%',
    padding: 8,
  },
  statCardInner: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
    textAlign: 'center',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  winnerCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  winnerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  winnerText: {
    marginLeft: 12,
  },
  winnerName: {
    color: '#fff',
    fontWeight: '600',
  },
  productName: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  winnerStats: {
    alignItems: 'flex-end',
  },
  finalPrice: {
    color: '#10B981',
    fontWeight: 'bold',
    fontSize: 16,
  },
  savings: {
    color: '#F59E0B',
    fontSize: 12,
  },
  fairnessSection: {
    padding: 16,
  },
  fairnessCard: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 16,
  },
  fairnessItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  fairnessLabel: {
    color: '#9CA3AF',
  },
  fairnessValue: {
    color: '#fff',
    fontWeight: '600',
  },
  savingsSection: {
    padding: 16,
  },
  savingsCard: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 16,
  },
  savingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  savingsLabel: {
    color: '#9CA3AF',
  },
  savingsValue: {
    color: '#fff',
    fontWeight: '600',
  },
  savingsValueGreen: {
    color: '#10B981',
    fontWeight: 'bold',
    fontSize: 18,
  },
  lastUpdated: {
    color: '#6B7280',
    fontSize: 12,
    textAlign: 'center',
    padding: 16,
    paddingBottom: 32,
  },
});

export default TransparencyScreen;
