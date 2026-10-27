"""Repair a retired insurance catalog image when reading existing products."""
from urllib.parse import urlsplit

PHONE_INSURANCE_IMAGE_URL = "https://images.unsplash.com/photo-1556656793-08538906a9f8?w=600&q=80"


def normalize_insurance_product_image(product: dict) -> dict:
    """Return the corrected view without changing the stored product."""
    image_url = product.get("image_url")
    if not isinstance(image_url, str):
        return product
    try:
        source = urlsplit(image_url)
    except ValueError:
        return product
    if (
        source.scheme in {"http", "https"}
        and source.hostname == "images.unsplash.com"
        and source.path == "/photo-1551355716-d99cdb39c5b9"
    ):
        return {**product, "image_url": PHONE_INSURANCE_IMAGE_URL}
    return product
