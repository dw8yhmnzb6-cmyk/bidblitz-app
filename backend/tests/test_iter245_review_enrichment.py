"""
Iteration 245: Review Enrichment Feature Tests
Tests the POST /api/admin/legacy-restore/review-enrichment endpoint
and verifies child-related backup collections are used to identify stronger real-product cases.
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
    
    response = session.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    return session


class TestReviewEnrichmentEndpoint:
    """Tests for POST /api/admin/legacy-restore/review-enrichment"""
    
    def test_review_enrichment_returns_200(self, admin_session):
        """Review enrichment endpoint should return 200 OK"""
        response = admin_session.post(f"{BASE_URL}/api/admin/legacy-restore/review-enrichment")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    def test_review_enrichment_returns_summary(self, admin_session):
        """Review enrichment should return summary with required fields"""
        response = admin_session.post(f"{BASE_URL}/api/admin/legacy-restore/review-enrichment")
        assert response.status_code == 200
        
        data = response.json()
        assert "summary" in data, "Response should contain 'summary'"
        
        summary = data["summary"]
        assert "review_visible" in summary, "Summary should contain 'review_visible'"
        assert "enriched_review_candidates" in summary, "Summary should contain 'enriched_review_candidates'"
        assert "upgrade_ready_candidates" in summary, "Summary should contain 'upgrade_ready_candidates'"
        assert "last_scan_at" in summary, "Summary should contain 'last_scan_at'"
    
    def test_review_enrichment_returns_candidates(self, admin_session):
        """Review enrichment should return enriched candidates list"""
        response = admin_session.post(f"{BASE_URL}/api/admin/legacy-restore/review-enrichment")
        assert response.status_code == 200
        
        data = response.json()
        assert "candidates" in data, "Response should contain 'candidates'"
        assert isinstance(data["candidates"], list), "Candidates should be a list"
    
    def test_enriched_candidates_have_required_fields(self, admin_session):
        """Each enriched candidate should have required fields"""
        response = admin_session.post(f"{BASE_URL}/api/admin/legacy-restore/review-enrichment")
        assert response.status_code == 200
        
        data = response.json()
        candidates = data.get("candidates", [])
        
        if len(candidates) > 0:
            for candidate in candidates:
                assert "candidate_key" in candidate, "Candidate should have 'candidate_key'"
                assert "display_name" in candidate, "Candidate should have 'display_name'"
                assert "child_signal_count" in candidate, "Candidate should have 'child_signal_count'"
                assert "priority_score" in candidate, "Candidate should have 'priority_score'"
                assert "candidate_category" in candidate, "Candidate should have 'candidate_category'"
                assert "category_reason" in candidate, "Candidate should have 'category_reason'"
    
    def test_enriched_candidates_have_positive_signal_count(self, admin_session):
        """All enriched candidates should have child_signal_count > 0"""
        response = admin_session.post(f"{BASE_URL}/api/admin/legacy-restore/review-enrichment")
        assert response.status_code == 200
        
        data = response.json()
        candidates = data.get("candidates", [])
        
        for candidate in candidates:
            assert candidate.get("child_signal_count", 0) > 0, \
                f"Candidate {candidate.get('candidate_key')} should have child_signal_count > 0"


class TestExpectedEnrichedCandidates:
    """Tests for the three expected enriched child-only cases"""
    
    def test_albin_is_enriched(self, admin_session):
        """Albin (child_2a880974de5f) should be in enriched candidates"""
        response = admin_session.post(f"{BASE_URL}/api/admin/legacy-restore/review-enrichment")
        assert response.status_code == 200
        
        data = response.json()
        candidates = data.get("candidates", [])
        
        albin = next((c for c in candidates if "child_2a880974de5f" in c.get("candidate_key", "")), None)
        assert albin is not None, "Albin (child_2a880974de5f) should be in enriched candidates"
        assert albin.get("display_name") == "Albin", f"Expected display_name 'Albin', got {albin.get('display_name')}"
        assert albin.get("candidate_category") == "possible_real_customer", \
            f"Albin should be 'possible_real_customer', got {albin.get('candidate_category')}"
    
    def test_anuar_is_enriched(self, admin_session):
        """Anuar (child_a240c029dd30) should be in enriched candidates"""
        response = admin_session.post(f"{BASE_URL}/api/admin/legacy-restore/review-enrichment")
        assert response.status_code == 200
        
        data = response.json()
        candidates = data.get("candidates", [])
        
        anuar = next((c for c in candidates if "child_a240c029dd30" in c.get("candidate_key", "")), None)
        assert anuar is not None, "Anuar (child_a240c029dd30) should be in enriched candidates"
        assert anuar.get("display_name") == "Anuar", f"Expected display_name 'Anuar', got {anuar.get('display_name')}"
        assert anuar.get("candidate_category") == "possible_real_customer", \
            f"Anuar should be 'possible_real_customer', got {anuar.get('candidate_category')}"
    
    def test_emma_is_enriched(self, admin_session):
        """Emma (child_888c787e77d9) should be in enriched candidates"""
        response = admin_session.post(f"{BASE_URL}/api/admin/legacy-restore/review-enrichment")
        assert response.status_code == 200
        
        data = response.json()
        candidates = data.get("candidates", [])
        
        emma = next((c for c in candidates if "child_888c787e77d9" in c.get("candidate_key", "")), None)
        assert emma is not None, "Emma (child_888c787e77d9) should be in enriched candidates"
        assert emma.get("display_name") == "Emma", f"Expected display_name 'Emma', got {emma.get('display_name')}"
        assert emma.get("candidate_category") == "possible_real_customer", \
            f"Emma should be 'possible_real_customer', got {emma.get('candidate_category')}"
    
    def test_upgrade_ready_count_matches_expected(self, admin_session):
        """upgrade_ready_candidates should be at least 3 (Albin, Anuar, Emma)"""
        response = admin_session.post(f"{BASE_URL}/api/admin/legacy-restore/review-enrichment")
        assert response.status_code == 200
        
        data = response.json()
        summary = data.get("summary", {})
        
        assert summary.get("upgrade_ready_candidates", 0) >= 3, \
            f"Expected at least 3 upgrade_ready_candidates, got {summary.get('upgrade_ready_candidates')}"


class TestOverviewEnrichedReviewCandidates:
    """Tests for enriched_review_candidates in overview endpoint"""
    
    def test_overview_includes_enriched_review_candidates(self, admin_session):
        """Overview summary should include enriched_review_candidates count"""
        response = admin_session.get(f"{BASE_URL}/api/admin/legacy-restore/overview?view=all")
        assert response.status_code == 200
        
        data = response.json()
        summary = data.get("summary", {})
        
        assert "enriched_review_candidates" in summary, \
            "Overview summary should include 'enriched_review_candidates'"
        assert summary.get("enriched_review_candidates", 0) >= 3, \
            f"Expected at least 3 enriched_review_candidates, got {summary.get('enriched_review_candidates')}"


class TestCandidateDetailChildSignalCount:
    """Tests for child_signal_count in candidate detail"""
    
    def test_candidate_detail_includes_child_signal_count(self, admin_session):
        """Candidate detail should include child_signal_count"""
        # First get a child candidate key
        response = admin_session.post(f"{BASE_URL}/api/admin/legacy-restore/review-enrichment")
        assert response.status_code == 200
        
        data = response.json()
        candidates = data.get("candidates", [])
        
        if len(candidates) > 0:
            candidate_key = candidates[0].get("candidate_key")
            
            # Get candidate detail
            detail_response = admin_session.get(
                f"{BASE_URL}/api/admin/legacy-restore/candidates/{candidate_key}"
            )
            assert detail_response.status_code == 200
            
            detail_data = detail_response.json()
            candidate = detail_data.get("candidate", {})
            
            assert "child_signal_count" in candidate, \
                "Candidate detail should include 'child_signal_count'"
            assert "category_reason" in candidate, \
                "Candidate detail should include 'category_reason'"


class TestNoRegressionExistingFeatures:
    """Tests to ensure no regression in existing features"""
    
    def test_overview_still_works(self, admin_session):
        """Overview endpoint should still work"""
        response = admin_session.get(f"{BASE_URL}/api/admin/legacy-restore/overview")
        assert response.status_code == 200
        
        data = response.json()
        assert "summary" in data
        assert "candidates" in data
        assert "history" in data
    
    def test_view_filters_still_work(self, admin_session):
        """View filters (real_only, review, noise_only, all) should still work"""
        for view in ["real_only", "review", "noise_only", "all"]:
            response = admin_session.get(f"{BASE_URL}/api/admin/legacy-restore/overview?view={view}")
            assert response.status_code == 200, f"View filter '{view}' failed"
            
            data = response.json()
            assert data.get("summary", {}).get("view_mode") == view, \
                f"Expected view_mode '{view}', got {data.get('summary', {}).get('view_mode')}"
    
    def test_priority_list_still_works(self, admin_session):
        """Priority list (top_candidates) should still be present"""
        response = admin_session.get(f"{BASE_URL}/api/admin/legacy-restore/overview?view=real_only")
        assert response.status_code == 200
        
        data = response.json()
        summary = data.get("summary", {})
        
        assert "top_candidates" in summary, "Summary should include 'top_candidates'"
        assert len(summary.get("top_candidates", [])) > 0, "top_candidates should not be empty"
    
    def test_bulk_preview_still_works(self, admin_session):
        """Bulk preview endpoint should still work"""
        response = admin_session.post(
            f"{BASE_URL}/api/admin/legacy-restore/bulk-preview",
            json={"candidate_keys": []}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "restoreable" in data
        assert "blocked" in data
        assert "summary" in data
    
    def test_history_still_works(self, admin_session):
        """History endpoint should still work"""
        response = admin_session.get(f"{BASE_URL}/api/admin/legacy-restore/history")
        assert response.status_code == 200
        
        data = response.json()
        assert "actions" in data
        assert "count" in data


class TestUnauthorizedAccess:
    """Tests for unauthorized access"""
    
    def test_review_enrichment_requires_auth(self):
        """Review enrichment should require authentication"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/admin/legacy-restore/review-enrichment")
        assert response.status_code in [401, 403], \
            f"Expected 401/403 for unauthenticated request, got {response.status_code}"
