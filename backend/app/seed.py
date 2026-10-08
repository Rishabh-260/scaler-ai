"""Small deterministic dataset for first launch and offline browsing."""

import uuid

from .db import connect
from .transcripts import parse_transcript


SEEDS = [
    {
        "title": "Product roadmap: Q4 priorities",
        "date": "2026-10-07T14:00:00",
        "duration": 1860,
        "participants": ["Maya Chen", "Alex Rivera", "Jordan Lee"],
        "transcript": """Maya Chen: Thanks for joining. We need to agree on our top Q4 product priorities.
Alex Rivera: The onboarding redesign is ready for a customer pilot, but analytics still needs final review.
Jordan Lee: I can finish the event tracking plan by Friday and share it with the team.
Maya Chen: Great. Let us include onboarding and reliability in the first release milestone.
Alex Rivera: Support tickets are down twelve percent after the navigation changes. We should keep monitoring that.
Jordan Lee: I will add the support trend to the launch dashboard before our next check-in.
Maya Chen: We will review the pilot feedback on October fourteenth and decide whether to widen the rollout.""",
        "summary": "The team aligned on an onboarding pilot and reliability work as the first Q4 milestone. Analytics review and a launch dashboard update are the immediate follow-ups. The team will use pilot feedback on October 14 to decide whether to expand the rollout.",
        "topics": [(0, "Q4 priorities"), (370, "Pilot readiness"), (920, "Reliability and support metrics"), (1460, "Rollout decision")],
        "tasks": [("Complete the event tracking plan", "Jordan Lee", "2026-10-09"), ("Add support trend to the launch dashboard", "Jordan Lee", None), ("Review pilot feedback", "Maya Chen", "2026-10-14")],
    },
    {
        "title": "Customer discovery: Northstar Health",
        "date": "2026-10-06T10:30:00", "duration": 2220,
        "participants": ["Priya Shah", "Sam Patel", "Morgan Price"],
        "transcript": """Priya Shah: Thanks for making time. We would like to understand how your team handles intake today.
Sam Patel: Requests arrive by email and our coordinators copy the details into three different systems.
Morgan Price: That creates duplicate work, especially when a referral is missing insurance information.
Priya Shah: What would a better intake flow need to do first?
Sam Patel: Flag incomplete referrals and show who is responsible for the next step.
Morgan Price: If we can test that with two clinics in November, I can bring the operations leads together.
Priya Shah: We will send a short workflow map by Thursday and schedule a prototype review.""",
        "summary": "Northstar Health's referral intake is fragmented across email and three systems. Coordinators need missing-information flags and clear ownership. A two-clinic pilot in November is a plausible next step, pending a workflow review.",
        "topics": [(0, "Current referral intake"), (520, "Sources of duplicate work"), (1050, "Required workflow improvements"), (1660, "Pilot planning")],
        "tasks": [("Send the intake workflow map", "Priya Shah", "2026-10-08"), ("Bring clinic operations leads to the prototype review", "Morgan Price", None)],
    },
    {
        "title": "Design critique: workspace navigation",
        "date": "2026-10-03T15:00:00", "duration": 1440,
        "participants": ["Elena Garcia", "Noah Brooks", "Ari Kim"],
        "transcript": """Elena Garcia: I have the updated workspace navigation ready for critique.
Noah Brooks: The meeting library is easier to scan, but the active item needs a stronger selected state.
Ari Kim: The transcript panel should keep its width when the notes panel expands.
Elena Garcia: I will test a persistent split layout with a draggable divider.
Noah Brooks: We should check the compact view on smaller laptop screens too.
Ari Kim: I can run the keyboard and focus pass after the layout is ready.
Elena Garcia: I will share the next version by Tuesday.""",
        "summary": "The navigation update is easier to scan. The critique focused on a clearer selected state, a stable transcript panel width, and keyboard accessibility. The next design iteration will test a resizable split layout and compact screens.",
        "topics": [(0, "Navigation review"), (330, "Selected state and panel sizing"), (800, "Responsive and keyboard behavior"), (1170, "Next iteration")],
        "tasks": [("Prototype a draggable split layout", "Elena Garcia", "2026-10-06"), ("Run keyboard and focus review", "Ari Kim", None)],
    },
    {
        "title": "Engineering sync: release readiness",
        "date": "2026-10-02T11:00:00", "duration": 1980,
        "participants": ["Ravi Nair", "Chloe Martin", "Ben Foster"],
        "transcript": """Ravi Nair: We are checking the release blockers before the staging freeze.
Chloe Martin: The migration is complete in staging. I am waiting for the updated rollback notes.
Ben Foster: The API latency alert threshold is too sensitive during the nightly import.
Ravi Nair: Please confirm whether that pattern is expected and propose a threshold adjustment.
Chloe Martin: I will publish the rollback notes today and run the migration checklist once more.
Ben Foster: I will compare the last seven nights and bring a recommendation to tomorrow's sync.
Ravi Nair: We can make the release call after those two checks.""",
        "summary": "The staging migration is complete, but the release call depends on refreshed rollback notes and a review of a noisy latency alert. The team will make the release decision after both checks are complete.",
        "topics": [(0, "Release blockers"), (380, "Staging migration"), (850, "Latency alert"), (1430, "Go/no-go checks")],
        "tasks": [("Publish rollback notes and rerun migration checklist", "Chloe Martin", "2026-10-02"), ("Analyze latency alert patterns and recommend a threshold", "Ben Foster", "2026-10-03")],
    },
    {
        "title": "Marketing launch review: Atlas",
        "date": "2026-09-30T13:30:00", "duration": 1680,
        "participants": ["Tess Walker", "Omar Haddad", "Lena Ortiz"],
        "transcript": """Tess Walker: The Atlas launch is planned for the second week of November.
Omar Haddad: The landing page copy is ready, but legal has not approved the comparison table.
Lena Ortiz: We should prepare a version of the campaign that does not depend on that table.
Tess Walker: Agreed. Omar, can you send the safe copy to legal by tomorrow?
Omar Haddad: Yes. I will include the revised claims and request a review by Friday.
Lena Ortiz: I will update the channel plan and mark the comparison asset as optional.
Tess Walker: We will do a final readiness check next Wednesday.""",
        "summary": "Atlas is targeting a November launch. The comparison table is still awaiting legal review, so the team will prepare a campaign path that does not depend on it. Copy and channel plan updates are due before the next readiness check.",
        "topics": [(0, "Launch timeline"), (400, "Legal review"), (870, "Fallback campaign path"), (1320, "Readiness check")],
        "tasks": [("Send revised claims to legal", "Omar Haddad", "2026-10-01"), ("Update channel plan and mark comparison asset optional", "Lena Ortiz", None)],
    },
    {
        "title": "People team: onboarding improvements",
        "date": "2026-09-28T09:00:00", "duration": 1560,
        "participants": ["Nina Park", "Drew Collins", "Fatima Noor"],
        "transcript": """Nina Park: We reviewed feedback from the last three new-hire cohorts.
Drew Collins: New hires want a clear first-week checklist with owners and links in one place.
Fatima Noor: Managers also need a reminder before day one to set up equipment and access.
Nina Park: Let's test a shared checklist with the product and support teams first.
Drew Collins: I can draft the checklist and gather the links from team leads.
Fatima Noor: I will add the pre-start reminder to the manager guide.
Nina Park: We can compare feedback from the next cohort at the end of October.""",
        "summary": "New hires asked for one first-week checklist with clear owners and resources. Managers need a pre-start reminder for equipment and access. The team will pilot updates with product and support, then review feedback from the next cohort.",
        "topics": [(0, "New-hire feedback"), (390, "First-week checklist"), (850, "Manager preparation"), (1230, "Pilot and measurement")],
        "tasks": [("Draft the first-week checklist and collect team links", "Drew Collins", None), ("Add a pre-start reminder to the manager guide", "Fatima Noor", None)],
    },
]


def seed_database() -> None:
    with connect() as connection:
        existing = connection.execute("SELECT COUNT(*) FROM meetings").fetchone()[0]
        if existing:
            return
        for record in SEEDS:
            meeting_id = str(uuid.uuid4())
            connection.execute(
                "INSERT INTO meetings(id,title,meeting_date,duration_seconds) VALUES(?,?,?,?)",
                (meeting_id, record["title"], record["date"], record["duration"]),
            )
            for name in record["participants"]:
                connection.execute("INSERT OR IGNORE INTO participants(name) VALUES(?)", (name,))
                participant_id = connection.execute("SELECT id FROM participants WHERE name=?", (name,)).fetchone()[0]
                connection.execute("INSERT INTO meeting_participants VALUES(?,?)", (meeting_id, participant_id))
            segments = parse_transcript(record["transcript"])
            connection.executemany(
                "INSERT INTO transcript_segments(meeting_id,sequence,timestamp_seconds,speaker,text) VALUES(?,?,?,?,?)",
                [(meeting_id, row["sequence"], row["timestamp_seconds"], row["speaker"], row["text"]) for row in segments],
            )
            connection.execute("INSERT INTO summaries(meeting_id,overview) VALUES(?,?)", (meeting_id, record["summary"]))
            connection.executemany(
                "INSERT INTO topics(meeting_id,title,timestamp_seconds,sequence) VALUES(?,?,?,?)",
                [(meeting_id, title, seconds, index) for index, (seconds, title) in enumerate(record["topics"])],
            )
            connection.executemany(
                "INSERT INTO action_items(meeting_id,description,owner,due_date,source) VALUES(?,?,?,?, 'seed')",
                [(meeting_id, description, owner, due_date) for description, owner, due_date in record["tasks"]],
            )

