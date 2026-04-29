# BidBlitz - Frontend Integration Guide

## Neue Components

### 1. SplitPaymentModal
```jsx
import SplitPaymentModal from '../components/SplitPaymentModal';

// In TaxiPage/FoodPage nach completed ride/order:
<SplitPaymentModal 
  isOpen={showSplit}
  onClose={() => setShowSplit(false)}
  type="taxi" // oder "food"
  itemId={ride.ride_id} // oder order.order_id
  totalAmount={ride.total_cost}
/>
```

### 2. LoyaltyDashboard
```jsx
import LoyaltyDashboard from '../components/LoyaltyDashboard';

// In WalletPage oder More-Tab:
<LoyaltyDashboard onClose={() => navigate('/')} />
```

### 3. ReviewModal
```jsx
import ReviewModal from '../components/ReviewModal';

// Nach Ride/Order completion:
<ReviewModal
  isOpen={showReview}
  onClose={() => setShowReview(false)}
  serviceType="taxi" // taxi, food, scooter, marketplace
  serviceId={ride.ride_id}
  onSubmit={() => {
    // Refresh data
  }}
/>
```

### 4. SubscriptionPlans
```jsx
import SubscriptionPlans from '../components/SubscriptionPlans';

// In More/Settings:
<SubscriptionPlans onClose={() => navigate('/')} />
```

### 5. SafetyButton
```jsx
import SafetyButton from '../components/SafetyButton';

// In TaxiPage während active ride:
<SafetyButton rideId={activeRide.ride_id} type="taxi" />
```

### 6. PromoCodeInput
```jsx
import PromoCodeInput from '../components/PromoCodeInput';

// In Checkout/Payment flow:
<PromoCodeInput
  serviceType="food"
  onApply={(discount) => {
    // Apply discount to total
    setDiscount(discount);
  }}
/>
```

### 7. FoodFilters
```jsx
import FoodFilters from '../components/FoodFilters';

// In FoodPage:
const [showFilters, setShowFilters] = useState(false);

<FoodFilters
  onApply={(filters) => {
    // Fetch filtered restaurants
    fetchRestaurants(filters);
    setShowFilters(false);
  }}
  onClose={() => setShowFilters(false)}
/>
```

---

## Backend API Endpoints

### Split Payment
- `POST /api/split-payment/taxi/create`
- `POST /api/split-payment/food/create`
- `POST /api/split-payment/accept`
- `GET /api/split-payment/my-requests`

### Loyalty
- `GET /api/loyalty/my-points`
- `POST /api/loyalty/stamp`
- `GET /api/loyalty/leaderboard`

### Reviews
- `POST /api/reviews/create`
- `GET /api/reviews/{service_type}/{service_id}`
- `POST /api/reviews/{review_id}/helpful`

### Scheduled
- `POST /api/scheduled/create`
- `GET /api/scheduled/my-bookings`
- `DELETE /api/scheduled/{booking_id}`

### Subscriptions
- `GET /api/subscriptions/plans`
- `POST /api/subscriptions/subscribe`
- `GET /api/subscriptions/my-subscriptions`

### Safety
- `POST /api/safety/share-location`
- `POST /api/safety/emergency`
- `POST /api/safety/verify-trip`

### Promo
- `POST /api/promo/apply`
- `GET /api/promo/available`

### Filters
- `GET /api/filters/food/restaurants`
- `GET /api/filters/marketplace/products`

---

## Integration Steps

### 1. Add to existing pages:
- **TaxiPage**: SafetyButton, SplitPaymentModal, ReviewModal
- **ScooterPage**: SubscriptionPlans banner
- **FoodPage**: FoodFilters, PromoCodeInput, ReviewModal
- **WalletPage**: LoyaltyDashboard link
- **More Tab**: SubscriptionPlans, LoyaltyDashboard

### 2. Auto-trigger after completion:
```jsx
// Nach successful ride/order:
useEffect(() => {
  if (status === 'completed') {
    setTimeout(() => setShowReview(true), 2000);
  }
}, [status]);
```

### 3. Loyalty stamps automatisch:
```jsx
// In backend nach successful transaction:
await add_points(10, "Completed taxi ride", user_id)
await add_stamp("taxi", user)
```

---

## Features aktivieren

1. **Split Payment Button** nach jeder Fahrt/Bestellung zeigen
2. **Loyalty Badge** im Header (zeigt Level + Points)
3. **Promo Input** im Checkout-Flow
4. **Safety Button** während aktiver Fahrt (floating bottom-right)
5. **Review Prompt** 2 Sekunden nach Completion
6. **Filter Button** im Restaurant/Produkt-Header
7. **Subscription Banner** wenn kein aktives Abo

---

## Testing Checklist

- [ ] Split Payment funktioniert (Taxi + Food)
- [ ] Loyalty Points werden gutgeschrieben
- [ ] Stamps werden gezählt (5 stamps = reward)
- [ ] Reviews können erstellt werden (mit Fotos)
- [ ] Subscriptions können gekauft werden
- [ ] Safety-Features funktionieren (Share, Emergency)
- [ ] Promo Codes können angewendet werden
- [ ] Filter liefern korrekte Ergebnisse
