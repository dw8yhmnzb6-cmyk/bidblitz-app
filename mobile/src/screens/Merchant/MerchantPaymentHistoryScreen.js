import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../../context/AuthContext';
import ApiService from '../../services/ApiService';
import { COLORS, SIZES } from '../../config/colors';

const MerchantPaymentHistoryScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('sent'); // sent, received, all
  const [sentPayments, setSentPayments] = useState([]);
  const [receivedPayments, setReceivedPayments] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  useEffect(() => {
    fetchHistory();
    fetchStats();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const response = await ApiService.get('/merchant-payments/history');
      setSentPayments(response.sent || []);
      setReceivedPayments(response.received || []);
    } catch (error) {
      console.error('Fetch history error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await ApiService.get('/merchant-payments/stats');
      setStats(response);
    } catch (error) {
      console.error('Fetch stats error:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchHistory(), fetchStats()]);
    setRefreshing(false);
  };

  const openTransactionDetail = (transaction) => {
    setSelectedTransaction(transaction);
    setShowDetailModal(true);
  };

  const getDisplayedPayments = () => {
    if (activeTab === 'sent') return sentPayments;
    if (activeTab === 'received') return receivedPayments;
    return [...sentPayments, ...receivedPayments].sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );
  };

  const renderPaymentItem = ({ item }) => {
    const isSent = item.type === 'merchant_payment';
    const isReceived = item.type === 'merchant_payment_received';

    return (
      <TouchableOpacity
        style={styles.paymentItem}
        onPress={() => openTransactionDetail(item)}
      >
        <View
          style={[
            styles.iconContainer,
            {
              backgroundColor: isSent
                ? `${COLORS.error}20`
                : `${COLORS.success}20`,
            },
          ]}
        >
          <Icon
            name={isSent ? 'arrow-up' : 'arrow-down'}
            size={24}
            color={isSent ? COLORS.error : COLORS.success}
          />
        </View>

        <View style={styles.paymentInfo}>
          <Text style={styles.paymentDescription}>{item.description}</Text>
          <Text style={styles.paymentDate}>
            {new Date(item.created_at).toLocaleDateString('de-DE', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
          {item.reference && (
            <Text style={styles.paymentReference}>Ref: {item.reference}</Text>
          )}
        </View>

        <View style={styles.paymentRight}>
          <Text
            style={[
              styles.paymentAmount,
              { color: isSent ? COLORS.error : COLORS.success },
            ]}
          >
            {isSent ? '-' : '+'}€{Math.abs(item.amount).toFixed(2)}
          </Text>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor:
                  item.status === 'completed'
                    ? `${COLORS.success}20`
                    : `${COLORS.warning}20`,
              },
            ]}
          >
            <Text
              style={[
                styles.statusText,
                {
                  color:
                    item.status === 'completed'
                      ? COLORS.success
                      : COLORS.warning,
                },
              ]}
            >
              {item.status === 'completed' ? 'Abgeschlossen' : 'Ausstehend'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={28} color={COLORS.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Zahlungshistorie</Text>
        <View style={{ width: 28 }} />
      </View>

      {/* Stats Cards */}
      {stats && (
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Gesendet</Text>
            <Text style={styles.statAmount}>€{stats.total_sent.toFixed(2)}</Text>
            <Text style={styles.statCount}>{stats.transactions_sent} Transaktionen</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Erhalten</Text>
            <Text style={[styles.statAmount, { color: COLORS.success }]}>
              €{stats.total_received.toFixed(2)}
            </Text>
            <Text style={styles.statCount}>{stats.transactions_received} Transaktionen</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: COLORS.primary }]}>
            <Text style={[styles.statLabel, { color: COLORS.white }]}>Netto</Text>
            <Text
              style={[
                styles.statAmount,
                {
                  color: COLORS.white,
                  fontSize: 28,
                },
              ]}
            >
              €{stats.net.toFixed(2)}
            </Text>
          </View>
        </View>
      )}

      {/* Tabs */}
      <View style={styles.tabContainer}>
        {[
          { key: 'sent', label: 'Gesendet', icon: 'arrow-up' },
          { key: 'received', label: 'Erhalten', icon: 'arrow-down' },
          { key: 'all', label: 'Alle', icon: 'list' },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.tab,
              activeTab === tab.key && styles.tabActive,
            ]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Icon
              name={tab.icon}
              size={18}
              color={activeTab === tab.key ? COLORS.white : COLORS.gray}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === tab.key && styles.tabTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Payment List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={getDisplayedPayments()}
          renderItem={renderPaymentItem}
          keyExtractor={(item, index) => `${item.id || index}`}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Icon name="receipt-outline" size={64} color={COLORS.lightGray} />
              <Text style={styles.emptyText}>Keine Transaktionen</Text>
              <Text style={styles.emptySubtext}>
                {activeTab === 'sent' && 'Sie haben noch keine Zahlungen gesendet'}
                {activeTab === 'received' && 'Sie haben noch keine Zahlungen erhalten'}
                {activeTab === 'all' && 'Keine Transaktionen vorhanden'}
              </Text>
            </View>
          }
        />
      )}

      {/* Transaction Detail Modal */}
      <Modal
        visible={showDetailModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDetailModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Transaktionsdetails</Text>
              <TouchableOpacity onPress={() => setShowDetailModal(false)}>
                <Icon name="close" size={28} color={COLORS.black} />
              </TouchableOpacity>
            </View>

            {selectedTransaction && (
              <View style={styles.detailContent}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Betrag:</Text>
                  <Text
                    style={[
                      styles.detailValue,
                      {
                        color:
                          selectedTransaction.type === 'merchant_payment'
                            ? COLORS.error
                            : COLORS.success,
                        fontSize: 24,
                        fontWeight: '700',
                      },
                    ]}
                  >
                    {selectedTransaction.type === 'merchant_payment' ? '-' : '+'}
                    €{Math.abs(selectedTransaction.amount).toFixed(2)}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Beschreibung:</Text>
                  <Text style={styles.detailValue}>
                    {selectedTransaction.description}
                  </Text>
                </View>

                {selectedTransaction.reference && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Referenz:</Text>
                    <Text style={styles.detailValue}>
                      {selectedTransaction.reference}
                    </Text>
                  </View>
                )}

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Datum:</Text>
                  <Text style={styles.detailValue}>
                    {new Date(selectedTransaction.created_at).toLocaleString('de-DE')}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Status:</Text>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor:
                          selectedTransaction.status === 'completed'
                            ? `${COLORS.success}20`
                            : `${COLORS.warning}20`,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        {
                          color:
                            selectedTransaction.status === 'completed'
                              ? COLORS.success
                              : COLORS.warning,
                        },
                      ]}
                    >
                      {selectedTransaction.status === 'completed'
                        ? 'Abgeschlossen'
                        : 'Ausstehend'}
                    </Text>
                  </View>
                </View>

                {selectedTransaction.metadata && (
                  <View style={styles.metadataContainer}>
                    <Text style={styles.metadataTitle}>Zusätzliche Informationen:</Text>
                    {selectedTransaction.metadata.invoice_number && (
                      <Text style={styles.metadataText}>
                        Rechnungsnr: {selectedTransaction.metadata.invoice_number}
                      </Text>
                    )}
                    {selectedTransaction.metadata.sender_name && (
                      <Text style={styles.metadataText}>
                        Von: {selectedTransaction.metadata.sender_name}
                      </Text>
                    )}
                    {selectedTransaction.metadata.recipient_name && (
                      <Text style={styles.metadataText}>
                        An: {selectedTransaction.metadata.recipient_name}
                      </Text>
                    )}
                  </View>
                )}
              </View>
            )}

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowDetailModal(false)}
            >
              <Text style={styles.closeButtonText}>Schließen</Text>
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
  statsContainer: {
    flexDirection: 'row',
    padding: SIZES.padding,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius,
    padding: 12,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.gray,
    marginBottom: 4,
  },
  statAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.black,
    marginBottom: 2,
  },
  statCount: {
    fontSize: 10,
    color: COLORS.gray,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    marginHorizontal: SIZES.margin,
    marginBottom: SIZES.margin,
    borderRadius: SIZES.radius,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: SIZES.radius - 2,
    gap: 6,
  },
  tabActive: {
    backgroundColor: COLORS.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.gray,
  },
  tabTextActive: {
    color: COLORS.white,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: SIZES.padding,
    paddingBottom: 20,
  },
  paymentItem: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    padding: SIZES.padding,
    borderRadius: SIZES.radius,
    marginBottom: 12,
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentInfo: {
    flex: 1,
  },
  paymentDescription: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.black,
    marginBottom: 4,
  },
  paymentDate: {
    fontSize: 12,
    color: COLORS.gray,
    marginBottom: 2,
  },
  paymentReference: {
    fontSize: 11,
    color: COLORS.gray,
    fontFamily: 'monospace',
  },
  paymentRight: {
    alignItems: 'flex-end',
  },
  paymentAmount: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
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
    paddingHorizontal: 40,
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
    maxHeight: '80%',
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
  detailContent: {
    gap: 16,
  },
  detailRow: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
    paddingBottom: 12,
  },
  detailLabel: {
    fontSize: 12,
    color: COLORS.gray,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    color: COLORS.black,
    fontWeight: '500',
  },
  metadataContainer: {
    backgroundColor: COLORS.background,
    padding: SIZES.padding,
    borderRadius: SIZES.radius,
  },
  metadataTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.black,
    marginBottom: 8,
  },
  metadataText: {
    fontSize: 13,
    color: COLORS.gray,
    marginBottom: 4,
  },
  closeButton: {
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.radius,
    padding: SIZES.padding,
    alignItems: 'center',
    marginTop: 16,
  },
  closeButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default MerchantPaymentHistoryScreen;