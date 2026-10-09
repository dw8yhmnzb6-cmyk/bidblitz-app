/** Frontend registry is authoritative; backend receives a deployable checked copy. */
const fs = require("node:fs");
const path = require("node:path");
const source = path.resolve(__dirname, "../src/config/gamesLanguages.json");
const target = path.resolve(__dirname, "../../backend/data/games_languages.json");
const content = fs.readFileSync(source, "utf8");
const entries = JSON.parse(content);
const codes = entries.map(({ code }) => code);
if (codes.length !== 51 || new Set(codes).size !== 51) throw new Error("Expected 51 unique Games language options.");
if (process.argv.includes("--check")) {
  if (!fs.existsSync(target) || fs.readFileSync(target, "utf8") !== content) throw new Error("Backend language registry is stale. Run sync-games-languages.cjs.");
  console.log("Frontend/backend Games language registries match (51 options).");
} else {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}
