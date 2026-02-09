import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { authAPI, userAPI } from '../services/api';

const ProfileScreen = ({ navigation }) => {
  const { user, logout, updateUser } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const [profileRes, statsRes] = await Promise.all([
        authAPI.getProfile(),
        userAPI.getStats().catch(() => ({ data: null })),
      ]);
      
      if (profileRes.data) {
        updateUser(profileRes.data);
      }
      if (statsRes.data) {
        setStats(statsRes.data);
      }
    } catch (error) {
      console.log('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Abmelden',
      'Möchten Sie sich wirklich abmelden?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Abmelden', style: 'destructive', onPress: logout },
      ]
    );
  };

  const MenuItem = ({ icon, label, onPress, color = '#8B5CF6', badge }) => (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <View style={[styles.menuIcon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text style={styles.menuLabel}>{label}</Text>
      {badge && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={20} color="#6B7280" />
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container}>
      {/* Profile Header */}
      <LinearGradient
        colors={['#8B5CF6', '#6366F1']}
        style={styles.header}
      >
        <View style={styles.avatarContainer}>
          {user?.avatar_url ? (
            <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </Text>
            </View>
          )}
          {user?.is_vip && (
            <View style={styles.vipBadge}>
              <Text style={styles.vipText}>VIP</Text>
            </View>
          )}
        </View>
        
        <Text style={styles.userName}>{user?.name || 'Benutzer'}</Text>
        <Text style={styles.userEmail}>{user?.email}</Text>
        
        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{user?.bids_balance || user?.bids || 0}</Text>
            <Text style={styles.statLabel}>Gebote</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats?.total_wins || user?.wins || 0}</Text>
            <Text style={styles.statLabel}>Gewinne</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{user?.login_streak || 0}</Text>
            <Text style={styles.statLabel}>Streak</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity 
          style={styles.quickAction}
          onPress={() => navigation.navigate('BuyBids')}
        >
          <View style={[styles.quickActionIcon, { backgroundColor: '#10B98120' }]}>
            <Ionicons name="cart" size={24} color="#10B981" />
          </View>
          <Text style={styles.quickActionText}>Gebote kaufen</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.quickAction}
          onPress={() => navigation.navigate('Favoriten')}
        >
          <View style={[styles.quickActionIcon, { backgroundColor: '#EF444420' }]}>
            <Ionicons name="heart" size={24} color="#EF4444" />
          </View>
          <Text style={styles.quickActionText}>Favoriten</Text>
        </TouchableOpacity>
      </View>

      {/* Menu Items */}
      <View style={styles.menuSection}>
        <Text style={styles.sectionTitle}>Konto</Text>
        
        <MenuItem 
          icon="person-outline" 
          label="Profil bearbeiten" 
          onPress={() => {}}
        />
        <MenuItem 
          icon="wallet-outline" 
          label="Gebote-Verlauf" 
          onPress={() => {}}
          badge={user?.bids_balance || user?.bids}
        />
        <MenuItem 
          icon="receipt-outline" 
          label="Bestellungen" 
          onPress={() => {}}
        />
        <MenuItem 
          icon="gift-outline" 
          label="Gutscheine" 
          color="#10B981"
          onPress={() => {}}
        />
      </View>

      <View style={styles.menuSection}>
        <Text style={styles.sectionTitle}>Einstellungen</Text>
        
        <MenuItem 
          icon="settings-outline" 
          label="App-Einstellungen" 
          onPress={() => navigation.navigate('Settings')}
        />
        <MenuItem 
          icon="notifications-outline" 
          label="Benachrichtigungen" 
          onPress={() => {}}
        />
        <MenuItem 
          icon="shield-outline" 
          label="Sicherheit" 
          onPress={() => {}}
        />
        <MenuItem 
          icon="help-circle-outline" 
          label="Hilfe & Support" 
          color="#6366F1"
          onPress={() => {}}
        />
      </View>

      {/* Referral Code */}
      {user?.referral_code && (
        <View style={styles.referralCard}>
          <View style={styles.referralHeader}>
            <Ionicons name="people" size={24} color="#8B5CF6" />
            <Text style={styles.referralTitle}>Freunde werben</Text>
          </View>
          <Text style={styles.referralText}>
            Teile deinen Code und erhalte Bonus-Gebote!
          </Text>
          <View style={styles.referralCodeBox}>
            <Text style={styles.referralCode}>{user.referral_code}</Text>
            <TouchableOpacity style={styles.copyButton}>
              <Ionicons name="copy" size={18} color="#8B5CF6" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={22} color="#EF4444" />
        <Text style={styles.logoutText}>Abmelden</Text>
      </TouchableOpacity>

      <View style={styles.footer}>
        <Text style={styles.footerText}>BidBlitz v1.0.0</Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  header: {
    padding: 25,
    paddingTop: 20,
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    borderColor: '#fff',
  },
  avatarPlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  avatarText: {
    fontSize: 36,
    color: '#fff',
    fontWeight: 'bold',
  },
  vipBadge: {
    position: 'absolute',
    bottom: 0,
    right: -5,
    backgroundColor: '#F59E0B',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  vipText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  userName: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 12,
  },
  userEmail: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    marginTop: 20,
    padding: 15,
    width: '100%',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  statLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  quickActions: {
    flexDirection: 'row',
    padding: 15,
  },
  quickAction: {
    flex: 1,
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  quickActionIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickActionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  menuSection: {
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
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingHorizontal: 15,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuLabel: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
  },
  badge: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginRight: 8,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  referralCard: {
    backgroundColor: '#1F2937',
    margin: 15,
    marginTop: 0,
    borderRadius: 12,
    padding: 20,
  },
  referralHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  referralTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  referralText: {
    color: '#9CA3AF',
    fontSize: 13,
    marginBottom: 15,
  },
  referralCodeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#374151',
    borderRadius: 10,
    padding: 12,
  },
  referralCode: {
    flex: 1,
    color: '#8B5CF6',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  copyButton: {
    padding: 5,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    margin: 15,
    marginTop: 0,
    padding: 15,
    borderRadius: 12,
  },
  logoutText: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  footer: {
    alignItems: 'center',
    padding: 20,
  },
  footerText: {
    color: '#6B7280',
    fontSize: 12,
  },
});

export default ProfileScreen;
