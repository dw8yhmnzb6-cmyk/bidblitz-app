import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const UserReviewsScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('browse');
  const [reviews, setReviews] = useState([]);
  const [reviewable, setReviewable] = useState([]);
  const [myReviews, setMyReviews] = useState([]);
  const [platformRating, setPlatformRating] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [featuredRes, reviewableRes, myRes, ratingRes] = await Promise.all([
        api.get('/user-reviews/featured'),
        api.get('/user-reviews/can-review'),
        api.get('/user-reviews/my-reviews'),
        api.get('/user-reviews/platform-rating')
      ]);
      setReviews(featuredRes.data.featured || []);
      setReviewable(reviewableRes.data.reviewable || []);
      setMyReviews(myRes.data.reviews || []);
      setPlatformRating(ratingRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderStars = (rating) => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Ionicons
            key={star}
            name={star <= rating ? 'star' : 'star-outline'}
            size={16}
            color="#F59E0B"
          />
        ))}
      </View>
    );
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
        <Ionicons name="chatbubbles" size={48} color="#F59E0B" />
        <Text style={styles.headerTitle}>Bewertungen</Text>
        <Text style={styles.headerSubtitle}>
          Echte Erfahrungen von echten Gewinnern
        </Text>
      </View>

      {/* Platform Rating */}
      {platformRating && (
        <View style={styles.ratingOverview}>
          <View style={styles.ratingMain}>
            <Text style={styles.ratingNumber}>
              {platformRating.average_rating?.toFixed(1)}
            </Text>
            {renderStars(Math.round(platformRating.average_rating))}
            <Text style={styles.ratingCount}>
              {platformRating.total_reviews} Bewertungen
            </Text>
          </View>
          <View style={styles.ratingBars}>
            {[5, 4, 3, 2, 1].map((num) => (
              <View key={num} style={styles.ratingBarRow}>
                <Text style={styles.ratingBarLabel}>{num}</Text>
                <View style={styles.ratingBarBg}>
                  <View
                    style={[
                      styles.ratingBarFill,
                      {
                        width: `${platformRating.total_reviews > 0
                          ? (platformRating.distribution[num] / platformRating.total_reviews) * 100
                          : 0}%`
                      }
                    ]}
                  />
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'browse' && styles.activeTab]}
          onPress={() => setActiveTab('browse')}
        >
          <Text style={[styles.tabText, activeTab === 'browse' && styles.activeTabText]}>
            Alle
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'write' && styles.activeTab]}
          onPress={() => setActiveTab('write')}
        >
          <Text style={[styles.tabText, activeTab === 'write' && styles.activeTabText]}>
            Schreiben ({reviewable.length})
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

      <ScrollView>
        {activeTab === 'browse' && (
          <View style={styles.reviewsSection}>
            {reviews.map((review) => (
              <View key={review.id} style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <View>
                    <Text style={styles.reviewerName}>{review.user_name}</Text>
                    {renderStars(review.rating)}
                  </View>
                  {review.would_recommend && (
                    <View style={styles.recommendBadge}>
                      <Ionicons name="thumbs-up" size={12} color="#10B981" />
                      <Text style={styles.recommendText}>Empfiehlt</Text>
                    </View>
                  )}
                </View>
                {review.title && (
                  <Text style={styles.reviewTitle}>{review.title}</Text>
                )}
                <Text style={styles.reviewComment}>{review.comment}</Text>
                <Text style={styles.reviewProduct}>
                  Produkt: {review.product_name}
                </Text>
                <View style={styles.reviewFooter}>
                  <Text style={styles.reviewDate}>
                    {new Date(review.created_at).toLocaleDateString('de')}
                  </Text>
                  <TouchableOpacity style={styles.helpfulButton}>
                    <Ionicons name="heart-outline" size={14} color="#9CA3AF" />
                    <Text style={styles.helpfulCount}>{review.helpful_votes || 0}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            {reviews.length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons name="chatbubble-outline" size={64} color="#6B7280" />
                <Text style={styles.emptyText}>Noch keine Bewertungen</Text>
              </View>
            )}
          </View>
        )}

        {activeTab === 'write' && (
          <View style={styles.writeSection}>
            <View style={styles.bonusInfo}>
              <Ionicons name="gift" size={24} color="#10B981" />
              <Text style={styles.bonusText}>
                +3 Gebote für jede Bewertung!
              </Text>
            </View>

            {reviewable.map((item) => (
              <TouchableOpacity key={item.auction_id} style={styles.reviewableItem}>
                <View style={styles.reviewableInfo}>
                  <Ionicons name="trophy" size={24} color="#F59E0B" />
                  <View style={styles.reviewableText}>
                    <Text style={styles.reviewableProduct}>{item.product_name}</Text>
                    <Text style={styles.reviewableDate}>
                      Gewonnen am {new Date(item.won_at).toLocaleDateString('de')}
                    </Text>
                  </View>
                </View>
                <Ionicons name="create" size={24} color="#8B5CF6" />
              </TouchableOpacity>
            ))}

            {reviewable.length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons name="checkmark-circle" size={64} color="#10B981" />
                <Text style={styles.emptyText}>Alle Gewinne bewertet!</Text>
              </View>
            )}
          </View>
        )}

        {activeTab === 'my' && (
          <View style={styles.myReviewsSection}>
            {myReviews.map((review) => (
              <View key={review.id} style={styles.myReviewCard}>
                <View style={styles.statusBadge}>
                  <Text style={[
                    styles.statusText,
                    review.status === 'approved' && styles.approvedStatus,
                    review.status === 'pending' && styles.pendingStatus
                  ]}>
                    {review.status === 'approved' ? '✓ Veröffentlicht' : '⏳ In Prüfung'}
                  </Text>
                </View>
                <Text style={styles.myReviewProduct}>{review.product_name}</Text>
                {renderStars(review.rating)}
                {review.title && (
                  <Text style={styles.myReviewTitle}>{review.title}</Text>
                )}
                <Text style={styles.myReviewComment}>{review.comment}</Text>
              </View>
            ))}

            {myReviews.length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons name="create-outline" size={64} color="#6B7280" />
                <Text style={styles.emptyText}>Noch keine Bewertungen geschrieben</Text>
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
  ratingOverview: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#1F2937',
    margin: 16,
    borderRadius: 12,
  },
  ratingMain: {
    alignItems: 'center',
    paddingRight: 16,
    borderRightWidth: 1,
    borderRightColor: '#374151',
  },
  ratingNumber: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
  },
  ratingCount: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 4,
  },
  ratingBars: {
    flex: 1,
    paddingLeft: 16,
    justifyContent: 'center',
  },
  ratingBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 2,
  },
  ratingBarLabel: {
    color: '#9CA3AF',
    width: 16,
    fontSize: 12,
  },
  ratingBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: '#374151',
    borderRadius: 3,
    marginLeft: 8,
  },
  ratingBarFill: {
    height: '100%',
    backgroundColor: '#F59E0B',
    borderRadius: 3,
  },
  starsContainer: {
    flexDirection: 'row',
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
  reviewsSection: {
    padding: 16,
  },
  reviewCard: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  reviewerName: {
    color: '#fff',
    fontWeight: '600',
    marginBottom: 4,
  },
  recommendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#064E3B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  recommendText: {
    color: '#10B981',
    fontSize: 10,
    marginLeft: 4,
  },
  reviewTitle: {
    color: '#fff',
    fontWeight: '600',
    marginTop: 12,
  },
  reviewComment: {
    color: '#D1D5DB',
    marginTop: 8,
  },
  reviewProduct: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 8,
  },
  reviewFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  reviewDate: {
    color: '#6B7280',
    fontSize: 12,
  },
  helpfulButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  helpfulCount: {
    color: '#9CA3AF',
    marginLeft: 4,
    fontSize: 12,
  },
  writeSection: {
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
  reviewableItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1F2937',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  reviewableInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  reviewableText: {
    marginLeft: 12,
  },
  reviewableProduct: {
    color: '#fff',
    fontWeight: '600',
  },
  reviewableDate: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  myReviewsSection: {
    padding: 16,
  },
  myReviewCard: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 16,
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
  pendingStatus: {
    backgroundColor: '#374151',
    color: '#9CA3AF',
  },
  myReviewProduct: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  myReviewTitle: {
    color: '#fff',
    fontWeight: '600',
    marginTop: 8,
  },
  myReviewComment: {
    color: '#D1D5DB',
    marginTop: 4,
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

export default UserReviewsScreen;
