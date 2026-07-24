/**
 * Minimal SEO helper — no react-helmet dependency.
 * Updates document.title + meta tags imperatively.
 * Google, Bing, DuckDuckGo and social crawlers (Twitter/Facebook) execute JS on
 * modern rendering so client-side meta updates are indexed.
 */
export function setSeo({ title, description, image, url, type = "website", jsonLd }) {
  if (title) document.title = title;

  const setMeta = (name, content, useProp = false) => {
    if (!content) return;
    const sel = useProp ? `meta[property="${name}"]` : `meta[name="${name}"]`;
    let el = document.head.querySelector(sel);
    if (!el) {
      el = document.createElement("meta");
      if (useProp) el.setAttribute("property", name); else el.setAttribute("name", name);
      document.head.appendChild(el);
    }
    el.setAttribute("content", content);
  };

  // Standard
  setMeta("description", description);
  // Canonical
  let canon = document.head.querySelector('link[rel="canonical"]');
  if (!canon) {
    canon = document.createElement("link");
    canon.setAttribute("rel", "canonical");
    document.head.appendChild(canon);
  }
  canon.setAttribute("href", url || window.location.href);

  // Open Graph
  setMeta("og:title", title, true);
  setMeta("og:description", description, true);
  setMeta("og:type", type, true);
  setMeta("og:url", url || window.location.href, true);
  if (image) setMeta("og:image", image, true);

  // Twitter Cards
  setMeta("twitter:card", image ? "summary_large_image" : "summary");
  setMeta("twitter:title", title);
  setMeta("twitter:description", description);
  if (image) setMeta("twitter:image", image);

  // JSON-LD structured data
  const existing = document.head.querySelector('script[data-seo-jsonld]');
  if (existing) existing.remove();
  if (jsonLd) {
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.setAttribute("data-seo-jsonld", "true");
    script.textContent = JSON.stringify(jsonLd);
    document.head.appendChild(script);
  }
}

export function resetSeo() {
  document.title = "BidBlitz — Super App";
  document.head.querySelector('script[data-seo-jsonld]')?.remove();
}
