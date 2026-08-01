import fs from 'fs';
import path from 'path';

const outputDir = path.resolve('frontend/qa-output');
const baseURL = process.env.QA_BASE_URL;
if (!baseURL) {
  fs.writeFileSync(path.join(outputDir, 'product-image-validation.json'), JSON.stringify({ generated_at: new Date().toISOString(), validation_mode: 'skipped', results: [] }, null, 2));
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

const results = auctions.slice(0, 80).flatMap((auction) => {
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

fs.writeFileSync(path.join(outputDir, 'product-image-validation.json'), JSON.stringify({ generated_at: new Date().toISOString(), validation_mode: 'heuristic', results }, null, 2));
console.log(`Product image validation finished for ${results.length} image references.`);