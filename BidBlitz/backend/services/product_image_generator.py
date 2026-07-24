"""
AI Product Image Generator using Gemini Nano Banana
Creates professional product photos that actually match each auction product.
Result: images saved locally + URL returned.
"""
import asyncio
import os
import base64
import re
import logging
from datetime import datetime, timezone
from typing import Optional

from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, UserMessage

load_dotenv()

logger = logging.getLogger(__name__)

STORAGE_DIR = "/app/backend/static/product_images"
PUBLIC_URL_PREFIX = "/static/product_images"


def _slug(text: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "_", text.lower())
    return s.strip("_")[:60]


def _build_prompt(title: str, description: str = "") -> str:
    """Create a photorealistic product-photography prompt."""
    base = (
        f"Professional studio product photograph of a {title}. "
        "Ultra high resolution, photorealistic, commercial e-commerce style. "
        "Clean dark background (charcoal gradient), dramatic rim lighting, "
        "soft shadows, 45-degree angle, centered composition. "
        "The product must be the exact item described — no people, no text, no logos overlaid, no watermarks. "
        "Sharp focus, true colors, high-end marketing look like Apple / Samsung / Sony official shots."
    )
    if description:
        base = f"{base} Product details: {description}."
    return base


class ProductImageGenerator:
    def __init__(self):
        self.api_key = os.getenv("EMERGENT_LLM_KEY")
        if not self.api_key:
            raise RuntimeError("EMERGENT_LLM_KEY missing in environment")
        os.makedirs(STORAGE_DIR, exist_ok=True)

    async def generate_for_product(self, title: str, description: str = "",
                                    force: bool = False) -> dict:
        """
        Generate a product image. If force=False and one already exists for this title,
        return the existing URL.
        """
        slug = _slug(title)
        # Look for existing recent file
        existing = sorted(
            [f for f in os.listdir(STORAGE_DIR) if f.startswith(f"prod_{slug}_")],
            reverse=True,
        )
        if existing and not force:
            return {
                "success": True,
                "cached": True,
                "url": f"{PUBLIC_URL_PREFIX}/{existing[0]}",
                "path": os.path.join(STORAGE_DIR, existing[0]),
            }

        prompt = _build_prompt(title, description)
        session_id = f"prod-{slug}-{datetime.now().strftime('%H%M%S')}"
        try:
            chat = LlmChat(
                api_key=self.api_key,
                session_id=session_id,
                system_message="You are a professional product photographer creating flawless commercial e-commerce images.",
            )
            chat.with_model("gemini", "gemini-3.1-flash-image-preview").with_params(
                modalities=["image", "text"]
            )
            msg = UserMessage(text=prompt)
            text_resp, images = await chat.send_message_multimodal_response(msg)

            if not images:
                return {"success": False, "error": "no_image_returned", "prompt": prompt}

            image_data = images[0]
            img_b64 = image_data["data"]
            img_bytes = base64.b64decode(img_b64)

            ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
            filename = f"prod_{slug}_{ts}.png"
            filepath = os.path.join(STORAGE_DIR, filename)
            with open(filepath, "wb") as f:
                f.write(img_bytes)

            return {
                "success": True,
                "cached": False,
                "url": f"{PUBLIC_URL_PREFIX}/{filename}",
                "path": filepath,
                "ai_text": (text_resp or "")[:200],
            }
        except Exception as e:
            logger.exception("Product image generation failed for %s", title)
            return {"success": False, "error": str(e), "prompt": prompt}


_generator: Optional[ProductImageGenerator] = None


def get_product_image_generator() -> ProductImageGenerator:
    global _generator
    if _generator is None:
        _generator = ProductImageGenerator()
    return _generator
