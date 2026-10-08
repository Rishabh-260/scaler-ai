"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AudioLines, Bot, CalendarDays, ChevronDown, CircleHelp, Cog, FileText, Search, Settings2, Sparkles, UsersRound } from "lucide-react";

const nav = [
  { label: "Meetings", href: "/", icon: CalendarDays },
  { label: "AI apps", href: "#", icon: Sparkles },
  { label: "Live assistant", href: "#", icon: Bot },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return <div className="app-frame">
    <aside className="sidebar">
      <Link className="brand" href="/"><span className="brand-mark"><AudioLines size={19} /></span><span>fireflies<span className="brand-dot">.</span></span></Link>
      <button className="workspace-picker"><span className="workspace-avatar">S</span><span className="workspace-copy"><b>Scaler Workspace</b><small>Personal workspace</small></span><ChevronDown size={15} /></button>
      <div className="side-section-label">WORKSPACE</div>
      <nav className="side-nav">{nav.map(({ label, href, icon: Icon }) => <Link key={label} href={href} className={`side-link ${pathname === href ? "selected" : ""}`}><Icon size={17} strokeWidth={1.8} /><span>{label}</span>{label === "Meetings" && <span className="nav-count">6</span>}</Link>)}</nav>
      <div className="side-section-label second">MANAGE</div>
      <nav className="side-nav">
        <button className="side-link" onClick={() => window.alert("Coming soon — connect your calendar here.")}><UsersRound size={17} strokeWidth={1.8} /><span>Team</span></button>
        <button className="side-link" onClick={() => window.alert("Coming soon — integrations will appear here.")}><Cog size={17} strokeWidth={1.8} /><span>Integrations</span></button>
        <button className="side-link" onClick={() => window.alert("Settings are coming soon.")}><Settings2 size={17} strokeWidth={1.8} /><span>Settings</span></button>
      </nav>
      <div className="sidebar-spacer" />
      <div className="side-bottom-card"><div className="side-card-icon"><FileText size={16} /></div><div><b>Better meetings start here</b><p>Your conversations, organized.</p></div></div>
      <button className="side-link help-link" onClick={() => window.alert("Help center coming soon.")}><CircleHelp size={17} /><span>Help center</span></button>
      <div className="profile-row"><span className="profile-avatar">K</span><span className="profile-copy"><b>Kumar</b><small>Free plan</small></span><button title="Profile settings" onClick={() => window.alert("Profile settings are coming soon.")}><Settings2 size={16} /></button></div>
    </aside>
    <main className="main-area">{children}</main>
  </div>;
}

export function Topbar({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return <header className="topbar"><div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div><div className="topbar-actions">{right}<button className="icon-button" title="Help" onClick={() => window.alert("Help center coming soon.")}><CircleHelp size={18} /></button><button className="top-avatar" title="Profile">K</button></div></header>;
}

