import asyncio
import base64
import json
import mimetypes
import os
import re
import tempfile
import urllib.request
from pathlib import Path
from typing import Any
from uuid import uuid4

try:
    from emergentintegrations.llm.chat import (
        LlmChat,
        UserMessage,
        FileContentWithMimeType,
        TextDelta,
        StreamDone,
    )
except Exception:  # pragma: no cover
    LlmChat = None
    UserMessage = None
    FileContentWithMimeType = None
    TextDelta = None
    StreamDone = None


class VisualQaAiError(Exception):
    pass


def _get_api_key() -> str:
    key = os.environ.get("EMERGENT_LLM_KEY", "").strip()
    if not key:
        raise VisualQaAiError("EMERGENT_LLM_KEY fehlt für AI Screenshot Review.")
    return key


def _ensure_chat_available():
    if not all([LlmChat, UserMessage, FileContentWithMimeType, TextDelta, StreamDone]):
        raise VisualQaAiError("emergentintegrations ist nicht verfügbar.")


def _decode_image_to_tempfile(image_base64: str, filename_hint: str = "review-image") -> tuple[str, str]:
    if "," in image_base64 and image_base64.startswith("data:"):
        header, encoded = image_base64.split(",", 1)
        mime_match = re.match(r"data:(.+?);base64", header)
        mime_type = mime_match.group(1) if mime_match else "image/png"
    else:
        encoded = image_base64
        mime_type = "image/png"

    raw = base64.b64decode(encoded)
    ext = mimetypes.guess_extension(mime_type) or ".png"
    with tempfile.NamedTemporaryFile(delete=False, suffix=ext, prefix=f"{filename_hint}-") as tmp:
        tmp.write(raw)
        return tmp.name, mime_type


async def _stream_json_response(system_message: str, user_text: str, file_path: str, mime_type: str) -> Any:
    _ensure_chat_available()
    api_key = _get_api_key()
    chat = LlmChat(
        api_key=api_key,
        session_id=f"visual-qa-{uuid4().hex}",
        system_message=system_message,
    ).with_model("openai", "gpt-5.4")

    chunks: list[str] = []
    async for event in chat.stream_message(
        UserMessage(
            text=user_text,
            file_contents=[FileContentWithMimeType(file_path=file_path, mime_type=mime_type)],
        )
    ):
        if isinstance(event, TextDelta):
            chunks.append(event.content)
        elif isinstance(event, StreamDone):
            break

    content = "".join(chunks).strip()
    match = re.search(r"\{.*\}|\[.*\]", content, re.DOTALL)
    json_text = match.group(0) if match else content
    try:
        return json.loads(json_text)
    except json.JSONDecodeError as exc:
        raise VisualQaAiError(f"AI Antwort ist kein valides JSON: {exc}") from exc


async def review_screenshot(payload: dict) -> dict:
    screenshot_b64 = payload.get("screenshot_base64", "")
    if not screenshot_b64:
        raise VisualQaAiError("screenshot_base64 fehlt")

    file_path, mime_type = _decode_image_to_tempfile(screenshot_b64, "screenshot-review")
    try:
        system_message = (
            "You are a strict visual QA reviewer for the BidBlitz fintech app. "
            "Return ONLY valid JSON. Never include markdown. "
            "If there are no issues, return {\"issues\": []}."
        )
        user_text = (
            "Review this BidBlitz screenshot. Return strict JSON with shape: "
            "{\"issues\":[{\"severity\":\"critical|high|medium|low\",\"category\":\"layout|overlap|clipping|wrong_image|wrong_number|translation|inconsistent_design|accessibility|navigation|data_inconsistency\","
            "\"route\":string,\"viewport\":string,\"visual_coordinates\":{\"x\":number,\"y\":number,\"width\":number,\"height\":number},"
            "\"problem\":string,\"affected_component\":string,\"suggested_fix\":string,\"confidence\":number,\"safe_to_auto_fix\":boolean}]} . "
            f"Route: {payload.get('route', '')}. Viewport: {payload.get('viewport', '')}. Language: {payload.get('language', '')}. "
            f"Role: {payload.get('role', '')}. Page data: {json.dumps(payload.get('page_data', {}), ensure_ascii=False)}. "
            f"Expected design tokens: {json.dumps(payload.get('design_tokens', {}), ensure_ascii=False)}."
        )
        result = await _stream_json_response(system_message, user_text, file_path, mime_type)
        return result if isinstance(result, dict) else {"issues": result}
    finally:
        try:
            Path(file_path).unlink(missing_ok=True)
        except Exception:
            pass


async def _fetch_image_as_tempfile(image_url: str) -> tuple[str, str]:
    def _download() -> tuple[str, str]:
        req = urllib.request.Request(image_url, headers={"User-Agent": "BidBlitz-Visual-QA/1.0"})
        with urllib.request.urlopen(req, timeout=20) as response:
            raw = response.read()
            content_type = response.headers.get_content_type() or "image/jpeg"
        suffix = mimetypes.guess_extension(content_type) or ".jpg"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix, prefix="product-image-") as tmp:
            tmp.write(raw)
            return tmp.name, content_type
    return await asyncio.to_thread(_download)


async def validate_product_images(products: list[dict]) -> list[dict]:
    _ensure_chat_available()
    results: list[dict] = []
    for product in products:
        title = product.get("title", "")
        category = product.get("category", "")
        product_id = product.get("product_id") or product.get("auction_id") or product.get("id") or "unknown"
        image_urls = [url for url in (product.get("image_urls") or []) if url][:4]
        if product.get("image_url") and product["image_url"] not in image_urls:
            image_urls.insert(0, product["image_url"])
        if not image_urls:
            results.append({
                "product_id": product_id,
                "title": title,
                "incorrect_image_url": "",
                "expected_category": category,
                "confidence": 0.0,
                "suggested_replacement": "",
                "status": "no_images",
            })
            continue

        for image_url in image_urls[:3]:
            try:
                file_path, mime_type = await _fetch_image_as_tempfile(image_url)
                system_message = (
                    "You validate if an ecommerce product image matches the product title and category. "
                    "Return ONLY valid JSON and be conservative."
                )
                user_text = (
                    "Return strict JSON with keys: product_id, title, incorrect_image_url, expected_category, confidence, suggested_replacement, "
                    "match_status(one of match|mismatch|uncertain), reason. "
                    f"Product ID: {product_id}. Title: {title}. Expected category: {category}. Current image URL: {image_url}."
                )
                result = await _stream_json_response(system_message, user_text, file_path, mime_type)
                if isinstance(result, dict):
                    result.setdefault("product_id", product_id)
                    result.setdefault("title", title)
                    result.setdefault("incorrect_image_url", image_url)
                    result.setdefault("expected_category", category)
                    results.append(result)
                Path(file_path).unlink(missing_ok=True)
            except Exception as exc:
                results.append({
                    "product_id": product_id,
                    "title": title,
                    "incorrect_image_url": image_url,
                    "expected_category": category,
                    "confidence": 0.0,
                    "suggested_replacement": "",
                    "match_status": "uncertain",
                    "reason": f"Validation failed: {exc}",
                })
    return results