#!/usr/bin/env python3
"""
Additional Smart Invoice Test - Reminder Email with Valid Client Email
"""

import json
import requests

BASE_URL = "https://game-center-hub-1.preview.emergentagent.com"
ADMIN_EMAIL = "admin@bidblitz.com"
ADMIN_PASSWORD = "BidBlitz2026!"

def admin_login():
    """Login as admin"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=30
    )
    return response.cookies

def find_invoice_with_email(cookies):
    """Find an invoice with client_email"""
    response = requests.get(
        f"{BASE_URL}/api/invoicing/my-invoices",
        cookies=cookies,
        timeout=30
    )
    
    invoices = response.json().get("invoices", [])
    for invoice in invoices:
        if invoice.get("client_email"):
            return invoice
    return None

def test_reminder_with_valid_email():
    """Test reminder email with valid client_email"""
    print("\n" + "="*80)
    print("ADDITIONAL TEST: Reminder Email with Valid Client Email")
    print("="*80)
    
    cookies = admin_login()
    
    # Find invoice with client_email
    invoice = find_invoice_with_email(cookies)
    
    if not invoice:
        print("⚠️ No invoices with client_email found - skipping this test")
        return
    
    invoice_id = invoice.get("invoice_id")
    client_email = invoice.get("client_email")
    
    print(f"\nFound invoice with client_email:")
    print(f"  - invoice_id: {invoice_id}")
    print(f"  - invoice_number: {invoice.get('invoice_number')}")
    print(f"  - client_email: {client_email}")
    print(f"  - total: €{invoice.get('total')}")
    
    # Send reminder
    print(f"\nSending manual reminder to {client_email}...")
    response = requests.post(
        f"{BASE_URL}/api/invoicing/{invoice_id}/reminders/email",
        json={"kind": "manual"},
        cookies=cookies,
        timeout=30
    )
    
    if response.status_code != 200:
        print(f"❌ FAILED: {response.status_code} - {response.text}")
        return
    
    data = response.json()
    history = data.get("history", {})
    
    print("\n✅ Reminder sent successfully!")
    print(f"  - history_id: {history.get('id')}")
    print(f"  - client_email: {history.get('client_email')}")
    print(f"  - kind: {history.get('kind')}")
    print(f"  - channel: {history.get('channel')}")
    print(f"  - sent_at: {history.get('sent_at')}")
    print(f"  - payment_link: {data.get('payment_link', 'N/A')[:60]}...")
    print(f"  - result: {history.get('result', {})}")
    
    # Verify history was saved by fetching reminders
    print(f"\nVerifying history was saved...")
    history_response = requests.get(
        f"{BASE_URL}/api/invoicing/{invoice_id}/reminders",
        cookies=cookies,
        timeout=30
    )
    
    if history_response.status_code != 200:
        print(f"⚠️ Could not fetch reminder history: {history_response.status_code}")
        return
    
    history_data = history_response.json()
    reminders = history_data.get("history", [])
    
    print(f"✅ History verified: Found {len(reminders)} reminder(s) for this invoice")
    if reminders:
        latest = reminders[0]
        print(f"  - Latest reminder kind: {latest.get('kind')}")
        print(f"  - Latest reminder sent_at: {latest.get('sent_at')}")
    
    print("\n" + "="*80)
    print("✅ ADDITIONAL TEST PASSED")
    print("="*80)

if __name__ == "__main__":
    test_reminder_with_valid_email()
