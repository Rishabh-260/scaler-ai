"""FastAPI application for the meeting library and transcript workspace."""

import os
import re
import sqlite3
import uuid
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .ai import generate_notes
from .db import connect, initialize
from .schemas import ActionItemCreate, ActionItemUpdate, MeetingCreate, MeetingUpdate
from .seed import seed_database
from .transcripts import parse_transcript


@asynccontextmanager
async def lifespan(_: FastAPI):
    initialize()
    seed_database()
    yield


app = FastAPI(title="Meetings Workspace API", version="1.0.0", lifespan=lifespan)
origins = ["http://localhost:3000", "http://127.0.0.1:3000"]
if os.getenv("FRONTEND_ORIGIN"):
    origins.extend(value.strip() for value in os.environ["FRONTEND_ORIGIN"].split(",") if value.strip())
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])


def participants_for(connection: sqlite3.Connection, meeting_id: str) -> list[str]:
    return [row[0] for row in connection.execute(
        "SELECT p.name FROM participants p JOIN meeting_participants mp ON mp.participant_id=p.id "
        "WHERE mp.meeting_id=? ORDER BY p.name", (meeting_id,))]


def meeting_card(connection: sqlite3.Connection, row: sqlite3.Row) -> dict:
    names = participants_for(connection, row["id"])
    first = connection.execute(
        "SELECT text FROM transcript_segments WHERE meeting_id=? ORDER BY sequence LIMIT 1", (row["id"],)
    ).fetchone()
    return {"id": row["id"], "title": row["title"], "meeting_date": row["meeting_date"],
            "duration_seconds": row["duration_seconds"], "participants": names,
            "preview": first[0] if first else "No transcript yet"}


def full_meeting(connection: sqlite3.Connection, meeting_id: str) -> dict | None:
    row = connection.execute("SELECT * FROM meetings WHERE id=?", (meeting_id,)).fetchone()
    if not row:
        return None
    segments = [dict(item) for item in connection.execute(
        "SELECT id,sequence,timestamp_seconds,speaker,text FROM transcript_segments "
        "WHERE meeting_id=? ORDER BY sequence", (meeting_id,))]
    summary = connection.execute("SELECT overview,generated_at FROM summaries WHERE meeting_id=?", (meeting_id,)).fetchone()
    topics = [dict(item) for item in connection.execute(
        "SELECT id,title,timestamp_seconds,sequence FROM topics WHERE meeting_id=? ORDER BY sequence", (meeting_id,))]
    actions = [dict(item) for item in connection.execute(
        "SELECT id,description,owner,due_date,is_complete,source FROM action_items WHERE meeting_id=? ORDER BY id", (meeting_id,))]
    return {"id": row["id"], "title": row["title"], "meeting_date": row["meeting_date"],
            "duration_seconds": row["duration_seconds"], "participants": participants_for(connection, meeting_id),
            "transcript": segments, "summary": dict(summary) if summary else None,
            "topics": topics, "action_items": actions}


def set_participants(connection: sqlite3.Connection, meeting_id: str, names: list[str]) -> None:
    connection.execute("DELETE FROM meeting_participants WHERE meeting_id=?", (meeting_id,))
    clean_names = list(dict.fromkeys(name.strip() for name in names if name.strip()))
    for name in clean_names:
        connection.execute("INSERT OR IGNORE INTO participants(name) VALUES(?)", (name,))
        participant_id = connection.execute("SELECT id FROM participants WHERE name=?", (name,)).fetchone()[0]
        connection.execute("INSERT INTO meeting_participants(meeting_id,participant_id) VALUES(?,?)", (meeting_id, participant_id))


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/meetings")
def list_meetings(q: str = Query(default="", max_length=200), participant: str = "",
                  date_from: str = "", date_to: str = ""):
    query = "SELECT DISTINCT m.* FROM meetings m LEFT JOIN meeting_participants mp ON mp.meeting_id=m.id " \
            "LEFT JOIN participants p ON p.id=mp.participant_id " \
            "LEFT JOIN transcript_segments ts ON ts.meeting_id=m.id WHERE 1=1"
    params: list[str] = []
    if q.strip():
        query += " AND (m.title LIKE ? OR p.name LIKE ? OR ts.text LIKE ?)"
        needle = f"%{q.strip()}%"
        params.extend([needle, needle, needle])
    if participant.strip():
        query += " AND p.name LIKE ?"
        params.append(f"%{participant.strip()}%")
    if date_from:
        query += " AND substr(m.meeting_date,1,10)>=?"
        params.append(date_from)
    if date_to:
        query += " AND substr(m.meeting_date,1,10)<=?"
        params.append(date_to)
    query += " ORDER BY m.meeting_date DESC"
    with connect() as connection:
        rows = connection.execute(query, params).fetchall()
        return [meeting_card(connection, row) for row in rows]


@app.post("/api/meetings", status_code=201)
def create_meeting(payload: MeetingCreate):
    try:
        segments = parse_transcript(payload.transcript)
        meeting_date = datetime.fromisoformat(payload.meeting_date).isoformat(timespec="seconds")
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    max_time = max((segment["timestamp_seconds"] for segment in segments), default=0)
    duration = max(payload.duration_seconds, int(max_time) + 1)
    meeting_id = str(uuid.uuid4())
    with connect() as connection:
        connection.execute("INSERT INTO meetings(id,title,meeting_date,duration_seconds) VALUES(?,?,?,?)",
                           (meeting_id, payload.title.strip(), meeting_date, duration))
        set_participants(connection, meeting_id, payload.participants)
        connection.executemany(
            "INSERT INTO transcript_segments(meeting_id,sequence,timestamp_seconds,speaker,text) VALUES(?,?,?,?,?)",
            [(meeting_id, row["sequence"], row["timestamp_seconds"], row["speaker"], row["text"]) for row in segments],
        )
        return full_meeting(connection, meeting_id)


@app.get("/api/meetings/{meeting_id}")
def get_meeting(meeting_id: str):
    with connect() as connection:
        result = full_meeting(connection, meeting_id)
    if not result:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return result


@app.put("/api/meetings/{meeting_id}")
def update_meeting(meeting_id: str, payload: MeetingUpdate):
    try:
        meeting_date = datetime.fromisoformat(payload.meeting_date).isoformat(timespec="seconds")
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="Meeting date must be ISO format") from exc
    with connect() as connection:
        if not connection.execute("SELECT 1 FROM meetings WHERE id=?", (meeting_id,)).fetchone():
            raise HTTPException(status_code=404, detail="Meeting not found")
        connection.execute("UPDATE meetings SET title=?,meeting_date=? WHERE id=?",
                           (payload.title.strip(), meeting_date, meeting_id))
        set_participants(connection, meeting_id, payload.participants)
        return full_meeting(connection, meeting_id)


@app.delete("/api/meetings/{meeting_id}", status_code=204)
def delete_meeting(meeting_id: str):
    with connect() as connection:
        cursor = connection.execute("DELETE FROM meetings WHERE id=?", (meeting_id,))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Meeting not found")
    return None


@app.get("/api/meetings/{meeting_id}/transcript/search")
def search_transcript(meeting_id: str, q: str = Query(min_length=1, max_length=200)):
    with connect() as connection:
        if not connection.execute("SELECT 1 FROM meetings WHERE id=?", (meeting_id,)).fetchone():
            raise HTTPException(status_code=404, detail="Meeting not found")
        return [dict(row) for row in connection.execute(
            "SELECT id,sequence,timestamp_seconds,speaker,text FROM transcript_segments "
            "WHERE meeting_id=? AND text LIKE ? ORDER BY sequence", (meeting_id, f"%{q}%"))]


@app.post("/api/meetings/{meeting_id}/generate-summary")
def regenerate_summary(meeting_id: str):
    with connect() as connection:
        if not connection.execute("SELECT 1 FROM meetings WHERE id=?", (meeting_id,)).fetchone():
            raise HTTPException(status_code=404, detail="Meeting not found")
        transcript = [dict(row) for row in connection.execute(
            "SELECT timestamp_seconds,speaker,text FROM transcript_segments WHERE meeting_id=? ORDER BY sequence",
            (meeting_id,))]
    try:
        notes = generate_notes(transcript)
    except Exception as exc:
        # Persisted meeting/transcript remain available when provider configuration or
        # network generation fails; the client can offer a retry.
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    with connect() as connection:
        connection.execute(
            "INSERT INTO summaries(meeting_id,overview) VALUES(?,?) "
            "ON CONFLICT(meeting_id) DO UPDATE SET overview=excluded.overview,generated_at=CURRENT_TIMESTAMP",
            (meeting_id, notes.overview.strip()),
        )
        connection.execute("DELETE FROM topics WHERE meeting_id=?", (meeting_id,))
        connection.execute("DELETE FROM action_items WHERE meeting_id=? AND source='ai'", (meeting_id,))
        connection.executemany(
            "INSERT INTO topics(meeting_id,title,timestamp_seconds,sequence) VALUES(?,?,?,?)",
            [(meeting_id, topic.title.strip(), max(0, topic.timestamp_seconds), index)
             for index, topic in enumerate(notes.topics)],
        )
        connection.executemany(
            "INSERT INTO action_items(meeting_id,description,owner,due_date,source) VALUES(?,?,?,?, 'ai')",
            [(meeting_id, item.description.strip(), item.owner, item.due_date)
             for item in notes.action_items if item.description.strip()],
        )
        return full_meeting(connection, meeting_id)


@app.post("/api/meetings/{meeting_id}/action-items", status_code=201)
def add_action_item(meeting_id: str, payload: ActionItemCreate):
    with connect() as connection:
        if not connection.execute("SELECT 1 FROM meetings WHERE id=?", (meeting_id,)).fetchone():
            raise HTTPException(status_code=404, detail="Meeting not found")
        cursor = connection.execute(
            "INSERT INTO action_items(meeting_id,description,owner,due_date) VALUES(?,?,?,?)",
            (meeting_id, payload.description.strip(), payload.owner, payload.due_date),
        )
        row = connection.execute("SELECT id,description,owner,due_date,is_complete,source FROM action_items WHERE id=?",
                                 (cursor.lastrowid,)).fetchone()
        return dict(row)


@app.put("/api/action-items/{item_id}")
def update_action_item(item_id: int, payload: ActionItemUpdate):
    with connect() as connection:
        cursor = connection.execute(
            "UPDATE action_items SET description=?,owner=?,due_date=?,is_complete=? WHERE id=?",
            (payload.description.strip(), payload.owner, payload.due_date, int(payload.is_complete), item_id),
        )
        if not cursor.rowcount:
            raise HTTPException(status_code=404, detail="Action item not found")
        return dict(connection.execute(
            "SELECT id,description,owner,due_date,is_complete,source FROM action_items WHERE id=?", (item_id,)
        ).fetchone())


@app.delete("/api/action-items/{item_id}", status_code=204)
def delete_action_item(item_id: int):
    with connect() as connection:
        cursor = connection.execute("DELETE FROM action_items WHERE id=?", (item_id,))
        if not cursor.rowcount:
            raise HTTPException(status_code=404, detail="Action item not found")
    return None

