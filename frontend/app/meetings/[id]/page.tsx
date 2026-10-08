"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, AudioLines, CalendarDays, Check, CheckCircle2, Clock3, Download, FileText, ListTodo, MoreHorizontal, Pause, Pencil, Play, Plus, RefreshCw, Search, Sparkles, Trash2, X } from "lucide-react";
import { Shell } from "@/components/Shell";
import { ActionItem, api, formatDate, formatTime, Meeting } from "@/lib/api";

function initials(name: string) { return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(); }

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "ig"));
  return <>{parts.map((part, index) => part.toLowerCase() === query.trim().toLowerCase() ? <mark key={index}>{part}</mark> : part)}</>;
}

function EditMeetingModal({ meeting, close, saved }: { meeting: Meeting; close: () => void; saved: (value: Meeting) => void }) {
  const [title, setTitle] = useState(meeting.title);
  const [date, setDate] = useState(new Date(meeting.meeting_date).toISOString().slice(0, 16));
  const [people, setPeople] = useState(meeting.participants.join(", "));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const result = await api<Meeting>(`/meetings/${meeting.id}`, { method: "PUT", body: JSON.stringify({
        title, meeting_date: new Date(date).toISOString(), participants: people.split(",").map((name) => name.trim()).filter(Boolean),
      }) }); saved(result);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not update meeting."); setBusy(false); }
  }
  return <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}><section className="modal-card edit-modal" role="dialog" aria-modal="true">
    <div className="modal-head"><div><div className="eyebrow">MEETING DETAILS</div><h2>Edit meeting</h2></div><button className="icon-button" onClick={close}><X size={18} /></button></div>
    <form className="modal-form" onSubmit={submit}><label>Title<input required value={title} onChange={(e) => setTitle(e.target.value)} /></label><label>Date and time<input required type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} /></label><label>Participants <span className="hint-inline">comma separated</span><input value={people} onChange={(e) => setPeople(e.target.value)} /></label>{error && <div className="inline-error">{error}</div>}<div className="modal-footer"><button type="button" className="button subtle" onClick={close}>Cancel</button><button className="button primary" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button></div></form>
  </section></div>;
}

function ActionEditor({ item, save, cancel }: { item: ActionItem; save: (description: string, owner: string, due: string) => void; cancel: () => void }) {
  const [description, setDescription] = useState(item.description);
  const [owner, setOwner] = useState(item.owner || "");
  const [due, setDue] = useState(item.due_date || "");
  return <div className="action-editor"><input aria-label="Task description" value={description} onChange={(e) => setDescription(e.target.value)} /><div className="action-edit-meta"><input aria-label="Task owner" placeholder="Owner" value={owner} onChange={(e) => setOwner(e.target.value)} /><input aria-label="Due date" type="date" value={due} onChange={(e) => setDue(e.target.value)} /></div><div className="action-edit-buttons"><button className="button primary mini" onClick={() => save(description, owner, due)}><Check size={13} /> Save</button><button className="button mini" onClick={cancel}>Cancel</button></div></div>;
}

export default function MeetingDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [toast, setToast] = useState("");
  const [editingMeeting, setEditingMeeting] = useState(false);
  const [editingAction, setEditingAction] = useState<number | null>(null);
  const [addingAction, setAddingAction] = useState(false);
  const [newAction, setNewAction] = useState("");
  const [generating, setGenerating] = useState(false);

  const refresh = useCallback(async () => {
    const result = await api<Meeting>(`/meetings/${id}`);
    setMeeting(result);
    return result;
  }, [id]);

  useEffect(() => {
    let alive = true;
    setLoading(true); setError("");
    api<Meeting>(`/meetings/${id}`).then((result) => { if (alive) setMeeting(result); })
      .catch((reason) => { if (alive) setError(reason.message); })
      .finally(() => { if (alive) setLoading(false); });
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("generation") === "failed") {
      setToast("Meeting saved. Add a Gemini API key and retry the summary.");
      window.history.replaceState({}, "", `/meetings/${id}`);
    }
    return () => { alive = false; };
  }, [id]);

  useEffect(() => {
    if (!playing || !meeting) return;
    const timer = window.setInterval(() => setCurrentTime((value) => {
      if (value + 1 >= meeting.duration_seconds) { setPlaying(false); return meeting.duration_seconds; }
      return value + 1;
    }), 1000);
    return () => window.clearInterval(timer);
  }, [playing, meeting]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 4600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const activeSequence = useMemo(() => {
    if (!meeting?.transcript.length) return -1;
    let found = meeting.transcript[0].sequence;
    for (const segment of meeting.transcript) {
      if (segment.timestamp_seconds <= currentTime) found = segment.sequence;
      else break;
    }
    return found;
  }, [currentTime, meeting]);
  const matching = useMemo(() => {
    const key = query.trim().toLowerCase();
    return (meeting?.transcript || []).filter((segment) => !key || segment.text.toLowerCase().includes(key) || segment.speaker.toLowerCase().includes(key));
  }, [meeting, query]);

  const jumpTo = (time: number) => { setCurrentTime(Math.min(Math.max(0, time), meeting?.duration_seconds || 0)); };
  const notify = (message: string) => setToast(message);
  const updateAction = async (item: ActionItem, values: Partial<ActionItem>) => {
    try {
      await api(`/action-items/${item.id}`, { method: "PUT", body: JSON.stringify({
        description: values.description ?? item.description, owner: values.owner === undefined ? item.owner : values.owner,
        due_date: values.due_date === undefined ? item.due_date : values.due_date,
        is_complete: values.is_complete === undefined ? Boolean(item.is_complete) : Boolean(values.is_complete),
      }) });
      await refresh();
    } catch (reason) { notify(reason instanceof Error ? reason.message : "Could not update task."); }
  };
  const regenerate = async () => {
    setGenerating(true);
    try { await api(`/meetings/${id}/generate-summary`, { method: "POST" }); await refresh(); notify("Summary and action items updated."); }
    catch (reason) { notify(reason instanceof Error ? reason.message : "Could not generate notes."); }
    finally { setGenerating(false); }
  };
  const addAction = async (event: React.FormEvent) => {
    event.preventDefault(); if (!newAction.trim()) return;
    try { await api(`/meetings/${id}/action-items`, { method: "POST", body: JSON.stringify({ description: newAction.trim() }) }); await refresh(); setNewAction(""); setAddingAction(false); notify("Action item added."); }
    catch (reason) { notify(reason instanceof Error ? reason.message : "Could not add task."); }
  };
  const removeAction = async (item: ActionItem) => {
    try { await api(`/action-items/${item.id}`, { method: "DELETE" }); await refresh(); notify("Action item removed."); }
    catch (reason) { notify(reason instanceof Error ? reason.message : "Could not remove task."); }
  };
  const deleteMeeting = async () => {
    if (!meeting || !window.confirm(`Delete “${meeting.title}”? This cannot be undone.`)) return;
    try { await api(`/meetings/${id}`, { method: "DELETE" }); router.push("/"); }
    catch (reason) { notify(reason instanceof Error ? reason.message : "Could not delete meeting."); }
  };
  const exportMarkdown = () => {
    if (!meeting) return;
    const content = `# ${meeting.title}\n\n${meeting.summary?.overview || "Summary not generated."}\n\n## Action items\n${meeting.action_items.map((item) => `- [${item.is_complete ? "x" : " "}] ${item.description}${item.owner ? ` — ${item.owner}` : ""}`).join("\n")}\n\n## Transcript\n${meeting.transcript.map((line) => `[${formatTime(line.timestamp_seconds)}] ${line.speaker}: ${line.text}`).join("\n")}`;
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([content], { type: "text/markdown" })); link.download = `${meeting.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.md`; link.click(); URL.revokeObjectURL(link.href); notify("Meeting notes exported as Markdown.");
  };

  if (loading) return <Shell><div className="detail-loading"><div className="spinner purple" /> Loading meeting…</div></Shell>;
  if (error || !meeting) return <Shell><div className="detail-error"><Link href="/" className="back-link"><ArrowLeft size={15} /> All meetings</Link><h2>Meeting unavailable</h2><p>{error || "This meeting could not be found."}</p><Link href="/" className="button secondary">Back to meetings</Link></div></Shell>;
  const duration = Math.max(1, meeting.duration_seconds);
  const completedCount = meeting.action_items.filter((item) => item.is_complete).length;

  return <Shell><div className="detail-page">
    <header className="detail-top"><Link href="/" className="back-link"><ArrowLeft size={15} /> Meetings</Link><div className="detail-head-right"><button className="button" onClick={exportMarkdown}><Download size={15} /> Export</button><button className="button" onClick={() => setEditingMeeting(true)}><Pencil size={14} /> Edit</button><button className="icon-button" title="Delete meeting" onClick={deleteMeeting}><Trash2 size={15} /></button></div></header>
    <div className="meeting-heading"><div><div className="meeting-heading-tags"><span className="meeting-kind"><span className="green-dot" /> Recorded meeting</span><span className="meeting-date"><CalendarDays size={13} />{formatDate(meeting.meeting_date)}</span><span className="meeting-date"><Clock3 size={13} />{formatTime(meeting.duration_seconds)}</span></div><h1>{meeting.title}</h1><div className="participant-chips">{meeting.participants.map((person, index) => <span className={`participant-chip chip-${index % 5}`} key={person}><i>{initials(person)}</i>{person}</span>)}<button className="add-person" onClick={() => setEditingMeeting(true)} title="Edit participants"><Plus size={14} /></button></div></div><button className="more-menu" title="More actions" onClick={exportMarkdown}><MoreHorizontal size={19} /></button></div>
    <section className="player-card"><div className="player-left"><button className="play-button" onClick={() => setPlaying((value) => !value)} aria-label={playing ? "Pause playback" : "Play recording"}>{playing ? <Pause size={17} fill="white" /> : <Play size={17} fill="white" />}</button><div className="audio-wave" aria-hidden="true">{Array.from({ length: 38 }, (_, index) => <i key={index} style={{ height: `${8 + ((index * 13 + index * index * 7) % 25)}px`, opacity: index / 50 + .25 }} />)}</div></div><div className="player-timeline"><div className="player-range-wrap"><input aria-label="Seek recording" type="range" min="0" max={duration} value={Math.min(currentTime, duration)} onChange={(event) => jumpTo(Number(event.target.value))} style={{ "--progress": `${(currentTime / duration) * 100}%` } as React.CSSProperties} /><div className="range-labels"><span>{formatTime(currentTime)}</span><span>{formatTime(duration)}</span></div></div></div><span className="player-placeholder"><AudioLines size={14} /> Audio preview</span></section>

    <div className="workspace-label"><span><Sparkles size={14} /> MEETING NOTES</span><span className="workspace-label-line" /><button onClick={regenerate} disabled={generating}><RefreshCw size={13} className={generating ? "rotate" : ""} />{generating ? "Generating…" : "Regenerate notes"}</button></div>
    <div className="notes-workspace">
      <section className="notes-panel">
        <div className="notes-panel-scroll">
          <div className="panel-title-row"><h2>Summary</h2><button className="icon-button tiny" title="Export summary" onClick={exportMarkdown}><Download size={14} /></button></div>
          {meeting.summary ? <p className="summary-copy">{meeting.summary.overview}</p> : <div className="summary-empty"><Sparkles size={17} /><div><b>No summary yet</b><p>Generate meeting notes with Gemini when an API key is configured.</p><button className="button secondary mini" onClick={regenerate} disabled={generating}>{generating ? "Generating…" : "Generate summary"}</button></div></div>}
          {meeting.topics.length > 0 && <div className="notes-section"><div className="section-title"><span><FileText size={15} /> Topics</span><span className="section-count">{meeting.topics.length}</span></div><div className="topic-list">{meeting.topics.map((topic) => <button className="topic-row" key={topic.id} onClick={() => jumpTo(topic.timestamp_seconds)}><span className="topic-time">{formatTime(topic.timestamp_seconds)}</span><span>{topic.title}</span><span className="topic-jump">↗</span></button>)}</div></div>}
          <div className="notes-section action-section"><div className="section-title"><span><ListTodo size={15} /> Action items</span><span className="section-count">{completedCount}/{meeting.action_items.length}</span><button className="section-add" onClick={() => setAddingAction((value) => !value)} title="Add action item"><Plus size={15} /></button></div>
            {addingAction && <form className="new-action-form" onSubmit={addAction}><input autoFocus value={newAction} onChange={(e) => setNewAction(e.target.value)} placeholder="What needs to get done?" /><button className="button primary mini" disabled={!newAction.trim()}><Check size={13} /> Add</button></form>}
            {meeting.action_items.length ? <div className="task-list">{meeting.action_items.map((item) => <div className={`task-row ${item.is_complete ? "task-done" : ""}`} key={item.id}>
              <button className={`task-check ${item.is_complete ? "checked" : ""}`} aria-label={item.is_complete ? "Mark incomplete" : "Mark complete"} onClick={() => updateAction(item, { is_complete: !item.is_complete })}>{item.is_complete && <Check size={12} />}</button>
              <div className="task-content">{editingAction === item.id ? <ActionEditor item={item} cancel={() => setEditingAction(null)} save={async (description, owner, due) => { await updateAction(item, { description, owner: owner || null, due_date: due || null }); setEditingAction(null); }} /> : <><span className="task-description">{item.description}</span><span className="task-meta">{item.owner && <span><i>{initials(item.owner)}</i>{item.owner}</span>}{item.due_date && <span className="task-due">Due {formatDate(item.due_date)}</span>}{item.source === "ai" && <span className="ai-tag">AI</span>}</span></>}</div>
              <div className="task-actions"><button title="Edit action item" onClick={() => setEditingAction(item.id)}><Pencil size={13} /></button><button title="Delete action item" onClick={() => removeAction(item)}><Trash2 size={13} /></button></div>
            </div>)}</div> : !addingAction && <div className="quiet-empty">No action items yet. Add one or regenerate the notes.</div>}
          </div>
          <div className="notes-ai-foot"><span className="ai-spark">✦</span> Notes are generated with AI and can be edited.</div>
        </div>
      </section>
      <section className="transcript-panel">
        <div className="transcript-panel-head"><div><h2>Transcript</h2><span>{meeting.transcript.length} segments</span></div><button className="icon-button tiny" title="Transcript options" onClick={exportMarkdown}><MoreHorizontal size={16} /></button></div>
        <div className="transcript-search"><Search size={15} /><input placeholder="Find in transcript…" value={query} onChange={(e) => setQuery(e.target.value)} /><span>{query ? `${matching.length} results` : "⌘ F"}</span>{query && <button onClick={() => setQuery("")} aria-label="Clear transcript search"><X size={13} /></button>}</div>
        <div className="transcript-lines">{matching.length ? matching.map((segment) => <button key={segment.id} className={`transcript-line ${activeSequence === segment.sequence ? "active-line" : ""}`} onClick={() => jumpTo(segment.timestamp_seconds)}>
          <div className="speaker-avatar">{initials(segment.speaker)}</div><div className="transcript-line-main"><div className="transcript-line-meta"><b>{segment.speaker}</b><span>{formatTime(segment.timestamp_seconds)}</span></div><p><Highlight text={segment.text} query={query} /></p></div><span className="line-play"><Play size={11} fill="currentColor" /></span>
        </button>) : <div className="transcript-no-results"><Search size={18} /><b>No matches found</b><span>Try another word or phrase.</span></div>}</div>
        <div className="transcript-footer"><span><span className="green-dot" /> Transcript ready</span><button onClick={exportMarkdown}><Download size={13} /> Export</button></div>
      </section>
    </div>
    {editingMeeting && <EditMeetingModal meeting={meeting} close={() => setEditingMeeting(false)} saved={(value) => { setMeeting((current) => current ? { ...current, ...value } : value); setEditingMeeting(false); notify("Meeting details updated."); }} />}
    {toast && <div className="toast"><CheckCircle2 size={17} />{toast}<button onClick={() => setToast("")}><X size={14} /></button></div>}
  </div></Shell>;
}
