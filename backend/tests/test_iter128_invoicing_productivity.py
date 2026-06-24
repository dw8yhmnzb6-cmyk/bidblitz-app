"""
Iteration 128 - Accountant Productivity Features Testing
Tests: Task Center, Payment Reminders, Client Health Score, Recurring Invoice, Audit Log, Client Import, Demo Mode
Uses single session to avoid rate limiting
"""

import os
import pytest
import requests
import time

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    BASE_URL = "https://commerce-hub-565.preview.emergentagent.com"

# Test credentials
ADMIN_EMAIL = "admin@bidblitz.com"
ADMIN_PASSWORD = "BidBlitz2026!"


@pytest.fixture(scope="module")
def auth_session():
    """Single authenticated session for all tests"""
    session = requests.Session()
    login_resp = session.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
    )
    assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
    yield session
    session.close()


class TestInvoicingDashboard:
    """Test /api/invoicing/dashboard endpoint - Task Center and Client Health"""

    def test_dashboard_returns_summary_tasks_clients(self, auth_session):
        """Dashboard endpoint returns summary, tasks, and clients"""
        resp = auth_session.get(f"{BASE_URL}/api/invoicing/dashboard")
        assert resp.status_code == 200, f"Dashboard failed: {resp.text}"
        data = resp.json()
        
        # Verify structure
        assert "summary" in data, "Missing summary in dashboard"
        assert "tasks" in data, "Missing tasks in dashboard"
        assert "clients" in data, "Missing clients in dashboard"
        
        # Verify summary fields
        summary = data["summary"]
        assert "clients_total" in summary
        assert "urgent_tasks" in summary
        assert "pending_tasks" in summary
        assert "completed_tasks" in summary
        assert "unpaid_invoices" in summary
        assert "green_clients" in summary
        assert "yellow_clients" in summary
        assert "red_clients" in summary
        print(f"Dashboard summary: {summary}")

    def test_tasks_have_priority_and_type(self, auth_session):
        """Tasks include priority (urgent/high/normal) and task_type"""
        resp = auth_session.get(f"{BASE_URL}/api/invoicing/dashboard")
        assert resp.status_code == 200
        data = resp.json()
        tasks = data.get("tasks", [])
        
        if tasks:
            task = tasks[0]
            assert "task_id" in task
            assert "task_type" in task
            assert "priority" in task
            assert task["priority"] in ["urgent", "high", "normal"]
            print(f"Sample task: {task.get('task_type')} - {task.get('priority')}")

    def test_clients_have_health_score(self, auth_session):
        """Clients include health score with status and reasons"""
        resp = auth_session.get(f"{BASE_URL}/api/invoicing/dashboard")
        assert resp.status_code == 200
        data = resp.json()
        clients = data.get("clients", [])
        
        if clients:
            client = clients[0]
            assert "health" in client, "Client missing health field"
            health = client["health"]
            assert "score" in health
            assert "reasons" in health
            assert health["score"]["status"] in ["green", "yellow", "red"]
            print(f"Client {client.get('company_name')}: health={health['score']}")


class TestInvoiceCreateAndRecurring:
    """Test invoice creation with recurring toggle"""

    def test_create_invoice_basic(self, auth_session):
        """Create a basic invoice"""
        payload = {
            "client_name": "TEST_Iter128_Client",
            "client_email": "test128@example.com",
            "items": [{"description": "Test Service", "quantity": 1, "unit_price": 100.0}],
            "notes": "Test invoice for iteration 128",
            "due_days": 14,
            "recurring_enabled": False,
            "recurring_frequency": "monthly",
            "next_invoice_date": None,
        }
        resp = auth_session.post(f"{BASE_URL}/api/invoicing/create", json=payload)
        assert resp.status_code == 200, f"Create invoice failed: {resp.text}"
        data = resp.json()
        assert data.get("ok") is True
        assert "invoice_id" in data
        assert "invoice_number" in data
        assert "scan_code" in data
        print(f"Created invoice: {data.get('invoice_number')}")

    def test_create_recurring_invoice(self, auth_session):
        """Create a recurring invoice with frequency and next date"""
        payload = {
            "client_name": "TEST_Iter128_Recurring",
            "client_email": "recurring128@example.com",
            "items": [{"description": "Monthly Service", "quantity": 1, "unit_price": 50.0}],
            "notes": "Recurring test",
            "due_days": 7,
            "recurring_enabled": True,
            "recurring_frequency": "monthly",
            "next_invoice_date": "2026-02-15T00:00:00Z",
        }
        resp = auth_session.post(f"{BASE_URL}/api/invoicing/create", json=payload)
        assert resp.status_code == 200, f"Create recurring invoice failed: {resp.text}"
        data = resp.json()
        assert data.get("ok") is True
        print(f"Created recurring invoice: {data.get('invoice_number')}")

    def test_my_invoices_returns_recurring_info(self, auth_session):
        """My invoices endpoint returns recurring info"""
        resp = auth_session.get(f"{BASE_URL}/api/invoicing/my-invoices")
        assert resp.status_code == 200
        data = resp.json()
        assert "invoices" in data
        invoices = data["invoices"]
        
        if invoices:
            inv = invoices[0]
            assert "recurring" in inv
            assert "reminder_count" in inv
            print(f"Invoice {inv.get('invoice_number')}: recurring={inv.get('recurring')}")


class TestGenerateNextInvoice:
    """Test generate-next endpoint for recurring invoices"""

    def test_generate_next_requires_recurring_enabled(self, auth_session):
        """Generate next fails if recurring not enabled"""
        # First create a non-recurring invoice
        payload = {
            "client_name": "TEST_NonRecurring",
            "client_email": "nonrec@example.com",
            "items": [{"description": "One-time", "quantity": 1, "unit_price": 25.0}],
            "due_days": 14,
            "recurring_enabled": False,
            "recurring_frequency": "monthly",
        }
        create_resp = auth_session.post(f"{BASE_URL}/api/invoicing/create", json=payload)
        assert create_resp.status_code == 200
        invoice_id = create_resp.json().get("invoice_id")
        
        # Try to generate next
        gen_resp = auth_session.post(f"{BASE_URL}/api/invoicing/{invoice_id}/generate-next")
        assert gen_resp.status_code == 400, "Should fail for non-recurring"
        print("Correctly rejected generate-next for non-recurring invoice")

    def test_generate_next_creates_new_invoice(self, auth_session):
        """Generate next creates a new invoice from recurring source"""
        # Create recurring invoice
        payload = {
            "client_name": "TEST_GenNext",
            "client_email": "gennext@example.com",
            "items": [{"description": "Recurring Item", "quantity": 2, "unit_price": 30.0}],
            "due_days": 10,
            "recurring_enabled": True,
            "recurring_frequency": "weekly",
        }
        create_resp = auth_session.post(f"{BASE_URL}/api/invoicing/create", json=payload)
        assert create_resp.status_code == 200
        invoice_id = create_resp.json().get("invoice_id")
        
        # Generate next
        gen_resp = auth_session.post(f"{BASE_URL}/api/invoicing/{invoice_id}/generate-next")
        assert gen_resp.status_code == 200, f"Generate next failed: {gen_resp.text}"
        data = gen_resp.json()
        assert data.get("ok") is True
        assert "invoice" in data
        new_inv = data["invoice"]
        assert new_inv.get("recurring", {}).get("enabled") is True
        print(f"Generated next invoice: {new_inv.get('invoice_number')}")


class TestPaymentReminders:
    """Test reminder email endpoint and history"""

    def test_send_reminder_email(self, auth_session):
        """Send reminder email for an invoice"""
        # Create invoice with email
        payload = {
            "client_name": "TEST_Reminder",
            "client_email": "reminder@example.com",
            "items": [{"description": "Reminder Test", "quantity": 1, "unit_price": 75.0}],
            "due_days": 14,
            "recurring_enabled": False,
            "recurring_frequency": "monthly",
        }
        create_resp = auth_session.post(f"{BASE_URL}/api/invoicing/create", json=payload)
        assert create_resp.status_code == 200
        invoice_id = create_resp.json().get("invoice_id")
        
        # Send reminder
        reminder_resp = auth_session.post(
            f"{BASE_URL}/api/invoicing/{invoice_id}/reminders/email",
            json={"kind": "payment"},
        )
        assert reminder_resp.status_code == 200, f"Reminder failed: {reminder_resp.text}"
        data = reminder_resp.json()
        assert data.get("ok") is True
        assert "history" in data
        assert "payment_link" in data
        print(f"Reminder sent, payment_link: {data.get('payment_link')}")

    def test_reminder_history_endpoint(self, auth_session):
        """Get reminder history for an invoice"""
        # Create and send reminder
        payload = {
            "client_name": "TEST_History",
            "client_email": "history@example.com",
            "items": [{"description": "History Test", "quantity": 1, "unit_price": 50.0}],
            "due_days": 14,
            "recurring_enabled": False,
            "recurring_frequency": "monthly",
        }
        create_resp = auth_session.post(f"{BASE_URL}/api/invoicing/create", json=payload)
        assert create_resp.status_code == 200
        invoice_id = create_resp.json().get("invoice_id")
        
        # Send reminder first
        auth_session.post(
            f"{BASE_URL}/api/invoicing/{invoice_id}/reminders/email",
            json={"kind": "payment"},
        )
        
        # Get history
        history_resp = auth_session.get(f"{BASE_URL}/api/invoicing/{invoice_id}/reminders")
        assert history_resp.status_code == 200
        data = history_resp.json()
        assert "history" in data
        print(f"Reminder history count: {len(data.get('history', []))}")

    def test_reminder_requires_client_email(self, auth_session):
        """Reminder fails if client email is missing"""
        # Create invoice without email
        payload = {
            "client_name": "TEST_NoEmail",
            "client_email": "",
            "items": [{"description": "No Email Test", "quantity": 1, "unit_price": 25.0}],
            "due_days": 14,
            "recurring_enabled": False,
            "recurring_frequency": "monthly",
        }
        create_resp = auth_session.post(f"{BASE_URL}/api/invoicing/create", json=payload)
        assert create_resp.status_code == 200
        invoice_id = create_resp.json().get("invoice_id")
        
        # Try to send reminder
        reminder_resp = auth_session.post(
            f"{BASE_URL}/api/invoicing/{invoice_id}/reminders/email",
            json={"kind": "payment"},
        )
        assert reminder_resp.status_code == 400, "Should fail without email"
        print("Correctly rejected reminder for invoice without email")


class TestClientEndpoints:
    """Test client list, detail, health, and lock toggle"""

    def test_clients_list(self, auth_session):
        """Get clients list with health scores"""
        resp = auth_session.get(f"{BASE_URL}/api/invoicing/clients")
        assert resp.status_code == 200
        data = resp.json()
        assert "clients" in data
        clients = data["clients"]
        if clients:
            client = clients[0]
            assert "client_id" in client
            assert "company_name" in client
            assert "health" in client
            print(f"Clients count: {len(clients)}")

    def test_client_detail_with_audit_logs(self, auth_session):
        """Get client detail including audit logs"""
        # First get clients list
        list_resp = auth_session.get(f"{BASE_URL}/api/invoicing/clients")
        assert list_resp.status_code == 200
        clients = list_resp.json().get("clients", [])
        
        if clients:
            client_id = clients[0].get("client_id")
            detail_resp = auth_session.get(f"{BASE_URL}/api/invoicing/clients/{client_id}")
            assert detail_resp.status_code == 200
            data = detail_resp.json()
            assert "client" in data
            assert "invoices" in data
            assert "audit_logs" in data
            print(f"Client detail: {data['client'].get('company_name')}, audit_logs: {len(data.get('audit_logs', []))}")

    def test_toggle_client_lock(self, auth_session):
        """Toggle client lock status"""
        # Get clients
        list_resp = auth_session.get(f"{BASE_URL}/api/invoicing/clients")
        clients = list_resp.json().get("clients", [])
        
        if clients:
            client_id = clients[0].get("client_id")
            original_locked = clients[0].get("locked", False)
            
            # Toggle lock
            toggle_resp = auth_session.post(f"{BASE_URL}/api/invoicing/clients/{client_id}/toggle-lock")
            assert toggle_resp.status_code == 200
            data = toggle_resp.json()
            assert data.get("ok") is True
            assert data.get("locked") != original_locked
            print(f"Toggled lock: {original_locked} -> {data.get('locked')}")
            
            # Toggle back
            auth_session.post(f"{BASE_URL}/api/invoicing/clients/{client_id}/toggle-lock")


class TestClientImport:
    """Test CSV import preview and import endpoints"""

    def test_import_preview_csv(self, auth_session):
        """Preview CSV file for import"""
        csv_content = """company_name,owner_name,email,phone,nui,vat_number
TEST_Import1,Owner One,import1@test.com,+123456,NUI001,VAT001
TEST_Import2,Owner Two,import2@test.com,+789012,NUI002,VAT002
"""
        files = {"file": ("clients.csv", csv_content, "text/csv")}
        resp = auth_session.post(f"{BASE_URL}/api/invoicing/clients/import-preview", files=files)
        assert resp.status_code == 200, f"Preview failed: {resp.text}"
        data = resp.json()
        assert "rows" in data
        assert "errors" in data
        assert "valid_count" in data
        assert data["valid_count"] == 2
        print(f"Preview: {data['valid_count']} valid, {data.get('error_count', 0)} errors")

    def test_import_clients(self, auth_session):
        """Import clients from validated rows"""
        rows = [
            {
                "company_name": "TEST_ImportClient1",
                "owner_name": "Import Owner 1",
                "email": "importclient1@test.com",
                "phone": "+111222333",
                "nui": "NUI-IMP1",
                "vat_number": "VAT-IMP1",
            },
            {
                "company_name": "TEST_ImportClient2",
                "owner_name": "Import Owner 2",
                "email": "importclient2@test.com",
                "phone": "+444555666",
                "nui": "NUI-IMP2",
                "vat_number": "VAT-IMP2",
            },
        ]
        resp = auth_session.post(f"{BASE_URL}/api/invoicing/clients/import", json={"rows": rows})
        assert resp.status_code == 200, f"Import failed: {resp.text}"
        data = resp.json()
        assert data.get("ok") is True
        assert "success_count" in data
        assert "fail_count" in data
        print(f"Import: {data['success_count']} success, {data['fail_count']} failed")


class TestAuditLog:
    """Test audit log endpoint"""

    def test_audit_log_returns_logs(self, auth_session):
        """Audit log endpoint returns structured logs"""
        resp = auth_session.get(f"{BASE_URL}/api/invoicing/audit-log")
        assert resp.status_code == 200
        data = resp.json()
        assert "logs" in data
        logs = data["logs"]
        
        if logs:
            log = logs[0]
            assert "timestamp" in log
            assert "user" in log
            assert "company" in log
            assert "action" in log
            assert "target" in log
            assert "status" in log
            print(f"Audit logs count: {len(logs)}, sample action: {log.get('action')}")

    def test_audit_log_filter_by_client(self, auth_session):
        """Audit log can be filtered by client_id"""
        # Get a client first
        clients_resp = auth_session.get(f"{BASE_URL}/api/invoicing/clients")
        clients = clients_resp.json().get("clients", [])
        
        if clients:
            client_id = clients[0].get("client_id")
            resp = auth_session.get(f"{BASE_URL}/api/invoicing/audit-log?client_id={client_id}")
            assert resp.status_code == 200
            data = resp.json()
            assert "logs" in data
            print(f"Filtered audit logs for client {client_id}: {len(data.get('logs', []))}")


class TestTaskComplete:
    """Test task completion endpoint"""

    def test_complete_task(self, auth_session):
        """Complete a task via POST"""
        # Get dashboard to find a task
        dash_resp = auth_session.get(f"{BASE_URL}/api/invoicing/dashboard")
        tasks = dash_resp.json().get("tasks", [])
        
        # Find a completable task
        completable = [t for t in tasks if t.get("can_complete") and t.get("status") != "completed"]
        
        if completable:
            task = completable[0]
            payload = {
                "task_id": task.get("task_id"),
                "task_type": task.get("task_type"),
                "title": task.get("title", ""),
                "company": task.get("company", ""),
                "client_id": task.get("client_id"),
                "ref_id": task.get("ref_id"),
            }
            resp = auth_session.post(f"{BASE_URL}/api/invoicing/tasks/complete", json=payload)
            assert resp.status_code == 200, f"Complete task failed: {resp.text}"
            data = resp.json()
            assert data.get("ok") is True
            print(f"Completed task: {task.get('task_type')}")
        else:
            # Create a test task scenario by creating an invoice
            print("No completable tasks found, skipping test")


class TestInvoiceUpdate:
    """Test invoice update/edit endpoint"""

    def test_update_invoice(self, auth_session):
        """Update an existing invoice"""
        # Create invoice first
        create_payload = {
            "client_name": "TEST_Update",
            "client_email": "update@example.com",
            "items": [{"description": "Original Item", "quantity": 1, "unit_price": 100.0}],
            "due_days": 14,
            "recurring_enabled": False,
            "recurring_frequency": "monthly",
        }
        create_resp = auth_session.post(f"{BASE_URL}/api/invoicing/create", json=create_payload)
        assert create_resp.status_code == 200
        invoice_id = create_resp.json().get("invoice_id")
        
        # Update invoice
        update_payload = {
            "client_name": "TEST_Update_Modified",
            "client_email": "update_modified@example.com",
            "items": [{"description": "Modified Item", "quantity": 2, "unit_price": 75.0}],
            "notes": "Updated notes",
            "due_days": 21,
            "recurring_enabled": True,
            "recurring_frequency": "weekly",
            "next_invoice_date": "2026-03-01T00:00:00Z",
        }
        update_resp = auth_session.patch(f"{BASE_URL}/api/invoicing/{invoice_id}", json=update_payload)
        assert update_resp.status_code == 200, f"Update failed: {update_resp.text}"
        data = update_resp.json()
        assert data.get("ok") is True
        print(f"Updated invoice {invoice_id}")

    def test_update_nonexistent_invoice_returns_404(self, auth_session):
        """Update non-existent invoice returns 404"""
        update_payload = {
            "client_name": "Test",
            "client_email": "test@example.com",
            "items": [{"description": "Item", "quantity": 1, "unit_price": 10.0}],
            "due_days": 14,
            "recurring_enabled": False,
            "recurring_frequency": "monthly",
        }
        resp = auth_session.patch(f"{BASE_URL}/api/invoicing/nonexistent_id_12345", json=update_payload)
        assert resp.status_code == 404
        print("Correctly returned 404 for non-existent invoice")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
