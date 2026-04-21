import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../../context/AuthContext';
import ApiService from '../../services/ApiService';
import { COLORS, SIZES } from '../../config/colors';

const MerchantPaymentsScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [merchants, setMerchants] = useState([]);
  const [recentMerchants, setRecentMerchants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedMerchant, setSelectedMerchant] = useState(null);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    // Check if user is merchant
    if (user?.role !== 'merchant') {
      Alert.alert(
        'Nicht verfügbar',
        'Diese Funktion ist nur für verifizierte Händler verfügbar.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
      return;
    }
    
    loadRecentMerchants();
  }, []);

  const loadRecentMerchants = async () => {
    try {
      const response = await ApiService.get('/merchant-payments/merchants/recent');
      setRecentMerchants(response.merchants || []);
    } catch (error) {
      console.error('Load recent merchants error:', error);
    }
  };

  const searchMerchants = async () => {
    if (searchQuery.length < 2) {
      Alert.alert('Hinweis', 'Bitte mindestens 2 Zeichen eingeben');
      return;
    }

    setLoading(true);
    try {
      const response = await ApiService.get('/merchant-payments/merchants/search', {
        query: searchQuery,
      });
      setMerchants(response.merchants || []);
      
      if (response.merchants.length === 0) {
        Alert.alert('Keine Ergebnisse', 'Keine Händler gefunden');
      }
    } catch (error) {
      Alert.alert('Fehler', 'Suche fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  const selectMerchant = (merchant) => {
    setSelectedMerchant(merchant);
    setShowPaymentModal(true);
  };

  const sendPayment = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Fehler', 'Bitte gültigen Betrag eingeben');
      return;
    }

    if (!description.trim()) {
      Alert.alert('Fehler', 'Bitte Zahlungsgrund angeben');
      return;
    }

    Alert.alert(
      'Zahlung bestätigen',
      `€${parseFloat(amount).toFixed(2)} an ${selectedMerchant.business_name || selectedMerchant.name} senden?`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Jetzt senden',
          onPress: async () => {
            setProcessing(true);
            try {
              const response = await ApiService.post('/merchant-payments/pay', {
                recipient_merchant_id: selectedMerchant.id,
                amount: parseFloat(amount),
                description: description.trim(),
                invoice_number: invoiceNumber.trim() || null,
              });

              setShowPaymentModal(false);
              setAmount('');
              setDescription('');
              setInvoiceNumber('');
              setSelectedMerchant(null);

              Alert.alert(
                'Erfolgreich!',
                `€${response.amount.toFixed(2)} erfolgreich gesendet!\n\nReferenz: ${response.reference}`,
                [{ text: 'OK' }]
              );

              // Refresh recent merchants
              loadRecentMerchants();
            } catch (error) {
              Alert.alert(
                'Zahlung fehlgeschlagen',
                error.response?.data?.detail || 'Bitte erneut versuchen'
              );
            } finally {
              setProcessing(false);
            }
          },
        },
      ]
    );
  };

  const renderMerchantItem = ({ item }) => (
    <TouchableOpacity
      style={styles.merchantItem}
      onPress={() => selectMerchant(item)}
    >
      <View style={styles.merchantIcon}>
        <Icon name="briefcase" size={24} color={COLORS.primary} />
      </View>
      <View style={styles.merchantInfo}>
        <Text style={styles.merchantName}>
          {item.business_name || item.name}
        </Text>
        <Text style={styles.merchantEmail}>{item.email}</Text>
        {item.merchant_id && (
          <Text style={styles.merchantId}>ID: {item.merchant_id}</Text>
        )}
      </View>
      <Icon name="chevron-forward" size={24} color={COLORS.gray} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={28} color={COLORS.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Händler bezahlen</Text>
        <TouchableOpacity onPress={() => navigation.navigate('MerchantPaymentHistory')}>
          <Icon name="time-outline" size={28} color={COLORS.black} />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Icon name="search" size={20} color={COLORS.gray} />
        <TextInput
          style={styles.searchInput}
          placeholder="Händler suchen (Name, Email, ID)..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={searchMerchants}
        />
        {loading && <ActivityIndicator size="small" color={COLORS.primary} />}
      </View>

      {/* Recent Merchants */}
      {recentMerchants.length > 0 && merchants.length === 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Zuletzt verwendet</Text>
          <FlatList
            data={recentMerchants}
            renderItem={renderMerchantItem}
            keyExtractor={(item) => item.id}
          />
        </View>
      )}

      {/* Search Results */}
      {merchants.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Suchergebnisse ({merchants.length})</Text>
          <FlatList
            data={merchants}
            renderItem={renderMerchantItem}
            keyExtractor={(item) => item.id}
          />
        </View>
      )}

      {/* Empty State */}
      {merchants.length === 0 && recentMerchants.length === 0 && !loading && (
        <View style={styles.emptyState}>
          <Icon name="search-outline" size={64} color={COLORS.lightGray} />
          <Text style={styles.emptyText}>Suchen Sie nach Händlern</Text>
          <Text style={styles.emptySubtext}>
            Geben Sie Name, Email oder Händler-ID ein
          </Text>
        </View>
      )}

      {/* Payment Modal */}
      <Modal
        visible={showPaymentModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPaymentModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Zahlung senden</Text>
              <TouchableOpacity onPress={() => setShowPaymentModal(false)}>
                <Icon name="close" size={28} color={COLORS.black} />
              </TouchableOpacity>
            </View>

            {selectedMerchant && (
              <View style={styles.recipientInfo}>
                <Text style={styles.recipientLabel}>Empfänger:</Text>
                <Text style={styles.recipientName}>
                  {selectedMerchant.business_name || selectedMerchant.name}
                </Text>
                <Text style={styles.recipientEmail}>{selectedMerchant.email}</Text>
              </View>
            )}

            <TextInput
              style={styles.input}
              placeholder="Betrag (EUR)"
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={setAmount}
            />

            <TextInput
              style={styles.input}
              placeholder="Zahlungsgrund *"
              value={description}
              onChangeText={setDescription}
              maxLength={200}
            />

            <TextInput
              style={styles.input}
              placeholder="Rechnungsnummer (optional)"
              value={invoiceNumber}
              onChangeText={setInvoiceNumber}
              maxLength={50}
            />

            <TouchableOpacity
              style={[styles.sendButton, processing && styles.sendButtonDisabled]}
              onPress={sendPayment}
              disabled={processing}
            >
              {processing ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <>
                  <Icon name="send" size={20} color={COLORS.white} />
                  <Text style={styles.sendButtonText}>Jetzt senden</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.white,
    paddingHorizontal: SIZES.padding,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.black,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    margin: SIZES.margin,
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.padding,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.black,
  },
  section: {
    flex: 1,
    paddingHorizontal: SIZES.padding,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.gray,
    marginBottom: 12,
  },
  merchantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    padding: SIZES.padding,
    borderRadius: SIZES.radius,
    marginBottom: 12,
    gap: 12,
  },
  merchantIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  merchantInfo: {
    flex: 1,
  },
  merchantName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.black,
    marginBottom: 2,
  },
  merchantEmail: {
    fontSize: 14,
    color: COLORS.gray,
    marginBottom: 2,
  },
  merchantId: {
    fontSize: 12,
    color: COLORS.gray,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SIZES.padding * 2,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.gray,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.gray,
    marginTop: 8,
    textAlign: 'center',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: SIZES.padding,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.black,
  },
  recipientInfo: {
    backgroundColor: COLORS.background,
    padding: SIZES.padding,
    borderRadius: SIZES.radius,
    marginBottom: 20,
  },
  recipientLabel: {
    fontSize: 12,
    color: COLORS.gray,
    marginBottom: 4,
  },
  recipientName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.black,
    marginBottom: 2,
  },
  recipientEmail: {
    fontSize: 14,
    color: COLORS.gray,
  },
  input: {
    backgroundColor: COLORS.background,
    borderRadius: SIZES.radius,
    padding: SIZES.padding,
    marginBottom: 12,
    fontSize: 16,
    color: COLORS.black,
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.radius,
    padding: SIZES.padding,
    marginTop: 8,
    gap: 8,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default MerchantPaymentsScreen;
