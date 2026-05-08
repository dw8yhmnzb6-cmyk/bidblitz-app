# Gespeicherte Empfänger - Backend Schema

## MongoDB Collection: `saved_recipients`

```json
{
  "id": "uuid",
  "user_id": "sender_email@example.com",
  "recipient_id": "recipient_email@example.com",
  "recipient_name": "Max Mustermann",
  "recipient_number": "BE12345",
  "nickname": "Papa",
  "icon": "family",
  "created_at": "2026-05-08T13:30:00Z",
  "last_used": "2026-05-08T14:00:00Z",
  "transfer_count": 15,
  "total_amount_sent": 1250.50
}
```

## User Number System

Jeder User bekommt eine eindeutige Nummer:
- Format: `BE` + 5-stellige Nummer (z.B. `BE12345`)
- Wird bei Registrierung generiert
- Wird in `users` Collection gespeichert: `user_number`

## API Endpoints

### GET `/api/wallet/saved-recipients`
Gibt alle gespeicherten Empfänger zurück

### POST `/api/wallet/saved-recipients`
Fügt neuen Empfänger hinzu
Body: `{ "recipient_number": "BE12345", "nickname": "Mama", "icon": "family" }`

### DELETE `/api/wallet/saved-recipients/{id}`
Löscht gespeicherten Empfänger

### POST `/api/wallet/transfer-by-number`
Geld an Nummer senden
Body: `{ "recipient_number": "BE54321", "amount": 50.00 }`
