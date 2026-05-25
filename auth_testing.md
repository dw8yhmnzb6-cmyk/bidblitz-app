# Staff Auth Testing

## API
- `POST /api/staff/auth/login`
- `POST /api/staff/auth/terminal-pin`
- `POST /api/staff/auth/logout`
- `GET /api/staff/auth/me`

## Rate-Limit Checks
1. Falsche Staff-Login-Daten 6x senden → 429 erwarten
2. Falsche Terminal-PIN 6x senden → 429 erwarten
3. Erfolgreicher Staff-Login setzt `staff_session`
4. Erfolgreiche PIN-Abfrage nach gültiger Eingabe funktioniert weiter

## Example curl
```bash
curl -i -X POST "$REACT_APP_BACKEND_URL/api/staff/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"mitarbeiter@bidblitz.com","password":"wrong"}'

curl -i -X POST "$REACT_APP_BACKEND_URL/api/staff/auth/terminal-pin" \
  -H "Content-Type: application/json" \
  -d '{"pin":"9999"}'
```

## Custom JWT WebSocket Auth
1. Login via `/api/auth/login` und Cookies speichern.
2. `GET /api/auth/ws-token` mit denselben Cookies aufrufen.
3. WebSocket auf `/api/restaurant/ws/{store_id}?token=...` öffnen.
4. Erwartung: `connected` Event, danach Live-Events bei Order-/Service-Änderungen.