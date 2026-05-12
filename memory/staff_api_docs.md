# BidBlitz Staff Management - API Documentation

## Overview
Complete time tracking, employee management, shift scheduling system for merchants.
Alternative to Crewmeister/Papershift.

## Base URL
`/api/staff`

---

## 📋 Endpoints

### 1. Employee Management

#### Create Staff Member
```http
POST /api/staff/members
Content-Type: application/json

{
  "name": "Max Mustermann",
  "email": "max@example.com",
  "phone": "+49123456789",
  "role": "employee",
  "hourly_rate": 15.50,
  "vacation_days_yearly": 24
}
```

#### List Staff Members
```http
GET /api/staff/members?active_only=true
```

#### Get Single Member
```http
GET /api/staff/members/{staff_id}
```

#### Update Member
```http
PATCH /api/staff/members/{staff_id}
Content-Type: application/json

{
  "name": "Max Mueller",
  "hourly_rate": 16.00
}
```

#### Deactivate Member
```http
DELETE /api/staff/members/{staff_id}
```

---

### 2. Time Tracking

#### Clock Event (Check-in/out, Breaks)
```http
POST /api/staff/clock
Content-Type: application/json

{
  "staff_id": "abc123",
  "action": "clock_in",
  "lat": 52.520008,
  "lng": 13.404954,
  "note": "Optional note",
  "source": "web"
}
```

**Actions:** `clock_in`, `clock_out`, `break_start`, `break_end`

#### Get Today's Events
```http
GET /api/staff/clock/today?staff_id={optional}
```

#### Get Clock History
```http
GET /api/staff/clock/history?staff_id={id}&start_date={iso}&end_date={iso}
```

---

### 3. Shift Scheduling

#### Create Shift
```http
POST /api/staff/shifts
Content-Type: application/json

{
  "staff_id": "abc123",
  "title": "Morning Shift",
  "start_time": "2025-05-13T08:00:00Z",
  "end_time": "2025-05-13T16:00:00Z",
  "location": "Berlin Mitte"
}
```

#### List Shifts
```http
GET /api/staff/shifts?staff_id={optional}&start_date={iso}&end_date={iso}
```

#### Delete Shift
```http
DELETE /api/staff/shifts/{shift_id}
```

---

### 4. Leave Management

#### Create Leave Request
```http
POST /api/staff/leave
Content-Type: application/json

{
  "staff_id": "abc123",
  "type": "vacation",
  "start_date": "2025-06-01",
  "end_date": "2025-06-14",
  "reason": "Summer vacation"
}
```

**Types:** `vacation`, `sick`, `other`

#### List Leave Requests
```http
GET /api/staff/leave?staff_id={optional}&status={pending|approved|rejected}
```

#### Approve/Reject Leave
```http
PATCH /api/staff/leave/{request_id}
Content-Type: application/json

{
  "status": "approved",
  "admin_note": "Genehmigt für Urlaub"
}
```

---

### 5. Reports

#### Calculate Work Hours
```http
GET /api/staff/reports/hours?staff_id={id}&start_date={iso}&end_date={iso}
```

**Response:**
```json
{
  "success": true,
  "staff_id": "abc123",
  "period": {
    "start": "2025-05-06T00:00:00Z",
    "end": "2025-05-12T23:59:59Z"
  },
  "total_hours": 42.5,
  "break_hours": 5.0,
  "net_hours": 37.5,
  "expected_hours": 40.0,
  "overtime_hours": 0.0,
  "events_count": 14
}
```

#### Get Dashboard Summary
```http
GET /api/staff/reports/summary
```

**Response:**
```json
{
  "success": true,
  "active_members": 12,
  "today_checkins": 8,
  "pending_leave": 2,
  "today_shifts": 15
}
```

---

### 6. Bonus Features (Placeholders)

#### Generate QR Check-in Token
```http
GET /api/staff/qr/{staff_id}
```

#### DATEV Export
```http
GET /api/staff/export/datev?start_date={date}&end_date={date}
```

#### PDF Report
```http
GET /api/staff/export/pdf?staff_id={id}&start_date={date}&end_date={date}
```

---

## 🗄️ MongoDB Collections

### staff_members
```javascript
{
  id: "uuid",
  merchant_id: "merchant123",
  name: "Max Mustermann",
  email: "max@example.com",
  phone: "+49123456789",
  role: "employee",
  hourly_rate: 15.50,
  vacation_days_yearly: 24,
  vacation_days_used: 5,
  active: true,
  created_at: "2025-01-15T10:00:00Z",
  updated_at: "2025-05-12T15:30:00Z"
}
```

### staff_clock_events
```javascript
{
  id: "uuid",
  merchant_id: "merchant123",
  staff_id: "abc123",
  action: "clock_in",
  timestamp: "2025-05-12T08:00:00Z",
  lat: 52.520008,
  lng: 13.404954,
  note: "Optional note",
  source: "web",
  created_at: "2025-05-12T08:00:01Z"
}
```

### staff_shifts
```javascript
{
  id: "uuid",
  merchant_id: "merchant123",
  staff_id: "abc123",
  title: "Morning Shift",
  start_time: "2025-05-13T08:00:00Z",
  end_time: "2025-05-13T16:00:00Z",
  location: "Berlin Mitte",
  created_at: "2025-05-10T12:00:00Z",
  updated_at: "2025-05-10T12:00:00Z"
}
```

### staff_leave_requests
```javascript
{
  id: "uuid",
  merchant_id: "merchant123",
  staff_id: "abc123",
  type: "vacation",
  start_date: "2025-06-01",
  end_date: "2025-06-14",
  reason: "Summer vacation",
  status: "pending",
  admin_note: null,
  created_at: "2025-05-12T10:00:00Z",
  updated_at: "2025-05-12T10:00:00Z"
}
```

---

## 🔒 Security

- All endpoints require merchant authentication
- Merchants can only access their own staff data
- `merchant_id` is validated server-side
- Sensitive data excluded from responses

---

## 🚀 Future Features

- [ ] QR/NFC Check-in
- [ ] DATEV CSV Export
- [ ] PDF Report Generation
- [ ] Push Notifications before shifts
- [ ] Wallet Bonus Payout
- [ ] Tip Distribution
- [ ] Geofencing for GPS Check-in
- [ ] Overtime Approval Flow
- [ ] Multi-Location Support
