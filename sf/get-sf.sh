#!/usr/bin/env bash
set -euo pipefail

# --- 0) Workspace -------------------------------------------------------------
ROOT="${PWD}/sf-dump-$(date +%Y%m%d-%H%M%S)"
OUT="${ROOT}/out"
MDAPI="${OUT}/mdapi"
DESCRIBES="${OUT}/describes"
mkdir -p "$OUT" "$MDAPI" "$DESCRIBES"

echo "Workspace: $ROOT"

# --- 1) Ensure CLI + login ---------------------------------------------------
# (Skip the next line if you're already logged in with alias snessorg)
# npm i -g @salesforce/cli
sf org login web -a snessorg || true

# Snapshot org basics
sf org display -o snessorg --json > "${OUT}/org-display.json"

# --- 2) Explore metadata surface ---------------------------------------------
sf org list metadata-types -o snessorg --json > "${OUT}/metadata-types.json"

# Optional: list sObjects available to the org (handy reference)
sf sobject list -o snessorg --json > "${OUT}/sobjects.json"

# --- 3) Create a DX project and manifest from ORG ----------------------------
cd "$ROOT"
sf project generate --name sness-backup --manifest >/dev/null
cd sness-backup

# Build a "grab everything present" manifest from the org
sf project generate manifest \
  --from-org snessorg \
  --output-dir manifest \
  --name allMetadata

# Keep a copy of the manifest for auditing
cp -r manifest "${OUT}/manifest-copy"

# --- 4) Retrieve (SOURCE FORMAT) to force-app --------------------------------
sf project retrieve start \
  -x manifest/allMetadata/package.xml \
  -o snessorg \
  --json > "${OUT}/retrieve-source.json"

# Your source now lives under: ${ROOT}/sness-backup/force-app

# --- 5) Retrieve (MDAPI ZIP) and convert to source ---------------------------
sf metadata retrieve \
  -x manifest/allMetadata/package.xml \
  -o snessorg \
  -r "${MDAPI}"

# MDAPI retrieve creates: ${MDAPI}/unpackaged.zip
unzip -o "${MDAPI}/unpackaged.zip" -d "${MDAPI}/unpackaged" >/dev/null

# Convert MDAPI -> separate source tree (for diffing)
sf project convert mdapi \
  -r "${MDAPI}/unpackaged" \
  -d "${MDAPI}/src"

# --- 6) Schema exports via SOQL (Tooling API) --------------------------------
# All entities
sf data query -o snessorg \
  -q "SELECT QualifiedApiName, Label, IsCustomObject, IsQueryable, IsUpdatable FROM EntityDefinition" \
  --json > "${OUT}/EntityDefinition.json"

# All fields (can be large)
sf data query -o snessorg \
  -q "SELECT EntityDefinition.QualifiedApiName, QualifiedApiName, Label, DataType, Length, Precision, Scale, IsCalculated, IsNillable FROM FieldDefinition" \
  --json > "${OUT}/FieldDefinition.json"

# --- 7) Per-sObject DESCRIBE snapshots (REST-like detail) --------------------
# Requires jq for JSON parsing; install with `sudo apt-get install jq` if needed.
jq -r '.result[]?' "${OUT}/sobjects.json" | while read -r SOBJ; do
  # Guard against blank lines
  [ -z "$SOBJ" ] && continue
  sf sobject describe -o snessorg -s "$SOBJ" --json > "${DESCRIBES}/${SOBJ}.json" || true
done

# --- 8) Useful extras ---------------------------------------------------------
# Limits snapshot (nice to have)
sf limits api display -o snessorg --json > "${OUT}/limits.json"

echo
echo "Done!"
echo "- Project (source): ${ROOT}/sness-backup/force-app"
echo "- MDAPI ZIP:        ${MDAPI}/unpackaged.zip"
echo "- MDAPI -> source:  ${MDAPI}/src"
echo "- Manifest:         ${OUT}/manifest-copy/allMetadata/package.xml"
echo "- Types list:       ${OUT}/metadata-types.json"
echo "- sObjects list:    ${OUT}/sobjects.json"
echo "- Describes:        ${DESCRIBES}/<SObject>.json"
echo "- Entity/FieldDef:  ${OUT}/EntityDefinition.json, ${OUT}/FieldDefinition.json"


