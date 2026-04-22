import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';

const { width } = Dimensions.get('window');

export default function ServicesScreen({ navigation }) {
  const services = [
    // Mobility
    { id: 'taxi', icon: 'navigation', label: 'Taxi', color: '#FFB800', category: 'mobility', screen: 'Taxi' },
    { id: 'scooter', icon: 'box', label: 'E-Scooter', color: '#00FFA3', category: 'mobility', screen: 'Scooter' },
    { id: 'hotels', icon: 'home', label: 'Hotels', color: '#FF6B6B', category: 'mobility', screen: 'Hotels' },
    { id: 'flights', icon: 'send', label: 'Flüge', color: '#00D4FF', category: 'mobility', screen: 'Flights' },
    { id: 'ev', icon: 'battery-charging', label: 'Ladesäulen', color: '#00FFA3', category: 'mobility', screen: 'EVCharging' },
    
    // Shopping
    { id: 'auctions', icon: 'zap', label: 'Auktionen', color: '#00D4FF', category: 'shopping', screen: 'Auctions' },
    { id: 'classifieds', icon: 'shopping-bag', label: 'Kleinanzeigen', color: '#FFB800', category: 'shopping', screen: 'Classifieds' },
    { id: 'marketplace', icon: 'shopping-cart', label: 'Marktplatz', color: '#FF6B6B', category: 'shopping', screen: 'Marketplace' },
    
    // Food & Entertainment
    { id: 'food', icon: 'coffee', label: 'Essen', color: '#FF6B6B', category: 'food', screen: 'Food' },
    { id: 'restaurants', icon: 'map-pin', label: 'Restaurants', color: '#FFB800', category: 'food', screen: 'Restaurants' },
    { id: 'events', icon: 'calendar', label: 'Events', color: '#00D4FF', category: 'food', screen: 'Events' },
    
    // Finance
    { id: 'wallet', icon: 'credit-card', label: 'Wallet', color: '#00FFA3', category: 'finance', screen: 'Wallet' },
    { id: 'savings', icon: 'trending-up', label: 'Sparen', color: '#00D4FF', category: 'finance', screen: 'Savings' },
    { id: 'crypto', icon: 'dollar-sign', label: 'Crypto', color: '#FFB800', category: 'finance', screen: 'Crypto' },
    { id: 'bills', icon: 'file-text', label: 'Rechnungen', color: '#FF6B6B', category: 'finance', screen: 'Bills' },
    
    // Kids
    { id: 'kids-gps', icon: 'map', label: 'GPS Tracking', color: '#00FFA3', category: 'kids', screen: 'KidsGPS' },
    { id: 'kids-wallet', icon: 'gift', label: 'Kids Wallet', color: '#FFB800', category: 'kids', screen: 'KidsWallet' },
    
    // Social
    { id: 'dating', icon: 'heart', label: 'Dating', color: '#FF6B6B', category: 'social', screen: 'Dating' },
    { id: 'friends-map', icon: 'users', label: 'Friends Map', color: '#00D4FF', category: 'social', screen: 'FriendsMap' },
    
    // Merchants
    { id: 'merchant', icon: 'briefcase', label: 'Händler', color: '#00FFA3', category: 'merchants', screen: 'MerchantPayments' },
  ];

  const categories = [
    { id: 'all', label: 'Alle', icon: 'grid' },
    { id: 'mobility', label: 'Mobilität', icon: 'navigation' },
    { id: 'shopping', label: 'Shopping', icon: 'shopping-bag' },
    { id: 'food', label: 'Essen', icon: 'coffee' },
    { id: 'finance', label: 'Finanzen', icon: 'credit-card' },
    { id: 'kids', label: 'Kids', icon: 'heart' },
    { id: 'social', label: 'Social', icon: 'users' },
    { id: 'merchants', label: 'Händler', icon: 'briefcase' },
  ];

  const [selectedCategory, setSelectedCategory] = React.useState('all');

  const filteredServices = selectedCategory === 'all' 
    ? services 
    : services.filter(s => s.category === selectedCategory);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Services</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Search')}>
          <Icon name="search" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      <ScrollView>
        {/* Categories */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categories}
        >
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.categoryChip,
                selectedCategory === cat.id && styles.categoryChipActive,
              ]}
              onPress={() => setSelectedCategory(cat.id)}
            >
              <Icon
                name={cat.icon}
                size={16}
                color={selectedCategory === cat.id ? '#0A0A0F' : 'rgba(255,255,255,0.7)'}
              />
              <Text
                style={[
                  styles.categoryText,
                  selectedCategory === cat.id && styles.categoryTextActive,
                ]}
              >
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Services Grid */}
        <View style={styles.servicesGrid}>
          {filteredServices.map((service) => (
            <TouchableOpacity
              key={service.id}
              style={[styles.serviceCard, { backgroundColor: `${service.color}15` }]}
              onPress={() => navigation.navigate(service.screen)}
            >
              <View style={[styles.serviceIcon, { backgroundColor: service.color }]}>
                <Icon name={service.icon} size={24} color="#FFF" />
              </View>
              <Text style={styles.serviceLabel}>{service.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  categories: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    gap: 6,
  },
  categoryChipActive: {
    backgroundColor: '#00D4FF',
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  categoryTextActive: {
    color: '#0A0A0F',
  },
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 20,
    gap: 16,
  },
  serviceCard: {
    width: (width - 56) / 3,
    aspectRatio: 1,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  serviceIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  serviceLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFF',
    textAlign: 'center',
  },
});
