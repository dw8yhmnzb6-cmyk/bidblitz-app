"""
Iteration 246: Child→User Preview API Tests
Tests the POST /api/admin/legacy-restore/child-to-user/preview endpoint
for converting strong enriched child candidates to real login users.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
ADMIN_EMAIL = "admin@bidblitz.ae"
ADMIN_PASSWORD = "BidBlitz2026!"


@pytest.fixture(scope="module")
def admin_session():
    """Create authenticated admin session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    
    # Login as admin
    response = session.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    return session


class TestChildToUserPreviewEndpoint:
    """Tests for POST /api/admin/legacy-restore/child-to-user/preview"""
    
    def test_preview_anuar_with_new_email_returns_restore_ready(self, admin_session):
        """
        Anuar (child_a240c029dd30) is a strong enriched candidate with 5 signals.
        Preview with a new email should return restore_ready=true.
        """
        response = admin_session.post(
            f"{BASE_URL}/api/admin/legacy-restore/child-to-user/preview",
            json={
                "candidate_key": "child:child_a240c029dd30",
                "primary_email": "anuar.child.restore@bidblitz.com",
                "display_name": "Anuar"
            }
        )
        assert response.status_code == 200, f"Preview failed: {response.text}"
        
        data = response.json()
        preview = data.get("preview", {})
        
        # Verify restore_ready is true
        assert preview.get("restore_ready") is True, f"Expected restore_ready=true, got: {preview}"
        
        # Verify email is set correctly
        assert preview.get("primary_email") == "anuar.child.restore@bidblitz.com"
        
        # Verify no existing user collision
        assert preview.get("existing_user") is None, f"Unexpected existing_user: {preview.get('existing_user')}"
        
        # Verify candidate category
        assert preview.get("candidate_category") == "possible_real_customer"
        
        # Verify child signal count > 0
        assert preview.get("child_signal_count", 0) >= 2, f"Expected child_signal_count >= 2, got: {preview.get('child_signal_count')}"
        
        print(f"PASS: Anuar preview with new email returns restore_ready=true, signals={preview.get('child_signal_count')}")
    
    def test_preview_emma_with_new_email_returns_restore_ready(self, admin_session):
        """
        Emma (child_888c787e77d9) is a strong enriched candidate with 2 signals.
        Preview with a new email should return restore_ready=true.
        """
        response = admin_session.post(
            f"{BASE_URL}/api/admin/legacy-restore/child-to-user/preview",
            json={
                "candidate_key": "child:child_888c787e77d9",
                "primary_email": "emma.child.restore@bidblitz.com",
                "display_name": "Emma"
            }
        )
        assert response.status_code == 200, f"Preview failed: {response.text}"
        
        data = response.json()
        preview = data.get("preview", {})
        
        # Verify restore_ready is true
        assert preview.get("restore_ready") is True, f"Expected restore_ready=true, got: {preview}"
        
        # Verify email is set correctly
        assert preview.get("primary_email") == "emma.child.restore@bidblitz.com"
        
        # Verify no existing user collision
        assert preview.get("existing_user") is None, f"Unexpected existing_user: {preview.get('existing_user')}"
        
        # Verify candidate category
        assert preview.get("candidate_category") == "possible_real_customer"
        
        # Verify child signal count >= 2
        assert preview.get("child_signal_count", 0) >= 2, f"Expected child_signal_count >= 2, got: {preview.get('child_signal_count')}"
        
        print(f"PASS: Emma preview with new email returns restore_ready=true, signals={preview.get('child_signal_count')}")
    
    def test_preview_albin_with_existing_alias_blocked(self, admin_session):
        """
        Albin (child_2a880974de5f) has alias albinkrasniqi11@icloud.com which is already restored.
        Preview using this alias should be blocked with existing_user set.
        """
        response = admin_session.post(
            f"{BASE_URL}/api/admin/legacy-restore/child-to-user/preview",
            json={
                "candidate_key": "child:child_2a880974de5f",
                "primary_email": "albinkrasniqi11@icloud.com",
                "display_name": "Albin"
            }
        )
        assert response.status_code == 200, f"Preview failed: {response.text}"
        
        data = response.json()
        preview = data.get("preview", {})
        
        # Verify restore_ready is false due to existing user
        assert preview.get("restore_ready") is False, f"Expected restore_ready=false, got: {preview}"
        
        # Verify existing_user is set
        existing_user = preview.get("existing_user")
        assert existing_user is not None, "Expected existing_user to be set for collision"
        assert existing_user.get("email") == "albinkrasniqi11@icloud.com" or "albinkrasniqi" in existing_user.get("email", "").lower()
        
        print(f"PASS: Albin preview with existing alias blocked, existing_user={existing_user.get('email')}")
    
    def test_preview_albin_with_secondary_alias_blocked(self, admin_session):
        """
        Albin's secondary alias albinkrasniqi612@gmail.com should also be blocked.
        """
        response = admin_session.post(
            f"{BASE_URL}/api/admin/legacy-restore/child-to-user/preview",
            json={
                "candidate_key": "child:child_2a880974de5f",
                "primary_email": "albinkrasniqi612@gmail.com",
                "display_name": "Albin"
            }
        )
        assert response.status_code == 200, f"Preview failed: {response.text}"
        
        data = response.json()
        preview = data.get("preview", {})
        
        # Verify restore_ready is false due to existing user
        assert preview.get("restore_ready") is False, f"Expected restore_ready=false, got: {preview}"
        
        # Verify existing_user is set
        existing_user = preview.get("existing_user")
        assert existing_user is not None, "Expected existing_user to be set for alias collision"
        
        print(f"PASS: Albin preview with secondary alias blocked, existing_user={existing_user}")
    
    def test_preview_without_email_returns_missing_fields(self, admin_session):
        """
        Preview without primary_email should return restore_ready=false with missing_fields.
        """
        response = admin_session.post(
            f"{BASE_URL}/api/admin/legacy-restore/child-to-user/preview",
            json={
                "candidate_key": "child:child_a240c029dd30",
                "primary_email": "",
                "display_name": "Anuar"
            }
        )
        # Should fail validation or return missing fields
        if response.status_code == 422:
            # Pydantic validation error for empty email
            print("PASS: Empty email rejected by validation")
            return
        
        assert response.status_code == 200, f"Preview failed: {response.text}"
        
        data = response.json()
        preview = data.get("preview", {})
        
        # Verify restore_ready is false
        assert preview.get("restore_ready") is False
        
        # Verify missing_fields includes primary_email
        missing = preview.get("missing_fields", [])
        assert "primary_email" in missing, f"Expected primary_email in missing_fields, got: {missing}"
        
        print(f"PASS: Preview without email returns missing_fields={missing}")
    
    def test_preview_nonexistent_candidate_returns_404(self, admin_session):
        """
        Preview for a non-existent candidate should return 404.
        """
        response = admin_session.post(
            f"{BASE_URL}/api/admin/legacy-restore/child-to-user/preview",
            json={
                "candidate_key": "child:nonexistent_child_id",
                "primary_email": "test@bidblitz.com",
                "display_name": "Test"
            }
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        print("PASS: Non-existent candidate returns 404")
    
    def test_preview_requires_admin_auth(self):
        """
        Preview endpoint should require admin authentication.
        """
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        response = session.post(
            f"{BASE_URL}/api/admin/legacy-restore/child-to-user/preview",
            json={
                "candidate_key": "child:child_a240c029dd30",
                "primary_email": "test@bidblitz.com",
                "display_name": "Test"
            }
        )
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print("PASS: Preview requires admin authentication")


class TestReviewEnrichmentIntegration:
    """Tests to verify review enrichment still works and returns expected candidates"""
    
    def test_review_enrichment_returns_enriched_candidates(self, admin_session):
        """
        POST /api/admin/legacy-restore/review-enrichment should return enriched candidates
        including Albin, Anuar, and Emma with child_signal_count > 0.
        """
        response = admin_session.post(f"{BASE_URL}/api/admin/legacy-restore/review-enrichment")
        assert response.status_code == 200, f"Review enrichment failed: {response.text}"
        
        data = response.json()
        summary = data.get("summary", {})
        candidates = data.get("candidates", [])
        
        # Verify summary fields
        assert "enriched_review_candidates" in summary
        assert "upgrade_ready_candidates" in summary
        assert summary.get("enriched_review_candidates", 0) >= 3, f"Expected >= 3 enriched candidates"
        
        # Verify candidates list contains expected names
        candidate_names = [c.get("display_name", "").lower() for c in candidates]
        assert any("albin" in name for name in candidate_names), "Albin not found in enriched candidates"
        assert any("anuar" in name for name in candidate_names), "Anuar not found in enriched candidates"
        assert any("emma" in name for name in candidate_names), "Emma not found in enriched candidates"
        
        print(f"PASS: Review enrichment returns {len(candidates)} enriched candidates")
    
    def test_overview_returns_possible_real_customer_candidates(self, admin_session):
        """
        GET /api/admin/legacy-restore/overview with view=real_only should include
        possible_real_customer candidates from child enrichment.
        """
        response = admin_session.get(f"{BASE_URL}/api/admin/legacy-restore/overview?view=real_only")
        assert response.status_code == 200, f"Overview failed: {response.text}"
        
        data = response.json()
        candidates = data.get("candidates", [])
        summary = data.get("summary", {})
        
        # Find possible_real_customer candidates
        possible_real = [c for c in candidates if c.get("candidate_category") == "possible_real_customer"]
        
        assert len(possible_real) >= 3, f"Expected >= 3 possible_real_customer candidates, got {len(possible_real)}"
        
        print(f"PASS: Overview returns {len(possible_real)} possible_real_customer candidates")


class TestLegacyRestoreNoRegression:
    """Regression tests to ensure existing features still work"""
    
    def test_overview_endpoint_works(self, admin_session):
        """GET /api/admin/legacy-restore/overview should return 200"""
        response = admin_session.get(f"{BASE_URL}/api/admin/legacy-restore/overview")
        assert response.status_code == 200
        data = response.json()
        assert "summary" in data
        assert "candidates" in data
        print("PASS: Overview endpoint works")
    
    def test_view_filters_work(self, admin_session):
        """All view filters should work"""
        for view in ["real_only", "review", "noise_only", "all"]:
            response = admin_session.get(f"{BASE_URL}/api/admin/legacy-restore/overview?view={view}")
            assert response.status_code == 200, f"View filter {view} failed"
        print("PASS: All view filters work")
    
    def test_candidate_detail_endpoint_works(self, admin_session):
        """GET /api/admin/legacy-restore/candidates/{key} should work"""
        # First get a candidate key
        response = admin_session.get(f"{BASE_URL}/api/admin/legacy-restore/overview?view=all")
        assert response.status_code == 200
        candidates = response.json().get("candidates", [])
        
        if candidates:
            key = candidates[0].get("candidate_key")
            detail_response = admin_session.get(
                f"{BASE_URL}/api/admin/legacy-restore/candidates/{key}"
            )
            assert detail_response.status_code == 200
            print(f"PASS: Candidate detail endpoint works for {key}")
        else:
            pytest.skip("No candidates to test detail endpoint")
    
    def test_bulk_preview_endpoint_works(self, admin_session):
        """POST /api/admin/legacy-restore/bulk-preview should work"""
        response = admin_session.post(
            f"{BASE_URL}/api/admin/legacy-restore/bulk-preview",
            json={"candidate_keys": ["albinkrasniqi11@icloud.com"]}
        )
        assert response.status_code == 200
        data = response.json()
        assert "summary" in data
        print("PASS: Bulk preview endpoint works")
    
    def test_history_endpoint_works(self, admin_session):
        """GET /api/admin/legacy-restore/history should work"""
        response = admin_session.get(f"{BASE_URL}/api/admin/legacy-restore/history")
        assert response.status_code == 200
        data = response.json()
        assert "actions" in data
        print("PASS: History endpoint works")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
