"""
Test Voice Command Translation Feature
Tests for:
1. Voice command recognition for translate_products
2. Products API returning translations for all 5 languages
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://bidblitz-mobile.preview.emergentagent.com')

class TestVoiceCommandTranslation:
    """Voice command translation tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@bidblitz.de",
            "password": "Admin123!"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json().get("token")
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get auth headers"""
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_translate_products_command_german(self, auth_headers):
        """Test: 'Übersetze alle Produkte' should be recognized as translate_products"""
        response = requests.post(
            f"{BASE_URL}/api/voice-command/execute",
            json={"text": "Übersetze alle Produkte", "execute": False},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        parsed = data.get("parsed_command", {})
        
        assert parsed.get("action") == "translate_products", f"Expected translate_products, got {parsed.get('action')}"
        assert "languages" in parsed.get("parameters", {}), "Missing languages parameter"
        
        # Verify all 5 languages are included
        languages = parsed["parameters"]["languages"]
        expected_langs = ["en", "tr", "fr", "sq", "ar"]
        for lang in expected_langs:
            assert lang in languages, f"Missing language: {lang}"
    
    def test_translate_site_command(self, auth_headers):
        """Test: 'Die Seite soll übersetzt werden' should be recognized as translate_products"""
        response = requests.post(
            f"{BASE_URL}/api/voice-command/execute",
            json={"text": "Die Seite soll übersetzt werden", "execute": False},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        parsed = data.get("parsed_command", {})
        
        assert parsed.get("action") == "translate_products", f"Expected translate_products, got {parsed.get('action')}"
    
    def test_translate_other_language_command(self, auth_headers):
        """Test: 'Übersetzung drücken auf andere Sprache' should be recognized as translate_products"""
        response = requests.post(
            f"{BASE_URL}/api/voice-command/execute",
            json={"text": "Übersetzung drücken auf andere Sprache", "execute": False},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        parsed = data.get("parsed_command", {})
        
        assert parsed.get("action") == "translate_products", f"Expected translate_products, got {parsed.get('action')}"


class TestProductsTranslations:
    """Products API translation tests"""
    
    def test_products_have_name_translations(self):
        """Test: Products API returns name_translations for all 5 languages"""
        response = requests.get(f"{BASE_URL}/api/products")
        assert response.status_code == 200
        
        products = response.json()
        assert len(products) > 0, "No products found"
        
        # Check first 5 products
        expected_langs = ["de", "en", "tr", "fr", "sq", "ar"]
        products_with_translations = 0
        
        for product in products[:5]:
            name_trans = product.get("name_translations", {})
            if all(lang in name_trans for lang in expected_langs):
                products_with_translations += 1
        
        assert products_with_translations >= 3, f"Only {products_with_translations}/5 products have all name translations"
    
    def test_products_have_description_translations(self):
        """Test: Products API returns description_translations for all 5 languages"""
        response = requests.get(f"{BASE_URL}/api/products")
        assert response.status_code == 200
        
        products = response.json()
        assert len(products) > 0, "No products found"
        
        # Check first 5 products
        expected_langs = ["de", "en", "tr", "fr", "sq", "ar"]
        products_with_translations = 0
        
        for product in products[:5]:
            desc_trans = product.get("description_translations", {})
            if all(lang in desc_trans for lang in expected_langs):
                products_with_translations += 1
        
        assert products_with_translations >= 3, f"Only {products_with_translations}/5 products have all description translations"
    
    def test_translation_content_not_empty(self):
        """Test: Translation content is not empty"""
        response = requests.get(f"{BASE_URL}/api/products")
        assert response.status_code == 200
        
        products = response.json()
        product = products[0]
        
        name_trans = product.get("name_translations", {})
        desc_trans = product.get("description_translations", {})
        
        # Check English translation exists and is not empty
        assert "en" in name_trans, "Missing English name translation"
        assert len(name_trans["en"]) > 0, "English name translation is empty"
        
        assert "en" in desc_trans, "Missing English description translation"
        assert len(desc_trans["en"]) > 0, "English description translation is empty"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
