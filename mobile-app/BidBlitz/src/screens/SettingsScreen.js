import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';

const SettingsScreen = ({ navigation }) => {
  const { user, logout } = useAuth();
  const { 
    notificationsEnabled, 
    registerForPushNotifications, 
    disableNotifications 
  } = useNotifications();
  
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricType, setBiometricType] = useState('');

  useEffect(() => {
    checkBiometricSupport();
    loadBiometricSetting();
  }, []);

  const checkBiometricSupport = async () => {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    
    if (compatible && enrolled) {
      setBiometricAvailable(true);
      
      // Check which type is available
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        setBiometricType('Face ID');
      } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        setBiometricType('Touch ID');
      } else {
        setBiometricType('Biometrie');
      }
    }
  };

  const loadBiometricSetting = async () => {
    // Load from storage (simplified - in production use SecureStore)
    if (Platform.OS === 'web') {
      const enabled = localStorage.getItem('biometric_enabled') === 'true';
      setBiometricEnabled(enabled);
    }
  };

  const toggleBiometric = async (value) => {
    if (value) {
      // Authenticate first to enable
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: `${biometricType} aktivieren`,
        cancelLabel: 'Abbrechen',
        disableDeviceFallback: false,
      });

      if (result.success) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setBiometricEnabled(true);
        if (Platform.OS === 'web') {
          localStorage.setItem('biometric_enabled', 'true');
        }
        Alert.alert('Aktiviert', `${biometricType} wurde erfolgreich aktiviert!`);
      } else {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } else {
      setBiometricEnabled(false);
      if (Platform.OS === 'web') {
        localStorage.setItem('biometric_enabled', 'false');
      }
    }
  };

  const toggleNotifications = async (value) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (value) {
      await registerForPushNotifications();
    } else {
      await disableNotifications();
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Abmelden',
      'Möchten Sie sich wirklich abmelden?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        { 
          text: 'Abmelden', 
          style: 'destructive', 
          onPress: async () => {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            logout();
          }
        },
      ]
    );
  };

  const SettingItem = ({ icon, label, description, value, onValueChange, type = 'switch' }) => (
    <View style={styles.settingItem}>
      <View style={styles.settingIcon}>
        <Ionicons name={icon} size={22} color="#8B5CF6" />
      </View>
      <View style={styles.settingContent}>
        <Text style={styles.settingLabel}>{label}</Text>
        {description && <Text style={styles.settingDescription}>{description}</Text>}
      </View>
      {type === 'switch' && (
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: '#374151', true: '#8B5CF6' }}
          thumbColor={value ? '#fff' : '#9CA3AF'}
        />
      )}
      {type === 'arrow' && (
        <Ionicons name="chevron-forward" size={20} color="#6B7280" />
      )}
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      {/* User Info */}
      <LinearGradient
        colors={['#8B5CF6', '#6366F1']}
        style={styles.userCard}
      >
        <View style={styles.userAvatar}>
          <Text style={styles.userInitial}>
            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
          </Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{user?.name || 'Benutzer'}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
        </View>
      </LinearGradient>

      {/* Security Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sicherheit</Text>
        
        {biometricAvailable && (
          <SettingItem
            icon="finger-print"
            label={biometricType}
            description={`Mit ${biometricType} schnell einloggen`}
            value={biometricEnabled}
            onValueChange={toggleBiometric}
          />
        )}
        
        <TouchableOpacity style={styles.settingItem}>
          <View style={styles.settingIcon}>
            <Ionicons name="lock-closed" size={22} color="#8B5CF6" />
          </View>
          <View style={styles.settingContent}>
            <Text style={styles.settingLabel}>Passwort ändern</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#6B7280" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingItem}>
          <View style={styles.settingIcon}>
            <Ionicons name="shield-checkmark" size={22} color="#8B5CF6" />
          </View>
          <View style={styles.settingContent}>
            <Text style={styles.settingLabel}>2-Faktor-Authentifizierung</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#6B7280" />
        </TouchableOpacity>
      </View>

      {/* Notifications Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Benachrichtigungen</Text>
        
        <SettingItem
          icon="notifications"
          label="Push-Benachrichtigungen"
          description="Auktions-Updates und Gewinn-Meldungen"
          value={notificationsEnabled}
          onValueChange={toggleNotifications}
        />
        
        <SettingItem
          icon="timer"
          label="Auktions-Erinnerungen"
          description="5 Min. vor Auktionsende"
          value={true}
          onValueChange={() => {}}
        />
        
        <SettingItem
          icon="trophy"
          label="Gewinn-Benachrichtigungen"
          description="Sofortige Benachrichtigung bei Gewinn"
          value={true}
          onValueChange={() => {}}
        />
      </View>

      {/* App Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App-Einstellungen</Text>
        
        <SettingItem
          icon="volume-high"
          label="Soundeffekte"
          description="Geräusche bei Geboten"
          value={true}
          onValueChange={() => {}}
        />
        
        <SettingItem
          icon="phone-portrait"
          label="Vibration"
          description="Haptisches Feedback"
          value={true}
          onValueChange={() => {}}
        />
      </View>

      {/* Support Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Hilfe & Support</Text>
        
        <TouchableOpacity style={styles.settingItem}>
          <View style={styles.settingIcon}>
            <Ionicons name="help-circle" size={22} color="#8B5CF6" />
          </View>
          <View style={styles.settingContent}>
            <Text style={styles.settingLabel}>FAQ</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#6B7280" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingItem}>
          <View style={styles.settingIcon}>
            <Ionicons name="chatbubble" size={22} color="#8B5CF6" />
          </View>
          <View style={styles.settingContent}>
            <Text style={styles.settingLabel}>Kontakt</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#6B7280" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingItem}>
          <View style={styles.settingIcon}>
            <Ionicons name="document-text" size={22} color="#8B5CF6" />
          </View>
          <View style={styles.settingContent}>
            <Text style={styles.settingLabel}>AGB & Datenschutz</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#6B7280" />
        </TouchableOpacity>
      </View>

      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={22} color="#EF4444" />
        <Text style={styles.logoutText}>Abmelden</Text>
      </TouchableOpacity>

      {/* App Version */}
      <Text style={styles.version}>BidBlitz App v1.0.0</Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 15,
    padding: 20,
    borderRadius: 15,
  },
  userAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInitial: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  userInfo: {
    marginLeft: 15,
  },
  userName: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  userEmail: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginTop: 2,
  },
  section: {
    backgroundColor: '#1F2937',
    margin: 15,
    marginTop: 0,
    borderRadius: 12,
    padding: 5,
  },
  sectionTitle: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 15,
    paddingTop: 12,
    paddingBottom: 8,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingHorizontal: 15,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingContent: {
    flex: 1,
  },
  settingLabel: {
    color: '#fff',
    fontSize: 15,
  },
  settingDescription: {
    color: '#6B7280',
    fontSize: 12,
    marginTop: 2,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    margin: 15,
    marginTop: 5,
    padding: 15,
    borderRadius: 12,
  },
  logoutText: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  version: {
    color: '#6B7280',
    fontSize: 12,
    textAlign: 'center',
    padding: 20,
  },
});

export default SettingsScreen;
