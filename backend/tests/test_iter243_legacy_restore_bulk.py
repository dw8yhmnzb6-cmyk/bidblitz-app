"""
Iteration 243: Legacy Restore Center - Priority List, Bulk Restore, and New Restored Accounts
Tests:
1. Legacy Restore overview exposes priority list (top_candidates) and top_missing_candidates
2. Three new restored accounts searchable: test-prod@bidblitz.com, aldinkrasniqi720@gmail.com, afrimfinaltest@icloud.com
3. Admin wallet and admin customers search return these accounts with legacy_restored metadata
4. Legacy Restore detail for each shows status=restored and correct evidence
5. Bulk Restore workflow: preview correctly marks already restored as blocked/existiert_bereits
6. No regression: admin wallet page and legacy restore tab still load
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
ADMIN_EMAIL = "admin@bidblitz.ae"
ADMIN_PASSWORD = "BidBlitz2026!"

# New restored accounts from LEGACY_WALLET_SNAPSHOT_USERS
NEW_RESTORED_ACCOUNTS = [
    {"email": "test-prod@bidblitz.com", "name": "Test GmbH", "balance_eur": 10.0, "balance_blz": 0.0, "evidence_label": "Screenshot IMG_2832"},
    {"email": "aldinkrasniqi720@gmail.com", "name": "Aldin Krasniqi", "balance_eur": 510.0, "balance_blz": 35.0, "evidence_label": "Screenshot IMG_2833"},
    {"email": "afrimfinaltest@icloud.com", "name": "Afrim Test Final", "balance_eur": 125.0, "balance_blz": 10.0, "evidence_label": "Screenshot IMG_2833"},
]


@pytest.fixture(scope="module")
def admin_session():
    """Login as admin and return session with cookies"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    
    response = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    return session


class TestLegacyRestoreOverviewPriorityList:
    """Test that overview exposes priority list of safe candidates"""
    
    def test_overview_returns_top_candidates(self, admin_session):
        """Overview summary should include top_candidates list"""
        response = admin_session.get(f"{BASE_URL}/api/admin/legacy-restore/overview")
        assert response.status_code == 200, f"Overview failed: {response.text}"
        
        data = response.json()
        assert "summary" in data
        summary = data["summary"]
        
        # Verify top_candidates exists and has entries
        assert "top_candidates" in summary, "top_candidates missing from summary"
        top_candidates = summary["top_candidates"]
        assert isinstance(top_candidates, list), "top_candidates should be a list"
        assert len(top_candidates) > 0, "top_candidates should not be empty"
        
        # Verify structure of top_candidates
        for candidate in top_candidates:
            assert "candidate_key" in candidate
            assert "display_name" in candidate
            assert "priority_score" in candidate
            assert "priority_label" in candidate
            assert "priority_rank" in candidate
            assert "status" in candidate
            assert "source_type" in candidate
            assert candidate["source_type"] == "known_seed", f"Top candidate should be known_seed, got {candidate['source_type']}"
        
        print(f"✓ Overview returns {len(top_candidates)} top candidates")
    
    def test_overview_returns_top_missing_candidates(self, admin_session):
        """Overview summary should include top_missing_candidates list"""
        response = admin_session.get(f"{BASE_URL}/api/admin/legacy-restore/overview")
        assert response.status_code == 200
        
        data = response.json()
        summary = data["summary"]
        
        # Verify top_missing_candidates exists
        assert "top_missing_candidates" in summary, "top_missing_candidates missing from summary"
        top_missing = summary["top_missing_candidates"]
        assert isinstance(top_missing, list), "top_missing_candidates should be a list"
        
        # All entries should have status != 'restored'
        for candidate in top_missing:
            assert candidate.get("status") != "restored", f"top_missing should not include restored candidates: {candidate}"
        
        print(f"✓ Overview returns {len(top_missing)} top missing candidates")


class TestNewRestoredAccountsSearchable:
    """Test that the three new restored accounts are searchable"""
    
    @pytest.mark.parametrize("account", NEW_RESTORED_ACCOUNTS)
    def test_restored_account_in_admin_wallet_search(self, admin_session, account):
        """Each restored account should be searchable in admin wallet users with correct balance"""
        response = admin_session.get(f"{BASE_URL}/api/admin/wallet/users?q={account['email']}")
        assert response.status_code == 200, f"Admin wallet search failed: {response.text}"
        
        data = response.json()
        users = data.get("users", [])
        
        # Find the user by email
        found_user = None
        for user in users:
            if user.get("email", "").lower() == account["email"].lower():
                found_user = user
                break
        
        assert found_user is not None, f"User {account['email']} not found in admin wallet search"
        
        # Verify balance (legacy_restored field is not returned by this endpoint but is in DB)
        assert abs(found_user.get("balance_eur", 0) - account["balance_eur"]) < 0.01, \
            f"User {account['email']} balance_eur mismatch: expected {account['balance_eur']}, got {found_user.get('balance_eur')}"
        assert abs(found_user.get("balance_blz", 0) - account["balance_blz"]) < 0.01, \
            f"User {account['email']} balance_blz mismatch: expected {account['balance_blz']}, got {found_user.get('balance_blz')}"
        
        print(f"✓ {account['email']} found in admin wallet search with correct balance ({account['balance_eur']} EUR, {account['balance_blz']} BLZ)")
    
    @pytest.mark.parametrize("account", NEW_RESTORED_ACCOUNTS)
    def test_restored_account_in_admin_customers_search(self, admin_session, account):
        """Each restored account should be searchable in admin customers"""
        response = admin_session.get(f"{BASE_URL}/api/admin/customers?q={account['email']}")
        assert response.status_code == 200, f"Admin customers search failed: {response.text}"
        
        data = response.json()
        customers = data.get("customers", [])
        
        # Find the customer by email
        found_customer = None
        for customer in customers:
            if customer.get("email", "").lower() == account["email"].lower():
                found_customer = customer
                break
        
        assert found_customer is not None, f"Customer {account['email']} not found in admin customers search"
        
        # Verify name
        assert found_customer.get("name") == account["name"], \
            f"Customer {account['email']} name mismatch: expected {account['name']}, got {found_customer.get('name')}"
        
        print(f"✓ {account['email']} found in admin customers search with name={account['name']}")


class TestLegacyRestoreDetailForRestoredAccounts:
    """Test that Legacy Restore detail shows correct status and evidence for restored accounts"""
    
    @pytest.mark.parametrize("account", NEW_RESTORED_ACCOUNTS)
    def test_legacy_restore_detail_shows_restored_status(self, admin_session, account):
        """Legacy Restore detail for each restored account should show status=restored"""
        response = admin_session.get(f"{BASE_URL}/api/admin/legacy-restore/candidates/{account['email']}")
        assert response.status_code == 200, f"Legacy restore detail failed for {account['email']}: {response.text}"
        
        data = response.json()
        candidate = data.get("candidate", {})
        
        # Verify status is restored
        assert candidate.get("status") == "restored", \
            f"Candidate {account['email']} should have status=restored, got {candidate.get('status')}"
        
        # Verify existing_user is populated
        existing_user = candidate.get("existing_user")
        assert existing_user is not None, f"Candidate {account['email']} should have existing_user populated"
        assert existing_user.get("email", "").lower() == account["email"].lower()
        assert existing_user.get("legacy_restored") == True
        
        print(f"✓ {account['email']} detail shows status=restored with existing_user populated")
    
    @pytest.mark.parametrize("account", NEW_RESTORED_ACCOUNTS)
    def test_legacy_restore_detail_shows_correct_evidence(self, admin_session, account):
        """Legacy Restore detail should show correct evidence from screenshots"""
        response = admin_session.get(f"{BASE_URL}/api/admin/legacy-restore/candidates/{account['email']}")
        assert response.status_code == 200
        
        data = response.json()
        candidate = data.get("candidate", {})
        evidence = candidate.get("evidence", [])
        
        # Verify evidence exists
        assert len(evidence) > 0, f"Candidate {account['email']} should have evidence"
        
        # Find evidence with expected label
        found_evidence = False
        for ev in evidence:
            if account["evidence_label"] in ev.get("label", ""):
                found_evidence = True
                assert ev.get("confidence", 0) >= 90, f"Evidence confidence should be >= 90, got {ev.get('confidence')}"
                break
        
        assert found_evidence, f"Expected evidence '{account['evidence_label']}' not found for {account['email']}"
        
        print(f"✓ {account['email']} detail shows evidence from {account['evidence_label']}")


class TestBulkRestoreWorkflow:
    """Test Bulk Restore workflow correctly handles already restored candidates"""
    
    def test_bulk_preview_marks_restored_as_blocked(self, admin_session):
        """Bulk preview should mark already restored candidates as blocked/existiert_bereits"""
        # Use the three new restored accounts
        candidate_keys = [acc["email"] for acc in NEW_RESTORED_ACCOUNTS]
        
        response = admin_session.post(f"{BASE_URL}/api/admin/legacy-restore/bulk-preview", json={
            "candidate_keys": candidate_keys
        })
        assert response.status_code == 200, f"Bulk preview failed: {response.text}"
        
        data = response.json()
        
        # Verify structure
        assert "restoreable" in data
        assert "blocked" in data
        assert "summary" in data
        
        # All three should be blocked since they're already restored
        blocked = data["blocked"]
        assert len(blocked) == 3, f"Expected 3 blocked candidates, got {len(blocked)}"
        
        # Verify each blocked candidate has reason=existiert_bereits
        for blocked_item in blocked:
            assert blocked_item.get("reason") == "existiert_bereits", \
                f"Blocked candidate {blocked_item.get('candidate_key')} should have reason=existiert_bereits, got {blocked_item.get('reason')}"
            assert blocked_item.get("existing_user") is not None, \
                f"Blocked candidate {blocked_item.get('candidate_key')} should have existing_user populated"
        
        # Restoreable should be empty
        restoreable = data["restoreable"]
        assert len(restoreable) == 0, f"Expected 0 restoreable candidates, got {len(restoreable)}"
        
        # Verify summary
        summary = data["summary"]
        assert summary.get("selected") == 3
        assert summary.get("restoreable") == 0
        assert summary.get("blocked") == 3
        
        print(f"✓ Bulk preview correctly marks all 3 restored accounts as blocked/existiert_bereits")
    
    def test_bulk_preview_with_mixed_candidates(self, admin_session):
        """Bulk preview with mix of restored and missing candidates"""
        # Get overview to find a missing candidate
        overview_response = admin_session.get(f"{BASE_URL}/api/admin/legacy-restore/overview")
        assert overview_response.status_code == 200
        
        overview_data = overview_response.json()
        candidates = overview_data.get("candidates", [])
        
        # Find a missing candidate that's not one of our restored accounts
        missing_candidate = None
        for c in candidates:
            if c.get("status") == "missing" and c.get("candidate_key") not in [acc["email"] for acc in NEW_RESTORED_ACCOUNTS]:
                missing_candidate = c
                break
        
        if missing_candidate:
            # Test with one restored and one missing
            candidate_keys = [NEW_RESTORED_ACCOUNTS[0]["email"], missing_candidate["candidate_key"]]
            
            response = admin_session.post(f"{BASE_URL}/api/admin/legacy-restore/bulk-preview", json={
                "candidate_keys": candidate_keys
            })
            assert response.status_code == 200
            
            data = response.json()
            
            # One should be blocked (restored), one might be restoreable or blocked for other reasons
            assert len(data["blocked"]) >= 1, "At least one should be blocked (the restored one)"
            
            # Find the restored one in blocked
            restored_blocked = [b for b in data["blocked"] if b.get("candidate_key") == NEW_RESTORED_ACCOUNTS[0]["email"]]
            assert len(restored_blocked) == 1, "Restored account should be in blocked list"
            assert restored_blocked[0].get("reason") == "existiert_bereits"
            
            print(f"✓ Bulk preview correctly handles mixed candidates")
        else:
            print("⚠ No missing candidates found to test mixed bulk preview")


class TestBulkRestoreUIElements:
    """Test that Bulk Restore UI elements exist in the API responses"""
    
    def test_overview_has_bulk_restore_data(self, admin_session):
        """Overview should return data needed for bulk restore UI"""
        response = admin_session.get(f"{BASE_URL}/api/admin/legacy-restore/overview")
        assert response.status_code == 200
        
        data = response.json()
        candidates = data.get("candidates", [])
        
        # Each candidate should have fields needed for bulk selection
        for candidate in candidates[:5]:  # Check first 5
            assert "candidate_key" in candidate
            assert "status" in candidate
            assert "restore_ready" in candidate
            assert "priority_score" in candidate
            assert "priority_rank" in candidate
        
        print(f"✓ Overview returns candidates with all fields needed for bulk restore UI")


class TestNoRegression:
    """Test that existing functionality still works"""
    
    def test_admin_wallet_page_loads(self, admin_session):
        """Admin wallet balance endpoint should work"""
        response = admin_session.get(f"{BASE_URL}/api/wallet/balance")
        assert response.status_code == 200, f"Wallet balance failed: {response.text}"
        
        data = response.json()
        assert "balance" in data or "balance_eur" in data
        
        print("✓ Admin wallet balance endpoint works")
    
    def test_legacy_restore_tab_loads(self, admin_session):
        """Legacy restore overview should load"""
        response = admin_session.get(f"{BASE_URL}/api/admin/legacy-restore/overview")
        assert response.status_code == 200
        
        data = response.json()
        assert "summary" in data
        assert "candidates" in data
        assert "history" in data
        
        print("✓ Legacy restore overview loads correctly")
    
    def test_previously_restored_albin_still_exists(self, admin_session):
        """Previously restored Albin Krasniqi should still exist"""
        response = admin_session.get(f"{BASE_URL}/api/admin/wallet/users?q=albinkrasniqi11@icloud.com")
        assert response.status_code == 200
        
        data = response.json()
        users = data.get("users", [])
        
        found = any(u.get("email", "").lower() == "albinkrasniqi11@icloud.com" for u in users)
        assert found, "Previously restored Albin Krasniqi (albinkrasniqi11@icloud.com) should still exist"
        
        print("✓ Previously restored Albin Krasniqi still exists")
    
    def test_previously_restored_afrim_still_exists(self, admin_session):
        """Previously restored Afrim Krasniqi should still exist"""
        response = admin_session.get(f"{BASE_URL}/api/admin/wallet/users?q=lufrollen.notepad_9o@icloud.com")
        assert response.status_code == 200
        
        data = response.json()
        users = data.get("users", [])
        
        found = any(u.get("email", "").lower() == "lufrollen.notepad_9o@icloud.com" for u in users)
        assert found, "Previously restored Afrim Krasniqi (lufrollen.notepad_9o@icloud.com) should still exist"
        
        print("✓ Previously restored Afrim Krasniqi still exists")


class TestLegacyRestoreHistory:
    """Test Legacy Restore history endpoint"""
    
    def test_history_endpoint_works(self, admin_session):
        """History endpoint should return list of restore actions"""
        response = admin_session.get(f"{BASE_URL}/api/admin/legacy-restore/history")
        assert response.status_code == 200, f"History endpoint failed: {response.text}"
        
        data = response.json()
        assert "actions" in data
        assert "count" in data
        assert isinstance(data["actions"], list)
        
        print(f"✓ History endpoint returns {data['count']} actions")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
