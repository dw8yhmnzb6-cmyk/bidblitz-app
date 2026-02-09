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

const VIPPlansScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState([]);
  const [subscription, setSubscription] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [plansRes, subRes] = await Promise.all([
        api.get('/vip-plans/available?language=de'),
        api.get('/vip-plans/my-subscription')
      ]);
      setPlans(plansRes.data.plans || []);
      setSubscription(subRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (planId) => {
    try {
      const response = await api.post('/vip-plans/subscribe', { plan_id: planId });
      console.log('Subscription initiated:', response.data);
    } catch (error) {
      console.error('Error subscribing:', error);
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
        <Ionicons name="crown" size={48} color="#F59E0B" />
        <Text style={styles.headerTitle}>VIP-Mitgliedschaft</Text>
        <Text style={styles.headerSubtitle}>
          Exklusive Vorteile für Power-Bieter
        </Text>
      </View>

      {/* Current Subscription */}
      {subscription?.has_subscription && (
        <View style={styles.currentSub}>
          <View style={styles.currentSubHeader}>
            <Ionicons name="checkmark-circle" size={24} color="#10B981" />
            <Text style={styles.currentSubTitle}>Dein aktives Abo</Text>
          </View>
          <View style={styles.currentSubInfo}>
            <Text style={styles.currentPlanName}>
              {subscription.subscription?.plan_name}
            </Text>
            {subscription.days_remaining && (
              <Text style={styles.daysRemaining}>
                Noch {subscription.days_remaining} Tage
              </Text>
            )}
          </View>
          <View style={styles.subStats}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {subscription.bids_received_this_period || 0}
              </Text>
              <Text style={styles.statLabel}>Gebote erhalten</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {Math.round((subscription.discount_rate || 0.10) * 100)}%
              </Text>
              <Text style={styles.statLabel}>Rabatt</Text>
            </View>
          </View>
        </View>
      )}

      {/* Plans */}
      <View style={styles.plansSection}>
        <Text style={styles.sectionTitle}>
          {subscription?.has_subscription ? 'Upgrade-Optionen' : 'Wähle deinen Plan'}
        </Text>

        {plans.map((plan) => (
          <View
            key={plan.id}
            style={[
              styles.planCard,
              plan.highlighted && styles.highlightedPlan
            ]}
          >
            {plan.badge && (
              <View style={[styles.planBadge, { backgroundColor: plan.badge_color }]}>
                <Text style={styles.planBadgeText}>{plan.badge}</Text>
              </View>
            )}

            <Text style={styles.planName}>{plan.name}</Text>
            
            <View style={styles.priceContainer}>
              <Text style={styles.planPrice}>€{plan.price?.toFixed(2)}</Text>
              <Text style={styles.planInterval}>
                /{plan.interval === 'monthly' ? 'Monat' : 'Jahr'}
              </Text>
            </View>

            {plan.monthly_equivalent && (
              <Text style={styles.monthlyEquiv}>
                nur €{plan.monthly_equivalent?.toFixed(2)}/Monat
              </Text>
            )}

            {plan.savings_vs_monthly && (
              <View style={styles.savingsBadge}>
                <Text style={styles.savingsText}>
                  {plan.savings_vs_monthly}% günstiger
                </Text>
              </View>
            )}

            <View style={styles.benefitsList}>
              {plan.benefits?.map((benefit, index) => (
                <View key={index} style={styles.benefitItem}>
                  <Ionicons name="checkmark" size={16} color="#10B981" />
                  <Text style={styles.benefitText}>{benefit}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={[
                styles.subscribeButton,
                plan.highlighted && styles.highlightedButton
              ]}
              onPress={() => handleSubscribe(plan.id)}
            >
              <Text style={styles.subscribeButtonText}>
                Jetzt abonnieren
              </Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {/* FAQ */}
      <View style={styles.faqSection}>
        <Text style={styles.faqTitle}>Häufige Fragen</Text>
        
        <View style={styles.faqItem}>
          <Text style={styles.faqQuestion}>Kann ich jederzeit kündigen?</Text>
          <Text style={styles.faqAnswer}>
            Ja, du kannst dein Abo jederzeit kündigen. Es läuft bis zum Ende der bezahlten Periode.
          </Text>
        </View>

        <View style={styles.faqItem}>
          <Text style={styles.faqQuestion}>Wann erhalte ich meine Gebote?</Text>
          <Text style={styles.faqAnswer}>
            Deine Gebote werden sofort nach der Zahlung gutgeschrieben.
          </Text>
        </View>

        <View style={styles.faqItem}>
          <Text style={styles.faqQuestion}>Gilt der Rabatt auf alle Käufe?</Text>
          <Text style={styles.faqAnswer}>
            Ja, der VIP-Rabatt gilt auf alle Gebote-Pakete während der Laufzeit.
          </Text>
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
  currentSub: {
    margin: 16,
    backgroundColor: '#064E3B',
    borderRadius: 16,
    padding: 16,
  },
  currentSubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currentSubTitle: {
    color: '#10B981',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  currentSubInfo: {
    marginTop: 12,
  },
  currentPlanName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  daysRemaining: {
    color: '#10B981',
    marginTop: 4,
  },
  subStats: {
    flexDirection: 'row',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#065F46',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  statLabel: {
    fontSize: 12,
    color: '#10B981',
    marginTop: 4,
  },
  plansSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  planCard: {
    backgroundColor: '#1F2937',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  highlightedPlan: {
    borderColor: '#F59E0B',
  },
  planBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  planBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  planName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 8,
  },
  planPrice: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  planInterval: {
    fontSize: 14,
    color: '#9CA3AF',
    marginLeft: 4,
  },
  monthlyEquiv: {
    fontSize: 14,
    color: '#10B981',
    marginTop: 4,
  },
  savingsBadge: {
    backgroundColor: '#7C2D12',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 8,
  },
  savingsText: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: 'bold',
  },
  benefitsList: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  benefitText: {
    color: '#D1D5DB',
    marginLeft: 8,
    flex: 1,
  },
  subscribeButton: {
    backgroundColor: '#8B5CF6',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  highlightedButton: {
    backgroundColor: '#F59E0B',
  },
  subscribeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  faqSection: {
    padding: 16,
    paddingBottom: 32,
  },
  faqTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  faqItem: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  faqQuestion: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  faqAnswer: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 8,
  },
});

export default VIPPlansScreen;
