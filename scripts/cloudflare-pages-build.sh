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
  export NEXT_PUBLIC_API_BASE_URL="https://web-portfolio-api.lengochao123-27102004.workers.dev/api"
  export NEXT_PUBLIC_SITE_URL="${CF_PAGES_URL:-https://web-porfolio.pages.dev}"
  export NEXT_PUBLIC_ROBOTS_INDEX="false"
fi

printf 'Cloudflare Pages build: branch=%s data-source=%s site-url=%s\n' \
  "$branch" "$NEXT_PUBLIC_DATA_SOURCE" "$NEXT_PUBLIC_SITE_URL"
pnpm run build
