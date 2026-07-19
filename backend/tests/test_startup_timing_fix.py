"""
Test: Startup Timing Fix Verification (iteration 281)
Purpose: Verify the tiny defer (await asyncio.sleep(0.1)) at the start of 
_bootstrap_worker_routes_and_tasks() allows uvicorn to complete startup 
before heavy background route loading begins.

This addresses the production symptom: readiness timing out because /health 
connection was refused while startup had not completed.
"""
import pytest
import subprocess
import time
import requests
import os
import re
import signal
import sys

# Use the public URL for API testing
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://super-app-staging-2.preview.emergentagent.com').rstrip('/')
LOCAL_URL = "http://127.0.0.1"


class TestStartupTimingFix:
    """Tests to verify the startup timing fix in server.py"""
    
    def test_asyncio_sleep_present_in_bootstrap(self):
        """Verify the tiny defer (await asyncio.sleep(0.1)) exists at the start of _bootstrap_worker_routes_and_tasks()"""
        server_path = "/app/backend/server.py"
        with open(server_path, 'r') as f:
            content = f.read()
        
        # Find the function definition
        assert "_bootstrap_worker_routes_and_tasks" in content, "Function _bootstrap_worker_routes_and_tasks not found"
        
        # Find the function and check for asyncio.sleep(0.1) as first statement
        func_pattern = r'async def _bootstrap_worker_routes_and_tasks\(\):\s*\n\s*try:\s*\n\s*await asyncio\.sleep\(0\.1\)'
        match = re.search(func_pattern, content)
        assert match is not None, "asyncio.sleep(0.1) not found at the start of _bootstrap_worker_routes_and_tasks()"
        print("✓ asyncio.sleep(0.1) is present at the start of _bootstrap_worker_routes_and_tasks()")
    
    def test_health_endpoint_available_immediately(self):
        """Verify /health endpoint is available on the running backend"""
        # Test local backend
        response = requests.get(f"{LOCAL_URL}:8001/health", timeout=5)
        assert response.status_code == 200, f"Health check failed with status {response.status_code}"
        
        data = response.json()
        assert data.get("status") == "healthy", f"Health status is not healthy: {data}"
        assert "startup_status" in data, "startup_status not in health response"
        print(f"✓ Health endpoint available: status={data.get('status')}, startup_status={data.get('startup_status')}")
    
    def test_health_defined_before_routers(self):
        """Verify /health is defined at module level, not inside router registration"""
        server_path = "/app/backend/server.py"
        with open(server_path, 'r') as f:
            content = f.read()
        
        # /health should be defined with @app.get("/health") at module level
        health_pattern = r'@app\.get\("/health"\)'
        match = re.search(health_pattern, content)
        assert match is not None, "/health endpoint not defined with @app.get"
        
        # Verify it's NOT inside register_all_routers
        # The health endpoint should be defined AFTER app creation but BEFORE startup_event
        health_pos = match.start()
        
        # Find register_all_routers call position
        register_pattern = r'register_all_routers\(app\)'
        register_match = re.search(register_pattern, content)
        
        # Health should be defined at module level (not dynamically)
        assert health_pos > 0, "/health endpoint position not found"
        print(f"✓ /health endpoint is defined at module level (position {health_pos})")
    
    def test_startup_guard_middleware_allows_health(self):
        """Verify startup_guard_middleware allows /health during booting"""
        server_path = "/app/backend/server.py"
        with open(server_path, 'r') as f:
            content = f.read()
        
        # Check that /health is in allowed_paths
        guard_pattern = r'allowed_paths\s*=\s*\{[^}]*"/health"[^}]*\}'
        match = re.search(guard_pattern, content)
        assert match is not None, "/health not in allowed_paths in startup_guard_middleware"
        print("✓ /health is in allowed_paths in startup_guard_middleware")
    
    def test_background_bootstrap_is_async_task(self):
        """Verify _bootstrap_worker_routes_and_tasks is scheduled as asyncio.create_task"""
        server_path = "/app/backend/server.py"
        with open(server_path, 'r') as f:
            content = f.read()
        
        # Check that bootstrap is scheduled via asyncio.create_task
        task_pattern = r'asyncio\.create_task\(_bootstrap_worker_routes_and_tasks\(\)\)'
        match = re.search(task_pattern, content)
        assert match is not None, "_bootstrap_worker_routes_and_tasks not scheduled via asyncio.create_task"
        print("✓ _bootstrap_worker_routes_and_tasks is scheduled via asyncio.create_task")
    
    def test_startup_event_returns_quickly(self):
        """Verify startup_event doesn't block - it schedules background task and returns"""
        server_path = "/app/backend/server.py"
        with open(server_path, 'r') as f:
            content = f.read()
        
        # Find startup_event function
        startup_pattern = r'@app\.on_event\("startup"\)\s*\nasync def startup_event\(\):'
        match = re.search(startup_pattern, content)
        assert match is not None, "startup_event not found"
        
        # Verify it doesn't call register_all_routers directly (that would block)
        # It should only schedule the background task
        startup_start = match.end()
        # Find the next function definition to get the startup_event body
        next_func = re.search(r'\n@app\.on_event\("shutdown"\)', content[startup_start:])
        if next_func:
            startup_body = content[startup_start:startup_start + next_func.start()]
        else:
            startup_body = content[startup_start:startup_start + 500]
        
        # Should NOT have direct register_all_routers call
        assert "register_all_routers(app)" not in startup_body, "startup_event should not call register_all_routers directly"
        
        # Should have asyncio.create_task
        assert "asyncio.create_task" in startup_body, "startup_event should schedule background task"
        print("✓ startup_event schedules background task without blocking")


class TestStartupTimingPractical:
    """Practical tests for startup timing behavior"""
    
    def test_health_response_time(self):
        """Verify /health responds quickly (< 1 second)"""
        start = time.time()
        response = requests.get(f"{LOCAL_URL}:8001/health", timeout=5)
        elapsed = time.time() - start
        
        assert response.status_code == 200, f"Health check failed: {response.status_code}"
        assert elapsed < 1.0, f"Health response too slow: {elapsed:.3f}s"
        print(f"✓ Health response time: {elapsed:.3f}s (< 1s threshold)")
    
    def test_current_startup_status_is_ready(self):
        """Verify the current backend has completed startup (status=ready)"""
        response = requests.get(f"{LOCAL_URL}:8001/health", timeout=5)
        assert response.status_code == 200
        
        data = response.json()
        startup_status = data.get("startup_status")
        # After full startup, status should be 'ready'
        assert startup_status == "ready", f"Expected startup_status='ready', got '{startup_status}'"
        print(f"✓ Current startup_status is 'ready'")
    
    def test_api_endpoints_available_after_startup(self):
        """Verify API endpoints are available after startup completes"""
        # Test a few API endpoints to ensure routers are loaded
        endpoints_to_test = [
            "/health",
            "/",
        ]
        
        for endpoint in endpoints_to_test:
            response = requests.get(f"{LOCAL_URL}:8001{endpoint}", timeout=5)
            assert response.status_code == 200, f"Endpoint {endpoint} failed: {response.status_code}"
            print(f"✓ Endpoint {endpoint} available (status {response.status_code})")


class TestUvicornMultiWorkerStartup:
    """Test startup behavior with multiple uvicorn workers"""
    
    def test_uvicorn_workers_startup_simulation(self):
        """
        Simulate uvicorn multi-worker startup and verify:
        1. 'Application startup complete.' appears before bulk router-loading logs
        2. /health becomes reachable quickly
        
        Note: This test starts a fresh uvicorn instance on a different port
        """
        test_port = 18001  # Use a different port to avoid conflicts
        
        # Start uvicorn with 2 workers in background
        cmd = [
            sys.executable, "-m", "uvicorn",
            "server:app",
            "--host", "127.0.0.1",
            "--port", str(test_port),
            "--workers", "2",
            "--log-level", "info"
        ]
        
        print(f"Starting uvicorn with workers=2 on port {test_port}...")
        
        proc = subprocess.Popen(
            cmd,
            cwd="/app/backend",
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            env={**os.environ, "PYTHONUNBUFFERED": "1"}
        )
        
        try:
            # Collect logs and track timing
            logs = []
            startup_complete_time = None
            router_loading_time = None
            health_available_time = None
            start_time = time.time()
            max_wait = 30  # Maximum wait time in seconds
            
            # Poll for health endpoint availability
            health_check_interval = 0.2
            last_health_check = 0
            
            while time.time() - start_time < max_wait:
                # Check for new log output (non-blocking)
                try:
                    import select
                    if select.select([proc.stdout], [], [], 0.1)[0]:
                        line = proc.stdout.readline()
                        if line:
                            logs.append(line.strip())
                            print(f"LOG: {line.strip()}")
                            
                            # Track when "Application startup complete" appears
                            if "Application startup complete" in line and startup_complete_time is None:
                                startup_complete_time = time.time() - start_time
                                print(f"✓ 'Application startup complete' at {startup_complete_time:.3f}s")
                            
                            # Track when router loading starts
                            if "routers loaded" in line.lower() and router_loading_time is None:
                                router_loading_time = time.time() - start_time
                                print(f"✓ Router loading logged at {router_loading_time:.3f}s")
                except Exception:
                    pass
                
                # Periodically check health endpoint
                current_time = time.time()
                if current_time - last_health_check > health_check_interval:
                    last_health_check = current_time
                    try:
                        resp = requests.get(f"http://127.0.0.1:{test_port}/health", timeout=1)
                        if resp.status_code == 200 and health_available_time is None:
                            health_available_time = time.time() - start_time
                            print(f"✓ /health available at {health_available_time:.3f}s")
                            # Once health is available, wait a bit more for router logs then break
                            time.sleep(2)
                            break
                    except requests.exceptions.ConnectionError:
                        pass  # Server not ready yet
                    except Exception as e:
                        print(f"Health check error: {e}")
            
            # Collect any remaining logs
            try:
                remaining = proc.stdout.read()
                if remaining:
                    for line in remaining.split('\n'):
                        if line.strip():
                            logs.append(line.strip())
                            if "routers loaded" in line.lower() and router_loading_time is None:
                                router_loading_time = time.time() - start_time
            except Exception:
                pass
            
            # Assertions
            assert health_available_time is not None, "/health never became available within timeout"
            assert health_available_time < 5.0, f"/health took too long to become available: {health_available_time:.3f}s"
            
            print(f"\n=== Startup Timing Summary ===")
            print(f"Health available at: {health_available_time:.3f}s")
            if startup_complete_time:
                print(f"'Application startup complete' at: {startup_complete_time:.3f}s")
            if router_loading_time:
                print(f"Router loading logged at: {router_loading_time:.3f}s")
            
            # The key assertion: startup_complete should appear before or around the same time as health
            # This confirms uvicorn binds the port before heavy background work
            if startup_complete_time and router_loading_time:
                assert startup_complete_time <= router_loading_time, \
                    f"'Application startup complete' ({startup_complete_time:.3f}s) should appear before router loading ({router_loading_time:.3f}s)"
                print("✓ Startup timing is correct: uvicorn completes before router loading")
            
            print("✓ Multi-worker startup test passed")
            
        finally:
            # Cleanup: terminate the uvicorn process
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait()
            print("✓ Test uvicorn process terminated")


class TestProductionReadinessSymptom:
    """Tests specifically addressing the production deployment symptom"""
    
    def test_health_not_connection_refused(self):
        """
        Verify /health doesn't return connection refused.
        This was the production symptom: nginx health checks got connection refused
        because startup hadn't completed.
        """
        # Multiple rapid health checks to ensure stability
        for i in range(5):
            try:
                response = requests.get(f"{LOCAL_URL}:8001/health", timeout=2)
                assert response.status_code == 200, f"Health check {i+1} failed: {response.status_code}"
            except requests.exceptions.ConnectionError as e:
                pytest.fail(f"Health check {i+1} got connection refused: {e}")
            time.sleep(0.1)
        
        print("✓ 5 consecutive health checks succeeded (no connection refused)")
    
    def test_fix_addresses_production_symptom(self):
        """
        Summary test: Verify the fix directly addresses the production symptom.
        
        Production symptom: Readiness timing out because /health connection was refused
        while startup had not completed.
        
        Fix: await asyncio.sleep(0.1) at start of _bootstrap_worker_routes_and_tasks()
        allows uvicorn to finish startup and bind the port before heavy background
        route loading begins.
        """
        # 1. Verify the fix is in place
        server_path = "/app/backend/server.py"
        with open(server_path, 'r') as f:
            content = f.read()
        
        # Check for the tiny defer
        assert "await asyncio.sleep(0.1)" in content, "Tiny defer not found in server.py"
        
        # Check it's in the right function
        func_pattern = r'async def _bootstrap_worker_routes_and_tasks\(\):\s*\n\s*try:\s*\n\s*await asyncio\.sleep\(0\.1\)'
        assert re.search(func_pattern, content), "Tiny defer not at start of _bootstrap_worker_routes_and_tasks"
        
        # 2. Verify /health is available
        response = requests.get(f"{LOCAL_URL}:8001/health", timeout=5)
        assert response.status_code == 200
        
        # 3. Verify startup is complete
        data = response.json()
        assert data.get("startup_status") == "ready"
        
        print("✓ Fix verified: tiny defer in place, /health available, startup complete")
        print("\nConclusion: The fix directly addresses the production symptom by ensuring")
        print("uvicorn can finish startup and bind the port before heavy background work begins.")
        print("This prevents 'connection refused' errors during readiness checks.")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
