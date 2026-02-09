import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const AppStoreScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [appStatus, setAppStatus] = useState(null);
  const [myRequests, setMyRequests] = useState([]);
  const [betaStatus, setBetaStatus] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [statusRes, requestsRes, betaRes] = await Promise.all([
        api.get('/app-store/status'),
        api.get('/app-store/my-requests'),
        api.get('/app-store/beta/status')
      ]);
      setAppStatus(statusRes.data);
      setMyRequests(requestsRes.data.requests || []);
      setBetaStatus(betaRes.data.beta_status || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNotifyRequest = async (platform) => {
    try {
      await api.post('/app-store/request-notify', { platform });
      loadData();
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleBetaSignup = async (platform) => {
    try {
      await api.post('/app-store/beta/signup', { platform });
      loadData();
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const isRegistered = (platform) => {
    return myRequests.some(r => r.platform === platform);
  };

  const isBetaRegistered = (platform) => {
    return betaStatus.some(s => s.platform === platform);
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
        <Ionicons name="phone-portrait" size={48} color="#8B5CF6" />
        <Text style={styles.headerTitle}>BidBlitz App</Text>
        <Text style={styles.headerSubtitle}>
          Bald auf deinem Smartphone
        </Text>
      </View>

      {/* iOS Status */}
      <View style={styles.platformCard}>
        <View style={styles.platformHeader}>
          <Ionicons name="logo-apple" size={32} color="#fff" />
          <View style={styles.platformInfo}>
            <Text style={styles.platformName}>iOS App</Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>
                {appStatus?.ios?.status === 'available' ? '✓ Verfügbar' : '🚧 In Entwicklung'}
              </Text>
            </View>
          </View>
        </View>
        <Text style={styles.releaseDate}>
          Erwarteter Release: {appStatus?.ios?.expected_date || 'Q1 2025'}
        </Text>
        <View style={styles.platformActions}>
          {appStatus?.ios?.status === 'available' ? (
            <TouchableOpacity style={styles.downloadButton}>
              <Ionicons name="download" size={20} color="#fff" />
              <Text style={styles.downloadText}>App Store</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                style={[
                  styles.notifyButton,
                  isRegistered('ios') && styles.registeredButton
                ]}
                onPress={() => handleNotifyRequest('ios')}
                disabled={isRegistered('ios')}
              >
                <Ionicons
                  name={isRegistered('ios') ? 'checkmark-circle' : 'notifications'}
                  size={20}
                  color={isRegistered('ios') ? '#10B981' : '#fff'}
                />
                <Text style={[
                  styles.notifyText,
                  isRegistered('ios') && styles.registeredText
                ]}>
                  {isRegistered('ios') ? 'Benachrichtigung aktiviert' : 'Benachrichtige mich'}
                </Text>
              </TouchableOpacity>
              {appStatus?.ios?.beta_available && (
                <TouchableOpacity
                  style={[
                    styles.betaButton,
                    isBetaRegistered('ios') && styles.betaRegisteredButton
                  ]}
                  onPress={() => handleBetaSignup('ios')}
                  disabled={isBetaRegistered('ios')}
                >
                  <Ionicons name="flask" size={16} color="#F59E0B" />
                  <Text style={styles.betaText}>
                    {isBetaRegistered('ios') ? 'Beta angemeldet' : 'Beta testen'}
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </View>

      {/* Android Status */}
      <View style={styles.platformCard}>
        <View style={styles.platformHeader}>
          <Ionicons name="logo-android" size={32} color="#3DDC84" />
          <View style={styles.platformInfo}>
            <Text style={styles.platformName}>Android App</Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>
                {appStatus?.android?.status === 'available' ? '✓ Verfügbar' : '🚧 In Entwicklung'}
              </Text>
            </View>
          </View>
        </View>
        <Text style={styles.releaseDate}>
          Erwarteter Release: {appStatus?.android?.expected_date || 'Q1 2025'}
        </Text>
        <View style={styles.platformActions}>
          {appStatus?.android?.status === 'available' ? (
            <TouchableOpacity style={[styles.downloadButton, styles.androidButton]}>
              <Ionicons name="logo-google-playstore" size={20} color="#fff" />
              <Text style={styles.downloadText}>Play Store</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                style={[
                  styles.notifyButton,
                  isRegistered('android') && styles.registeredButton
                ]}
                onPress={() => handleNotifyRequest('android')}
                disabled={isRegistered('android')}
              >
                <Ionicons
                  name={isRegistered('android') ? 'checkmark-circle' : 'notifications'}
                  size={20}
                  color={isRegistered('android') ? '#10B981' : '#fff'}
                />
                <Text style={[
                  styles.notifyText,
                  isRegistered('android') && styles.registeredText
                ]}>
                  {isRegistered('android') ? 'Benachrichtigung aktiviert' : 'Benachrichtige mich'}
                </Text>
              </TouchableOpacity>
              {appStatus?.android?.beta_available && (
                <TouchableOpacity
                  style={[
                    styles.betaButton,
                    isBetaRegistered('android') && styles.betaRegisteredButton
                  ]}
                  onPress={() => handleBetaSignup('android')}
                  disabled={isBetaRegistered('android')}
                >
                  <Ionicons name="flask" size={16} color="#F59E0B" />
                  <Text style={styles.betaText}>
                    {isBetaRegistered('android') ? 'Beta angemeldet' : 'Beta testen'}
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </View>

      {/* PWA Option */}
      {appStatus?.web_app?.pwa_installable && (
        <View style={styles.pwaCard}>
          <Ionicons name="globe" size={32} color="#8B5CF6" />
          <View style={styles.pwaInfo}>
            <Text style={styles.pwaTitle}>Web App verfügbar!</Text>
            <Text style={styles.pwaDesc}>
              Installiere BidBlitz direkt von der Website auf deinen Homescreen.
            </Text>
          </View>
        </View>
      )}

      {/* Planned Features */}
      <View style={styles.featuresSection}>
        <Text style={styles.sectionTitle}>Geplante Features</Text>
        {appStatus?.features_planned?.map((feature, index) => (
          <View key={index} style={styles.featureItem}>
            <Ionicons name="checkmark-circle" size={20} color="#8B5CF6" />
            <Text style={styles.featureText}>{feature}</Text>
          </View>
        ))}
      </View>

      {/* Feature Request */}
      <TouchableOpacity
        style={styles.featureRequestButton}
        onPress={() => navigation.navigate('FeatureRequest')}
      >
        <Ionicons name="bulb" size={24} color="#F59E0B" />
        <View style={styles.featureRequestText}>
          <Text style={styles.featureRequestTitle}>Feature vorschlagen</Text>
          <Text style={styles.featureRequestDesc}>
            Hilf uns, die App besser zu machen!
          </Text>
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
  platformCard: {
    backgroundColor: '#1F2937',
    margin: 16,
    borderRadius: 16,
    padding: 20,
  },
  platformHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  platformInfo: {
    marginLeft: 16,
    flex: 1,
  },
  platformName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  statusBadge: {
    backgroundColor: '#374151',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 4,
  },
  statusText: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  releaseDate: {
    color: '#6B7280',
    marginTop: 12,
  },
  platformActions: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
    padding: 14,
    borderRadius: 12,
  },
  androidButton: {
    backgroundColor: '#3DDC84',
  },
  downloadText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  notifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8B5CF6',
    padding: 14,
    borderRadius: 12,
  },
  registeredButton: {
    backgroundColor: '#064E3B',
  },
  notifyText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },
  registeredText: {
    color: '#10B981',
  },
  betaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#F59E0B',
    padding: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  betaRegisteredButton: {
    backgroundColor: '#7C2D12',
    borderColor: 'transparent',
  },
  betaText: {
    color: '#F59E0B',
    fontWeight: '600',
    marginLeft: 6,
  },
  pwaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    margin: 16,
    marginTop: 0,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#8B5CF6',
  },
  pwaInfo: {
    marginLeft: 16,
    flex: 1,
  },
  pwaTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  pwaDesc: {
    color: '#9CA3AF',
    fontSize: 13,
    marginTop: 4,
  },
  featuresSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureText: {
    color: '#D1D5DB',
    marginLeft: 12,
  },
  featureRequestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  featureRequestText: {
    flex: 1,
    marginLeft: 12,
  },
  featureRequestTitle: {
    color: '#fff',
    fontWeight: '600',
  },
  featureRequestDesc: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 2,
  },
});

export default AppStoreScreen;
