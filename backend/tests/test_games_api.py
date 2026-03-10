"""
Test suite for BidBlitz Gaming Platform API
Tests: Games CRUD, Categories, Score submission, Leaderboard
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestGamesAPI:
    """Test games listing and retrieval endpoints"""
    
    def test_get_all_games(self):
        """GET /api/games - should return list of games"""
        response = requests.get(f"{BASE_URL}/api/games")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        
        # Verify game structure
        game = data[0]
        assert "id" in game
        assert "name" in game
        assert "slug" in game
        assert "category" in game
        assert "max_reward" in game
        print(f"PASS: Retrieved {len(data)} games")
    
    def test_get_games_by_category_puzzle(self):
        """GET /api/games?category=puzzle - filter by puzzle category"""
        response = requests.get(f"{BASE_URL}/api/games?category=puzzle")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        # All games should be puzzle category
        for game in data:
            assert game["category"] == "puzzle"
        print(f"PASS: Retrieved {len(data)} puzzle games")
    
    def test_get_games_by_category_arcade(self):
        """GET /api/games?category=arcade - filter by arcade category"""
        response = requests.get(f"{BASE_URL}/api/games?category=arcade")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        for game in data:
            assert game["category"] == "arcade"
        print(f"PASS: Retrieved {len(data)} arcade games")
    
    def test_get_games_by_category_3d(self):
        """GET /api/games?category=3d - filter by 3D category"""
        response = requests.get(f"{BASE_URL}/api/games?category=3d")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        for game in data:
            assert game["category"] == "3d"
        print(f"PASS: Retrieved {len(data)} 3D games")


class TestCategoriesAPI:
    """Test categories endpoint"""
    
    def test_get_categories(self):
        """GET /api/games/categories - should return category counts"""
        response = requests.get(f"{BASE_URL}/api/games/categories")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 5  # puzzle, strategy, tycoon, arcade, 3d
        
        # Verify structure
        category_names = [cat["name"] for cat in data]
        assert "puzzle" in category_names
        assert "arcade" in category_names
        assert "tycoon" in category_names
        assert "strategy" in category_names
        assert "3d" in category_names
        
        # Each category should have count
        for cat in data:
            assert "name" in cat
            assert "count" in cat
            assert isinstance(cat["count"], int)
        print(f"PASS: Retrieved {len(data)} categories with counts")


class TestScoreSubmission:
    """Test score submission endpoint"""
    
    def test_submit_score_success(self):
        """POST /api/games/score - submit score and get reward"""
        # First get a valid game ID
        games_response = requests.get(f"{BASE_URL}/api/games")
        games = games_response.json()
        game_id = games[0]["id"]
        
        # Submit score
        test_user_id = f"TEST_user_{uuid.uuid4().hex[:8]}"
        score_data = {
            "user_id": test_user_id,
            "game_id": game_id,
            "score": 150
        }
        
        response = requests.post(
            f"{BASE_URL}/api/games/score",
            json=score_data
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "score" in data
        assert "reward" in data
        assert "message" in data
        assert data["score"] == 150
        assert data["reward"] >= 0
        print(f"PASS: Score submitted, earned {data['reward']} coins")
    
    def test_submit_score_by_slug(self):
        """POST /api/games/score - submit score using game slug"""
        test_user_id = f"TEST_user_{uuid.uuid4().hex[:8]}"
        score_data = {
            "user_id": test_user_id,
            "game_id": "candy-match",  # Using slug instead of ID
            "score": 200
        }
        
        response = requests.post(
            f"{BASE_URL}/api/games/score",
            json=score_data
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["score"] == 200
        print(f"PASS: Score submitted by slug, earned {data['reward']} coins")
    
    def test_submit_score_invalid_game(self):
        """POST /api/games/score - should fail for invalid game"""
        score_data = {
            "user_id": "test_user",
            "game_id": "invalid_game_id_12345",
            "score": 100
        }
        
        response = requests.post(
            f"{BASE_URL}/api/games/score",
            json=score_data
        )
        assert response.status_code == 404
        print("PASS: Invalid game returns 404")


class TestLeaderboard:
    """Test leaderboard endpoints"""
    
    def test_get_global_leaderboard(self):
        """GET /api/games/leaderboard/global/top - get global leaderboard"""
        response = requests.get(f"{BASE_URL}/api/games/leaderboard/global/top?limit=10")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        # Verify structure if there are entries
        if len(data) > 0:
            entry = data[0]
            assert "rank" in entry
            assert "user_id" in entry
            assert "user_name" in entry
            assert "total_score" in entry
            assert "total_plays" in entry
            
            # Verify ranking order
            for i, entry in enumerate(data):
                assert entry["rank"] == i + 1
        print(f"PASS: Retrieved {len(data)} leaderboard entries")
    
    def test_get_game_leaderboard(self):
        """GET /api/games/leaderboard/{game_id} - get game-specific leaderboard"""
        # Get a game ID first
        games_response = requests.get(f"{BASE_URL}/api/games")
        games = games_response.json()
        game_id = games[0]["id"]
        
        response = requests.get(f"{BASE_URL}/api/games/leaderboard/{game_id}?limit=5")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: Retrieved {len(data)} game-specific leaderboard entries")


class TestGameStats:
    """Test game statistics endpoint"""
    
    def test_get_game_stats(self):
        """GET /api/games/stats/overview - get overall statistics"""
        response = requests.get(f"{BASE_URL}/api/games/stats/overview")
        assert response.status_code == 200
        
        data = response.json()
        assert "total_games" in data
        assert "total_plays" in data
        assert "categories" in data
        assert "top_games" in data
        
        # Verify categories breakdown
        categories = data["categories"]
        assert "puzzle" in categories
        assert "arcade" in categories
        assert "tycoon" in categories
        assert "strategy" in categories
        assert "3d" in categories
        print(f"PASS: Stats - {data['total_games']} games, {data['total_plays']} plays")


class TestGameCRUD:
    """Test game CRUD operations"""
    
    def test_create_and_get_game(self):
        """POST /api/games - create a new game and verify"""
        unique_slug = f"TEST_game_{uuid.uuid4().hex[:8]}"
        game_data = {
            "name": "Test Game",
            "slug": unique_slug,
            "category": "arcade",
            "description": "A test game",
            "thumbnail": "https://example.com/thumb.jpg",
            "min_score": 0,
            "max_reward": 50,
            "cost_to_play": 0,
            "is_active": True
        }
        
        # Create game
        response = requests.post(f"{BASE_URL}/api/games", json=game_data)
        assert response.status_code == 200
        
        created_game = response.json()
        assert created_game["name"] == "Test Game"
        assert created_game["slug"] == unique_slug
        assert created_game["category"] == "arcade"
        assert "id" in created_game
        
        game_id = created_game["id"]
        
        # Verify by GET
        get_response = requests.get(f"{BASE_URL}/api/games/{game_id}")
        assert get_response.status_code == 200
        
        fetched_game = get_response.json()
        assert fetched_game["name"] == "Test Game"
        assert fetched_game["slug"] == unique_slug
        
        # Cleanup - delete the test game
        delete_response = requests.delete(f"{BASE_URL}/api/games/{game_id}")
        assert delete_response.status_code == 200
        print(f"PASS: Created, verified, and deleted test game")
    
    def test_get_game_by_slug(self):
        """GET /api/games/{slug} - get game by slug"""
        response = requests.get(f"{BASE_URL}/api/games/candy-match")
        assert response.status_code == 200
        
        data = response.json()
        assert data["slug"] == "candy-match"
        print("PASS: Retrieved game by slug")
    
    def test_get_nonexistent_game(self):
        """GET /api/games/{id} - should return 404 for nonexistent game"""
        response = requests.get(f"{BASE_URL}/api/games/nonexistent_game_12345")
        assert response.status_code == 404
        print("PASS: Nonexistent game returns 404")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
