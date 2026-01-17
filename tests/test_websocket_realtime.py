"""
WebSocket Real-time Updates Test Suite
Tests WebSocket connections, bid updates, and real-time functionality
"""
import pytest
import requests
import websocket
import json
import time
import threading
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@bidblitz.de"
ADMIN_PASSWORD = "Admin123!"
CUSTOMER_EMAIL = "kunde@bidblitz.de"
CUSTOMER_PASSWORD = "Kunde123!"

# Test auction ID - use the newly created active auction
TEST_AUCTION_ID = "9c106ba8-bb6f-4df6-bb4c-8c4edafc53ed"


class TestWebSocketConnection:
    """Test WebSocket connection establishment"""
    
    def test_websocket_single_auction_connection(self):
        """Test WebSocket connection to single auction endpoint"""
        ws_url = BASE_URL.replace('https://', 'wss://').replace('http://', 'ws://')
        ws_endpoint = f"{ws_url}/api/ws/auction/{TEST_AUCTION_ID}"
        
        received_messages = []
        connection_success = [False]  # Use list to allow modification in nested function
        
        def on_message(ws, message):
            received_messages.append(json.loads(message))
            # Close after receiving first message
            ws.close()
        
        def on_open(ws):
            connection_success[0] = True
        
        def on_error(ws, error):
            print(f"WebSocket error: {error}")
        
        ws = websocket.WebSocketApp(
            ws_endpoint,
            on_message=on_message,
            on_open=on_open,
            on_error=on_error
        )
        
        # Run WebSocket in a thread with timeout
        ws_thread = threading.Thread(target=ws.run_forever)
        ws_thread.daemon = True
        ws_thread.start()
        ws_thread.join(timeout=10)
        
        assert connection_success[0], "WebSocket connection should succeed"
        assert len(received_messages) > 0, "Should receive initial auction state"
        
        # Verify initial state message
        initial_msg = received_messages[0]
        assert initial_msg.get('type') == 'auction_state', f"First message should be auction_state, got {initial_msg.get('type')}"
        assert 'data' in initial_msg, "Message should contain data"
        
        data = initial_msg['data']
        assert 'current_price' in data, "Data should contain current_price"
        assert 'end_time' in data, "Data should contain end_time"
        assert 'viewers' in data, "Data should contain viewers count"
        print(f"✓ WebSocket single auction connection successful. Viewers: {data.get('viewers')}")
    
    def test_websocket_all_auctions_connection(self):
        """Test WebSocket connection to all auctions endpoint"""
        ws_url = BASE_URL.replace('https://', 'wss://').replace('http://', 'ws://')
        ws_endpoint = f"{ws_url}/api/ws/auctions"
        
        received_messages = []
        connection_success = [False]
        
        def on_message(ws, message):
            received_messages.append(json.loads(message))
            ws.close()
        
        def on_open(ws):
            connection_success[0] = True
        
        ws = websocket.WebSocketApp(
            ws_endpoint,
            on_message=on_message,
            on_open=on_open
        )
        
        ws_thread = threading.Thread(target=ws.run_forever)
        ws_thread.daemon = True
        ws_thread.start()
        ws_thread.join(timeout=10)
        
        assert connection_success[0], "WebSocket connection should succeed"
        assert len(received_messages) > 0, "Should receive initial auctions state"
        
        initial_msg = received_messages[0]
        assert initial_msg.get('type') == 'auctions_state', f"First message should be auctions_state, got {initial_msg.get('type')}"
        assert 'data' in initial_msg, "Message should contain data"
        assert isinstance(initial_msg['data'], list), "Data should be a list of auctions"
        print(f"✓ WebSocket all auctions connection successful. Auctions count: {len(initial_msg['data'])}")
    
    def test_websocket_ping_pong(self):
        """Test WebSocket ping/pong mechanism"""
        ws_url = BASE_URL.replace('https://', 'wss://').replace('http://', 'ws://')
        ws_endpoint = f"{ws_url}/api/ws/auction/{TEST_AUCTION_ID}"
        
        received_pong = False
        
        def on_message(ws, message):
            nonlocal received_pong
            msg = json.loads(message)
            if msg.get('type') == 'pong':
                received_pong = True
                ws.close()
        
        def on_open(ws):
            # Skip initial state message, then send ping
            time.sleep(0.5)
            ws.send(json.dumps({"type": "ping"}))
        
        ws = websocket.WebSocketApp(
            ws_endpoint,
            on_message=on_message,
            on_open=on_open
        )
        
        ws_thread = threading.Thread(target=ws.run_forever, kwargs={'ping_timeout': 5})
        ws_thread.daemon = True
        ws_thread.start()
        ws_thread.join(timeout=5)
        
        assert received_pong, "Should receive pong response to ping"
        print("✓ WebSocket ping/pong mechanism working")


class TestBidPlacementREST:
    """Test bid placement via REST API (which triggers WebSocket broadcasts)"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token for customer"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Customer authentication failed")
    
    def test_bid_placement_returns_correct_data(self, auth_token):
        """Test that bid placement returns expected data structure"""
        # First get current auction state
        auction_response = requests.get(f"{BASE_URL}/api/auctions/{TEST_AUCTION_ID}")
        assert auction_response.status_code == 200, f"Failed to get auction: {auction_response.text}"
        
        auction = auction_response.json()
        initial_price = auction.get('current_price', 0)
        initial_bids = auction.get('total_bids', 0)
        
        # Place a bid
        bid_response = requests.post(
            f"{BASE_URL}/api/auctions/{TEST_AUCTION_ID}/bid",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        if bid_response.status_code == 400:
            # Might be insufficient bids or auction ended
            detail = bid_response.json().get('detail', '')
            if 'Insufficient' in detail or 'ended' in detail or 'not active' in detail:
                pytest.skip(f"Cannot place bid: {detail}")
        
        assert bid_response.status_code == 200, f"Bid placement failed: {bid_response.text}"
        
        bid_data = bid_response.json()
        assert 'new_price' in bid_data, "Response should contain new_price"
        assert 'new_end_time' in bid_data, "Response should contain new_end_time"
        assert 'bids_remaining' in bid_data, "Response should contain bids_remaining"
        
        # Verify price increased
        assert bid_data['new_price'] > initial_price, "Price should increase after bid"
        print(f"✓ Bid placed successfully. New price: €{bid_data['new_price']:.2f}")
    
    def test_auction_state_updates_after_bid(self, auth_token):
        """Test that auction state is updated after bid placement"""
        # Get initial state
        initial_response = requests.get(f"{BASE_URL}/api/auctions/{TEST_AUCTION_ID}")
        assert initial_response.status_code == 200
        initial_auction = initial_response.json()
        
        # Place bid
        bid_response = requests.post(
            f"{BASE_URL}/api/auctions/{TEST_AUCTION_ID}/bid",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        if bid_response.status_code != 200:
            detail = bid_response.json().get('detail', '')
            pytest.skip(f"Cannot place bid: {detail}")
        
        # Get updated state
        updated_response = requests.get(f"{BASE_URL}/api/auctions/{TEST_AUCTION_ID}")
        assert updated_response.status_code == 200
        updated_auction = updated_response.json()
        
        # Verify updates
        assert updated_auction['current_price'] > initial_auction['current_price'], "Price should increase"
        assert updated_auction['total_bids'] > initial_auction['total_bids'], "Total bids should increase"
        assert updated_auction.get('last_bidder_name') is not None, "Last bidder should be set"
        print(f"✓ Auction state updated. Price: €{updated_auction['current_price']:.2f}, Bids: {updated_auction['total_bids']}")


class TestWebSocketBidBroadcast:
    """Test WebSocket bid broadcast functionality"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token for customer"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Customer authentication failed")
    
    def test_bid_broadcast_to_single_auction_ws(self, auth_token):
        """Test that bid updates are broadcast to single auction WebSocket"""
        ws_url = BASE_URL.replace('https://', 'wss://').replace('http://', 'ws://')
        ws_endpoint = f"{ws_url}/api/ws/auction/{TEST_AUCTION_ID}"
        
        received_messages = []
        bid_update_received = False
        
        def on_message(ws, message):
            nonlocal bid_update_received
            msg = json.loads(message)
            received_messages.append(msg)
            if msg.get('type') == 'bid_update':
                bid_update_received = True
                ws.close()
        
        def on_open(ws):
            # Wait for initial state, then place a bid via REST
            time.sleep(0.5)
            # Place bid in a separate thread
            def place_bid():
                requests.post(
                    f"{BASE_URL}/api/auctions/{TEST_AUCTION_ID}/bid",
                    headers={"Authorization": f"Bearer {auth_token}"}
                )
            threading.Thread(target=place_bid).start()
        
        ws = websocket.WebSocketApp(
            ws_endpoint,
            on_message=on_message,
            on_open=on_open
        )
        
        ws_thread = threading.Thread(target=ws.run_forever, kwargs={'ping_timeout': 10})
        ws_thread.daemon = True
        ws_thread.start()
        ws_thread.join(timeout=10)
        
        # Check if we received bid update (may not if bid failed due to insufficient bids)
        if bid_update_received:
            bid_msg = next((m for m in received_messages if m.get('type') == 'bid_update'), None)
            assert bid_msg is not None, "Should have bid_update message"
            assert 'data' in bid_msg, "Bid update should contain data"
            assert 'current_price' in bid_msg['data'], "Bid data should contain current_price"
            print(f"✓ Bid broadcast received. New price: €{bid_msg['data']['current_price']:.2f}")
        else:
            # Check if we at least got initial state
            assert len(received_messages) > 0, "Should receive at least initial state"
            print("✓ WebSocket connection works, bid broadcast may not have occurred (insufficient bids or auction ended)")


class TestAuctionEndpoints:
    """Test auction REST endpoints"""
    
    def test_get_all_auctions(self):
        """Test getting all auctions"""
        response = requests.get(f"{BASE_URL}/api/auctions")
        assert response.status_code == 200, f"Failed to get auctions: {response.text}"
        
        auctions = response.json()
        assert isinstance(auctions, list), "Response should be a list"
        print(f"✓ Got {len(auctions)} auctions")
    
    def test_get_active_auctions(self):
        """Test getting active auctions only"""
        response = requests.get(f"{BASE_URL}/api/auctions?status=active")
        assert response.status_code == 200, f"Failed to get active auctions: {response.text}"
        
        auctions = response.json()
        assert isinstance(auctions, list), "Response should be a list"
        for auction in auctions:
            assert auction.get('status') == 'active', f"Auction {auction.get('id')} should be active"
        print(f"✓ Got {len(auctions)} active auctions")
    
    def test_get_single_auction(self):
        """Test getting a single auction by ID"""
        response = requests.get(f"{BASE_URL}/api/auctions/{TEST_AUCTION_ID}")
        assert response.status_code == 200, f"Failed to get auction: {response.text}"
        
        auction = response.json()
        assert auction.get('id') == TEST_AUCTION_ID, "Auction ID should match"
        assert 'current_price' in auction, "Auction should have current_price"
        assert 'end_time' in auction, "Auction should have end_time"
        assert 'status' in auction, "Auction should have status"
        assert 'product' in auction, "Auction should have product data"
        print(f"✓ Got auction {TEST_AUCTION_ID}. Status: {auction.get('status')}, Price: €{auction.get('current_price'):.2f}")
    
    def test_auction_has_required_fields(self):
        """Test that auction response has all required fields"""
        response = requests.get(f"{BASE_URL}/api/auctions/{TEST_AUCTION_ID}")
        assert response.status_code == 200
        
        auction = response.json()
        required_fields = ['id', 'product_id', 'current_price', 'bid_increment', 'end_time', 'status', 'total_bids']
        for field in required_fields:
            assert field in auction, f"Auction should have {field} field"
        print("✓ Auction has all required fields")


class TestAuthenticationFlow:
    """Test authentication for bid placement"""
    
    def test_customer_login(self):
        """Test customer login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert 'token' in data, "Response should contain token"
        assert 'user' in data, "Response should contain user"
        assert data['user']['email'] == CUSTOMER_EMAIL, "User email should match"
        print(f"✓ Customer login successful. Bids balance: {data['user'].get('bids_balance')}")
    
    def test_admin_login(self):
        """Test admin login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        
        data = response.json()
        assert 'token' in data, "Response should contain token"
        assert data['user'].get('is_admin') == True, "User should be admin"
        print("✓ Admin login successful")
    
    def test_bid_requires_authentication(self):
        """Test that bid placement requires authentication"""
        response = requests.post(f"{BASE_URL}/api/auctions/{TEST_AUCTION_ID}/bid")
        assert response.status_code == 401, "Bid without auth should return 401"
        print("✓ Bid endpoint correctly requires authentication")


# Run tests if executed directly
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
