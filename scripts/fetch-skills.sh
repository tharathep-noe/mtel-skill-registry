#!/bin/bash
# fetch-skills.sh
# Clones the registry repo and copies matched skills into .claude/skills/
#
# Usage: ./scripts/fetch-skills.sh <registry-url> <skill-path-1> <skill-path-2> ...
#
# Example:
#   ./scripts/fetch-skills.sh https://github.com/company/mtel-skill-registry.git \
#     frontend/nextjs frontend/tailwind database/supabase
#
# Environment variables:
#   REGISTRY_TOKEN — GitHub token for private repo access (optional)

set -euo pipefail

if [ $# -lt 2 ]; then
  echo "Usage: $0 <registry-url> <skill-path-1> [skill-path-2 ...]"
  exit 1
fi

REGISTRY_URL="$1"
shift
SKILL_PATHS=("$@")
TMP_DIR=$(mktemp -d)
TARGET_DIR=".claude/skills"

# Always clean up the temp clone, even on error or interrupt.
trap 'rm -rf "$TMP_DIR"' EXIT

# Build clone URL with token if provided
if [ -n "${REGISTRY_TOKEN:-}" ]; then
  # Insert token into HTTPS URL: https://token@github.com/...
  CLONE_URL="${REGISTRY_URL/https:\/\//https:\/\/${REGISTRY_TOKEN}@}"
else
  CLONE_URL="$REGISTRY_URL"
fi

# Shallow + sparse: fetch only the matched skill directories rather than the
# whole registry (requires git >= 2.25). Clone errors are surfaced, not hidden.
echo "Cloning registry (shallow, sparse)..."
git clone --depth 1 --filter=blob:none --sparse "$CLONE_URL" "$TMP_DIR"
git -C "$TMP_DIR" sparse-checkout set "${SKILL_PATHS[@]}"

mkdir -p "$TARGET_DIR"

for SKILL_PATH in "${SKILL_PATHS[@]}"; do
  SKILL_NAME=$(basename "$SKILL_PATH")
  SOURCE="$TMP_DIR/$SKILL_PATH"

  if [ ! -d "$SOURCE" ]; then
    echo "  ⚠  Skill path not found: $SKILL_PATH — skipping"
    continue
  fi

  if [ -d "$TARGET_DIR/$SKILL_NAME" ]; then
    echo "  - $SKILL_NAME (already exists, skipping)"
    continue
  fi

  cp -r "$SOURCE" "$TARGET_DIR/$SKILL_NAME"
  echo "  ✓ $SKILL_NAME → .claude/skills/$SKILL_NAME"
done

echo "Done."
