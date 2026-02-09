import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const UserReportsScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('new');
  const [myReports, setMyReports] = useState([]);
  const [categories, setCategories] = useState({});
  
  // New report form
  const [selectedCategory, setSelectedCategory] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [reportsRes, categoriesRes] = await Promise.all([
        api.get('/user-reports/my-reports'),
        api.get('/user-reports/categories')
      ]);
      setMyReports(reportsRes.data.reports || []);
      setCategories(categoriesRes.data.categories || {});
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedCategory || !subject || !description) {
      Alert.alert('Fehler', 'Bitte fülle alle Felder aus');
      return;
    }

    setSubmitting(true);
    try {
      const response = await api.post('/user-reports/submit', {
        category: selectedCategory,
        subject,
        description
      });

      if (response.data.success) {
        Alert.alert('Erfolg', response.data.message);
        setSelectedCategory('');
        setSubject('');
        setDescription('');
        setActiveTab('my');
        loadData();
      }
    } catch (error) {
      console.error('Error submitting:', error);
      Alert.alert('Fehler', 'Konnte Bericht nicht senden');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'open': return '#F59E0B';
      case 'in_progress': return '#3B82F6';
      case 'resolved': return '#10B981';
      case 'closed': return '#6B7280';
      default: return '#9CA3AF';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'open': return 'Offen';
      case 'in_progress': return 'In Bearbeitung';
      case 'resolved': return 'Gelöst';
      case 'closed': return 'Geschlossen';
      default: return status;
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
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="help-buoy" size={48} color="#8B5CF6" />
        <Text style={styles.headerTitle}>Support & Meldungen</Text>
        <Text style={styles.headerSubtitle}>
          Wir helfen dir gerne weiter
        </Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'new' && styles.activeTab]}
          onPress={() => setActiveTab('new')}
        >
          <Ionicons
            name="create"
            size={18}
            color={activeTab === 'new' ? '#fff' : '#9CA3AF'}
          />
          <Text style={[styles.tabText, activeTab === 'new' && styles.activeTabText]}>
            Neu
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'my' && styles.activeTab]}
          onPress={() => setActiveTab('my')}
        >
          <Ionicons
            name="list"
            size={18}
            color={activeTab === 'my' ? '#fff' : '#9CA3AF'}
          />
          <Text style={[styles.tabText, activeTab === 'my' && styles.activeTabText]}>
            Meine ({myReports.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {activeTab === 'new' && (
          <View style={styles.formSection}>
            {/* Category Selection */}
            <Text style={styles.fieldLabel}>Kategorie</Text>
            <View style={styles.categoryGrid}>
              {Object.entries(categories).map(([key, label]) => (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.categoryButton,
                    selectedCategory === key && styles.categorySelected
                  ]}
                  onPress={() => setSelectedCategory(key)}
                >
                  <Ionicons
                    name={
                      key === 'technical' ? 'build' :
                      key === 'auction' ? 'hammer' :
                      key === 'payment' ? 'card' :
                      key === 'user' ? 'person' :
                      key === 'fraud' ? 'warning' :
                      'help-circle'
                    }
                    size={24}
                    color={selectedCategory === key ? '#8B5CF6' : '#6B7280'}
                  />
                  <Text style={[
                    styles.categoryText,
                    selectedCategory === key && styles.categoryTextSelected
                  ]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Subject */}
            <Text style={styles.fieldLabel}>Betreff</Text>
            <TextInput
              style={styles.input}
              placeholder="Kurze Beschreibung des Problems"
              placeholderTextColor="#6B7280"
              value={subject}
              onChangeText={setSubject}
            />

            {/* Description */}
            <Text style={styles.fieldLabel}>Beschreibung</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Beschreibe das Problem so detailliert wie möglich..."
              placeholderTextColor="#6B7280"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />

            {/* Submit */}
            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="send" size={20} color="#fff" />
                  <Text style={styles.submitText}>Bericht senden</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Info */}
            <View style={styles.infoBox}>
              <Ionicons name="information-circle" size={20} color="#8B5CF6" />
              <Text style={styles.infoText}>
                Wir antworten in der Regel innerhalb von 24 Stunden.
              </Text>
            </View>
          </View>
        )}

        {activeTab === 'my' && (
          <View style={styles.reportsSection}>
            {myReports.length > 0 ? (
              myReports.map((report) => (
                <TouchableOpacity
                  key={report.id}
                  style={styles.reportCard}
                  onPress={() => navigation.navigate('ReportDetail', { reportId: report.id })}
                >
                  <View style={styles.reportHeader}>
                    <View style={[
                      styles.statusBadge,
                      { backgroundColor: getStatusColor(report.status) + '20' }
                    ]}>
                      <View style={[
                        styles.statusDot,
                        { backgroundColor: getStatusColor(report.status) }
                      ]} />
                      <Text style={[
                        styles.statusText,
                        { color: getStatusColor(report.status) }
                      ]}>
                        {getStatusText(report.status)}
                      </Text>
                    </View>
                    <Text style={styles.reportDate}>
                      {new Date(report.created_at).toLocaleDateString('de')}
                    </Text>
                  </View>
                  <Text style={styles.reportSubject}>{report.subject}</Text>
                  <Text style={styles.reportCategory}>{report.category_name}</Text>
                  {report.messages?.length > 0 && (
                    <View style={styles.messageIndicator}>
                      <Ionicons name="chatbubble" size={14} color="#8B5CF6" />
                      <Text style={styles.messageCount}>
                        {report.messages.length} Nachricht(en)
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="document-outline" size={64} color="#6B7280" />
                <Text style={styles.emptyText}>Keine Berichte</Text>
                <Text style={styles.emptySubtext}>
                  Du hast noch keine Berichte eingereicht
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
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
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#1F2937',
    margin: 16,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#8B5CF6',
  },
  tabText: {
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  activeTabText: {
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  formSection: {
    padding: 16,
  },
  fieldLabel: {
    color: '#D1D5DB',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 16,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  categoryButton: {
    width: '31%',
    margin: '1%',
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  categorySelected: {
    borderColor: '#8B5CF6',
    backgroundColor: '#1F2937',
  },
  categoryText: {
    color: '#9CA3AF',
    fontSize: 11,
    marginTop: 6,
    textAlign: 'center',
  },
  categoryTextSelected: {
    color: '#8B5CF6',
  },
  input: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 14,
    color: '#fff',
    fontSize: 14,
  },
  textArea: {
    height: 120,
    paddingTop: 14,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8B5CF6',
    padding: 16,
    borderRadius: 12,
    marginTop: 24,
  },
  submitText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    padding: 12,
    borderRadius: 12,
    marginTop: 16,
  },
  infoText: {
    color: '#9CA3AF',
    marginLeft: 10,
    flex: 1,
  },
  reportsSection: {
    padding: 16,
  },
  reportCard: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  reportDate: {
    color: '#6B7280',
    fontSize: 12,
  },
  reportSubject: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  reportCategory: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 4,
  },
  messageIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  messageCount: {
    color: '#8B5CF6',
    marginLeft: 6,
    fontSize: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    color: '#6B7280',
    marginTop: 4,
  },
});

export default UserReportsScreen;
