#!/usr/bin/env bash
set -euo pipefail

branch="${CF_PAGES_BRANCH:-local}"

if [[ "$branch" == "main" ]]; then
  export NEXT_PUBLIC_DATA_SOURCE="api"
  export NEXT_PUBLIC_API_BASE_URL="https://web-portfolio-api.lengochao123-27102004.workers.dev/api"
  export NEXT_PUBLIC_SITE_URL="https://web-porfolio.pages.dev"
  export NEXT_PUBLIC_ROBOTS_INDEX="true"
else
  export NEXT_PUBLIC_DATA_SOURCE="api"
  export NEXT_PUBLIC_API_BASE_URL="https://web-portfolio-api-staging.lengochao123-27102004.workers.dev/api"
  export NEXT_PUBLIC_SITE_URL="${CF_PAGES_URL:-http://localhost:8788}"
  export NEXT_PUBLIC_ROBOTS_INDEX="false"
fi

printf 'Cloudflare Pages build: branch=%s data-source=%s site-url=%s\n' \
  "$branch" "$NEXT_PUBLIC_DATA_SOURCE" "$NEXT_PUBLIC_SITE_URL"

if [[ -n "${PORTFOLIO_RELEASE_ID:-}" || -n "${PORTFOLIO_BUILD_TOKEN:-}" ]]; then
  if [[ -z "${PORTFOLIO_RELEASE_ID:-}" || -z "${PORTFOLIO_BUILD_TOKEN:-}" || -z "${PORTFOLIO_RELEASE_CHECKSUM:-}" ]]; then
    echo "Portfolio release build is missing required release configuration." >&2
    exit 1
  fi
  if [[ ! "${PORTFOLIO_RELEASE_CHECKSUM}" =~ ^[0-9a-f]{64}$ ]]; then
    echo "Portfolio release checksum must be a SHA-256 hex digest." >&2
    exit 1
  fi
fi

pnpm run build

if [[ -n "${PORTFOLIO_RELEASE_ID:-}" ]]; then
  node scripts/write-release-manifest.mjs
fi
