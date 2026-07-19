"""
Test: Backend Startup Readiness Fix Verification
=================================================
This test verifies the fix for production deployment readiness issue where:
- nginx health checks to /health on 127.0.0.1:8001 were getting connection refused
- Old live version remained visible because new deployment never became ready

The fix ensures:
1. register_all_routers(app) is NOT called at module import time
2. /health endpoint is defined early and available immediately
3. Heavy initialization runs in background after startup
"""

import pytest
import time
import subprocess
import socket
import requests
import sys
import os

# Get BASE_URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


def get_free_port():
    """Get a free port for testing"""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('', 0))
        return s.getsockname()[1]


class TestStartupReadinessFix:
    """Tests for the backend startup readiness fix"""

    def test_health_endpoint_available_on_running_backend(self):
        """Test that /health endpoint is available on the running backend"""
        # Test against the internal backend port directly
        response = requests.get("http://127.0.0.1:8001/health", timeout=5)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "startup_status" in data
        print(f"Health check passed: {data}")

    def test_import_time_is_fast(self):
        """Test that importing server.py is fast (< 2 seconds)"""
        # This simulates what uvicorn does when loading the module
        start = time.time()
        result = subprocess.run(
            [sys.executable, "-c", "import server"],
            cwd="/app/backend",
            capture_output=True,
            text=True,
            timeout=30
        )
        elapsed = time.time() - start
        
        print(f"Import time: {elapsed:.3f}s")
        print(f"stdout: {result.stdout}")
        print(f"stderr: {result.stderr}")
        
        # Import should be fast (< 2 seconds) since heavy init is backgrounded
        assert elapsed < 2.0, f"Import took too long: {elapsed:.3f}s (should be < 2s)"
        assert result.returncode == 0, f"Import failed: {result.stderr}"

    def test_health_route_present_at_import(self):
        """Test that /health route is present immediately after import"""
        result = subprocess.run(
            [sys.executable, "-c", """
import server
health_found = False
for route in server.app.routes:
    if hasattr(route, 'path') and route.path == '/health':
        health_found = True
        break
print(f'health_found={health_found}')
assert health_found, '/health route not found at import time'
"""],
            cwd="/app/backend",
            capture_output=True,
            text=True,
            timeout=30
        )
        
        print(f"stdout: {result.stdout}")
        print(f"stderr: {result.stderr}")
        
        assert result.returncode == 0, f"Test failed: {result.stderr}"
        assert "health_found=True" in result.stdout

    def test_register_all_routers_not_called_at_import(self):
        """Test that register_all_routers is NOT called during module import"""
        # This test verifies the code structure - register_all_routers should only
        # be called inside _load_routers_for_worker which is scheduled as background task
        result = subprocess.run(
            [sys.executable, "-c", """
import server

# Check that routes_loaded is False after import (before startup event runs)
# Note: In actual uvicorn, startup_event would set this, but during import it should be undefined
routes_loaded = getattr(server.app.state, 'routes_loaded', 'NOT_SET')
print(f'routes_loaded_at_import={routes_loaded}')

# The key check: at import time, only the /health, /, /pay.js routes should exist
# (plus middleware routes), NOT the 200+ API routes
route_count = len([r for r in server.app.routes if hasattr(r, 'path')])
print(f'route_count_at_import={route_count}')

# Should have very few routes at import (health, root, pay.js, static mounts)
# If register_all_routers was called at import, we'd have 200+ routes
assert route_count < 20, f'Too many routes at import ({route_count}), register_all_routers may have been called'
"""],
            cwd="/app/backend",
            capture_output=True,
            text=True,
            timeout=30
        )
        
        print(f"stdout: {result.stdout}")
        print(f"stderr: {result.stderr}")
        
        assert result.returncode == 0, f"Test failed: {result.stderr}"

    def test_startup_guard_middleware_allows_health(self):
        """Test that startup_guard_middleware allows /health during booting"""
        result = subprocess.run(
            [sys.executable, "-c", """
import server
import asyncio
from fastapi.testclient import TestClient

# Simulate booting state
server.app.state.startup_status = 'booting'

# Test that /health is allowed even during booting
client = TestClient(server.app)
response = client.get('/health')
print(f'status_code={response.status_code}')
print(f'response={response.json()}')

# /health should return 200 even during booting
assert response.status_code == 200, f'Expected 200, got {response.status_code}'
"""],
            cwd="/app/backend",
            capture_output=True,
            text=True,
            timeout=30
        )
        
        print(f"stdout: {result.stdout}")
        print(f"stderr: {result.stderr}")
        
        assert result.returncode == 0, f"Test failed: {result.stderr}"
        assert "status_code=200" in result.stdout

    def test_startup_guard_blocks_api_during_booting(self):
        """Test that startup_guard_middleware blocks API routes during booting"""
        result = subprocess.run(
            [sys.executable, "-c", """
import server
from fastapi.testclient import TestClient

# Simulate booting state
server.app.state.startup_status = 'booting'

# Test that non-health routes return 503 during booting
client = TestClient(server.app)
response = client.get('/api/some-route')
print(f'status_code={response.status_code}')

# Non-health routes should return 503 during booting
assert response.status_code == 503, f'Expected 503, got {response.status_code}'
"""],
            cwd="/app/backend",
            capture_output=True,
            text=True,
            timeout=30
        )
        
        print(f"stdout: {result.stdout}")
        print(f"stderr: {result.stderr}")
        
        assert result.returncode == 0, f"Test failed: {result.stderr}"
        assert "status_code=503" in result.stdout


class TestCodeStructureVerification:
    """Verify the code structure matches the expected fix"""

    def test_server_py_structure(self):
        """Verify server.py has the correct structure for the fix"""
        with open("/app/backend/server.py", "r") as f:
            content = f.read()
        
        # 1. register_all_routers should be imported but NOT called at module level
        assert "from core.router_registry import register_all_routers" in content, \
            "register_all_routers should be imported"
        
        # 2. /health should be defined directly on app (not in a router)
        assert '@app.get("/health")' in content, \
            "/health should be defined directly on app"
        
        # 3. _bootstrap_worker_routes_and_tasks should exist and be scheduled in startup
        assert "async def _bootstrap_worker_routes_and_tasks" in content, \
            "_bootstrap_worker_routes_and_tasks function should exist"
        
        assert "asyncio.create_task(_bootstrap_worker_routes_and_tasks())" in content, \
            "_bootstrap_worker_routes_and_tasks should be scheduled as background task"
        
        # 4. register_all_routers should be called inside _load_routers_for_worker
        assert "def _load_routers_for_worker" in content or "async def _load_routers_for_worker" in content, \
            "_load_routers_for_worker function should exist"
        
        # 5. startup_guard_middleware should allow /health
        assert 'allowed_paths = {"/health"' in content, \
            "startup_guard_middleware should allow /health"
        
        print("All code structure checks passed!")

    def test_dockerfile_health_check(self):
        """Verify Dockerfile has appropriate health check configuration"""
        with open("/app/backend/Dockerfile", "r") as f:
            content = f.read()
        
        # Should have HEALTHCHECK directive
        assert "HEALTHCHECK" in content, "Dockerfile should have HEALTHCHECK"
        assert "/health" in content, "HEALTHCHECK should use /health endpoint"
        
        # Check start-period is reasonable (allows time for startup)
        assert "--start-period=" in content, "HEALTHCHECK should have start-period"
        
        print("Dockerfile health check configuration verified!")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
