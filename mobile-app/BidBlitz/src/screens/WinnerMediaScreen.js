import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const WinnerMediaScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('gallery');
  const [gallery, setGallery] = useState([]);
  const [pendingUploads, setPendingUploads] = useState([]);
  const [myUploads, setMyUploads] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [galleryRes, pendingRes, myRes] = await Promise.all([
        api.get('/winner-media/gallery?limit=20'),
        api.get('/winner-media/my-wins-pending'),
        api.get('/winner-media/my-uploads')
      ]);
      setGallery(galleryRes.data.gallery || []);
      setPendingUploads(pendingRes.data.pending_uploads || []);
      setMyUploads(myRes.data.uploads || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleLike = async (mediaId) => {
    try {
      await api.post(`/winner-media/${mediaId}/like`);
      loadData();
    } catch (error) {
      console.error('Error liking:', error);
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
        <Ionicons name="images" size={48} color="#F59E0B" />
        <Text style={styles.headerTitle}>Gewinner-Galerie</Text>
        <Text style={styles.headerSubtitle}>
          Echte Gewinner, echte Fotos
        </Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'gallery' && styles.activeTab]}
          onPress={() => setActiveTab('gallery')}
        >
          <Text style={[styles.tabText, activeTab === 'gallery' && styles.activeTabText]}>
            Galerie
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'upload' && styles.activeTab]}
          onPress={() => setActiveTab('upload')}
        >
          <Text style={[styles.tabText, activeTab === 'upload' && styles.activeTabText]}>
            Hochladen ({pendingUploads.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'my' && styles.activeTab]}
          onPress={() => setActiveTab('my')}
        >
          <Text style={[styles.tabText, activeTab === 'my' && styles.activeTabText]}>
            Meine
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor="#8B5CF6" />
        }
      >
        {activeTab === 'gallery' && (
          <View style={styles.galleryGrid}>
            {gallery.map((item) => (
              <View key={item.id} style={styles.galleryItem}>
                {item.media_url ? (
                  <Image source={{ uri: item.media_url }} style={styles.galleryImage} />
                ) : (
                  <View style={styles.placeholderImage}>
                    <Ionicons name="image" size={40} color="#6B7280" />
                  </View>
                )}
                <View style={styles.galleryInfo}>
                  <Text style={styles.productName} numberOfLines={1}>
                    {item.product_name}
                  </Text>
                  <Text style={styles.winnerName}>{item.user_name}</Text>
                  <View style={styles.priceRow}>
                    <Text style={styles.price}>€{item.won_price?.toFixed(2)}</Text>
                    <Text style={styles.savings}>
                      statt €{item.retail_price?.toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.statsRow}>
                    <TouchableOpacity
                      style={styles.likeButton}
                      onPress={() => handleLike(item.id)}
                    >
                      <Ionicons name="heart" size={16} color="#EF4444" />
                      <Text style={styles.likeCount}>{item.likes || 0}</Text>
                    </TouchableOpacity>
                    <View style={styles.viewCount}>
                      <Ionicons name="eye" size={16} color="#9CA3AF" />
                      <Text style={styles.viewText}>{item.views || 0}</Text>
                    </View>
                  </View>
                </View>
              </View>
            ))}
            {gallery.length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons name="images-outline" size={64} color="#6B7280" />
                <Text style={styles.emptyText}>Noch keine Fotos</Text>
              </View>
            )}
          </View>
        )}

        {activeTab === 'upload' && (
          <View style={styles.uploadSection}>
            <View style={styles.bonusInfo}>
              <Ionicons name="gift" size={24} color="#10B981" />
              <Text style={styles.bonusText}>
                +5 Gebote für jedes hochgeladene Foto!
              </Text>
            </View>
            
            {pendingUploads.map((item) => (
              <View key={item.auction_id} style={styles.uploadItem}>
                {item.product_image ? (
                  <Image source={{ uri: item.product_image }} style={styles.uploadImage} />
                ) : (
                  <View style={styles.uploadImagePlaceholder}>
                    <Ionicons name="cube" size={24} color="#6B7280" />
                  </View>
                )}
                <View style={styles.uploadInfo}>
                  <Text style={styles.uploadProductName}>{item.product_name}</Text>
                  <Text style={styles.uploadPrice}>Gewonnen für €{item.won_price?.toFixed(2)}</Text>
                </View>
                <TouchableOpacity style={styles.uploadButton}>
                  <Ionicons name="camera" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}

            {pendingUploads.length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons name="checkmark-circle" size={64} color="#10B981" />
                <Text style={styles.emptyText}>Alle Gewinne dokumentiert!</Text>
              </View>
            )}
          </View>
        )}

        {activeTab === 'my' && (
          <View style={styles.myUploadsSection}>
            {myUploads.map((item) => (
              <View key={item.id} style={styles.myUploadItem}>
                <View style={styles.statusBadge}>
                  <Text style={[
                    styles.statusText,
                    item.status === 'approved' && styles.approvedStatus,
                    item.status === 'featured' && styles.featuredStatus,
                    item.status === 'pending' && styles.pendingStatus
                  ]}>
                    {item.status === 'approved' ? '✓ Genehmigt' :
                     item.status === 'featured' ? '⭐ Featured' :
                     item.status === 'pending' ? '⏳ Ausstehend' : item.status}
                  </Text>
                </View>
                <Text style={styles.myProductName}>{item.product_name}</Text>
                <Text style={styles.myCaption}>{item.caption}</Text>
                <Text style={styles.myStats}>
                  ❤️ {item.likes || 0} • 👁 {item.views || 0}
                </Text>
              </View>
            ))}

            {myUploads.length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons name="camera-outline" size={64} color="#6B7280" />
                <Text style={styles.emptyText}>Noch keine Uploads</Text>
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
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#8B5CF6',
  },
  tabText: {
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#fff',
  },
  galleryGrid: {
    padding: 16,
  },
  galleryItem: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  galleryImage: {
    width: '100%',
    height: 200,
  },
  placeholderImage: {
    width: '100%',
    height: 200,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
  },
  galleryInfo: {
    padding: 12,
  },
  productName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  winnerName: {
    fontSize: 14,
    color: '#8B5CF6',
    marginTop: 4,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  price: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#10B981',
  },
  savings: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 8,
    textDecorationLine: 'line-through',
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  likeCount: {
    color: '#EF4444',
    marginLeft: 4,
  },
  viewCount: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewText: {
    color: '#9CA3AF',
    marginLeft: 4,
  },
  uploadSection: {
    padding: 16,
  },
  bonusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#064E3B',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  bonusText: {
    color: '#10B981',
    marginLeft: 8,
    fontWeight: '600',
  },
  uploadItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  uploadImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  uploadImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadInfo: {
    flex: 1,
    marginLeft: 12,
  },
  uploadProductName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  uploadPrice: {
    fontSize: 12,
    color: '#10B981',
    marginTop: 4,
  },
  uploadButton: {
    backgroundColor: '#8B5CF6',
    padding: 12,
    borderRadius: 8,
  },
  myUploadsSection: {
    padding: 16,
  },
  myUploadItem: {
    backgroundColor: '#1F2937',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  approvedStatus: {
    backgroundColor: '#064E3B',
    color: '#10B981',
  },
  featuredStatus: {
    backgroundColor: '#7C2D12',
    color: '#F59E0B',
  },
  pendingStatus: {
    backgroundColor: '#374151',
    color: '#9CA3AF',
  },
  myProductName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  myCaption: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
  },
  myStats: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 16,
    marginTop: 16,
  },
});

export default WinnerMediaScreen;
