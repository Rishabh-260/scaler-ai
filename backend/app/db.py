"""SQLite connection helpers and schema initialization."""

import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")


def database_path() -> Path:
    path = Path(os.getenv("DATABASE_PATH", "./data/meetings.db")).expanduser()
    if not path.is_absolute():
        path = Path(__file__).resolve().parents[1] / path
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


@contextmanager
def connect() -> Iterator[sqlite3.Connection]:
    connection = sqlite3.connect(database_path(), timeout=15)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def initialize() -> None:
    with connect() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS meetings (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                meeting_date TEXT NOT NULL,
                duration_seconds INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS participants (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE
            );
            CREATE TABLE IF NOT EXISTS meeting_participants (
                meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
                participant_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
                PRIMARY KEY (meeting_id, participant_id)
            );
            CREATE TABLE IF NOT EXISTS transcript_segments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
                sequence INTEGER NOT NULL,
                timestamp_seconds REAL NOT NULL DEFAULT 0,
                speaker TEXT NOT NULL,
                text TEXT NOT NULL,
                UNIQUE (meeting_id, sequence)
            );
            CREATE TABLE IF NOT EXISTS summaries (
                meeting_id TEXT PRIMARY KEY REFERENCES meetings(id) ON DELETE CASCADE,
                overview TEXT NOT NULL,
                generated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS topics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                timestamp_seconds REAL NOT NULL DEFAULT 0,
                sequence INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS action_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
                description TEXT NOT NULL,
                owner TEXT,
                due_date TEXT,
                is_complete INTEGER NOT NULL DEFAULT 0,
                source TEXT NOT NULL DEFAULT 'manual',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_meetings_date ON meetings(meeting_date DESC);
            CREATE INDEX IF NOT EXISTS idx_segments_meeting_sequence ON transcript_segments(meeting_id, sequence);
            CREATE INDEX IF NOT EXISTS idx_action_items_meeting ON action_items(meeting_id, id);
            """
        )
