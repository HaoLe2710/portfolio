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

release_build_token="${PORTFOLIO_BUILD_TOKEN:-}"
unset PORTFOLIO_RELEASE_ID PORTFOLIO_RELEASE_CHECKSUM PORTFOLIO_BUILD_TOKEN

if [[ "$branch" != "main" && -n "$release_build_token" ]]; then
  export PORTFOLIO_BUILD_LOOKUP_TOKEN="$release_build_token"
  release_context=""
  set +e
  release_context="$(node scripts/resolve-release-build.mjs)"
  resolver_status=$?
  set -e
  unset PORTFOLIO_BUILD_LOOKUP_TOKEN

  if [[ "$resolver_status" -eq 0 ]]; then
    IFS=$'\t' read -r release_id release_checksum release_commit_sha <<< "$release_context"
    if [[ ! "$release_id" =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$ || ! "$release_checksum" =~ ^[0-9a-f]{64}$ || ! "$release_commit_sha" =~ ^[0-9a-f]{40}$ ]]; then
      echo "The staging release context returned an invalid identity." >&2
      exit 1
    fi
    export PORTFOLIO_RELEASE_ID="$release_id"
    export PORTFOLIO_RELEASE_CHECKSUM="$release_checksum"
    export PORTFOLIO_BUILD_TOKEN="$release_build_token"
    printf 'Cloudflare Pages build is pinned to release %s at commit %s.\n' "$release_id" "$release_commit_sha"
  elif [[ "$resolver_status" -eq 3 ]]; then
    echo "No staging release is assigned to this Preview deployment; building an ordinary Preview."
  else
    echo "Could not resolve the staging release context for this Preview deployment." >&2
    exit "$resolver_status"
  fi
fi
unset release_build_token

pnpm run build

if [[ -n "${PORTFOLIO_RELEASE_ID:-}" ]]; then
  node scripts/write-release-manifest.mjs
fi
