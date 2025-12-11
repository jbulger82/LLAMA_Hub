#!/usr/bin/env python3
"""
Simple CLI to transcribe an audio file with faster-whisper.
Exits with non-zero status if transcription fails.
"""
import argparse
import os
import sys
from pathlib import Path

try:
    from faster_whisper import WhisperModel
except ImportError as exc:
    raise SystemExit(
        "faster-whisper is required. Install it in your Python environment:\n"
        "  pip install faster-whisper"
    ) from exc


def build_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Transcribe audio with faster-whisper.")
    parser.add_argument("--audio", required=True, help="Path to the audio file (wav, mp3, etc.).")
    parser.add_argument("--model", default=os.environ.get("WHISPER_MODEL", "base.en"),
                        help="Model size/path to load (default: base.en or WHISPER_MODEL env).")
    parser.add_argument("--device", default=os.environ.get("WHISPER_DEVICE", "auto"),
                        help="Device to run on: cpu, cuda, auto… (default: auto).")
    parser.add_argument("--compute-type", default=os.environ.get("WHISPER_COMPUTE_TYPE", "int8_float32"),
                        help="Computation type (see faster-whisper docs).")
    parser.add_argument("--beam-size", type=int, default=int(os.environ.get("WHISPER_BEAM_SIZE", "5")),
                        help="Beam size for decoding.")
    return parser.parse_args()


def main() -> None:
    args = build_args()
    audio_path = Path(args.audio)
    if not audio_path.is_file():
        raise SystemExit(f"Audio file not found: {audio_path}")

    model = WhisperModel(
        args.model,
        device=args.device,
        compute_type=args.compute_type,
    )

    segments, _ = model.transcribe(
        str(audio_path),
        beam_size=args.beam_size,
        vad_filter=True,
    )

    transcript_parts = [segment.text.strip() for segment in segments if segment.text.strip()]
    transcript = " ".join(transcript_parts).strip()
    print(transcript)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(1)
