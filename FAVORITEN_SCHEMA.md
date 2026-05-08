# Favoriten / Gespeicherte Adressen - Backend Schema

## MongoDB Collection: `user_favorite_locations`

```json
{
  "id": "uuid-v4",
  "user_id": "user-email@example.com",
  "name": "Zuhause",  // User-defined name
  "address": "Hauptstraße 123, 10115 Berlin",
  "latitude": 52.5200,
  "longitude": 13.4050,
  "icon": "home",  // home, work, star, heart
  "created_at": "2026-05-08T10:30:00Z",
  "last_used": "2026-05-08T12:00:00Z",
  "use_count": 5
}
```

## API Endpoints

### GET `/api/user/favorite-locations`
Returns all favorite locations for authenticated user

### POST `/api/user/favorite-locations`
Add new favorite location

### DELETE `/api/user/favorite-locations/{id}`
Remove favorite location

### PUT `/api/user/favorite-locations/{id}`
Update favorite location name/icon
