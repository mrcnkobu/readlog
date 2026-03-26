#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLUGIN_ID="readlog"

if [[ -f "$ROOT_DIR/.env" ]]; then
	set -a
	# shellcheck disable=SC1091
	source "$ROOT_DIR/.env"
	set +a
fi

deploy_plugin() {
	local vault_path="$1"
	local label="$2"

	if [[ -z "$vault_path" ]]; then
		echo "Missing vault path for $label deployment." >&2
		exit 1
	fi

	local plugin_path="$vault_path/.obsidian/plugins/$PLUGIN_ID"
	mkdir -p "$plugin_path"

	cp "$ROOT_DIR/main.js" "$ROOT_DIR/manifest.json" "$ROOT_DIR/styles.css" "$plugin_path/"

	echo "Deployed Readlog to $label vault: $plugin_path"
}
