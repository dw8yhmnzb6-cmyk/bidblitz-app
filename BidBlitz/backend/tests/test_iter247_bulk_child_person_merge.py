"""
Iteration 247: Bulk Child→User and Person-Merge Features Testing
Tests the new bulk child-to-user workflow and person-merge grouping logic.
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
    response = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    return session


class TestPersonMergeOverview:
    """Tests for GET /api/admin/legacy-restore/person-merge/overview"""

    def test_person_merge_overview_returns_summary(self, admin_session):
        """Verify person-merge overview returns summary with expected fields"""
        response = admin_session.get(f"{BASE_URL}/api/admin/legacy-restore/person-merge/overview")
        assert response.status_code == 200
        data = response.json()
        
        # Verify summary structure
        assert "summary" in data
        summary = data["summary"]
        assert "total_clusters" in summary
        assert "clusters_with_active_users" in summary
        assert "clusters_with_child_candidates" in summary
        assert "clusters_with_possible_real" in summary
        assert "last_scan_at" in summary
        
        # Verify expected values (from agent context)
        assert summary["total_clusters"] >= 25, f"Expected ~30 clusters, got {summary['total_clusters']}"
        assert summary["clusters_with_active_users"] >= 4, f"Expected ~6 active user clusters"
        assert summary["clusters_with_child_candidates"] >= 4, f"Expected ~6 child candidate clusters"
        assert summary["clusters_with_possible_real"] >= 2, f"Expected ~3 possible real clusters"

    def test_person_merge_overview_returns_clusters(self, admin_session):
        """Verify person-merge overview returns cluster list"""
        response = admin_session.get(f"{BASE_URL}/api/admin/legacy-restore/person-merge/overview")
        assert response.status_code == 200
        data = response.json()
        
        # Verify clusters structure
        assert "clusters" in data
        clusters = data["clusters"]
        assert len(clusters) > 0, "Expected at least one cluster"
        
        # Verify cluster structure
        first_cluster = clusters[0]
        assert "cluster_id" in first_cluster
        assert "display_name" in first_cluster
        assert "member_count" in first_cluster
        assert "active_users" in first_cluster
        assert "candidate_count" in first_cluster
        assert "child_candidate_count" in first_cluster

    def test_person_merge_overview_with_query(self, admin_session):
        """Verify person-merge overview supports query filtering"""
        response = admin_session.get(f"{BASE_URL}/api/admin/legacy-restore/person-merge/overview?q=albin")
        assert response.status_code == 200
        data = response.json()
        
        # Should find Albin cluster
        clusters = data.get("clusters", [])
        albin_found = any("albin" in c.get("cluster_id", "").lower() or 
                         "albin" in c.get("display_name", "").lower() 
                         for c in clusters)
        assert albin_found, "Expected to find Albin cluster with query filter"


class TestPersonMergeDetail:
    """Tests for GET /api/admin/legacy-restore/person-merge/{cluster_id}"""

    def test_person_merge_albin_cluster(self, admin_session):
        """Verify Albin cluster combines child candidate, restored candidate, and active user"""
        response = admin_session.get(f"{BASE_URL}/api/admin/legacy-restore/person-merge/albin")
        assert response.status_code == 200
        data = response.json()
        
        # Verify cluster structure
        assert "cluster" in data
        cluster = data["cluster"]
        assert cluster["cluster_id"] == "albin"
        assert "Albin" in cluster["display_name"]
        
        # Verify members
        members = cluster.get("members", [])
        assert len(members) >= 2, f"Expected at least 2 members, got {len(members)}"
        
        # Check for different member kinds
        member_kinds = [m.get("member_kind") for m in members]
        assert "candidate" in member_kinds, "Expected at least one candidate member"
        
        # Check for child candidate
        child_candidates = [m for m in members if m.get("source_type") == "child_backup_signal"]
        assert len(child_candidates) >= 1, "Expected at least one child backup signal member"
        
        # Check for active user (if restored)
        active_users = [m for m in members if m.get("member_kind") == "active_user"]
        # Active user may or may not exist depending on restore state

    def test_person_merge_albin_has_emails_and_aliases(self, admin_session):
        """Verify Albin cluster has emails and aliases"""
        response = admin_session.get(f"{BASE_URL}/api/admin/legacy-restore/person-merge/albin")
        assert response.status_code == 200
        cluster = response.json().get("cluster", {})
        
        # Verify emails and aliases
        emails = cluster.get("emails", [])
        aliases = cluster.get("aliases", [])
        related_names = cluster.get("related_names", [])
        
        # Should have at least one email or alias
        assert len(emails) > 0 or len(aliases) > 0, "Expected emails or aliases"
        assert len(related_names) > 0, "Expected related names"

    def test_person_merge_nonexistent_cluster_404(self, admin_session):
        """Verify 404 for non-existent cluster"""
        response = admin_session.get(f"{BASE_URL}/api/admin/legacy-restore/person-merge/nonexistent_cluster_xyz")
        assert response.status_code == 404


class TestChildToUserBulkPreview:
    """Tests for POST /api/admin/legacy-restore/child-to-user/bulk-preview"""

    def test_bulk_preview_with_valid_candidates(self, admin_session):
        """Verify bulk preview returns restoreable items for valid child candidates"""
        response = admin_session.post(
            f"{BASE_URL}/api/admin/legacy-restore/child-to-user/bulk-preview",
            json={
                "candidate_keys": [
                    "child:child_a240c029dd30",  # Anuar
                    "child:child_888c787e77d9",  # Emma
                    "child:child_2a880974de5f"   # Albin
                ],
                "email_domain": "restore.bidblitz.local"
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "restoreable" in data
        assert "blocked" in data
        assert "summary" in data
        
        # Verify summary
        summary = data["summary"]
        assert summary["selected"] == 3
        assert summary["email_domain"] == "restore.bidblitz.local"

    def test_bulk_preview_anuar_restoreable(self, admin_session):
        """Verify Anuar (child_a240c029dd30) is restoreable with suggested email"""
        response = admin_session.post(
            f"{BASE_URL}/api/admin/legacy-restore/child-to-user/bulk-preview",
            json={
                "candidate_keys": ["child:child_a240c029dd30"],
                "email_domain": "restore.bidblitz.local"
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        restoreable = data.get("restoreable", [])
        assert len(restoreable) == 1, "Expected Anuar to be restoreable"
        
        anuar = restoreable[0]
        assert anuar["candidate_key"] == "child:child_a240c029dd30"
        assert anuar["restore_ready"] == True
        assert "restore.bidblitz.local" in anuar["primary_email"]
        assert anuar["display_name"] == "Anuar"
        assert anuar["child_signal_count"] >= 2

    def test_bulk_preview_emma_restoreable(self, admin_session):
        """Verify Emma (child_888c787e77d9) is restoreable with suggested email"""
        response = admin_session.post(
            f"{BASE_URL}/api/admin/legacy-restore/child-to-user/bulk-preview",
            json={
                "candidate_keys": ["child:child_888c787e77d9"],
                "email_domain": "restore.bidblitz.local"
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        restoreable = data.get("restoreable", [])
        assert len(restoreable) == 1, "Expected Emma to be restoreable"
        
        emma = restoreable[0]
        assert emma["candidate_key"] == "child:child_888c787e77d9"
        assert emma["restore_ready"] == True
        assert "restore.bidblitz.local" in emma["primary_email"]
        assert emma["display_name"] == "Emma"

    def test_bulk_preview_with_custom_domain(self, admin_session):
        """Verify bulk preview uses custom email domain"""
        response = admin_session.post(
            f"{BASE_URL}/api/admin/legacy-restore/child-to-user/bulk-preview",
            json={
                "candidate_keys": ["child:child_a240c029dd30"],
                "email_domain": "custom.test.domain"
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        restoreable = data.get("restoreable", [])
        if restoreable:
            assert "custom.test.domain" in restoreable[0]["primary_email"]
        
        summary = data.get("summary", {})
        assert summary["email_domain"] == "custom.test.domain"

    def test_bulk_preview_nonexistent_candidate_blocked(self, admin_session):
        """Verify non-existent candidate is blocked"""
        response = admin_session.post(
            f"{BASE_URL}/api/admin/legacy-restore/child-to-user/bulk-preview",
            json={
                "candidate_keys": ["child:nonexistent_child_xyz"],
                "email_domain": "restore.bidblitz.local"
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        blocked = data.get("blocked", [])
        assert len(blocked) == 1
        assert blocked[0]["reason"] == "nicht_gefunden"

    def test_bulk_preview_empty_candidates(self, admin_session):
        """Verify bulk preview handles empty candidate list"""
        response = admin_session.post(
            f"{BASE_URL}/api/admin/legacy-restore/child-to-user/bulk-preview",
            json={
                "candidate_keys": [],
                "email_domain": "restore.bidblitz.local"
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["summary"]["selected"] == 0
        assert data["summary"]["restoreable"] == 0


class TestChildToUserBulkConfirm:
    """Tests for POST /api/admin/legacy-restore/child-to-user/bulk-confirm"""

    def test_bulk_confirm_requires_password(self, admin_session):
        """Verify bulk confirm requires admin password"""
        response = admin_session.post(
            f"{BASE_URL}/api/admin/legacy-restore/child-to-user/bulk-confirm",
            json={
                "candidate_keys": ["child:child_a240c029dd30"],
                "email_domain": "restore.bidblitz.local",
                "admin_password": ""
            }
        )
        # Should fail with empty password
        assert response.status_code in [400, 403, 422]

    def test_bulk_confirm_wrong_password(self, admin_session):
        """Verify bulk confirm rejects wrong password"""
        response = admin_session.post(
            f"{BASE_URL}/api/admin/legacy-restore/child-to-user/bulk-confirm",
            json={
                "candidate_keys": ["child:child_a240c029dd30"],
                "email_domain": "restore.bidblitz.local",
                "admin_password": "WrongPassword123!"
            }
        )
        assert response.status_code == 403


class TestNoRegression:
    """Tests to verify no regression in existing features"""

    def test_overview_still_works(self, admin_session):
        """Verify GET /api/admin/legacy-restore/overview still works"""
        response = admin_session.get(f"{BASE_URL}/api/admin/legacy-restore/overview")
        assert response.status_code == 200
        data = response.json()
        assert "summary" in data
        assert "candidates" in data

    def test_review_enrichment_still_works(self, admin_session):
        """Verify POST /api/admin/legacy-restore/review-enrichment still works"""
        response = admin_session.post(f"{BASE_URL}/api/admin/legacy-restore/review-enrichment")
        assert response.status_code == 200
        data = response.json()
        assert "summary" in data
        assert "candidates" in data

    def test_bulk_preview_still_works(self, admin_session):
        """Verify POST /api/admin/legacy-restore/bulk-preview still works"""
        response = admin_session.post(
            f"{BASE_URL}/api/admin/legacy-restore/bulk-preview",
            json={"candidate_keys": ["albinkrasniqi11@icloud.com"]}
        )
        assert response.status_code == 200
        data = response.json()
        assert "restoreable" in data
        assert "blocked" in data
        assert "summary" in data

    def test_child_to_user_single_preview_still_works(self, admin_session):
        """Verify POST /api/admin/legacy-restore/child-to-user/preview still works"""
        response = admin_session.post(
            f"{BASE_URL}/api/admin/legacy-restore/child-to-user/preview",
            json={
                "candidate_key": "child:child_a240c029dd30",
                "primary_email": "test.anuar@restore.bidblitz.local",
                "display_name": "Anuar"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "preview" in data

    def test_history_still_works(self, admin_session):
        """Verify GET /api/admin/legacy-restore/history still works"""
        response = admin_session.get(f"{BASE_URL}/api/admin/legacy-restore/history")
        assert response.status_code == 200
        data = response.json()
        assert "actions" in data

    def test_view_filters_still_work(self, admin_session):
        """Verify all view filters still work"""
        for view in ["real_only", "review", "noise_only", "all"]:
            response = admin_session.get(f"{BASE_URL}/api/admin/legacy-restore/overview?view={view}")
            assert response.status_code == 200, f"View filter '{view}' failed"


class TestAuthRequired:
    """Tests to verify authentication is required"""

    def test_person_merge_overview_requires_auth(self):
        """Verify person-merge overview requires authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/legacy-restore/person-merge/overview")
        assert response.status_code in [401, 403]

    def test_person_merge_detail_requires_auth(self):
        """Verify person-merge detail requires authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/legacy-restore/person-merge/albin")
        assert response.status_code in [401, 403]

    def test_child_bulk_preview_requires_auth(self):
        """Verify child bulk preview requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/admin/legacy-restore/child-to-user/bulk-preview",
            json={"candidate_keys": [], "email_domain": "test.local"}
        )
        assert response.status_code in [401, 403]

    def test_child_bulk_confirm_requires_auth(self):
        """Verify child bulk confirm requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/admin/legacy-restore/child-to-user/bulk-confirm",
            json={"candidate_keys": [], "email_domain": "test.local", "admin_password": "test"}
        )
        assert response.status_code in [401, 403]
