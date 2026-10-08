"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownUp, CalendarDays, ChevronDown, Clock3, FilePlus2, MoreHorizontal, Plus, Search, Users, X } from "lucide-react";
import { Shell, Topbar } from "@/components/Shell";
import { api, formatDate, formatDuration, MeetingCard } from "@/lib/api";

function CreateMeetingModal({ close, created }: { close: () => void; created: (id: string, generationFailed: boolean) => void }) {
  const [title, setTitle] = useState("");
  const [meetingDate, setMeetingDate] = useState(new Date().toISOString().slice(0, 16));
  const [participants, setParticipants] = useState("");
  const [transcript, setTranscript] = useState("");
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fileError, setFileError] = useState("");
  const readFile = async (file?: File) => {
    if (!file) return;
    if (!/\.(txt|vtt)$/i.test(file.name)) { setFileError("Choose a .txt or .vtt transcript file."); return; }
    setFileError(""); setFileName(file.name);
    setTranscript(await file.text());
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const meeting = await api<{ id: string }>("/meetings", { method: "POST", body: JSON.stringify({
        title, meeting_date: new Date(meetingDate).toISOString(), duration_seconds: 0,
        participants: participants.split(",").map((name) => name.trim()).filter(Boolean), transcript,
      }) });
      let failed = false;
      try { await api(`/meetings/${meeting.id}/generate-summary`, { method: "POST" }); }
      catch { failed = true; }
      created(meeting.id, failed);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to create this meeting."); setBusy(false); }
  };
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
    <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="create-heading">
      <div className="modal-head"><div><div className="eyebrow">MEETING LIBRARY</div><h2 id="create-heading">Add a meeting</h2><p>Paste a transcript or upload a text / WebVTT file.</p></div><button className="icon-button" onClick={close} aria-label="Close"><X size={19} /></button></div>
      <form onSubmit={submit} className="modal-form">
        <label>Meeting title<input required maxLength={180} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Weekly product sync" autoFocus /></label>
        <div className="form-grid"><label>Date and time<input required type="datetime-local" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} /></label><label>Participants <span className="hint-inline">comma separated</span><input value={participants} onChange={(e) => setParticipants(e.target.value)} placeholder="Alex, Morgan" /></label></div>
        <label>Transcript<textarea required rows={8} value={transcript} onChange={(e) => setTranscript(e.target.value)} placeholder={"Paste one utterance per line, e.g.\nAlex: Let's review the launch plan.\nMorgan: The pilot is ready for next week."} /></label>
        <div className="upload-row"><label className="upload-button"><FilePlus2 size={16} />Choose transcript file<input type="file" accept=".txt,.vtt,text/plain,text/vtt" onChange={(e) => readFile(e.target.files?.[0])} /></label><span>{fileError || fileName || "TXT or VTT · max file size follows your browser limits"}</span></div>
        {error && <div className="inline-error">{error}</div>}
        <div className="modal-footer"><span className="ai-note">✦ Gemini will draft a summary and action items</span><button type="button" className="button subtle" onClick={close}>Cancel</button><button className="button primary" disabled={busy || !transcript.trim()}>{busy ? <><span className="spinner" /> Saving…</> : <><Plus size={16} /> Add meeting</>}</button></div>
      </form>
    </section>
  </div>;
}

export default function MeetingsPage() {
  const router = useRouter();
  const [meetings, setMeetings] = useState<MeetingCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [participant, setParticipant] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [toast, setToast] = useState("");
  const participants = useMemo(() => [...new Set(meetings.flatMap((meeting) => meeting.participants))].sort(), [meetings]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (participant) params.set("participant", participant);
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    setLoading(true); setError("");
    api<MeetingCard[]>(`/meetings?${params.toString()}`, { signal: controller.signal })
      .then(setMeetings).catch((reason) => { if (!controller.signal.aborted) setError(reason.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [query, participant, dateFrom, dateTo, reloadKey]);

  const created = (id: string, failed: boolean) => {
    setShowCreate(false);
    if (failed) router.push(`/meetings/${id}?generation=failed`);
    else router.push(`/meetings/${id}`);
  };

  return <Shell><div className="library-page">
    <Topbar title="Meetings" subtitle="Your conversations, all in one place." right={<button className="button primary" onClick={() => setShowCreate(true)}><Plus size={16} /> Add meeting</button>} />
    <div className="library-content">
      <div className="welcome-strip"><div className="welcome-icon"><CalendarDays size={19} /></div><div><b>Good meetings create momentum.</b><span>Pick up right where the conversation left off.</span></div><div className="welcome-stat"><b>{meetings.length}</b><span>meetings found</span></div></div>
      <div className="library-toolbar">
        <div className="search-box"><Search size={17} /><input aria-label="Search meetings" placeholder="Search meetings or transcripts…" value={query} onChange={(e) => setQuery(e.target.value)} /><kbd>⌘ K</kbd></div>
        <div className="filter-controls"><label className="filter-select"><Users size={15} /><select aria-label="Filter by participant" value={participant} onChange={(e) => setParticipant(e.target.value)}><option value="">All participants</option>{participants.map((name) => <option key={name}>{name}</option>)}</select><ChevronDown size={14} /></label><label className="date-filter"><span>From</span><input type="date" aria-label="Start date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></label><label className="date-filter"><span>To</span><input type="date" aria-label="End date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></label></div>
      </div>
      <div className="list-heading"><div><span>RECENT MEETINGS</span><span className="sub-count">{meetings.length} conversations</span></div><button className="sort-button"><ArrowDownUp size={14} /> Most recent</button></div>
      {error ? <div className="state-card"><div className="state-symbol">!</div><h3>Couldn’t load your meetings</h3><p>{error}</p><button className="button secondary" onClick={() => setReloadKey((key) => key + 1)}>Try again</button></div> : loading ? <div className="meeting-skeletons">{[0,1,2,3].map((item) => <div className="meeting-skeleton" key={item}><i /><div><i /><i /></div><i /></div>)}</div> : meetings.length ? <div className="meeting-list">{meetings.map((meeting, index) => <Link className="meeting-row" href={`/meetings/${meeting.id}`} key={meeting.id}>
        <div className={`meeting-art art-${index % 6}`}><span>{meeting.title.split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase()}</span></div>
        <div className="meeting-main"><div className="meeting-title-line"><h2>{meeting.title}</h2><span className="meeting-tag">Meeting</span></div><p className="meeting-preview">{meeting.preview}</p><div className="meeting-meta"><span><CalendarDays size={13} />{formatDate(meeting.meeting_date)}</span><span><Clock3 size={13} />{formatDuration(meeting.duration_seconds)}</span><span><Users size={13} />{meeting.participants.slice(0, 3).join(", ")}{meeting.participants.length > 3 ? ` +${meeting.participants.length - 3}` : ""}</span></div></div>
        <span className="row-arrow"><MoreHorizontal size={20} /></span>
      </Link>)}</div> : <div className="state-card"><div className="state-symbol"><Search size={21} /></div><h3>No meetings match that search</h3><p>Try changing your filters or add a meeting to get started.</p><button className="button secondary" onClick={() => { setQuery(""); setParticipant(""); setDateFrom(""); setDateTo(""); }}>Clear filters</button></div>}
      <div className="library-footnote"><span><span className="green-dot" /> Your meeting data is saved to this workspace</span><span>Sorted by <b>most recent</b> <ChevronDown size={13} /></span></div>
    </div>
    {showCreate && <CreateMeetingModal close={() => setShowCreate(false)} created={created} />}
  </div></Shell>;
}
