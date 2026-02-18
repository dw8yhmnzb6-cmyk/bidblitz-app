"""
Test Partner Referral System and Staff Login Cards
- Partner Referral: GET /api/partner-referral/my-code, /stats, /leaderboard, POST /apply
- Staff Cards: GET /api/staff-cards/preview/{staff_id}, /single/{staff_id}, /all, /admin/all-partners
- Staff Cards: POST /api/staff-cards/a4-sheet
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@bidblitz.ae"
ADMIN_PASSWORD = "Admin123!"


class TestSetup:
    """Setup fixtures and helper methods"""
    
    @pytest.fixture(scope="class")
    def api_client(self):
        """Shared requests session"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        return session
    
    @pytest.fixture(scope="class")
    def admin_token(self, api_client):
        """Get admin authentication token"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            data = response.json()
            return data.get("token") or data.get("auth_token")
        pytest.skip(f"Admin authentication failed: {response.status_code}")
    
    @pytest.fixture(scope="class")
    def partner_token(self, api_client):
        """Get or create a partner token for testing"""
        # First try to find existing partner
        response = api_client.get(f"{BASE_URL}/api/partner-portal/list")
        if response.status_code == 200:
            partners = response.json().get("partners", [])
            for partner in partners:
                if partner.get("auth_token"):
                    return partner["auth_token"]
        
        # Try partner login
        response = api_client.post(f"{BASE_URL}/api/partner-portal/login", json={
            "email": "partner@test.de",
            "password": "Partner123!"
        })
        if response.status_code == 200:
            data = response.json()
            return data.get("token") or data.get("auth_token")
        
        # Create test partner if none exists
        test_partner_id = str(uuid.uuid4())
        test_token = f"test_token_{uuid.uuid4().hex[:16]}"
        
        # Try to create via admin endpoint or direct DB
        response = api_client.post(f"{BASE_URL}/api/partner-portal/register", json={
            "name": "Test Partner Referral",
            "email": f"test_partner_{uuid.uuid4().hex[:8]}@test.de",
            "password": "TestPartner123!",
            "business_name": "Test Business",
            "business_type": "restaurant"
        })
        if response.status_code in [200, 201]:
            data = response.json()
            return data.get("token") or data.get("auth_token")
        
        pytest.skip("Could not get or create partner token")
    
    @pytest.fixture(scope="class")
    def staff_id(self, api_client, partner_token):
        """Get or create a staff member for testing"""
        # Get existing staff
        response = api_client.get(f"{BASE_URL}/api/partner-portal/staff?token={partner_token}")
        if response.status_code == 200:
            staff_list = response.json().get("staff", [])
            if staff_list:
                return staff_list[0].get("id")
        
        # Create test staff
        response = api_client.post(
            f"{BASE_URL}/api/partner-portal/staff/create?token={partner_token}",
            json={
                "name": "Test Staff Member",
                "password": "TestStaff123!",
                "role": "counter"
            }
        )
        if response.status_code in [200, 201]:
            data = response.json()
            return data.get("id") or data.get("staff_id")
        
        pytest.skip("Could not get or create staff member")


class TestPartnerReferralMyCode(TestSetup):
    """Test GET /api/partner-referral/my-code endpoint"""
    
    def test_get_referral_code_success(self, api_client, partner_token):
        """Test getting partner's referral code"""
        response = api_client.get(f"{BASE_URL}/api/partner-referral/my-code?token={partner_token}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "code" in data, "Response should contain 'code'"
        assert "link" in data, "Response should contain 'link'"
        assert "total_referrals" in data, "Response should contain 'total_referrals'"
        
        # Validate code format (starts with P)
        assert data["code"].startswith("P"), f"Referral code should start with 'P', got: {data['code']}"
        
        # Validate link format
        assert "bidblitz.ae" in data["link"], "Link should contain bidblitz.ae"
        assert data["code"] in data["link"], "Link should contain the referral code"
        
        print(f"✓ Partner referral code: {data['code']}")
        print(f"✓ Referral link: {data['link']}")
        print(f"✓ Total referrals: {data['total_referrals']}")
    
    def test_get_referral_code_invalid_token(self, api_client):
        """Test with invalid token returns 401"""
        response = api_client.get(f"{BASE_URL}/api/partner-referral/my-code?token=invalid_token_123")
        
        assert response.status_code == 401, f"Expected 401 for invalid token, got {response.status_code}"
        print("✓ Invalid token correctly returns 401")


class TestPartnerReferralStats(TestSetup):
    """Test GET /api/partner-referral/stats endpoint"""
    
    def test_get_referral_stats_success(self, api_client, partner_token):
        """Test getting partner's referral statistics"""
        response = api_client.get(f"{BASE_URL}/api/partner-referral/stats?token={partner_token}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "total_referrals" in data, "Response should contain 'total_referrals'"
        assert "successful_referrals" in data, "Response should contain 'successful_referrals'"
        assert "pending_referrals" in data, "Response should contain 'pending_referrals'"
        assert "total_earned" in data, "Response should contain 'total_earned'"
        assert "pending_bonus" in data, "Response should contain 'pending_bonus'"
        assert "referrals" in data, "Response should contain 'referrals' list"
        
        # Validate types
        assert isinstance(data["total_referrals"], int), "total_referrals should be int"
        assert isinstance(data["referrals"], list), "referrals should be a list"
        
        print(f"✓ Total referrals: {data['total_referrals']}")
        print(f"✓ Successful: {data['successful_referrals']}, Pending: {data['pending_referrals']}")
        print(f"✓ Total earned: €{data['total_earned']}, Pending bonus: €{data['pending_bonus']}")
    
    def test_get_referral_stats_invalid_token(self, api_client):
        """Test with invalid token returns 401"""
        response = api_client.get(f"{BASE_URL}/api/partner-referral/stats?token=invalid_token_123")
        
        assert response.status_code == 401, f"Expected 401 for invalid token, got {response.status_code}"
        print("✓ Invalid token correctly returns 401")


class TestPartnerReferralLeaderboard(TestSetup):
    """Test GET /api/partner-referral/leaderboard endpoint"""
    
    def test_get_leaderboard_success(self, api_client):
        """Test getting referral leaderboard (public endpoint)"""
        response = api_client.get(f"{BASE_URL}/api/partner-referral/leaderboard")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "leaderboard" in data, "Response should contain 'leaderboard'"
        assert isinstance(data["leaderboard"], list), "leaderboard should be a list"
        
        # If there are entries, validate structure
        if data["leaderboard"]:
            entry = data["leaderboard"][0]
            assert "rank" in entry, "Entry should have 'rank'"
            assert "partner_name" in entry, "Entry should have 'partner_name'"
            assert "total_referrals" in entry, "Entry should have 'total_referrals'"
            print(f"✓ Top partner: {entry['partner_name']} with {entry['total_referrals']} referrals")
        else:
            print("✓ Leaderboard is empty (no completed referrals yet)")
        
        print(f"✓ Leaderboard entries: {len(data['leaderboard'])}")


class TestPartnerReferralApply(TestSetup):
    """Test POST /api/partner-referral/apply endpoint"""
    
    def test_apply_invalid_code(self, api_client):
        """Test applying invalid referral code returns 404"""
        response = api_client.post(
            f"{BASE_URL}/api/partner-referral/apply?code=INVALID123&new_partner_id={uuid.uuid4()}"
        )
        
        assert response.status_code == 404, f"Expected 404 for invalid code, got {response.status_code}"
        print("✓ Invalid referral code correctly returns 404")
    
    def test_apply_invalid_partner(self, api_client, partner_token):
        """Test applying code with invalid partner ID returns 404"""
        # First get a valid referral code
        code_response = api_client.get(f"{BASE_URL}/api/partner-referral/my-code?token={partner_token}")
        if code_response.status_code != 200:
            pytest.skip("Could not get referral code")
        
        code = code_response.json().get("code")
        
        response = api_client.post(
            f"{BASE_URL}/api/partner-referral/apply?code={code}&new_partner_id=invalid_partner_id"
        )
        
        assert response.status_code == 404, f"Expected 404 for invalid partner, got {response.status_code}"
        print("✓ Invalid partner ID correctly returns 404")


class TestStaffCardsPreview(TestSetup):
    """Test GET /api/staff-cards/preview/{staff_id} endpoint"""
    
    def test_preview_staff_card_success(self, api_client, partner_token, staff_id):
        """Test previewing a staff card"""
        response = api_client.get(
            f"{BASE_URL}/api/staff-cards/preview/{staff_id}?token={partner_token}"
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "staff_id" in data, "Response should contain 'staff_id'"
        assert "staff_name" in data, "Response should contain 'staff_name'"
        assert "card_html" in data, "Response should contain 'card_html'"
        assert "qr_data" in data, "Response should contain 'qr_data'"
        
        # Validate HTML contains QR code
        assert "data:image/png;base64" in data["card_html"], "Card HTML should contain QR code image"
        
        print(f"✓ Staff card preview for: {data['staff_name']}")
        print(f"✓ Staff number: {data.get('staff_number', 'N/A')}")
        print(f"✓ QR data URL: {data['qr_data'][:50]}...")
    
    def test_preview_invalid_staff(self, api_client, partner_token):
        """Test preview with invalid staff ID returns 404"""
        response = api_client.get(
            f"{BASE_URL}/api/staff-cards/preview/invalid_staff_id?token={partner_token}"
        )
        
        assert response.status_code == 404, f"Expected 404 for invalid staff, got {response.status_code}"
        print("✓ Invalid staff ID correctly returns 404")
    
    def test_preview_invalid_token(self, api_client, staff_id):
        """Test preview with invalid token returns 401"""
        response = api_client.get(
            f"{BASE_URL}/api/staff-cards/preview/{staff_id}?token=invalid_token"
        )
        
        assert response.status_code == 401, f"Expected 401 for invalid token, got {response.status_code}"
        print("✓ Invalid token correctly returns 401")


class TestStaffCardsSingle(TestSetup):
    """Test GET /api/staff-cards/single/{staff_id} endpoint"""
    
    def test_get_single_card_success(self, api_client, partner_token, staff_id):
        """Test getting a single printable staff card (HTML)"""
        response = api_client.get(
            f"{BASE_URL}/api/staff-cards/single/{staff_id}?token={partner_token}"
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        # Should return HTML content
        content_type = response.headers.get("content-type", "")
        assert "text/html" in content_type, f"Expected text/html, got {content_type}"
        
        html_content = response.text
        assert "<!DOCTYPE html>" in html_content, "Response should be valid HTML"
        assert "Mitarbeiterkarte" in html_content, "HTML should contain 'Mitarbeiterkarte'"
        assert "data:image/png;base64" in html_content, "HTML should contain QR code"
        assert "window.print()" in html_content, "HTML should have print button"
        
        print("✓ Single staff card HTML generated successfully")
        print(f"✓ HTML length: {len(html_content)} characters")
    
    def test_single_card_invalid_staff(self, api_client, partner_token):
        """Test single card with invalid staff ID returns 404"""
        response = api_client.get(
            f"{BASE_URL}/api/staff-cards/single/invalid_staff_id?token={partner_token}"
        )
        
        assert response.status_code == 404, f"Expected 404 for invalid staff, got {response.status_code}"
        print("✓ Invalid staff ID correctly returns 404")


class TestStaffCardsA4Sheet(TestSetup):
    """Test POST /api/staff-cards/a4-sheet endpoint"""
    
    def test_a4_sheet_success(self, api_client, partner_token, staff_id):
        """Test generating A4 sheet with multiple staff cards"""
        response = api_client.post(
            f"{BASE_URL}/api/staff-cards/a4-sheet?token={partner_token}",
            json={"staff_ids": [staff_id]}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        # Should return HTML content
        content_type = response.headers.get("content-type", "")
        assert "text/html" in content_type, f"Expected text/html, got {content_type}"
        
        html_content = response.text
        assert "<!DOCTYPE html>" in html_content, "Response should be valid HTML"
        assert "Mitarbeiterkarten" in html_content, "HTML should contain 'Mitarbeiterkarten'"
        assert "A4" in html_content, "HTML should reference A4 format"
        assert "data:image/png;base64" in html_content, "HTML should contain QR code"
        
        print("✓ A4 sheet HTML generated successfully")
        print(f"✓ HTML length: {len(html_content)} characters")
    
    def test_a4_sheet_empty_list(self, api_client, partner_token):
        """Test A4 sheet with empty staff list"""
        response = api_client.post(
            f"{BASE_URL}/api/staff-cards/a4-sheet?token={partner_token}",
            json={"staff_ids": []}
        )
        
        # Should return 404 or 422 for empty list
        assert response.status_code in [404, 422], f"Expected 404/422 for empty list, got {response.status_code}"
        print("✓ Empty staff list correctly handled")
    
    def test_a4_sheet_invalid_staff(self, api_client, partner_token):
        """Test A4 sheet with invalid staff IDs returns 404"""
        response = api_client.post(
            f"{BASE_URL}/api/staff-cards/a4-sheet?token={partner_token}",
            json={"staff_ids": ["invalid_id_1", "invalid_id_2"]}
        )
        
        assert response.status_code == 404, f"Expected 404 for invalid staff IDs, got {response.status_code}"
        print("✓ Invalid staff IDs correctly returns 404")
    
    def test_a4_sheet_too_many_staff(self, api_client, partner_token):
        """Test A4 sheet with more than 20 staff returns 400"""
        # Generate 21 fake IDs
        fake_ids = [str(uuid.uuid4()) for _ in range(21)]
        
        response = api_client.post(
            f"{BASE_URL}/api/staff-cards/a4-sheet?token={partner_token}",
            json={"staff_ids": fake_ids}
        )
        
        assert response.status_code == 400, f"Expected 400 for >20 staff, got {response.status_code}"
        print("✓ More than 20 staff correctly returns 400")


class TestStaffCardsAll(TestSetup):
    """Test GET /api/staff-cards/all endpoint"""
    
    def test_get_all_cards_success(self, api_client, partner_token):
        """Test getting all staff cards for a partner"""
        response = api_client.get(f"{BASE_URL}/api/staff-cards/all?token={partner_token}")
        
        # Could be 200 (has staff) or 404 (no active staff)
        assert response.status_code in [200, 404], f"Expected 200 or 404, got {response.status_code}"
        
        if response.status_code == 200:
            content_type = response.headers.get("content-type", "")
            assert "text/html" in content_type, f"Expected text/html, got {content_type}"
            
            html_content = response.text
            assert "Mitarbeiterkarten" in html_content, "HTML should contain 'Mitarbeiterkarten'"
            print("✓ All staff cards HTML generated successfully")
        else:
            print("✓ No active staff found (404 is expected)")
    
    def test_get_all_cards_invalid_token(self, api_client):
        """Test get all cards with invalid token returns 401"""
        response = api_client.get(f"{BASE_URL}/api/staff-cards/all?token=invalid_token")
        
        assert response.status_code == 401, f"Expected 401 for invalid token, got {response.status_code}"
        print("✓ Invalid token correctly returns 401")


class TestStaffCardsAdminAllPartners(TestSetup):
    """Test GET /api/staff-cards/admin/all-partners endpoint"""
    
    def test_admin_all_partners_success(self, api_client, admin_token):
        """Test admin getting all staff cards from all partners"""
        response = api_client.get(
            f"{BASE_URL}/api/staff-cards/admin/all-partners",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        # Could be 200 (has staff) or 404 (no staff)
        assert response.status_code in [200, 404], f"Expected 200 or 404, got {response.status_code}"
        
        if response.status_code == 200:
            content_type = response.headers.get("content-type", "")
            assert "text/html" in content_type, f"Expected text/html, got {content_type}"
            
            html_content = response.text
            assert "Admin-Ansicht" in html_content, "HTML should contain 'Admin-Ansicht'"
            print("✓ Admin all partners cards HTML generated successfully")
        else:
            print("✓ No staff found across all partners (404 is expected)")
    
    def test_admin_all_partners_no_auth(self, api_client):
        """Test admin endpoint without auth returns 401/403"""
        response = api_client.get(f"{BASE_URL}/api/staff-cards/admin/all-partners")
        
        assert response.status_code in [401, 403, 422], f"Expected 401/403/422 without auth, got {response.status_code}"
        print("✓ Admin endpoint correctly requires authentication")


class TestIntegration(TestSetup):
    """Integration tests for Partner Referral and Staff Cards"""
    
    def test_referral_code_persistence(self, api_client, partner_token):
        """Test that referral code is persisted and returned consistently"""
        # Get code first time
        response1 = api_client.get(f"{BASE_URL}/api/partner-referral/my-code?token={partner_token}")
        assert response1.status_code == 200
        code1 = response1.json().get("code")
        
        # Get code second time
        response2 = api_client.get(f"{BASE_URL}/api/partner-referral/my-code?token={partner_token}")
        assert response2.status_code == 200
        code2 = response2.json().get("code")
        
        # Should be the same code
        assert code1 == code2, f"Referral code should be persistent: {code1} != {code2}"
        print(f"✓ Referral code is persistent: {code1}")
    
    def test_staff_card_qr_contains_correct_data(self, api_client, partner_token, staff_id):
        """Test that staff card QR code contains correct login URL"""
        response = api_client.get(
            f"{BASE_URL}/api/staff-cards/preview/{staff_id}?token={partner_token}"
        )
        
        if response.status_code == 200:
            data = response.json()
            qr_data = data.get("qr_data", "")
            
            assert "bidblitz.ae" in qr_data, "QR data should contain bidblitz.ae"
            assert "staff-login" in qr_data, "QR data should contain staff-login"
            
            print(f"✓ QR code contains correct login URL: {qr_data}")
        else:
            pytest.skip(f"Could not get staff card preview: {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
