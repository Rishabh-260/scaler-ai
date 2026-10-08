"""Parse pasted plain text and WebVTT into timestamped transcript segments."""

import re

TIMECODE = re.compile(r"(?:(\d{1,2}):)?(\d{2}):(\d{2})[.,](\d{1,3})")
SPEAKER = re.compile(r"^\s*([^:]{1,60}):\s*(.+)$")


def seconds(code: str) -> float:
    match = TIMECODE.search(code)
    if not match:
        return 0.0
    hours, minutes, secs, fraction = match.groups()
    return (int(hours or 0) * 3600 + int(minutes) * 60 + int(secs)
            + int(fraction.ljust(3, "0")) / 1000)


def parse_transcript(source: str) -> list[dict]:
    source = source.strip().lstrip("\ufeff")
    if not source:
        raise ValueError("Transcript is empty")
    segments: list[dict] = []
    is_vtt = "-->" in source or source.upper().startswith("WEBVTT")
    if is_vtt:
        blocks = re.split(r"\n\s*\n", source)
        entries = []
        for block in blocks:
            lines = [line.strip() for line in block.splitlines() if line.strip()]
            if not lines or lines[0].upper().startswith(("WEBVTT", "NOTE", "STYLE", "REGION")):
                continue
            cue_line = next((line for line in lines if "-->" in line), None)
            if not cue_line:
                continue
            body_index = lines.index(cue_line) + 1
            entries.append((seconds(cue_line.split("-->")[0]), " ".join(lines[body_index:])))
    else:
        # Plain text supports one utterance per line. A line without a
        # "Speaker: words" prefix is assigned to the default speaker.
        entries = []
        for line in source.splitlines():
            line = line.strip()
            if not line:
                continue
            cue_match = re.match(r"^\[(.+?)\]\s*(.*)$", line)
            entries.append((seconds(cue_match.group(1)) if cue_match else len(entries) * 18.0,
                            cue_match.group(2) if cue_match else line))

    for start, body in entries:
        voice_match = re.match(r"^<v(?:\s+([^>]+))?>(.*?)</v>$", body, re.IGNORECASE)
        if voice_match:
            speaker, text = voice_match.group(1) or "Speaker", voice_match.group(2)
        else:
            speaker_match = SPEAKER.match(body)
            speaker = speaker_match.group(1).strip() if speaker_match else "Speaker"
            text = speaker_match.group(2).strip() if speaker_match else body
        text = re.sub(r"<[^>]+>", "", text).strip()
        if text:
            segments.append({"sequence": len(segments), "timestamp_seconds": start,
                             "speaker": speaker, "text": text})
    if not segments:
        raise ValueError("No transcript lines could be read. Paste plain text or valid WebVTT.")
    return segments
