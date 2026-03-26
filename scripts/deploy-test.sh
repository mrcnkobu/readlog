#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR"
npm run build

# shellcheck disable=SC1091
source "$ROOT_DIR/scripts/deploy-common.sh"
deploy_plugin "${READLOG_TEST_VAULT:-}" "test"
