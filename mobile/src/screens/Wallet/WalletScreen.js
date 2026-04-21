import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { WebView } from 'react-native-webview';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../../context/AuthContext';
import ApiService from '../../services/ApiService';
import { API_ENDPOINTS } from '../../config/api';
import { COLORS, SIZES } from '../../config/colors';

const WalletScreen = () => {
  const { user, updateUserBalance } = useAuth();
  const [balance, setBalance] = useState(user?.balance || 0);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showWebView, setShowWebView] = useState(false);
  const [webViewUrl, setWebViewUrl] = useState('');

  useEffect(() => {
    fetchWalletData();
  }, []);

  const fetchWalletData = async () => {
    setLoading(true);
    try {
      const [walletData, txData] = await Promise.all([
        ApiService.get(API_ENDPOINTS.WALLET_BALANCE),
        ApiService.get(API_ENDPOINTS.TRANSACTIONS),
      ]);
      
      setBalance(walletData.balance);
      setTransactions(txData.transactions || []);
      updateUserBalance(walletData.balance);
    } catch (error) {
      console.error('Fetch wallet error:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchWalletData();
    setRefreshing(false);
  };

  // ✅ STORE-KONFORM: Öffne externe Website in WebView
  const handleTopUp = () => {
    Alert.alert(
      'Wallet aufladen',
      'Sie werden zur BidBlitz Website weitergeleitet, um Ihr Wallet aufzuladen.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Weiter zur Website',
          onPress: () => {
            // Öffne Wallet-Seite in WebView
            setWebViewUrl('https://bidblitz.ae/wallet?source=app');
            setShowWebView(true);
          },
        },
      ]
    );
  };

  const handleWebViewNavigationStateChange = (navState) => {
    // Check if payment was successful (URL contains success parameter)
    if (navState.url.includes('stripe_session_id') || navState.url.includes('payment_success=true')) {
      setShowWebView(false);
      // Refresh wallet balance
      fetchWalletData();
      Alert.alert('Erfolg', 'Wallet erfolgreich aufgeladen!');
    }
  };

  if (showWebView) {
    return (
      <View style={styles.container}>
        <View style={styles.webViewHeader}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setShowWebView(false)}
          >
            <Icon name="close" size={28} color={COLORS.black} />
          </TouchableOpacity>
          <Text style={styles.webViewTitle}>Wallet aufladen</Text>
        </View>
        <WebView
          source={{ uri: webViewUrl }}
          onNavigationStateChange={handleWebViewNavigationStateChange}
          startInLoadingState={true}
          renderLoading={() => (
            <ActivityIndicator
              size="large"
              color={COLORS.primary}
              style={styles.webViewLoader}
            />
          )}
          // Enable Apple Pay in WebView
          javaScriptEnabled={true}
          domStorageEnabled={true}
          sharedCookiesEnabled={true}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Wallet</Text>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Aktuelles Guthaben</Text>
          <Text style={styles.balanceAmount}>€{balance.toFixed(2)}</Text>
          
          {/* ✅ STORE-KONFORM: Button führt zu externer Website */}
          <TouchableOpacity
            style={styles.topUpButton}
            onPress={handleTopUp}
          >
            <Icon name="add-circle-outline" size={24} color={COLORS.white} />
            <Text style={styles.topUpButtonText}>Auf Website aufladen</Text>
          </TouchableOpacity>
          
          <Text style={styles.infoText}>
            💡 Sie werden zur Website weitergeleitet, um sicher zu bezahlen
          </Text>
        </View>

        {/* Transactions */}
        <View style={styles.transactionsContainer}>
          <Text style={styles.sectionTitle}>Letzte Transaktionen</Text>
          
          {loading ? (
            <ActivityIndicator size="large" color={COLORS.primary} />
          ) : transactions.length === 0 ? (
            <Text style={styles.emptyText}>Keine Transaktionen vorhanden</Text>
          ) : (
            transactions.slice(0, 20).map((tx, index) => (
              <View key={index} style={styles.transactionItem}>
                <View style={styles.transactionLeft}>
                  <Icon
                    name={tx.type === 'topup' ? 'arrow-down' : 'arrow-up'}
                    size={24}
                    color={tx.type === 'topup' ? COLORS.success : COLORS.error}
                  />
                  <View style={styles.transactionInfo}>
                    <Text style={styles.transactionDescription}>
                      {tx.description}
                    </Text>
                    <Text style={styles.transactionDate}>
                      {new Date(tx.created_at).toLocaleDateString('de-DE')}
                    </Text>
                  </View>
                </View>
                <Text
                  style={[
                    styles.transactionAmount,
                    { color: tx.type === 'topup' ? COLORS.success : COLORS.error },
                  ]}
                >
                  {tx.type === 'topup' ? '+' : '-'}€{Math.abs(tx.amount).toFixed(2)}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.white,
    paddingHorizontal: SIZES.padding,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.black,
  },
  content: {
    flex: 1,
  },
  balanceCard: {
    backgroundColor: COLORS.primary,
    margin: SIZES.margin,
    borderRadius: SIZES.radius,
    padding: SIZES.padding * 2,
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 14,
    color: COLORS.white,
    opacity: 0.9,
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 48,
    fontWeight: 'bold',
    color: COLORS.white,
    marginBottom: 24,
  },
  topUpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.black,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: SIZES.radius,
    gap: 8,
  },
  topUpButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  infoText: {
    color: COLORS.white,
    fontSize: 12,
    marginTop: 16,
    textAlign: 'center',
    opacity: 0.8,
  },
  transactionsContainer: {
    backgroundColor: COLORS.white,
    margin: SIZES.margin,
    borderRadius: SIZES.radius,
    padding: SIZES.padding,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.black,
    marginBottom: 16,
  },
  emptyText: {
    textAlign: 'center',
    color: COLORS.gray,
    paddingVertical: 32,
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionDescription: {
    fontSize: 14,
    color: COLORS.black,
    fontWeight: '500',
  },
  transactionDate: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 2,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '600',
  },
  // WebView styles
  webViewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  closeButton: {
    marginRight: 16,
  },
  webViewTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.black,
  },
  webViewLoader: {
    position: 'absolute,
    top: '50%',
    left: '50%',
    marginLeft: -20,
    marginTop: -20,
  },
});

export default WalletScreen;
