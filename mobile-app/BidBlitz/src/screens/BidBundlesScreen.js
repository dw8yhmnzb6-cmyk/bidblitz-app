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
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const BidBundlesScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [bundles, setBundles] = useState([]);
  const [isVip, setIsVip] = useState(false);
  const [recommended, setRecommended] = useState(null);

  useEffect(() => {
    loadBundles();
  }, []);

  const loadBundles = async () => {
    try {
      const [bundlesRes, recommendedRes] = await Promise.all([
        api.get('/bid-bundles/available'),
        api.get('/bid-bundles/recommended')
      ]);
      setBundles(bundlesRes.data.bundles || []);
      setIsVip(bundlesRes.data.is_vip || false);
      setRecommended(recommendedRes.data.recommended);
    } catch (error) {
      console.error('Error loading bundles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (bundleId) => {
    try {
      const response = await api.post(`/bid-bundles/purchase/${bundleId}`);
      // Handle checkout redirect
      console.log('Purchase initiated:', response.data);
    } catch (error) {
      console.error('Error purchasing:', error);
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
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="cube" size={48} color="#8B5CF6" />
        <Text style={styles.headerTitle}>Gebote-Pakete</Text>
        <Text style={styles.headerSubtitle}>
          Mehr Gebote, mehr Chancen zu gewinnen
        </Text>
        {isVip && (
          <View style={styles.vipBadge}>
            <Ionicons name="star" size={16} color="#F59E0B" />
            <Text style={styles.vipText}>VIP: 10% Extra-Rabatt!</Text>
          </View>
        )}
      </View>

      {/* Recommended */}
      {recommended && (
        <View style={styles.recommendedSection}>
          <Text style={styles.recommendedTitle}>Empfohlen für dich</Text>
          <View style={styles.recommendedCard}>
            <View style={styles.recommendedBadge}>
              <Ionicons name="star" size={16} color="#fff" />
              <Text style={styles.recommendedBadgeText}>Empfohlen</Text>
            </View>
            <Text style={styles.recommendedName}>{recommended.name}</Text>
            <Text style={styles.recommendedBids}>
              {recommended.bids + recommended.bonus_bids} Gebote
            </Text>
            <Text style={styles.recommendedPrice}>€{recommended.price?.toFixed(2)}</Text>
          </View>
        </View>
      )}

      {/* Bundles Grid */}
      <View style={styles.bundlesSection}>
        <Text style={styles.sectionTitle}>Alle Pakete</Text>
        
        {bundles.map((bundle) => (
          <TouchableOpacity
            key={bundle.id}
            style={[
              styles.bundleCard,
              bundle.highlighted && styles.highlightedBundle
            ]}
            onPress={() => handlePurchase(bundle.id)}
          >
            {bundle.badge && (
              <View style={styles.bundleBadge}>
                <Text style={styles.bundleBadgeText}>{bundle.badge}</Text>
              </View>
            )}
            
            <View style={styles.bundleHeader}>
              <Text style={styles.bundleName}>{bundle.name}</Text>
              {bundle.savings_percent > 0 && (
                <View style={styles.savingsBadge}>
                  <Text style={styles.savingsText}>-{bundle.savings_percent}%</Text>
                </View>
              )}
            </View>

            <View style={styles.bundleDetails}>
              <View style={styles.bidsInfo}>
                <Text style={styles.bidsCount}>{bundle.bids}</Text>
                <Text style={styles.bidsLabel}>Gebote</Text>
              </View>
              
              {bundle.bonus_bids > 0 && (
                <View style={styles.bonusInfo}>
                  <Text style={styles.bonusCount}>+{bundle.bonus_bids}</Text>
                  <Text style={styles.bonusLabel}>Bonus</Text>
                </View>
              )}
              
              <View style={styles.priceInfo}>
                {isVip && bundle.vip_price ? (
                  <>
                    <Text style={styles.originalPrice}>€{bundle.price?.toFixed(2)}</Text>
                    <Text style={styles.vipPrice}>€{bundle.vip_price?.toFixed(2)}</Text>
                  </>
                ) : (
                  <Text style={styles.price}>€{bundle.price?.toFixed(2)}</Text>
                )}
                <Text style={styles.pricePerBid}>
                  €{bundle.price_per_bid?.toFixed(2)}/Gebot
                </Text>
              </View>
            </View>

            <View style={styles.buyButton}>
              <Text style={styles.buyButtonText}>Jetzt kaufen</Text>
              <Ionicons name="arrow-forward" size={16} color="#fff" />
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Benefits */}
      <View style={styles.benefitsSection}>
        <Text style={styles.benefitsTitle}>Warum Gebote-Pakete?</Text>
        <View style={styles.benefitItem}>
          <Ionicons name="checkmark-circle" size={24} color="#10B981" />
          <Text style={styles.benefitText}>Bis zu 64% günstiger pro Gebot</Text>
        </View>
        <View style={styles.benefitItem}>
          <Ionicons name="gift" size={24} color="#F59E0B" />
          <Text style={styles.benefitText}>Bonus-Gebote geschenkt</Text>
        </View>
        <View style={styles.benefitItem}>
          <Ionicons name="shield-checkmark" size={24} color="#8B5CF6" />
          <Text style={styles.benefitText}>Sichere Zahlung via Stripe</Text>
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
  vipBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7C2D12',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 12,
  },
  vipText: {
    color: '#F59E0B',
    fontWeight: '600',
    marginLeft: 6,
  },
  recommendedSection: {
    padding: 16,
  },
  recommendedTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  recommendedCard: {
    backgroundColor: '#7C3AED',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  recommendedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  recommendedBadgeText: {
    color: '#fff',
    marginLeft: 4,
    fontWeight: '600',
  },
  recommendedName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  recommendedBids: {
    fontSize: 16,
    color: '#E9D5FF',
    marginTop: 4,
  },
  recommendedPrice: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
  },
  bundlesSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  bundleCard: {
    backgroundColor: '#1F2937',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  highlightedBundle: {
    borderColor: '#8B5CF6',
    backgroundColor: '#1F2937',
  },
  bundleBadge: {
    position: 'absolute',
    top: -10,
    right: 16,
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  bundleBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  bundleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bundleName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  savingsBadge: {
    backgroundColor: '#064E3B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  savingsText: {
    color: '#10B981',
    fontWeight: 'bold',
  },
  bundleDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  bidsInfo: {
    alignItems: 'center',
  },
  bidsCount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  bidsLabel: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  bonusInfo: {
    alignItems: 'center',
  },
  bonusCount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#10B981',
  },
  bonusLabel: {
    fontSize: 12,
    color: '#10B981',
  },
  priceInfo: {
    alignItems: 'flex-end',
  },
  price: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  originalPrice: {
    fontSize: 14,
    color: '#6B7280',
    textDecorationLine: 'line-through',
  },
  vipPrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#F59E0B',
  },
  pricePerBid: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  buyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8B5CF6',
    padding: 12,
    borderRadius: 12,
    marginTop: 16,
  },
  buyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
  },
  benefitsSection: {
    padding: 16,
    paddingBottom: 32,
  },
  benefitsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  benefitText: {
    color: '#D1D5DB',
    marginLeft: 12,
    fontSize: 14,
  },
});

export default BidBundlesScreen;
