#!/usr/bin/env python3
"""
🔒 BidBlitz MongoDB Backup Script
==================================
Erstellt ein vollständiges Backup aller Daten aus MongoDB Atlas.

Verwendung:
    python3 backup_database.py

Das Backup wird gespeichert in:
    /app/backups/backup_YYYY-MM-DD_HH-MM-SS/
"""

import os
import json
import sys
from datetime import datetime
from pymongo import MongoClient
from bson import json_util
import zipfile
import shutil

# ============================================
# KONFIGURATION
# ============================================

# MongoDB Atlas Connection String
MONGO_URL = os.environ.get(
    "MONGO_URL",
    "mongodb+srv://sappicapp_db_user:nUEUHyexecwlc44T@afrimkrasniqi007.2uyxsqz.mongodb.net/bidblitz?retryWrites=true&w=majority"
)
DB_NAME = "bidblitz"

# Backup Verzeichnis
BACKUP_BASE_DIR = "/app/backups"

# ============================================
# BACKUP FUNKTIONEN
# ============================================

def create_backup():
    """Erstellt ein vollständiges Datenbank-Backup"""
    
    print("=" * 60)
    print("🔒 BidBlitz Datenbank Backup")
    print("=" * 60)
    print(f"⏰ Start: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    # Backup-Verzeichnis erstellen
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    backup_dir = os.path.join(BACKUP_BASE_DIR, f"backup_{timestamp}")
    os.makedirs(backup_dir, exist_ok=True)
    
    print(f"📁 Backup-Verzeichnis: {backup_dir}")
    print()
    
    try:
        # Mit MongoDB verbinden
        print("🔌 Verbinde mit MongoDB Atlas...")
        client = MongoClient(MONGO_URL, serverSelectionTimeoutMS=10000)
        db = client[DB_NAME]
        
        # Verbindung testen
        client.admin.command('ping')
        print("✅ Verbindung erfolgreich!")
        print()
        
        # Alle Collections abrufen
        collections = db.list_collection_names()
        print(f"📦 {len(collections)} Collections gefunden")
        print()
        
        # Statistiken
        total_docs = 0
        backed_up = []
        errors = []
        
        # Jede Collection exportieren
        for i, collection_name in enumerate(collections, 1):
            try:
                collection = db[collection_name]
                docs = list(collection.find({}))
                count = len(docs)
                
                if count > 0:
                    # Als JSON speichern
                    filepath = os.path.join(backup_dir, f"{collection_name}.json")
                    with open(filepath, 'w', encoding='utf-8') as f:
                        # json_util für MongoDB-spezifische Typen (ObjectId, etc.)
                        json.dump(json.loads(json_util.dumps(docs)), f, ensure_ascii=False, indent=2)
                    
                    print(f"  [{i:2}/{len(collections)}] ✅ {collection_name}: {count} Dokumente")
                    total_docs += count
                    backed_up.append({"name": collection_name, "count": count})
                else:
                    print(f"  [{i:2}/{len(collections)}] ⏭️  {collection_name}: leer")
                    
            except Exception as e:
                print(f"  [{i:2}/{len(collections)}] ❌ {collection_name}: {str(e)[:40]}")
                errors.append({"name": collection_name, "error": str(e)})
        
        # Verbindung schließen
        client.close()
        
        # Backup-Info erstellen
        info = {
            "timestamp": timestamp,
            "database": DB_NAME,
            "total_collections": len(collections),
            "backed_up_collections": len(backed_up),
            "total_documents": total_docs,
            "collections": backed_up,
            "errors": errors
        }
        
        info_path = os.path.join(backup_dir, "_backup_info.json")
        with open(info_path, 'w', encoding='utf-8') as f:
            json.dump(info, f, ensure_ascii=False, indent=2)
        
        # ZIP-Archiv erstellen
        print()
        print("📦 Erstelle ZIP-Archiv...")
        zip_path = f"{backup_dir}.zip"
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, dirs, files in os.walk(backup_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, backup_dir)
                    zipf.write(file_path, arcname)
        
        # ZIP-Größe
        zip_size = os.path.getsize(zip_path) / (1024 * 1024)  # MB
        
        print()
        print("=" * 60)
        print("✅ BACKUP ERFOLGREICH!")
        print("=" * 60)
        print(f"📊 Statistiken:")
        print(f"   • Collections: {len(backed_up)}")
        print(f"   • Dokumente: {total_docs:,}")
        print(f"   • ZIP-Größe: {zip_size:.2f} MB")
        print()
        print(f"📁 Dateien:")
        print(f"   • Ordner: {backup_dir}")
        print(f"   • ZIP: {zip_path}")
        print()
        print(f"⏰ Fertig: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 60)
        
        return {
            "success": True,
            "backup_dir": backup_dir,
            "zip_path": zip_path,
            "total_docs": total_docs,
            "collections": len(backed_up)
        }
        
    except Exception as e:
        print()
        print("=" * 60)
        print(f"❌ BACKUP FEHLGESCHLAGEN!")
        print(f"   Fehler: {str(e)}")
        print("=" * 60)
        return {
            "success": False,
            "error": str(e)
        }


def list_backups():
    """Zeigt alle vorhandenen Backups an"""
    
    print("📋 Vorhandene Backups:")
    print("-" * 40)
    
    if not os.path.exists(BACKUP_BASE_DIR):
        print("   Keine Backups gefunden.")
        return []
    
    backups = []
    for item in sorted(os.listdir(BACKUP_BASE_DIR), reverse=True):
        if item.startswith("backup_") and item.endswith(".zip"):
            path = os.path.join(BACKUP_BASE_DIR, item)
            size = os.path.getsize(path) / (1024 * 1024)
            date = item.replace("backup_", "").replace(".zip", "")
            backups.append({"file": item, "size": size, "date": date})
            print(f"   • {item} ({size:.2f} MB)")
    
    if not backups:
        print("   Keine Backups gefunden.")
    
    return backups


def restore_backup(backup_name):
    """Stellt ein Backup wieder her (VORSICHT!)"""
    
    print("⚠️  WARNUNG: Diese Funktion überschreibt alle Daten!")
    print("   Bitte kontaktiere den Support für Wiederherstellung.")
    print()
    print("   Backup-Datei:", backup_name)


# ============================================
# HAUPTPROGRAMM
# ============================================

if __name__ == "__main__":
    # Backup-Verzeichnis erstellen falls nicht vorhanden
    os.makedirs(BACKUP_BASE_DIR, exist_ok=True)
    
    if len(sys.argv) > 1:
        command = sys.argv[1]
        
        if command == "list":
            list_backups()
        elif command == "restore" and len(sys.argv) > 2:
            restore_backup(sys.argv[2])
        else:
            print("Verwendung:")
            print("  python3 backup_database.py        # Backup erstellen")
            print("  python3 backup_database.py list   # Backups anzeigen")
    else:
        create_backup()
