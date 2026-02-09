import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Image,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const FavoritesScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchFavorites = useCallback(async () => {
    try {
      const response = await api.get('/favorites/my');
      setFavorites(response.data || []);
    } catch (error) {
      console.log('Error fetching favorites:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchFavorites();
  };

  const removeFavorite = async (favoriteId) => {
    Alert.alert(
      'Favorit entfernen',
      'Möchten Sie dieses Produkt aus Ihren Favoriten entfernen?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Entfernen',
          style: 'destructive',
          onPress: async () => {
            try {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              await api.delete(`/favorites/${favoriteId}`);
              setFavorites(prev => prev.filter(f => f.id !== favoriteId));
            } catch (error) {
              Alert.alert('Fehler', 'Konnte Favorit nicht entfernen');
            }
          },
        },
      ]
    );
  };

  const renderFavorite = ({ item }) => {
    const product = item.product_info || {};
    
    return (
      <TouchableOpacity
        style={styles.favoriteCard}
        onPress={() => {
          // Find auction with this product and navigate
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }}
      >
        <Image
          source={{ uri: product.image_url || 'https://via.placeholder.com/100' }}
          style={styles.productImage}
        />
        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={2}>
            {product.name || 'Unbekanntes Produkt'}
          </Text>
          
          {product.retail_price && (
            <Text style={styles.retailPrice}>
              UVP: €{product.retail_price?.toFixed(0)}
            </Text>
          )}
          
          {item.price_alert && (
            <View style={styles.alertBadge}>
              <Ionicons name="notifications" size={12} color="#F59E0B" />
              <Text style={styles.alertText}>
                Alarm: unter €{item.price_alert}
              </Text>
            </View>
          )}
          
          <Text style={styles.dateText}>
            Hinzugefügt: {new Date(item.created_at).toLocaleDateString('de-DE')}
          </Text>
        </View>
        
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => removeFavorite(item.id)}
        >
          <Ionicons name="heart-dislike" size={22} color="#EF4444" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const EmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="heart-outline" size={80} color="#374151" />
      <Text style={styles.emptyTitle}>Keine Favoriten</Text>
      <Text style={styles.emptyText}>
        Tippen Sie auf das Herz-Symbol bei einer Auktion, um sie zu Ihren Favoriten hinzuzufügen.
      </Text>
      <TouchableOpacity
        style={styles.browseButton}
        onPress={() => navigation.navigate('Auktionen')}
      >
        <LinearGradient
          colors={['#8B5CF6', '#6366F1']}
          style={styles.browseButtonGradient}
        >
          <Ionicons name="search" size={20} color="#fff" />
          <Text style={styles.browseButtonText}>Auktionen durchsuchen</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Meine Favoriten</Text>
        <View style={styles.headerBadge}>
          <Ionicons name="heart" size={16} color="#EF4444" />
          <Text style={styles.headerCount}>{favorites.length}</Text>
        </View>
      </View>

      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <Ionicons name="notifications" size={18} color="#8B5CF6" />
        <Text style={styles.infoText}>
          Sie werden benachrichtigt, wenn Ihre Favoriten in einer Auktion sind!
        </Text>
      </View>

      {/* Favorites List */}
      {favorites.length > 0 ? (
        <FlatList
          data={favorites}
          renderItem={renderFavorite}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8B5CF6" />
          }
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <EmptyState />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    paddingTop: 10,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  headerCount: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 5,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    marginHorizontal: 15,
    marginBottom: 15,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  infoText: {
    flex: 1,
    color: '#A5B4FC',
    fontSize: 12,
    marginLeft: 10,
  },
  listContainer: {
    padding: 15,
    paddingTop: 0,
  },
  favoriteCard: {
    flexDirection: 'row',
    backgroundColor: '#1F2937',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  productImage: {
    width: 100,
    height: 100,
    backgroundColor: '#374151',
  },
  productInfo: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  productName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  retailPrice: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  alertBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  alertText: {
    color: '#F59E0B',
    fontSize: 11,
    marginLeft: 4,
  },
  dateText: {
    color: '#6B7280',
    fontSize: 10,
  },
  removeButton: {
    padding: 15,
    justifyContent: 'center',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 20,
  },
  emptyText: {
    color: '#9CA3AF',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 22,
  },
  browseButton: {
    marginTop: 25,
    borderRadius: 12,
    overflow: 'hidden',
  },
  browseButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 25,
  },
  browseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});

export default FavoritesScreen;
