import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const TournamentScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [tournament, setTournament] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [myRank, setMyRank] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTournamentData();
  }, []);

  const fetchTournamentData = async () => {
    try {
      const [tournamentRes, leaderboardRes, rankRes] = await Promise.all([
        api.get('/tournament/current'),
        api.get('/tournament/leaderboard?limit=20'),
        api.get('/tournament/my-rank').catch(() => ({ data: null })),
      ]);
      
      setTournament(tournamentRes.data?.tournament);
      setLeaderboard(leaderboardRes.data?.leaderboard || []);
      setMyRank(rankRes.data);
    } catch (error) {
      console.log('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRankIcon = (rank) => {
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return `#${rank}`;
    }
  };

  const getRankColor = (rank) => {
    switch (rank) {
      case 1: return '#F59E0B';
      case 2: return '#9CA3AF';
      case 3: return '#CD7F32';
      default: return '#6B7280';
    }
  };

  const renderLeaderboardItem = ({ item, index }) => (
    <View style={[
      styles.leaderboardItem,
      item.rank <= 3 && styles.topRankItem,
      myRank?.rank === item.rank && styles.myRankItem,
    ]}>
      <View style={styles.rankContainer}>
        <Text style={[styles.rankText, { color: getRankColor(item.rank) }]}>
          {getRankIcon(item.rank)}
        </Text>
      </View>
      
      <View style={styles.playerInfo}>
        <Text style={styles.playerName}>{item.user_name}</Text>
        <Text style={styles.playerStats}>
          {item.wins} Siege • {item.bids_placed} Gebote
        </Text>
      </View>
      
      <View style={styles.scoreContainer}>
        <Text style={styles.scoreValue}>{item.score}</Text>
        <Text style={styles.scoreLabel}>Punkte</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#F59E0B', '#D97706']}
        style={styles.header}
      >
        <Ionicons name="trophy" size={48} color="#fff" />
        <Text style={styles.headerTitle}>Wöchentliches Turnier</Text>
        {tournament && (
          <Text style={styles.tournamentName}>{tournament.name}</Text>
        )}
      </LinearGradient>

      {/* Time Remaining */}
      {tournament && (
        <View style={styles.timeCard}>
          <Ionicons name="time" size={24} color="#F59E0B" />
          <View style={styles.timeInfo}>
            <Text style={styles.timeLabel}>Verbleibende Zeit</Text>
            <Text style={styles.timeValue}>
              {tournament.time_remaining?.days}d {tournament.time_remaining?.hours}h {tournament.time_remaining?.minutes}m
            </Text>
          </View>
        </View>
      )}

      {/* Prizes */}
      <View style={styles.prizesContainer}>
        <Text style={styles.sectionTitle}>🏆 Preise</Text>
        <View style={styles.prizesRow}>
          <View style={styles.prizeItem}>
            <Text style={styles.prizeEmoji}>🥇</Text>
            <Text style={styles.prizeValue}>100</Text>
            <Text style={styles.prizeLabel}>Gebote</Text>
          </View>
          <View style={styles.prizeItem}>
            <Text style={styles.prizeEmoji}>🥈</Text>
            <Text style={styles.prizeValue}>50</Text>
            <Text style={styles.prizeLabel}>Gebote</Text>
          </View>
          <View style={styles.prizeItem}>
            <Text style={styles.prizeEmoji}>🥉</Text>
            <Text style={styles.prizeValue}>25</Text>
            <Text style={styles.prizeLabel}>Gebote</Text>
          </View>
        </View>
      </View>

      {/* My Rank */}
      {myRank && (
        <View style={styles.myRankCard}>
          <Text style={styles.myRankTitle}>Dein Rang</Text>
          <View style={styles.myRankInfo}>
            <Text style={styles.myRankNumber}>#{myRank.rank || '-'}</Text>
            <Text style={styles.myRankScore}>{myRank.score || 0} Punkte</Text>
            {myRank.in_prize_position && (
              <View style={styles.inPrizeBadge}>
                <Text style={styles.inPrizeText}>🎉 Im Preisgeld!</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Leaderboard */}
      <View style={styles.leaderboardSection}>
        <Text style={styles.sectionTitle}>📊 Rangliste</Text>
        <FlatList
          data={leaderboard}
          renderItem={renderLeaderboardItem}
          keyExtractor={item => item.user_id}
          refreshing={loading}
          onRefresh={fetchTournamentData}
          style={styles.leaderboardList}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  header: {
    padding: 24,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 12,
  },
  tournamentName: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  timeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  timeInfo: {
    flex: 1,
  },
  timeLabel: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  timeValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  prizesContainer: {
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  prizesRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#1F2937',
    padding: 16,
    borderRadius: 12,
  },
  prizeItem: {
    alignItems: 'center',
  },
  prizeEmoji: {
    fontSize: 32,
  },
  prizeValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 4,
  },
  prizeLabel: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  myRankCard: {
    backgroundColor: '#8B5CF6',
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  myRankTitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  myRankInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 16,
  },
  myRankNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  myRankScore: {
    fontSize: 16,
    color: '#fff',
  },
  inPrizeBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  inPrizeText: {
    color: '#fff',
    fontWeight: '600',
  },
  leaderboardSection: {
    flex: 1,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  leaderboardList: {
    flex: 1,
  },
  leaderboardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  topRankItem: {
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  myRankItem: {
    backgroundColor: '#374151',
  },
  rankContainer: {
    width: 40,
    alignItems: 'center',
  },
  rankText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  playerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  playerStats: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  scoreContainer: {
    alignItems: 'flex-end',
  },
  scoreValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#8B5CF6',
  },
  scoreLabel: {
    fontSize: 10,
    color: '#6B7280',
  },
});

export default TournamentScreen;
