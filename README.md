# Fireflies-Style Meeting Notes Workspace

A full-stack meeting library and post-meeting workspace built for the SDE full-stack assignment. It provides a searchable meetings library, speaker-labeled transcripts, simulated synchronized playback, meeting summaries, topics, and editable action items.

## Stack

- **Frontend:** Next.js App Router, React, TypeScript, CSS
- **Backend:** Python, FastAPI, Pydantic
- **Database:** SQLite with foreign-key relationships
- **AI notes:** Google Gemini API, configured on the backend

Real audio capture and speech-to-text are outside scope. The player is an interactive timeline placeholder; transcript timestamps drive seeking and the active line.

## Run locally

Requirements: Python 3.10+ and Node.js 20+.

### 1. Start the API

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

Set `GEMINI_API_KEY` in your shell or in the environment used to launch Uvicorn. The library and seeded meetings work without the key; creating a meeting still saves the transcript, while summary generation returns a retryable error until the key is configured.

```powershell
uvicorn app.main:app --reload --port 8000
```

The first startup creates `backend/data/meetings.db` and seeds six meetings with transcripts, summaries, topics, and action items. API docs are available at `http://localhost:8000/docs`.

### 2. Start the web app

```powershell
cd ..\frontend
npm install
Copy-Item .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. The frontend reads `NEXT_PUBLIC_API_BASE_URL`, defaulting to `http://localhost:8000/api`.

## Gemini configuration

Set these on the **backend only**:

| Variable | Purpose | Default |
|---|---|---|
| `GEMINI_API_KEY` | Google AI Studio API key | unset; needed to generate meeting notes |
| `GEMINI_MODEL` | Gemini model name | `gemini-3.8-flash` |

Generation requests return a typed JSON result containing an overview, timestamped topics, and action items. The meeting and transcript are committed before note generation; if Gemini is unavailable, the user can retry from the meeting page. Seeded content is deterministic and does not call Gemini.

## Architecture

The Next.js app has two primary routes: `/` for the meetings library and `/meetings/[id]` for the meeting workspace. The library calls REST endpoints for recent meetings, filtering, and meeting creation. The detail view loads one meeting and uses the REST API for metadata updates, summary regeneration, and action-item changes. Transcript search is performed immediately in the browser against the loaded transcript. The API also exposes a transcript-search endpoint for clients that prefer server-side search.

FastAPI owns the business logic and SQLite persistence. SQLite foreign keys cascade meeting deletion through participants, transcript segments, summaries, topics, and action items. Gemini credentials never reach the browser. The schema and parser are in `backend/app/db.py`, `backend/app/schemas.py`, and `backend/app/transcripts.py`; API handlers live in `backend/app/main.py`.

## Database schema

| Table | Purpose | Relationships |
|---|---|---|
| `meetings` | Title, date/time, duration | Parent of all meeting records |
| `participants` | Reusable participant names | Linked to meetings through `meeting_participants` |
| `meeting_participants` | Meeting/participant join table | Composite primary key; cascades on either parent deletion |
| `transcript_segments` | Ordered speaker, timestamp, and text rows | Many segments per meeting; unique sequence per meeting |
| `summaries` | Generated overview and generation time | One summary per meeting |
| `topics` | Timestamped meeting outline entries | Many topics per meeting |
| `action_items` | Description, owner, due date, completion, and source | Many tasks per meeting; `source` distinguishes seed, AI, and manual items |

## API overview

All routes use the `/api` prefix. Request and response payloads are JSON except `204` delete responses.

| Method | Route | Behavior |
|---|---|---|
| `GET` | `/health` | Health status |
| `GET` | `/meetings?q=&participant=&date_from=&date_to=` | Search/filter meetings, newest first; `q` also checks transcript text |
| `POST` | `/meetings` | Create meeting, participants, and parsed transcript; accepts `title`, ISO `meeting_date`, `duration_seconds`, `participants[]`, and `transcript` |
| `GET` | `/meetings/{id}` | Read meeting, participants, transcript, summary, topics, action items |
| `PUT` | `/meetings/{id}` | Update title, date, and participant names |
| `DELETE` | `/meetings/{id}` | Delete meeting and cascading child rows |
| `GET` | `/meetings/{id}/transcript/search?q=` | Search transcript segments |
| `POST` | `/meetings/{id}/generate-summary` | Generate and persist Gemini notes; provider errors return `503` and preserve existing data |
| `POST` | `/meetings/{id}/action-items` | Add a manual task |
| `PUT` | `/action-items/{id}` | Edit a task or its completion state |
| `DELETE` | `/action-items/{id}` | Delete a task |

Accepted transcript inputs are plain text and WebVTT. Plain text supports one utterance per line (`Speaker: words`) and optional leading timestamps (`[00:12] Speaker: words`). Lines without a speaker label use `Speaker`; untimed plain-text lines receive 18-second intervals.

## Product behavior

- Meeting library searches title, participant, and transcript content; participant and date filters can be combined.
- Clicking a transcript line or topic moves the placeholder player; moving the seek bar highlights the active transcript line.
- Search highlights matching transcript phrases and filters visible lines.
- Create, edit, delete, summary retry, action-item create/edit/delete/complete, and Markdown export are available in the interface.
- Settings, team, calendar, and integrations are clearly marked placeholders.
- The app assumes a default local user and does not implement authentication.

## Deployment preparation

The apps are configured through environment variables and can be deployed separately. Deploy the frontend as a Next.js service with `NEXT_PUBLIC_API_BASE_URL` set to the public API URL. Deploy the FastAPI service with `GEMINI_API_KEY`, `GEMINI_MODEL`, `DATABASE_PATH`, and `FRONTEND_ORIGIN` set. Point `DATABASE_PATH` at a persistent mounted volume so the SQLite database survives service restarts. Add the deployed frontend origin to `FRONTEND_ORIGIN` (comma-separated origins are supported). Do not commit provider keys or `.env` files. GitHub publication and hosted deployment are intentionally left for a configured account and destination.

## Notes

- AI output is a draft and is editable through action-item controls; summary text can be regenerated.
- Regenerating notes replaces existing topics and AI-generated action items while preserving manual and seeded tasks.
- Seed data initializes only when the `meetings` table is empty, so deleting an individual seeded meeting does not recreate it on restart.

