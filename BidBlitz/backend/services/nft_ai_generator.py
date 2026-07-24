"""
AI NFT Image Generator using Gemini Nano Banana
Generates unique NFT artwork based on style and rarity
"""

import asyncio
import os
import base64
import secrets
from datetime import datetime, timezone
from typing import Optional
from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, UserMessage

load_dotenv()

# Style-based prompts for AI generation
STYLE_PROMPTS = {
    "cyberpunk": {
        "base": "Create a futuristic cyberpunk digital artwork with neon lights, high-tech cityscape, holographic elements, and dystopian atmosphere",
        "legendary": "masterpiece, ultra detailed, 8K resolution, cinematic lighting",
        "epic": "highly detailed, dramatic composition, vibrant neon colors",
        "rare": "detailed artwork, neon glow effects, urban setting",
        "common": "digital art, cyberpunk style, neon aesthetic"
    },
    "fantasy": {
        "base": "Create a magical fantasy artwork with mystical creatures, enchanted forests, magical energy, and ethereal atmosphere",
        "legendary": "epic masterpiece, ultra detailed, fantasy art, majestic composition",
        "epic": "highly detailed fantasy art, magical lighting, dramatic scene",
        "rare": "detailed fantasy artwork, mystical elements, magical glow",
        "common": "fantasy digital art, magical theme"
    },
    "abstract": {
        "base": "Create an abstract digital artwork with geometric patterns, flowing colors, mathematical beauty, and artistic composition",
        "legendary": "masterpiece abstract art, ultra detailed, perfect composition, stunning visual",
        "epic": "highly detailed abstract artwork, dynamic composition, vibrant colors",
        "rare": "detailed abstract art, geometric patterns, color harmony",
        "common": "abstract digital art, colorful patterns"
    },
    "space": {
        "base": "Create a cosmic space artwork with galaxies, nebulas, stars, planets, and vast universe elements",
        "legendary": "epic space masterpiece, ultra detailed, astronomical beauty, cinematic quality",
        "epic": "highly detailed space artwork, cosmic phenomena, stunning nebulas",
        "rare": "detailed space art, galaxy scenes, star clusters",
        "common": "space digital art, cosmic theme"
    },
    "nature": {
        "base": "Create a beautiful nature artwork with landscapes, forests, mountains, natural beauty, and serene atmosphere",
        "legendary": "nature masterpiece, ultra detailed, breathtaking scenery, photorealistic quality",
        "epic": "highly detailed nature artwork, dramatic landscape, vivid colors",
        "rare": "detailed nature art, beautiful scenery, natural lighting",
        "common": "nature digital art, landscape theme"
    },
    "anime": {
        "base": "Create an anime-style artwork with dynamic character design, manga aesthetics, Japanese art style, and expressive composition",
        "legendary": "anime masterpiece, ultra detailed, studio quality, perfect character design",
        "epic": "highly detailed anime artwork, dynamic pose, vibrant style",
        "rare": "detailed anime art, manga style, expressive design",
        "common": "anime digital art, manga aesthetic"
    },
    "pixel": {
        "base": "Create a pixel art artwork with retro gaming aesthetic, 8-bit style, pixelated design, and nostalgic composition",
        "legendary": "pixel art masterpiece, ultra detailed sprite work, perfect pixel composition",
        "epic": "highly detailed pixel artwork, retro gaming style, vibrant pixels",
        "rare": "detailed pixel art, 8-bit aesthetic, colorful sprites",
        "common": "pixel art, retro gaming style"
    },
    "3d": {
        "base": "Create a photorealistic 3D rendered artwork with modern CGI, realistic materials, advanced lighting, and professional quality",
        "legendary": "3D masterpiece, photorealistic rendering, ultra detailed, cinema 4D quality",
        "epic": "highly detailed 3D artwork, realistic materials, dramatic lighting",
        "rare": "detailed 3D render, modern CGI, good lighting",
        "common": "3D digital art, rendered artwork"
    }
}


class NFTAIGenerator:
    def __init__(self):
        self.api_key = os.getenv("EMERGENT_LLM_KEY")
        if not self.api_key:
            raise ValueError("EMERGENT_LLM_KEY not found in environment")
    
    def _build_prompt(self, style_id: str, rarity: str, custom_prompt: Optional[str] = None) -> str:
        """Build AI generation prompt based on style and rarity."""
        style_prompts = STYLE_PROMPTS.get(style_id, STYLE_PROMPTS["abstract"])
        
        base_prompt = style_prompts["base"]
        quality_suffix = style_prompts.get(rarity, style_prompts["common"])
        
        # Add custom user prompt if provided
        if custom_prompt:
            prompt = f"{base_prompt}, {custom_prompt}, {quality_suffix}"
        else:
            prompt = f"{base_prompt}, {quality_suffix}"
        
        # Add NFT-specific instructions
        prompt += ", square composition, suitable for NFT collection, unique artwork, no text or watermarks"
        
        return prompt
    
    async def generate_nft_image(
        self,
        style_id: str,
        rarity: str,
        custom_prompt: Optional[str] = None
    ) -> dict:
        """
        Generate NFT image using Gemini Nano Banana.
        Returns dict with image data and metadata.
        """
        session_id = f"nft-gen-{secrets.token_hex(8)}"
        
        try:
            # Initialize chat with Gemini Nano Banana
            chat = LlmChat(
                api_key=self.api_key,
                session_id=session_id,
                system_message="You are an expert NFT artist creating unique digital collectibles."
            )
            
            # Configure for image generation (gemini-3.1-flash-image-preview is Nano Banana)
            chat.with_model("gemini", "gemini-3.1-flash-image-preview").with_params(
                modalities=["image", "text"]
            )
            
            # Build prompt
            prompt = self._build_prompt(style_id, rarity, custom_prompt)
            
            msg = UserMessage(text=prompt)
            
            # Generate image
            text_response, images = await chat.send_message_multimodal_response(msg)
            
            if not images or len(images) == 0:
                raise Exception("No image generated by AI")
            
            # Get first image
            image_data = images[0]
            
            return {
                "success": True,
                "image_base64": image_data["data"],  # Base64 encoded image
                "mime_type": image_data.get("mime_type", "image/png"),
                "ai_response": text_response[:200] if text_response else "",
                "prompt_used": prompt[:500],
            }
        
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "prompt_used": prompt[:500] if 'prompt' in locals() else "",
            }
    
    async def save_image_to_storage(self, image_base64: str, nft_id: str) -> str:
        """
        Save generated image to file storage.
        In production, upload to S3/Cloud Storage.
        For now, saves locally and returns path.
        """
        try:
            # Decode base64 to bytes
            image_bytes = base64.b64decode(image_base64)
            
            # Create storage directory
            storage_dir = "/app/backend/static/nft_images"
            os.makedirs(storage_dir, exist_ok=True)
            
            # Generate filename
            timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
            filename = f"nft_{nft_id}_{timestamp}.png"
            filepath = os.path.join(storage_dir, filename)
            
            # Save file
            with open(filepath, "wb") as f:
                f.write(image_bytes)
            
            # Return URL path (relative to backend)
            return f"/static/nft_images/{filename}"
        
        except Exception as e:
            raise Exception(f"Failed to save image: {str(e)}")


# Singleton instance
_generator = None

def get_nft_generator() -> NFTAIGenerator:
    """Get or create NFT generator instance."""
    global _generator
    if _generator is None:
        _generator = NFTAIGenerator()
    return _generator
