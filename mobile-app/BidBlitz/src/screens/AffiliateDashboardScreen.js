import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Share
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const AffiliateDashboardScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [programInfo, setProgramInfo] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [dashboardRes, infoRes] = await Promise.all([
        api.get('/affiliate-dashboard/my-dashboard'),
        api.get('/affiliate-dashboard/program-info')
      ]);
      setDashboard(dashboardRes.data);
      setProgramInfo(infoRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Spare bis zu 90% bei BidBlitz Auktionen! Melde dich an: ${dashboard?.affiliate_link}`,
        url: dashboard?.affiliate_link
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8B5CF6" />
      </View>
    );
  }

  // Not an affiliate yet
  if (!dashboard?.is_affiliate) {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <Ionicons name="people" size={48} color="#8B5CF6" />
          <Text style={styles.headerTitle}>Affiliate-Programm</Text>
          <Text style={styles.headerSubtitle}>
            Verdiene Geld mit BidBlitz
          </Text>
        </View>

        <View style={styles.applySection}>
          <Text style={styles.applyTitle}>
            {dashboard?.status === 'pending'
              ? 'Bewerbung wird geprüft'
              : 'Werde Affiliate-Partner!'}
          </Text>
          <Text style={styles.applyDesc}>
            {dashboard?.status === 'pending'
              ? 'Wir prüfen deine Bewerbung und melden uns bald.'
              : 'Empfehle BidBlitz und verdiene Provision auf jeden Kauf.'}
          </Text>

          {dashboard?.status !== 'pending' && (
            <View style={styles.benefitsList}>
              {programInfo?.benefits?.map((benefit, index) => (
                <View key={index} style={styles.benefitItem}>
                  <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                  <Text style={styles.benefitText}>{benefit}</Text>
                </View>
              ))}
            </View>
          )}

          {dashboard?.status !== 'pending' && (
            <TouchableOpacity
              style={styles.applyButton}
              onPress={() => navigation.navigate('AffiliateApply')}
            >
              <Text style={styles.applyButtonText}>Jetzt bewerben</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    );
  }

  // Affiliate Dashboard
  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="analytics" size={48} color="#8B5CF6" />
        <Text style={styles.headerTitle}>Dein Affiliate-Dashboard</Text>
      </View>

      {/* Affiliate Link */}
      <View style={styles.linkSection}>
        <Text style={styles.linkLabel}>Dein Affiliate-Link</Text>
        <View style={styles.linkBox}>
          <Text style={styles.linkText} numberOfLines={1}>
            {dashboard?.affiliate_link}
          </Text>
          <TouchableOpacity style={styles.copyButton} onPress={handleShare}>
            <Ionicons name="share-social" size={20} color="#8B5CF6" />
          </TouchableOpacity>
        </View>
        <Text style={styles.linkCode}>Code: {dashboard?.affiliate_code}</Text>
      </View>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Ionicons name="eye" size={24} color="#8B5CF6" />
          <Text style={styles.statNumber}>{dashboard?.stats?.total_clicks || 0}</Text>
          <Text style={styles.statLabel}>Klicks</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="cart" size={24} color="#10B981" />
          <Text style={styles.statNumber}>{dashboard?.stats?.total_conversions || 0}</Text>
          <Text style={styles.statLabel}>Conversions</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="trending-up" size={24} color="#F59E0B" />
          <Text style={styles.statNumber}>{dashboard?.stats?.conversion_rate || 0}%</Text>
          <Text style={styles.statLabel}>Conv. Rate</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="cash" size={24} color="#EC4899" />
          <Text style={styles.statNumber}>€{dashboard?.stats?.total_revenue?.toFixed(2) || 0}</Text>
          <Text style={styles.statLabel}>Umsatz</Text>
        </View>
      </View>

      {/* Earnings */}
      <View style={styles.earningsSection}>
        <Text style={styles.sectionTitle}>Deine Einnahmen</Text>
        <View style={styles.earningsCard}>
          <View style={styles.earningRow}>
            <Text style={styles.earningLabel}>Gesamt-Provision</Text>
            <Text style={styles.earningValue}>
              €{dashboard?.stats?.total_commission?.toFixed(2) || 0}
            </Text>
          </View>
          <View style={styles.earningRow}>
            <Text style={styles.earningLabel}>Ausstehend</Text>
            <Text style={styles.earningValuePending}>
              €{dashboard?.stats?.pending_commission?.toFixed(2) || 0}
            </Text>
          </View>
          <View style={styles.earningRow}>
            <Text style={styles.earningLabel}>Ausgezahlt</Text>
            <Text style={styles.earningValuePaid}>
              €{dashboard?.stats?.paid_commission?.toFixed(2) || 0}
            </Text>
          </View>
        </View>

        {dashboard?.can_request_payout && (
          <TouchableOpacity
            style={styles.payoutButton}
            onPress={() => navigation.navigate('PayoutRequest')}
          >
            <Ionicons name="wallet" size={20} color="#fff" />
            <Text style={styles.payoutButtonText}>Auszahlung anfordern</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Recent Conversions */}
      <View style={styles.conversionsSection}>
        <Text style={styles.sectionTitle}>Letzte Conversions</Text>
        {dashboard?.recent_conversions?.length > 0 ? (
          dashboard.recent_conversions.map((conv, index) => (
            <View key={index} style={styles.conversionItem}>
              <View style={styles.conversionInfo}>
                <Text style={styles.conversionDate}>
                  {new Date(conv.created_at).toLocaleDateString('de')}
                </Text>
                <Text style={styles.conversionAmount}>€{conv.order_amount?.toFixed(2)}</Text>
              </View>
              <Text style={styles.conversionCommission}>
                +€{conv.commission?.toFixed(2)}
              </Text>
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={48} color="#6B7280" />
            <Text style={styles.emptyText}>Noch keine Conversions</Text>
          </View>
        )}
      </View>

      {/* Marketing Materials */}
      <TouchableOpacity
        style={styles.marketingButton}
        onPress={() => navigation.navigate('MarketingMaterials')}
      >
        <Ionicons name="images" size={24} color="#8B5CF6" />
        <View style={styles.marketingText}>
          <Text style={styles.marketingTitle}>Marketing-Materialien</Text>
          <Text style={styles.marketingDesc}>Banner, Texte und mehr</Text>
        </View>
        <Ionicons name="chevron-forward" size={24} color="#6B7280" />
      </TouchableOpacity>
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
  applySection: {
    padding: 24,
    alignItems: 'center',
  },
  applyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  applyDesc: {
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 8,
  },
  benefitsList: {
    marginTop: 24,
    width: '100%',
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  benefitText: {
    color: '#D1D5DB',
    marginLeft: 12,
  },
  applyButton: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 24,
  },
  applyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  linkSection: {
    padding: 16,
  },
  linkLabel: {
    color: '#9CA3AF',
    marginBottom: 8,
  },
  linkBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 12,
  },
  linkText: {
    flex: 1,
    color: '#8B5CF6',
    fontFamily: 'monospace',
  },
  copyButton: {
    padding: 8,
  },
  linkCode: {
    color: '#6B7280',
    marginTop: 8,
    fontSize: 12,
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
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 4,
  },
  earningsSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  earningsCard: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 16,
  },
  earningRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  earningLabel: {
    color: '#9CA3AF',
  },
  earningValue: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
  },
  earningValuePending: {
    color: '#F59E0B',
    fontWeight: '600',
  },
  earningValuePaid: {
    color: '#10B981',
    fontWeight: '600',
  },
  payoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    padding: 14,
    borderRadius: 12,
    marginTop: 16,
  },
  payoutButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  conversionsSection: {
    padding: 16,
  },
  conversionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  conversionInfo: {},
  conversionDate: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  conversionAmount: {
    color: '#fff',
    fontWeight: '600',
  },
  conversionCommission: {
    color: '#10B981',
    fontWeight: 'bold',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: '#6B7280',
    marginTop: 12,
  },
  marketingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  marketingText: {
    flex: 1,
    marginLeft: 12,
  },
  marketingTitle: {
    color: '#fff',
    fontWeight: '600',
  },
  marketingDesc: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 2,
  },
});

export default AffiliateDashboardScreen;
