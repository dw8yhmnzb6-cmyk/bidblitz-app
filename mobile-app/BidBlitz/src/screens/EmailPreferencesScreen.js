import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const EmailPreferencesScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState({
    marketing: true,
    auction_updates: true,
    win_notifications: true,
    weekly_digest: true
  });

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const response = await api.get('/email-marketing/preferences');
      setPreferences(response.data);
    } catch (error) {
      console.error('Error loading preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    setSaving(true);
    try {
      await api.put('/email-marketing/preferences', preferences);
    } catch (error) {
      console.error('Error saving preferences:', error);
    } finally {
      setSaving(false);
    }
  };

  const togglePreference = (key) => {
    const newPrefs = { ...preferences, [key]: !preferences[key] };
    setPreferences(newPrefs);
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
        <Ionicons name="mail" size={48} color="#8B5CF6" />
        <Text style={styles.headerTitle}>E-Mail Einstellungen</Text>
        <Text style={styles.headerSubtitle}>
          Verwalte deine E-Mail-Benachrichtigungen
        </Text>
      </View>

      {/* Preferences */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Benachrichtigungen</Text>

        <View style={styles.preferenceItem}>
          <View style={styles.preferenceInfo}>
            <Ionicons name="megaphone" size={24} color="#8B5CF6" />
            <View style={styles.preferenceText}>
              <Text style={styles.preferenceTitle}>Marketing</Text>
              <Text style={styles.preferenceDesc}>Angebote und Aktionen</Text>
            </View>
          </View>
          <Switch
            value={preferences.marketing}
            onValueChange={() => togglePreference('marketing')}
            trackColor={{ false: '#374151', true: '#8B5CF6' }}
            thumbColor="#fff"
          />
        </View>

        <View style={styles.preferenceItem}>
          <View style={styles.preferenceInfo}>
            <Ionicons name="hammer" size={24} color="#F59E0B" />
            <View style={styles.preferenceText}>
              <Text style={styles.preferenceTitle}>Auktions-Updates</Text>
              <Text style={styles.preferenceDesc}>Favoriten & Erinnerungen</Text>
            </View>
          </View>
          <Switch
            value={preferences.auction_updates}
            onValueChange={() => togglePreference('auction_updates')}
            trackColor={{ false: '#374151', true: '#8B5CF6' }}
            thumbColor="#fff"
          />
        </View>

        <View style={styles.preferenceItem}>
          <View style={styles.preferenceInfo}>
            <Ionicons name="trophy" size={24} color="#10B981" />
            <View style={styles.preferenceText}>
              <Text style={styles.preferenceTitle}>Gewinn-Benachrichtigungen</Text>
              <Text style={styles.preferenceDesc}>Wenn du eine Auktion gewinnst</Text>
            </View>
          </View>
          <Switch
            value={preferences.win_notifications}
            onValueChange={() => togglePreference('win_notifications')}
            trackColor={{ false: '#374151', true: '#8B5CF6' }}
            thumbColor="#fff"
          />
        </View>

        <View style={styles.preferenceItem}>
          <View style={styles.preferenceInfo}>
            <Ionicons name="calendar" size={24} color="#EC4899" />
            <View style={styles.preferenceText}>
              <Text style={styles.preferenceTitle}>Wöchentliche Zusammenfassung</Text>
              <Text style={styles.preferenceDesc}>Dein BidBlitz Wochenrückblick</Text>
            </View>
          </View>
          <Switch
            value={preferences.weekly_digest}
            onValueChange={() => togglePreference('weekly_digest')}
            trackColor={{ false: '#374151', true: '#8B5CF6' }}
            thumbColor="#fff"
          />
        </View>
      </View>

      {/* Save Button */}
      <TouchableOpacity
        style={styles.saveButton}
        onPress={savePreferences}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveButtonText}>Einstellungen speichern</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.footerText}>
        Du kannst dich jederzeit von Marketing-E-Mails abmelden.
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
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  preferenceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  preferenceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  preferenceText: {
    marginLeft: 12,
    flex: 1,
  },
  preferenceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  preferenceDesc: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  saveButton: {
    backgroundColor: '#8B5CF6',
    marginHorizontal: 16,
    marginVertical: 24,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  footerText: {
    color: '#6B7280',
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
});

export default EmailPreferencesScreen;
