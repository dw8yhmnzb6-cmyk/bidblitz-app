#!/bin/bash
# 🚀 BidBlitz Crypto Earn - Daten Setup für bidblitz.ae
# Führe dieses Script auf deinem VPS aus, um Demo-Daten zu erstellen

echo "🔧 BidBlitz Crypto Earn - Daten Setup"
echo "======================================"
echo ""

# MongoDB Connection (passe an, wenn nötig)
MONGO_HOST="${MONGO_HOST:-localhost}"
MONGO_PORT="${MONGO_PORT:-27017}"
DB_NAME="${DB_NAME:-bidblitz_production}"

echo "📊 MongoDB: $MONGO_HOST:$MONGO_PORT / $DB_NAME"
echo ""

# User Email (ändere zu deiner echten Email!)
USER_EMAIL="${USER_EMAIL:-admin@bidblitz.ae}"

echo "👤 Setup für User: $USER_EMAIL"
echo ""

# Erstelle Crypto-Daten mit mongosh
mongosh "$MONGO_HOST:$MONGO_PORT/$DB_NAME" << 'MONGO_SCRIPT'

// Finde den User
const userEmail = process.env.USER_EMAIL || "admin@bidblitz.ae";
const user = db.users.findOne({ email: userEmail });

if (!user) {
    print("❌ User nicht gefunden: " + userEmail);
    print("Bitte ändere USER_EMAIL zu deiner echten Email!");
    quit(1);
}

const userId = user._id.toString();
print("✅ User gefunden: " + userEmail);
print("   User ID: " + userId);

// Prüfe ob Crypto Wallets existieren
const existingWallets = db.crypto_wallets.countDocuments({ user_id: userId });

if (existingWallets > 0) {
    print("\n⚠️  Crypto Wallets existieren bereits (" + existingWallets + " Wallets)");
    print("Möchtest du sie überschreiben? (Strg+C zum Abbrechen)");
    // Warte 3 Sekunden
    sleep(3000);
}

// Lösche alte Crypto-Daten für diesen User
db.crypto_wallets.deleteMany({ user_id: userId });
db.crypto_earn_deposits.deleteMany({ user_id: userId });
print("\n🧹 Alte Crypto-Daten gelöscht");

// ═══════════════════════════════════════════════════════════════════
// ERSTELLE CRYPTO WALLET MIT 55 BTC
// ═══════════════════════════════════════════════════════════════════

db.crypto_wallets.insertOne({
    user_id: userId,
    coin: "BTC",
    balance: 0.0,              // 0 BTC verfügbar
    locked_balance: 55.0,      // 55 BTC gesperrt in Crypto Earn
    total_earned: 0.5,         // 0.5 BTC bereits verdient
    created_at: new Date().toISOString()
});

print("✅ Crypto Wallet erstellt: 55 BTC (gesperrt)");

// Erstelle Crypto Earn Deposit
db.crypto_earn_deposits.insertOne({
    deposit_id: "earn_" + Date.now(),
    user_id: userId,
    user_email: userEmail,
    product_id: "btc_flex",
    coin: "BTC",
    amount: 55.0,
    apy: 3.0,
    term: "Flexibel",
    lock_days: 0,
    earned: 0.5,
    status: "active",
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 Tage alt
    last_interest_calc: new Date().toISOString()
});

print("✅ Crypto Earn Deposit erstellt: 55 BTC @ 3% APY");

// Berechne Werte
const btcPrice = 88000; // EUR pro BTC
const totalBTC = 55.5; // 55 + 0.5 earned
const totalEur = totalBTC * btcPrice;

print("\n💰 ZUSAMMENFASSUNG:");
print("   ├─ BTC Amount: " + totalBTC + " BTC");
print("   ├─ BTC Preis: €" + btcPrice.toLocaleString("de-DE"));
print("   └─ EUR Wert: €" + totalEur.toLocaleString("de-DE") + " (" + (totalEur / 1000000).toFixed(2) + "M)");

// Erstelle auch andere Coins (optional)
const otherCoins = [
    { coin: "ETH", balance: 0, locked: 0 },
    { coin: "USDT", balance: 0, locked: 0 },
    { coin: "SOL", balance: 0, locked: 0 },
    { coin: "BNB", balance: 0, locked: 0 }
];

otherCoins.forEach(c => {
    db.crypto_wallets.insertOne({
        user_id: userId,
        coin: c.coin,
        balance: c.balance,
        locked_balance: c.locked,
        total_earned: 0,
        created_at: new Date().toISOString()
    });
});

print("\n✅ Alle Crypto Wallets erstellt!");
print("\n🎉 FERTIG! Deine bidblitz.ae sollte jetzt die Crypto-Balance anzeigen.");
print("   Logge dich aus und wieder ein, um die Änderungen zu sehen.");

MONGO_SCRIPT

echo ""
echo "✅ Setup abgeschlossen!"
echo ""
echo "🌐 Öffne bidblitz.ae und logge dich ein"
echo "   Du solltest jetzt €4.840.000+ im Gesamtguthaben sehen!"
