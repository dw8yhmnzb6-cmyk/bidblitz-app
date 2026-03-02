"""
Support API Tests
Tests for support settings, tickets, and chat endpoints
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://allinone-platform-2.preview.emergentagent.com')

class TestSupportSettings:
    """Test support settings endpoints"""
    
    def test_get_support_settings(self):
        """Test GET /api/support/settings - public endpoint"""
        response = requests.get(f"{BASE_URL}/api/support/settings")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "hotline" in data
        assert "email" in data
        assert "chat_enabled" in data
        assert "ticket_enabled" in data
        
        # Verify data types
        assert isinstance(data["hotline"], str)
        assert isinstance(data["email"], str)
        assert isinstance(data["chat_enabled"], bool)
        assert isinstance(data["ticket_enabled"], bool)
        
        print(f"✅ Support settings: hotline={data['hotline']}, email={data['email']}")


class TestSupportTicketsUnauthenticated:
    """Test ticket endpoints without authentication"""
    
    def test_get_tickets_requires_auth(self):
        """Test GET /api/support/tickets requires authentication"""
        response = requests.get(f"{BASE_URL}/api/support/tickets")
        
        # Should return 401 or 403 without auth
        assert response.status_code in [401, 403, 422]
        print("✅ Tickets endpoint requires authentication")
    
    def test_create_ticket_requires_auth(self):
        """Test POST /api/support/tickets requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/support/tickets",
            json={"subject": "Test", "message": "Test message"}
        )
        
        # Should return 401 or 403 without auth
        assert response.status_code in [401, 403, 422]
        print("✅ Create ticket endpoint requires authentication")


class TestSupportChatUnauthenticated:
    """Test chat endpoints without authentication"""
    
    def test_get_chat_messages_requires_auth(self):
        """Test GET /api/support/chat/messages requires authentication"""
        response = requests.get(f"{BASE_URL}/api/support/chat/messages")
        
        # Should return 401 or 403 without auth
        assert response.status_code in [401, 403, 422]
        print("✅ Chat messages endpoint requires authentication")
    
    def test_send_chat_message_requires_auth(self):
        """Test POST /api/support/chat/message requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/support/chat/message",
            json={"message": "Test message"}
        )
        
        # Should return 401 or 403 without auth
        assert response.status_code in [401, 403, 422]
        print("✅ Send chat message endpoint requires authentication")


class TestAdminSupportEndpoints:
    """Test admin support endpoints"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@bidblitz.ae", "password": "Admin123!"}
        )
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Admin authentication failed")
    
    def test_admin_get_tickets(self, admin_token):
        """Test GET /api/support/admin/tickets"""
        response = requests.get(
            f"{BASE_URL}/api/support/admin/tickets",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "tickets" in data
        assert "stats" in data
        assert isinstance(data["tickets"], list)
        
        # Verify stats structure
        stats = data["stats"]
        assert "total" in stats
        assert "open" in stats
        assert "in_progress" in stats
        assert "resolved" in stats
        
        print(f"✅ Admin tickets: total={stats['total']}, open={stats['open']}")
    
    def test_admin_get_chats(self, admin_token):
        """Test GET /api/support/admin/chats"""
        response = requests.get(
            f"{BASE_URL}/api/support/admin/chats",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "chats" in data
        assert isinstance(data["chats"], list)
        
        print(f"✅ Admin chats: count={len(data['chats'])}")
    
    def test_admin_update_settings(self, admin_token):
        """Test PUT /api/support/settings (admin only)"""
        # First get current settings
        current = requests.get(f"{BASE_URL}/api/support/settings").json()
        
        # Update settings
        response = requests.put(
            f"{BASE_URL}/api/support/settings",
            json={
                "hotline": current.get("hotline", "+49 123 456789"),
                "email": current.get("email", "support@bidblitz.ae")
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        
        print("✅ Admin can update support settings")


class TestSupportTicketsAuthenticated:
    """Test ticket endpoints with customer authentication"""
    
    @pytest.fixture
    def customer_token(self):
        """Get customer authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "kunde@bidblitz.ae", "password": "Kunde123!"}
        )
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Customer authentication failed")
    
    def test_customer_get_tickets(self, customer_token):
        """Test GET /api/support/tickets for authenticated customer"""
        response = requests.get(
            f"{BASE_URL}/api/support/tickets",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "tickets" in data
        assert isinstance(data["tickets"], list)
        
        print(f"✅ Customer tickets: count={len(data['tickets'])}")
    
    def test_customer_create_ticket(self, customer_token):
        """Test POST /api/support/tickets for authenticated customer"""
        response = requests.post(
            f"{BASE_URL}/api/support/tickets",
            json={
                "subject": "TEST_Automated Test Ticket",
                "message": "This is an automated test ticket",
                "category": "technical"
            },
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "message" in data
        assert "ticket_id" in data
        assert "ticket" in data
        
        ticket = data["ticket"]
        assert ticket["subject"] == "TEST_Automated Test Ticket"
        assert ticket["status"] == "open"
        
        print(f"✅ Customer created ticket: id={data['ticket_id']}")
        
        return data["ticket_id"]
    
    def test_customer_get_chat_messages(self, customer_token):
        """Test GET /api/support/chat/messages for authenticated customer"""
        response = requests.get(
            f"{BASE_URL}/api/support/chat/messages",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "messages" in data
        assert isinstance(data["messages"], list)
        
        print(f"✅ Customer chat messages: count={len(data['messages'])}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
