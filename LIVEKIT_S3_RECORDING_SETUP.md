# BidBlitz — LiveKit Egress S3 Recording

Stand: 04.05.2026

## Status
✅ **Code-seitig vollständig implementiert** in `/app/backend/routes/livekit_streaming.py` (Lines 253-330).
🔧 Aktivierung erfordert nur ENV-Konfiguration + AWS S3-Bucket-Setup.

---

## 1. AWS S3-Bucket erstellen

```bash
# AWS CLI (installiert?)
aws s3api create-bucket \
  --bucket bidblitz-recordings \
  --region us-east-1 \
  --create-bucket-configuration LocationConstraint=us-east-1

# Lifecycle: Auto-Delete Recordings nach 30 Tagen (kostensparend)
aws s3api put-bucket-lifecycle-configuration \
  --bucket bidblitz-recordings \
  --lifecycle-configuration '{
    "Rules":[{"ID":"expire30d","Status":"Enabled","Expiration":{"Days":30},"Filter":{"Prefix":"recordings/"}}]
  }'
```

Alternativ: AWS Console → S3 → Create Bucket → `bidblitz-recordings` → Region wählen.

## 2. IAM-User mit Minimal-Rechten

Policy `bidblitz-recordings-write`:
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["s3:PutObject", "s3:PutObjectAcl"],
    "Resource": "arn:aws:s3:::bidblitz-recordings/*"
  }]
}
```

User-Credentials downloaden → Access Key ID + Secret Access Key.

## 3. Backend `.env` setzen

```bash
S3_ACCESS_KEY=AKIA...
S3_SECRET_KEY=wJalr...
S3_REGION=us-east-1
S3_BUCKET=bidblitz-recordings
```
Restart: `sudo supervisorctl restart backend`

## 4. Egress-Recording starten (API)

```bash
curl -X POST "$REACT_APP_BACKEND_URL/api/livekit/rooms/auction-live-42/egress/start" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "room_name": "auction-live-42",
    "output_type": "s3",
    "s3_bucket": "bidblitz-recordings",
    "s3_key": "recordings/auction-42/2026-05-04.mp4",
    "layout": "speaker"
  }'
```

Response:
```json
{
  "egress_id": "EGR_xxx",
  "livekit_egress_id": "EG_yyyy",
  "status": "active"
}
```

## 5. Stop & Verify

```bash
# Stop
curl -X POST "$REACT_APP_BACKEND_URL/api/livekit/egress/EGR_xxx/stop" -H "Authorization: Bearer $TOKEN"

# S3-Object listen
aws s3 ls s3://bidblitz-recordings/recordings/auction-42/
```

## 6. Mongo-Collection
Recordings werden in `livekit_egress` getrackt:
```js
{
  egress_id: "EGR_xxx",
  room_name: "auction-live-42",
  status: "active|stopped|failed",
  output_type: "s3",
  s3_bucket: "bidblitz-recordings",
  s3_key: "recordings/...",
  livekit_egress_id: "EG_yyyy",
  started_by: "user_id",
  started_at: "ISO-8601"
}
```

## 7. Costs (Reference)
| Service | Cost | Notes |
|---------|------|-------|
| LiveKit Egress | $0.01/min recording | Cloud-Plan |
| S3 Storage | $0.023/GB/Month | us-east-1 Standard |
| S3 Egress | $0.09/GB | First 1GB/Month free |
| 1h MP4 Recording (~1GB) | ~$0.92 | Egress + 1 Monat Storage |

**Tipp:** S3 Lifecycle-Policy auf 30 Tage = ~$0.03/Recording nach Cleanup.

## 8. Fallback (lokales File-Output)
Wenn `S3_ACCESS_KEY` leer → automatisch `/recordings/{egress_id}.mp4` lokal auf dem LiveKit-Server gespeichert (siehe `livekit_streaming.py:299-303`).
