"""
Test Legacy Restore Center - Real Customer Filter Feature (Iteration 244)
Tests the view filter functionality: real_only, noise_only, review, all
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
ADMIN_EMAIL = "admin@bidblitz.ae"
ADMIN_PASSWORD = "BidBlitz2026!"

# Expected real customers from screenshots
EXPECTED_REAL_CUSTOMERS = [
    "Afrim Krasniqi",
    "Afrim Test Final",
    "Albin Krasniqi",
    "Aldin Krasniqi",
    "Test GmbH",
]


@pytest.fixture(scope="module")
def admin_session():
    """Login as admin and return session with cookies"""
    session = requests.Session()
    response = session.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
    )
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    return session


class TestLegacyRestoreOverviewFilters:
    """Test the view filter functionality in Legacy Restore Center"""

    def test_real_only_view_default(self, admin_session):
        """real_only view should show only real screenshot-derived customers"""
        response = admin_session.get(f"{BASE_URL}/api/admin/legacy-restore/overview?view=real_only")
        assert response.status_code == 200
        data = response.json()
        
        summary = data["summary"]
        candidates = data["candidates"]
        
        # Verify view mode
        assert summary["view_mode"] == "real_only"
        
        # Verify visible count matches real customer count
        assert summary["visible_candidates"] == 5, f"Expected 5 visible, got {summary['visible_candidates']}"
        assert summary["real_customer_candidates"] == 5
        
        # Verify all visible candidates are real_customer category
        for candidate in candidates:
            assert candidate["candidate_category"] in ["real_customer", "possible_real_customer"], \
                f"Non-real customer in real_only view: {candidate['display_name']} ({candidate['candidate_category']})"
        
        # Verify expected names are present
        visible_names = [c["display_name"] for c in candidates]
        for expected_name in EXPECTED_REAL_CUSTOMERS:
            assert expected_name in visible_names, f"Missing expected real customer: {expected_name}"

    def test_noise_only_view(self, admin_session):
        """noise_only view should show only attack/synthetic traces"""
        response = admin_session.get(f"{BASE_URL}/api/admin/legacy-restore/overview?view=noise_only")
        assert response.status_code == 200
        data = response.json()
        
        summary = data["summary"]
        candidates = data["candidates"]
        
        # Verify view mode
        assert summary["view_mode"] == "noise_only"
        
        # Verify visible count matches attack + synthetic count
        expected_noise = summary["attack_candidates"] + summary["synthetic_candidates"]
        assert summary["visible_candidates"] == expected_noise, \
            f"Expected {expected_noise} noise candidates, got {summary['visible_candidates']}"
        
        # Verify all visible candidates are attack_trace or synthetic_test
        for candidate in candidates:
            assert candidate["candidate_category"] in ["attack_trace", "synthetic_test"], \
                f"Non-noise candidate in noise_only view: {candidate['display_name']} ({candidate['candidate_category']})"
        
        # Verify real customers are NOT in noise view
        visible_names = [c["display_name"] for c in candidates]
        for real_name in EXPECTED_REAL_CUSTOMERS:
            assert real_name not in visible_names, f"Real customer {real_name} should not be in noise_only view"

    def test_review_view(self, admin_session):
        """review view should show only review_required candidates"""
        response = admin_session.get(f"{BASE_URL}/api/admin/legacy-restore/overview?view=review")
        assert response.status_code == 200
        data = response.json()
        
        summary = data["summary"]
        candidates = data["candidates"]
        
        # Verify view mode
        assert summary["view_mode"] == "review"
        
        # Verify visible count matches review count
        assert summary["visible_candidates"] == summary["review_candidates"], \
            f"Expected {summary['review_candidates']} review candidates, got {summary['visible_candidates']}"
        
        # Verify all visible candidates are review_required
        for candidate in candidates:
            assert candidate["candidate_category"] == "review_required", \
                f"Non-review candidate in review view: {candidate['display_name']} ({candidate['candidate_category']})"
        
        # Verify child_backup_signal sources are present
        source_types = [c["source_type"] for c in candidates]
        assert "child_backup_signal" in source_types, "Expected child_backup_signal sources in review view"

    def test_all_view(self, admin_session):
        """all view should show all candidates without filtering"""
        response = admin_session.get(f"{BASE_URL}/api/admin/legacy-restore/overview?view=all")
        assert response.status_code == 200
        data = response.json()
        
        summary = data["summary"]
        candidates = data["candidates"]
        
        # Verify view mode
        assert summary["view_mode"] == "all"
        
        # Verify visible equals total (no filtering)
        assert summary["visible_candidates"] == summary["total_candidates"], \
            f"All view should show all candidates: visible={summary['visible_candidates']}, total={summary['total_candidates']}"
        assert summary["hidden_candidates"] == 0, "All view should have 0 hidden candidates"
        
        # Verify all category types are present
        categories = set(c["candidate_category"] for c in candidates)
        assert "real_customer" in categories, "Missing real_customer in all view"
        assert "attack_trace" in categories, "Missing attack_trace in all view"
        assert "review_required" in categories, "Missing review_required in all view"


class TestLegacyRestoreSummaryCounters:
    """Test summary counters are accurate"""

    def test_summary_counters_present(self, admin_session):
        """Verify all required summary counters are present"""
        response = admin_session.get(f"{BASE_URL}/api/admin/legacy-restore/overview?view=real_only")
        assert response.status_code == 200
        summary = response.json()["summary"]
        
        required_fields = [
            "total_candidates",
            "visible_candidates",
            "hidden_candidates",
            "real_customer_candidates",
            "review_candidates",
            "synthetic_candidates",
            "attack_candidates",
            "view_mode",
        ]
        
        for field in required_fields:
            assert field in summary, f"Missing required summary field: {field}"

    def test_summary_counters_math(self, admin_session):
        """Verify summary counter math is correct"""
        response = admin_session.get(f"{BASE_URL}/api/admin/legacy-restore/overview?view=all")
        assert response.status_code == 200
        summary = response.json()["summary"]
        
        # Total should equal sum of all categories
        category_sum = (
            summary["real_customer_candidates"] +
            summary["review_candidates"] +
            summary["synthetic_candidates"] +
            summary["attack_candidates"]
        )
        assert summary["total_candidates"] == category_sum, \
            f"Category sum {category_sum} != total {summary['total_candidates']}"
        
        # Hidden should equal total - visible
        assert summary["hidden_candidates"] == summary["total_candidates"] - summary["visible_candidates"]


class TestLegacyRestoreCandidateClassification:
    """Test candidate classification badges and reasons"""

    def test_real_customer_classification(self, admin_session):
        """Verify real customers have correct classification"""
        response = admin_session.get(f"{BASE_URL}/api/admin/legacy-restore/overview?view=real_only")
        assert response.status_code == 200
        candidates = response.json()["candidates"]
        
        for candidate in candidates:
            # Verify classification fields present
            assert "candidate_category" in candidate
            assert "candidate_category_label" in candidate
            assert "category_reason" in candidate
            
            # Verify known seeds have correct category
            if candidate["source_type"] == "known_seed":
                assert candidate["candidate_category"] == "real_customer"
                assert candidate["candidate_category_label"] == "Echter Kunde"

    def test_attack_trace_classification(self, admin_session):
        """Verify attack traces have correct classification"""
        response = admin_session.get(f"{BASE_URL}/api/admin/legacy-restore/overview?view=noise_only")
        assert response.status_code == 200
        candidates = response.json()["candidates"]
        
        attack_candidates = [c for c in candidates if c["candidate_category"] == "attack_trace"]
        assert len(attack_candidates) > 0, "Expected attack_trace candidates in noise_only view"
        
        for candidate in attack_candidates:
            assert candidate["candidate_category_label"] == "Angriff/Lockout"
            assert "category_reason" in candidate


class TestNoRegression:
    """Verify no regression in existing functionality"""

    def test_priority_list_still_works(self, admin_session):
        """Verify priority list (top_candidates) still present"""
        response = admin_session.get(f"{BASE_URL}/api/admin/legacy-restore/overview?view=real_only")
        assert response.status_code == 200
        summary = response.json()["summary"]
        
        assert "top_candidates" in summary
        assert len(summary["top_candidates"]) > 0, "Priority list should have candidates"
        
        # Verify top candidates have required fields
        for candidate in summary["top_candidates"]:
            assert "candidate_key" in candidate
            assert "display_name" in candidate
            assert "priority_score" in candidate
            assert "priority_rank" in candidate

    def test_bulk_restore_endpoint_works(self, admin_session):
        """Verify bulk restore preview endpoint still works"""
        response = admin_session.post(
            f"{BASE_URL}/api/admin/legacy-restore/bulk-preview",
            json={"candidate_keys": ["albinkrasniqi11@icloud.com"]},
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "restoreable" in data
        assert "blocked" in data
        assert "summary" in data

    def test_admin_wallet_endpoint_works(self, admin_session):
        """Verify admin wallet endpoint still works"""
        response = admin_session.get(f"{BASE_URL}/api/admin/wallet/users?limit=1")
        assert response.status_code == 200
        data = response.json()
        assert "users" in data

    def test_history_endpoint_works(self, admin_session):
        """Verify history endpoint still works"""
        response = admin_session.get(f"{BASE_URL}/api/admin/legacy-restore/history")
        assert response.status_code == 200
        data = response.json()
        assert "actions" in data
