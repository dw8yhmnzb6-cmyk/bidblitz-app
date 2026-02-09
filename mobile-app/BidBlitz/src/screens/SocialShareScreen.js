import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  Linking
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const SocialShareScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [shareable, setShareable] = useState([]);
  const [myShares, setMyShares] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [shareableRes, sharesRes, leaderboardRes] = await Promise.all([
        api.get('/social-media-share/shareable-content'),
        api.get('/social-media-share/my-shares'),
        api.get('/social-media-share/leaderboard?period=week')
      ]);
      setShareable(shareableRes.data);
      setMyShares(sharesRes.data);
      setLeaderboard(leaderboardRes.data.leaderboard || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async (item, platform) => {
    try {
      const response = await api.post('/social-media-share/share', {
        share_type: item.type,
        content_id: item.content_id,
        platform
      });

      if (response.data.success) {
        if (platform === 'copy') {
          // Copy to clipboard
          alert('Link kopiert!');
        } else if (response.data.share_url) {
          await Linking.openURL(response.data.share_url);
        }
        loadData(); // Reload to update stats
      }
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleNativeShare = async (item) => {
    try {
      await Share.share({
        message: `${item.description} ${shareable?.referral_link || ''}`,
        url: shareable?.referral_link
      });
      handleShare(item, 'native');
    } catch (error) {
      console.error('Error:', error);
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
        <Ionicons name="share-social" size={48} color="#EC4899" />
        <Text style={styles.headerTitle}>Teilen & Verdienen</Text>
        <Text style={styles.headerSubtitle}>
          Teile deine Gewinne und erhalte Bonus-Gebote
        </Text>
      </View>

      {/* Rewards Info */}
      <View style={styles.rewardsInfo}>
        <View style={styles.rewardItem}>
          <Ionicons name="trophy" size={24} color="#F59E0B" />
          <Text style={styles.rewardText}>+5 Gebote für Gewinn teilen</Text>
        </View>
        <View style={styles.rewardItem}>
          <Ionicons name="ribbon" size={24} color="#8B5CF6" />
          <Text style={styles.rewardText}>+3 Gebote für Achievement</Text>
        </View>
        <View style={styles.rewardItem}>
          <Ionicons name="gift" size={24} color="#10B981" />
          <Text style={styles.rewardText}>+10 Gebote für erstes Teilen!</Text>
        </View>
      </View>

      {/* Referral Link */}
      <View style={styles.referralSection}>
        <Text style={styles.sectionTitle}>Dein Empfehlungslink</Text>
        <View style={styles.linkBox}>
          <Text style={styles.linkText} numberOfLines={1}>
            {shareable?.referral_link}
          </Text>
          <TouchableOpacity
            style={styles.copyButton}
            onPress={() => handleShare({ type: 'referral', content_id: 'general' }, 'copy')}
          >
            <Ionicons name="copy" size={20} color="#8B5CF6" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Shareable Content */}
      <View style={styles.shareableSection}>
        <Text style={styles.sectionTitle}>Zum Teilen</Text>
        {shareable?.shareable?.map((item, index) => (
          <View key={index} style={styles.shareCard}>
            <View style={styles.shareContent}>
              <View style={styles.shareIcon}>
                <Ionicons
                  name={item.type === 'win' ? 'trophy' : item.type === 'achievement' ? 'ribbon' : 'people'}
                  size={24}
                  color={item.type === 'win' ? '#F59E0B' : item.type === 'achievement' ? '#8B5CF6' : '#10B981'}
                />
              </View>
              <View style={styles.shareInfo}>
                <Text style={styles.shareTitle}>{item.title}</Text>
                <Text style={styles.shareDesc} numberOfLines={2}>{item.description}</Text>
              </View>
              <View style={styles.rewardBadge}>
                <Text style={styles.rewardBadgeText}>+{item.reward_bids}</Text>
              </View>
            </View>
            <View style={styles.platformButtons}>
              <TouchableOpacity
                style={[styles.platformButton, styles.facebookButton]}
                onPress={() => handleShare(item, 'facebook')}
              >
                <Ionicons name="logo-facebook" size={20} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.platformButton, styles.twitterButton]}
                onPress={() => handleShare(item, 'twitter')}
              >
                <Ionicons name="logo-twitter" size={20} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.platformButton, styles.whatsappButton]}
                onPress={() => handleShare(item, 'whatsapp')}
              >
                <Ionicons name="logo-whatsapp" size={20} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.platformButton, styles.shareButton]}
                onPress={() => handleNativeShare(item)}
              >
                <Ionicons name="share" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>

      {/* Stats */}
      <View style={styles.statsSection}>
        <Text style={styles.sectionTitle}>Deine Statistik</Text>
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{myShares?.total_shares || 0}</Text>
            <Text style={styles.statLabel}>Geteilt</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{myShares?.total_bids_earned || 0}</Text>
            <Text style={styles.statLabel}>Gebote verdient</Text>
          </View>
        </View>
      </View>

      {/* Leaderboard */}
      <View style={styles.leaderboardSection}>
        <Text style={styles.sectionTitle}>Top Teiler der Woche</Text>
        {leaderboard.map((entry, index) => (
          <View key={index} style={styles.leaderboardItem}>
            <View style={styles.rankBadge}>
              <Text style={styles.rankText}>{index + 1}</Text>
            </View>
            <Text style={styles.leaderName}>{entry.user_name}</Text>
            <Text style={styles.leaderShares}>{entry.share_count} Shares</Text>
          </View>
        ))}
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
    textAlign: 'center',
  },
  rewardsInfo: {
    backgroundColor: '#1F2937',
    margin: 16,
    borderRadius: 12,
    padding: 16,
  },
  rewardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  rewardText: {
    color: '#D1D5DB',
    marginLeft: 12,
  },
  referralSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  linkBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 12,
  },
  linkText: {
    flex: 1,
    color: '#8B5CF6',
    fontFamily: 'monospace',
  },
  copyButton: {
    padding: 8,
  },
  shareableSection: {
    padding: 16,
  },
  shareCard: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  shareContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shareIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareInfo: {
    flex: 1,
    marginLeft: 12,
  },
  shareTitle: {
    color: '#fff',
    fontWeight: '600',
  },
  shareDesc: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 4,
  },
  rewardBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  rewardBadgeText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  platformButtons: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  platformButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  facebookButton: {
    backgroundColor: '#1877F2',
  },
  twitterButton: {
    backgroundColor: '#1DA1F2',
  },
  whatsappButton: {
    backgroundColor: '#25D366',
  },
  shareButton: {
    backgroundColor: '#8B5CF6',
  },
  statsSection: {
    padding: 16,
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 20,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#374151',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  statLabel: {
    color: '#9CA3AF',
    marginTop: 4,
  },
  leaderboardSection: {
    padding: 16,
    paddingBottom: 32,
  },
  leaderboardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  leaderName: {
    flex: 1,
    color: '#fff',
    fontWeight: '600',
    marginLeft: 12,
  },
  leaderShares: {
    color: '#9CA3AF',
  },
});

export default SocialShareScreen;
