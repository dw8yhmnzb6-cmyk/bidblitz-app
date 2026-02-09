import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const WelcomeBonusScreen = ({ navigation }) => {
  const { user, refreshUser } = useAuth();
  const [bonusStatus, setBonusStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const pulseAnim = new Animated.Value(1);

  useEffect(() => {
    fetchBonusStatus();
    startPulseAnimation();
  }, []);

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const fetchBonusStatus = async () => {
    try {
      const response = await api.get('/welcome-bonus/status');
      setBonusStatus(response.data);
    } catch (error) {
      console.log('Error fetching bonus status:', error);
    } finally {
      setLoading(false);
    }
  };

  const claimWelcomeBids = async () => {
    setClaiming(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    
    try {
      const response = await api.post('/welcome-bonus/claim-welcome-bids');
      Alert.alert('🎉 Geschafft!', response.data?.message);
      fetchBonusStatus();
      if (refreshUser) refreshUser();
    } catch (error) {
      Alert.alert('Fehler', error.response?.data?.detail || 'Konnte nicht eingelöst werden');
    } finally {
      setClaiming(false);
    }
  };

  const claimFirstWinRefund = async () => {
    setClaiming(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    
    try {
      const response = await api.post('/welcome-bonus/claim-first-win-refund');
      Alert.alert('💰 Erstattung!', response.data?.message);
      fetchBonusStatus();
      if (refreshUser) refreshUser();
    } catch (error) {
      Alert.alert('Fehler', error.response?.data?.detail || 'Konnte nicht eingelöst werden');
    } finally {
      setClaiming(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Lade Boni...</Text>
      </View>
    );
  }

  const welcomeBids = bonusStatus?.welcome_bids;
  const guarantee = bonusStatus?.first_win_guarantee;

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#10B981', '#059669']}
        style={styles.header}
      >
        <Ionicons name="gift" size={56} color="#fff" />
        <Text style={styles.headerTitle}>Willkommens-Boni</Text>
        <Text style={styles.headerSubtitle}>
          Deine exklusiven Neukundenvorteile
        </Text>
      </LinearGradient>

      {/* Welcome Bids Card */}
      <Animated.View style={[styles.bonusCard, { transform: [{ scale: !welcomeBids?.claimed ? pulseAnim : 1 }] }]}>
        <LinearGradient
          colors={welcomeBids?.claimed ? ['#374151', '#1F2937'] : ['#F59E0B', '#D97706']}
          style={styles.bonusGradient}
        >
          <View style={styles.bonusHeader}>
            <Ionicons 
              name={welcomeBids?.claimed ? "checkmark-circle" : "gift"} 
              size={32} 
              color="#fff" 
            />
            <Text style={styles.bonusTitle}>Willkommens-Gebote</Text>
          </View>
          
          <Text style={styles.bonusAmount}>
            {welcomeBids?.amount || 15} Gratis-Gebote
          </Text>
          
          <Text style={styles.bonusDesc}>
            {welcomeBids?.claimed 
              ? `✅ Eingelöst am ${new Date(welcomeBids?.claimed_at).toLocaleDateString('de-DE')}`
              : 'Starte jetzt mit kostenlosen Geboten!'}
          </Text>

          {!welcomeBids?.claimed && (
            <TouchableOpacity 
              style={styles.claimBtn}
              onPress={claimWelcomeBids}
              disabled={claiming}
            >
              <Text style={styles.claimBtnText}>
                {claiming ? 'Wird eingelöst...' : '🎁 Jetzt einlösen!'}
              </Text>
            </TouchableOpacity>
          )}
        </LinearGradient>
      </Animated.View>

      {/* First Win Guarantee Card */}
      <View style={styles.bonusCard}>
        <LinearGradient
          colors={guarantee?.active ? ['#8B5CF6', '#6366F1'] : ['#374151', '#1F2937']}
          style={styles.bonusGradient}
        >
          <View style={styles.bonusHeader}>
            <Ionicons 
              name="shield-checkmark" 
              size={32} 
              color="#fff" 
            />
            <Text style={styles.bonusTitle}>Erstauktions-Garantie</Text>
          </View>
          
          <Text style={styles.bonusAmount}>
            100% Gebote-Erstattung
          </Text>
          
          {guarantee?.active ? (
            <>
              <Text style={styles.bonusDesc}>
                Verlierst du deine erste Auktion? Wir erstatten alle Gebote!
              </Text>
              
              <View style={styles.guaranteeInfo}>
                <Ionicons name="time" size={16} color="#F59E0B" />
                <Text style={styles.guaranteeText}>
                  Noch {guarantee?.hours_remaining || 0} Stunden gültig
                </Text>
              </View>

              {guarantee?.bids_to_refund > 0 && (
                <TouchableOpacity 
                  style={styles.claimBtn}
                  onPress={claimFirstWinRefund}
                  disabled={claiming}
                >
                  <Text style={styles.claimBtnText}>
                    {claiming ? 'Wird eingelöst...' : `💰 ${guarantee?.bids_to_refund} Gebote zurückholen`}
                  </Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <Text style={styles.bonusDesc}>
              {guarantee?.already_won 
                ? '🎉 Du hast bereits gewonnen!' 
                : guarantee?.refund_used 
                  ? '✅ Erstattung bereits genutzt'
                  : '⏰ Garantie-Zeitraum abgelaufen'}
            </Text>
          )}
        </LinearGradient>
      </View>

      {/* Info Section */}
      <View style={styles.infoSection}>
        <Text style={styles.infoTitle}>So funktioniert's:</Text>
        
        <View style={styles.infoItem}>
          <Ionicons name="checkmark-circle" size={20} color="#10B981" />
          <Text style={styles.infoText}>Willkommens-Gebote sofort verfügbar</Text>
        </View>
        
        <View style={styles.infoItem}>
          <Ionicons name="checkmark-circle" size={20} color="#10B981" />
          <Text style={styles.infoText}>Erstattung wenn du deine erste Auktion verlierst</Text>
        </View>
        
        <View style={styles.infoItem}>
          <Ionicons name="checkmark-circle" size={20} color="#10B981" />
          <Text style={styles.infoText}>72 Stunden Zeit für die Garantie</Text>
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
  loadingText: {
    color: '#fff',
    fontSize: 16,
  },
  header: {
    padding: 32,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 16,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 8,
  },
  bonusCard: {
    margin: 16,
    marginBottom: 8,
    borderRadius: 16,
    overflow: 'hidden',
  },
  bonusGradient: {
    padding: 24,
  },
  bonusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bonusTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  bonusAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 16,
  },
  bonusDesc: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 8,
  },
  claimBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 25,
    marginTop: 20,
    alignItems: 'center',
  },
  claimBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  guaranteeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    backgroundColor: 'rgba(0,0,0,0.2)',
    padding: 12,
    borderRadius: 8,
  },
  guaranteeText: {
    color: '#F59E0B',
    fontWeight: '600',
  },
  infoSection: {
    margin: 16,
    padding: 20,
    backgroundColor: '#1F2937',
    borderRadius: 12,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  infoText: {
    color: '#D1D5DB',
    fontSize: 14,
    flex: 1,
  },
});

export default WelcomeBonusScreen;
