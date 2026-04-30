#!/bin/bash

###############################################################################
# MongoDB Backup Script for BidBlitz
# Run: bash /var/www/bidblitz/scripts/backup.sh
###############################################################################

set -e

BACKUP_DIR="/var/www/bidblitz/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="bidblitz_backup_$DATE"

# Load environment variables
source /var/www/bidblitz/.env

echo "🔄 Starting MongoDB backup..."

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup MongoDB
docker-compose exec -T mongodb mongodump \
  --username $MONGO_USERNAME \
  --password $MONGO_PASSWORD \
  --db $DB_NAME \
  --out /backups/$BACKUP_NAME

# Compress backup
cd $BACKUP_DIR
tar -czf $BACKUP_NAME.tar.gz $BACKUP_NAME
rm -rf $BACKUP_NAME

# Keep only last 7 backups
ls -t $BACKUP_DIR/*.tar.gz | tail -n +8 | xargs -r rm

echo "✅ Backup completed: $BACKUP_NAME.tar.gz"
echo "📦 Size: $(du -h $BACKUP_DIR/$BACKUP_NAME.tar.gz | cut -f1)"

# Optional: Upload to Backblaze B2 (requires b2 CLI)
# if command -v b2 &> /dev/null; then
#   b2 upload-file YOUR_BUCKET_NAME $BACKUP_DIR/$BACKUP_NAME.tar.gz backups/$BACKUP_NAME.tar.gz
#   echo "☁️  Uploaded to Backblaze B2"
# fi
