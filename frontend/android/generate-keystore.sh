#!/bin/bash
# Android Keystore Generation & Signing — Fully Automated
# =========================================================
# Generates release keystore, updates keystore.properties, extracts SHA256,
# and provides ready-to-use commands for Google Play upload.

set -e

echo "🔐 BidBlitz Android Keystore — Automated Setup"
echo "=============================================="
echo ""

# Configuration
KEYSTORE_FILE="bidblitz-upload.jks"
KEY_ALIAS="bidblitz"
VALIDITY_DAYS=10000

# Check if keystore already exists
if [ -f "$KEYSTORE_FILE" ]; then
  echo "⚠️  Keystore already exists: $KEYSTORE_FILE"
  read -p "Overwrite? (yes/no): " OVERWRITE
  if [ "$OVERWRITE" != "yes" ]; then
    echo "❌ Aborted. Delete $KEYSTORE_FILE manually if you want to regenerate."
    exit 1
  fi
  rm -f "$KEYSTORE_FILE"
fi

# Prompt for passwords
echo ""
echo "📝 Enter keystore credentials (SAVE THESE SECURELY!):"
read -sp "Keystore Password: " KEYSTORE_PASSWORD
echo ""
read -sp "Key Password (press Enter to use same as keystore): " KEY_PASSWORD
echo ""
if [ -z "$KEY_PASSWORD" ]; then
  KEY_PASSWORD="$KEYSTORE_PASSWORD"
fi

# Prompt for certificate details
echo ""
echo "📝 Certificate details:"
read -p "Your Name: " CERT_NAME
read -p "Organization: " CERT_ORG
read -p "City: " CERT_CITY
read -p "State/Province: " CERT_STATE
read -p "Country Code (e.g., DE): " CERT_COUNTRY

# Generate keystore
echo ""
echo "🔨 Generating keystore..."
keytool -genkeypair -v \
  -keystore "$KEYSTORE_FILE" \
  -alias "$KEY_ALIAS" \
  -keyalg RSA \
  -keysize 2048 \
  -validity $VALIDITY_DAYS \
  -storetype JKS \
  -storepass "$KEYSTORE_PASSWORD" \
  -keypass "$KEY_PASSWORD" \
  -dname "CN=$CERT_NAME, OU=$CERT_ORG, O=$CERT_ORG, L=$CERT_CITY, ST=$CERT_STATE, C=$CERT_COUNTRY"

echo "✅ Keystore created: $KEYSTORE_FILE"
echo ""

# Create keystore.properties
echo "📝 Creating keystore.properties..."
cat > keystore.properties <<EOF
storeFile=$KEYSTORE_FILE
storePassword=$KEYSTORE_PASSWORD
keyAlias=$KEY_ALIAS
keyPassword=$KEY_PASSWORD
EOF

echo "✅ keystore.properties created"
echo ""

# Extract SHA256 fingerprint
echo "🔍 Extracting SHA256 fingerprint..."
SHA256=$(keytool -list -v -keystore "$KEYSTORE_FILE" -alias "$KEY_ALIAS" -storepass "$KEYSTORE_PASSWORD" | grep "SHA256:" | awk '{print $2}')

echo "✅ SHA256 Fingerprint: $SHA256"
echo ""

# Update assetlinks.json
ASSETLINKS_FILE="../public/.well-known/assetlinks.json"
if [ -f "$ASSETLINKS_FILE" ]; then
  echo "📝 Updating assetlinks.json with SHA256..."
  sed -i.bak "s/REPLACE_WITH_UPLOAD_KEY_SHA256_FINGERPRINT/$SHA256/g" "$ASSETLINKS_FILE"
  echo "✅ assetlinks.json updated"
else
  echo "⚠️  assetlinks.json not found at $ASSETLINKS_FILE"
  echo "   Manual update required:"
  echo "   Replace 'REPLACE_WITH_UPLOAD_KEY_SHA256_FINGERPRINT' with: $SHA256"
fi
echo ""

# Backup warning
echo "⚠️  CRITICAL: BACKUP YOUR KEYSTORE!"
echo "   File: $KEYSTORE_FILE"
echo "   Store this file + passwords in a SECURE location (password manager, encrypted drive)"
echo "   Losing this file = CANNOT update app on Google Play Store FOREVER"
echo ""

# Next steps
echo "✅ SETUP COMPLETE"
echo "================="
echo ""
echo "📋 Next steps:"
echo ""
echo "1️⃣  Rebuild frontend with updated assetlinks.json:"
echo "    cd .."
echo "    yarn build"
echo "    npx cap sync android"
echo ""
echo "2️⃣  Build release AAB:"
echo "    ./gradlew bundleRelease"
echo "    # Output: app/build/outputs/bundle/release/app-release.aab"
echo ""
echo "3️⃣  Upload to Google Play Console:"
echo "    https://play.google.com/console"
echo ""
echo "4️⃣  Deploy assetlinks.json to production:"
echo "    https://bidblitz.ae/.well-known/assetlinks.json"
echo ""
echo "📊 Summary:"
echo "   Keystore: $KEYSTORE_FILE"
echo "   Alias: $KEY_ALIAS"
echo "   SHA256: $SHA256"
echo "   Properties: keystore.properties"
echo ""
echo "🎯 Ready for Google Play upload!"
