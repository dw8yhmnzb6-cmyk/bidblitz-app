# 🔧 Code-Refactoring Plan

**Erstellt:** 2026-05-11  
**Status:** In Progress

---

## 📊 Aktueller Status

### Problemat Frontend:
- `/app/frontend/src/pages/TaxiPage.jsx`: **1682 Zeilen** ❌ (Ziel: < 500)

### Backend:
- `/app/backend/server.py`: **1005 Zeilen** ❌ (Ziel: < 300)
- `/app/backend/routes/taxi.py`: **2623 Zeilen** ❌ (Ziel: < 800)
- `/app/backend/routes/auctions.py`: **2487 Zeilen** ❌ (Ziel: < 800)
- `/app/backend/models/`: **Existiert nicht** ❌

### Konsequenzen:
- Schwer wartbar
- Merge-Konflikte bei paralleler Entwicklung
- Schlechte Testbarkeit
- Langsame IDE-Performance

---

## 🎯 Refactoring-Ziele

1. **Modularität**: Jedes File < 800 Zeilen
2. **Separation of Concerns**: Models, Routes, Services getrennt
3. **Wiederverwendbarkeit**: Shared Components/Utilities
4. **Testbarkeit**: Klare Unit-Test-Targets

---

## 📋 Phase 1: Backend Models (HÖCHSTE PRIORITÄT)

### 1.1 Models-Struktur erstellen

```
/app/backend/models/
├── __init__.py
├── user.py          # User, UserPublic, UserUpdate
├── taxi.py          # TaxiRide, DriverApplication, FavoriteLocation
├── auction.py       # Auction, Bid, BidHistory
├── pos.py           # POSTransaction, Receipt, Shift
├── payment.py       # Payment, Transaction, Wallet
├── ev_charging.py   # ChargePoint, ChargingSession
└── common.py        # Shared models (Address, Coordinates, etc.)
```

### 1.2 Models extrahieren aus Routes

**Quellen:**
- `routes/taxi.py` → `models/taxi.py`
- `routes/auctions.py` → `models/auction.py`
- `routes/pos_system.py` → `models/pos.py`
- `routes/auth.py` → `models/user.py`

**Beispiel-Migration (taxi.py):**
```python
# VORHER (in routes/taxi.py):
class TaxiRide(BaseModel):
    ride_id: str
    ...

# NACHHER (in models/taxi.py):
from pydantic import BaseModel

class TaxiRide(BaseModel):
    ride_id: str
    ...

# In routes/taxi.py:
from models.taxi import TaxiRide
```

---

## 📋 Phase 2: Backend Routes aufteilen

### 2.1 Taxi-Modul (2623 → 3× ~800 Zeilen)

```
/app/backend/routes/taxi/
├── __init__.py
├── rides.py         # Booking, tracking, completion
├── drivers.py       # Onboarding, status, earnings
├── favorites.py     # Favorite locations CRUD
└── operator.py      # Operator dashboard
```

**Migration:**
```python
# routes/taxi/__init__.py
from fastapi import APIRouter
from .rides import router as rides_router
from .drivers import router as drivers_router
from .favorites import router as favorites_router

router = APIRouter(prefix="/api/taxi")
router.include_router(rides_router)
router.include_router(drivers_router)
router.include_router(favorites_router)
```

### 2.2 Auctions-Modul (2487 → 3× ~800 Zeilen)

```
/app/backend/routes/auctions/
├── __init__.py
├── core.py          # Create, list, details
├── bids.py          # Bidding, bid history
└── management.py    # Admin: cancel, extend
```

---

## 📋 Phase 3: Backend server.py aufräumen (1005 → ~300 Zeilen)

### 3.1 Middleware extrahieren

```
/app/backend/core/middleware.py
```

Verschieben:
- CORS config
- Request logging
- Rate limiting handler

### 3.2 Router-Registry optimieren

**Vorher (server.py):**
```python
from routes import auth, taxi, auctions, ...  # 40+ imports

app.include_router(auth.router)
app.include_router(taxi.router)
...  # 40+ registrations
```

**Nachher:**
```python
from core.router_registry import register_all_routers

register_all_routers(app)
```

**Neue Datei `/app/backend/core/router_registry.py`:**
```python
def register_all_routers(app: FastAPI):
    from routes import auth, taxi, auctions, ...
    routers = [
        auth.router,
        taxi.router,
        auctions.router,
        ...
    ]
    for router in routers:
        app.include_router(router)
```

---

## 📋 Phase 4: Frontend TaxiPage aufteilen (1682 → 4× ~400 Zeilen)

### 4.1 Komponenten extrahieren

```
/app/frontend/src/components/taxi/
├── TaxiBookingForm.jsx      # Main booking interface
├── TaxiMap.jsx              # Map rendering & markers
├── TaxiFavorites.jsx        # Favorites list & modal
├── TaxiVehicleSelector.jsx  # Vehicle type picker
├── useTaxiState.js          # Custom hook für state
└── useTaxiMap.js            # Custom hook für Mapbox
```

### 4.2 State-Management auslagern

**Neu: `/app/frontend/src/hooks/useTaxiState.js`**
```javascript
export function useTaxiState() {
  const [pickup, setPickup] = useState(...)
  const [dropoff, setDropoff] = useState(...)
  const [estimates, setEstimates] = useState([])
  
  const getEstimate = useCallback(async () => { ... }, [pickup, dropoff])
  
  return { pickup, setPickup, dropoff, setDropoff, estimates, getEstimate }
}
```

**TaxiPage.jsx wird zu:**
```jsx
import { TaxiBookingForm } from '../components/taxi/TaxiBookingForm'
import { useTaxiState } from '../hooks/useTaxiState'

export default function TaxiPage() {
  const taxiState = useTaxiState()
  return <TaxiBookingForm {...taxiState} />
}
```

---

## ✅ Implementation Checklist

### Backend Models (Phase 1) - **✅ COMPLETED**
- [x] `/app/backend/models/__init__.py` erstellt
- [x] `models/common.py` (shared types: Coordinates, Address)
- [x] `models/taxi.py` extrahiert (15 Models, 201 lines)
- [x] Routes aktualisieren (imports in taxi.py)
- [x] **Ergebnis:** routes/taxi.py: 2623 → 2477 lines (-146 lines)

### Backend Routes (Phase 2) - **PLANNED**
- [ ] `routes/taxi/` Modul erstellen
  - [ ] `taxi/rides.py`
  - [ ] `taxi/drivers.py`
  - [ ] `taxi/favorites.py`
- [ ] `routes/auctions/` Modul erstellen
  - [ ] `auctions/core.py`
  - [ ] `auctions/bids.py`
- [ ] Alt-Files löschen

### Backend server.py (Phase 3) - **PLANNED**
- [ ] `core/middleware.py` erstellen
- [ ] `core/router_registry.py` erstellen
- [ ] `server.py` cleanup
- [ ] Testen: `python -c "from server import app"`

### Frontend TaxiPage (Phase 4) - **PLANNED**
- [ ] `hooks/useTaxiState.js`
- [ ] `hooks/useTaxiMap.js`
- [ ] `components/taxi/TaxiBookingForm.jsx`
- [ ] `components/taxi/TaxiMap.jsx`
- [ ] `pages/TaxiPage.jsx` refactoren
- [ ] Testen: yarn build

---

## 🧪 Testing-Strategie

Nach jedem Phase:
1. **Linting:** `yarn lint` + `ruff check`
2. **Import-Check:** `python -c "from server import app"`
3. **API-Test:** curl health-check endpoints
4. **Frontend-Build:** `yarn build`
5. **E2E:** Testing subagent für kritische Flows

---

## 📈 Erfolgskriterien

- ✅ Kein File > 800 Zeilen
- ✅ Models in separatem `/models` Ordner
- ✅ Taxi/Auctions als Submodule
- ✅ TaxiPage < 500 Zeilen
- ✅ Alle Tests bestehen
- ✅ Keine kaputten Imports

---

**Nächster Schritt:** Phase 1 - Backend Models extrahieren
