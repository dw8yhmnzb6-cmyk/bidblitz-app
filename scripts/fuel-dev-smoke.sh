#!/usr/bin/env bash
# Fast offline smoke gate for BidBlitz Fuel. Never deploys or runs payments.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

# Worktrees may not share node_modules. Use a working dependency tree instead
# of an incomplete frontend/node_modules symlink. Can be set explicitly in CI.
if [[ -n "${FUEL_NODE_MODULES:-}" ]]; then
  deps="$FUEL_NODE_MODULES"
elif [[ -f "$root/node_modules/react/package.json" ]]; then
  deps="$root/node_modules"
else
  primary="$(git worktree list --porcelain | sed -n '1s/^worktree //p')"
  deps="$primary/node_modules"
fi
if [[ ! -f "$deps/react/package.json" || ! -f "$deps/@babel/core/package.json" ]]; then
  echo "Missing React/Babel dependencies: set FUEL_NODE_MODULES to an installed node_modules folder" >&2
  exit 2
fi

echo "Fuel frontend smoke: React + Babel + server render + API mocks"
NODE_PATH="$deps${NODE_PATH:+:$NODE_PATH}" node --test \
  frontend/tests/fuel-commercial-preview.test.cjs \
  frontend/tests/fuel-discovery-preflight.test.cjs

if [[ -n "${FUEL_PYTHON:-}" ]]; then
  python_exec="$FUEL_PYTHON"
  echo "Fuel backend suite: all fuel test files"
  "$python_exec" -m unittest discover -s backend/tests -p 'test_fuel_*.py' -q
else
  echo "Fuel core: standard-library-only calculations"
  python3 -m unittest discover -s backend/tests -p 'test_fuel_business_model.py' -q
  echo "Set FUEL_PYTHON to a Python with FastAPI installed to run the full Fuel suite."
fi
echo "FUEL_DEV_SMOKE_OK (no deployment, no payment execution)"
