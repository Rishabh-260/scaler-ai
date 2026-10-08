"""Gemini summary generation; the API key is read only on the backend."""

import os

from google import genai

from .schemas import GeneratedNotes


def generate_notes(transcript: list[dict]) -> GeneratedNotes:
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("Set GEMINI_API_KEY in the backend environment to generate notes.")
    model = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
    transcript_text = "\n".join(
        f"[{int(row['timestamp_seconds']) // 60:02d}:{int(row['timestamp_seconds']) % 60:02d}] "
        f"{row['speaker']}: {row['text']}" for row in transcript
    )
    client = genai.Client(api_key=api_key)
    response = client.interactions.create(
        model=model,
        input=(
            "Create concise, faithful meeting notes from this transcript. Do not invent facts. "
            "Return an overview, 3 to 6 key topics with the nearest timestamps in seconds, and "
            "action items with an owner only when explicitly clear. Due dates should be null "
            "unless explicit.\n\n" + transcript_text
        ),
        response_format={
            "type": "text",
            "mime_type": "application/json",
            "schema": GeneratedNotes.model_json_schema(),
        },
    )
    output_text = getattr(response, "output_text", None)
    if not output_text:
        raise RuntimeError("Gemini returned an empty response. Try generating notes again.")
    return GeneratedNotes.model_validate_json(output_text)

