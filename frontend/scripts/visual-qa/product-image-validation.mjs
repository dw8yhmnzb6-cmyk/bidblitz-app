import path from 'path';
import { outputDir, deriveVisualQaUrl, getQaBaseUrl, postJson, readJson, writeJson } from './shared.mjs';

const baseURL = getQaBaseUrl();
if (!baseURL) {
  writeJson(path.join(outputDir, 'product-image-validation.json'), { generated_at: new Date().toISOString(), validation_mode: 'skipped', results: [] });
  console.log('QA_BASE_URL missing, product image validation skipped.');
  process.exit(0);
}

const response = await fetch(`${baseURL}/api/auctions`);
const data = await response.json();
const auctions = data?.auctions || [];

const categoryRules = {
  mobility: { expected: ['bike', 'scooter', 'ebike', 'stromer', 'vanmoof', 'cowboy'], forbidden: ['motorcycle', 'car', 'truck'] },
  laptops: { expected: ['laptop', 'macbook', 'notebook', 'surface'], forbidden: ['motorcycle', 'car', 'vacuum'] },
  robots: { expected: ['robot', 'roomba', 'roborock', 'vacuum'], forbidden: ['car', 'motorcycle', 'laptop'] },
  gaming: { expected: ['gaming', 'console', 'monitor', 'playstation', 'xbox', 'switch'], forbidden: ['bike', 'vacuum'] },
};

const heuristicResults = auctions.slice(0, 80).flatMap((auction) => {
  const rules = categoryRules[auction.category] || null;
  if (!rules) return [];
  const urls = [auction.image_url, ...(auction.image_urls || [])].filter(Boolean);
  return urls.map((url) => {
    const normalized = `${auction.title} ${url}`.toLowerCase();
    const hasExpected = rules.expected.some((token) => normalized.includes(token));
    const hasForbidden = rules.forbidden.some((token) => normalized.includes(token));
    const mismatch = hasForbidden || !hasExpected;
    return {
      product_id: auction.id || auction.auction_id || auction._id || 'unknown',
      title: auction.title,
      incorrect_image_url: url,
      expected_category: auction.category,
      confidence: mismatch ? (hasForbidden ? 0.96 : 0.72) : 0.12,
      suggested_replacement: mismatch && hasForbidden ? 'Review category-aligned gallery asset with high confidence.' : '',
      match_status: mismatch ? 'mismatch' : 'match',
      validation_mode: 'heuristic',
    };
  });
});

let validationMode = 'heuristic';
let results = heuristicResults;

try {
  const endpoint = deriveVisualQaUrl(process.env.QA_PRODUCT_VALIDATION_URL, '/api/visual-qa/product-image-validate');
  if (endpoint) {
    const products = auctions.slice(0, 30).map((auction) => ({
      auction_id: auction.id || auction.auction_id || auction._id || 'unknown',
      title: auction.title || '',
      category: auction.category || '',
      image_url: auction.image_url || '',
      image_urls: [auction.thumbnail_url, ...(auction.image_urls || [])].filter(Boolean),
    }));
    const aiResponse = await postJson(endpoint, { products });
    if (aiResponse.ok) {
      const payload = await aiResponse.json();
      const aiResults = payload?.results || [];
      if (aiResults.length > 0) {
        validationMode = 'ai+heuristic';
        results = aiResults;
      }
    }
  }
} catch (error) {
  validationMode = 'heuristic-fallback';
}

writeJson(path.join(outputDir, 'product-image-validation.json'), { generated_at: new Date().toISOString(), validation_mode: validationMode, results });
console.log(`Product image validation finished for ${results.length} image references (${validationMode}).`);