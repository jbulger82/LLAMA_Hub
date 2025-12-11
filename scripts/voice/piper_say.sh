#!/usr/bin/env bash
set -euo pipefail

# Environment overrides (optional)
VENV_DIR="${PIPER_VENV:-$HOME/.piper_venv}"
MODEL_PATH="${PIPER_MODEL:-$HOME/piper_voices/en_US-libritts_r-medium.onnx}"
OUTPUT_FILE="${PIPER_OUTPUT:-/tmp/francine_piper_output.wav}"
PIPER_BIN="${PIPER_BIN:-piper}"
PLAYER_BIN="${PIPER_PLAYER:-aplay}"

if [[ ! -f "$MODEL_PATH" ]]; then
  echo "Piper model not found at $MODEL_PATH. Set PIPER_MODEL to a valid .onnx model." >&2
  exit 1
fi

if [[ -d "$VENV_DIR" && -f "$VENV_DIR/bin/activate" ]]; then
  # shellcheck disable=SC1090
  source "$VENV_DIR/bin/activate"
fi

if ! command -v "$PIPER_BIN" >/dev/null 2>&1; then
  echo "Could not find the 'piper' binary. Add it to PATH or set PIPER_BIN." >&2
  exit 1
fi

if ! command -v "$PLAYER_BIN" >/dev/null 2>&1; then
  echo "Could not find the audio player '$PLAYER_BIN'. Install 'aplay' or set PIPER_PLAYER." >&2
  exit 1
fi

TEXT_INPUT="${1:-}"
if [[ -z "$TEXT_INPUT" ]]; then
  # Read from stdin if no argument was provided
  if ! TEXT_INPUT="$(cat)"; then
    echo "Failed to read text from stdin." >&2
    exit 1
  fi
fi

TEXT_INPUT="$(echo "$TEXT_INPUT" | tr -d '\r')"
if [[ -z "$TEXT_INPUT" ]]; then
  echo "No text provided for Piper speech synthesis." >&2
  exit 1
fi

mkdir -p "$(dirname "$OUTPUT_FILE")"

printf "%s" "$TEXT_INPUT" | "$PIPER_BIN" --model "$MODEL_PATH" --output_file "$OUTPUT_FILE"
"$PLAYER_BIN" "$OUTPUT_FILE" >/dev/null 2>&1
