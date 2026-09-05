import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type Match = {
  id: string; title: string; provider?: string; university?: string; country?: string;
  fundingClass: string; deadline?: string; trustLevel: number; fields: string[]; score: number;
  eligibility: "confirmed_eligible" | "probably_eligible" | "cannot_determine" | "not_eligible";
  eligibilityConfidence?: number; reasons: string[]; sourceUrl: string; applicationUrl?: string; opportunityType?: string;
};
type Requirement = { id: string; name: string; required: boolean; status: string; sourceInstruction?: string };
type Answer = { id: string; field: string; answer: string; aiPolicy: string; reviewed: boolean };
type Application = { id: string; scholarshipId: string; status: string; aiPolicy: string; notes?: string; requirements: Requirement[]; answers: Answer[]; events: Array<{ eventType: string; createdAt: string }> };

const API = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
const PROFILE = { nationality: "Nigeria", degreeLevel: "masters", targetFields: ["forestry", "wildlife", "conservation", "natural_resources", "climate", "geospatial"], minimumFunding: "substantially_funded", academicScore: 4.72, academicScale: 5 };

function App() {
  const [items, setItems] = React.useState<Match[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [funding, setFunding] = React.useState("all");
  const [includeReview, setIncludeReview] = React.useState(false);
  const [activeApplication, setActiveApplication] = React.useState<Application | null>(null);
  const [appLoading, setAppLoading] = React.useState(false);

  async function load() {
    setLoading(true); setError("");
    try {
      const response = await fetch(`${API}/api/matches/top`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ profile: PROFILE, limit: 20 }) });
      if (!response.ok) throw new Error(`API returned ${response.status}`);
      const data = await response.json() as { matches: Match[] }; setItems(data.matches ?? []);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to calculate matches"); }
    finally { setLoading(false); }
  }

  async function openApplication(scholarshipId: string) {
    setAppLoading(true); setError("");
    try {
      const response = await fetch(`${API}/api/applications`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ scholarshipId }) });
      if (!response.ok) throw new Error(`Application API returned ${response.status}`);
      const data = await response.json() as { application: Application }; setActiveApplication(data.application);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to open application workspace"); }
    finally { setAppLoading(false); }
  }

  React.useEffect(() => { void load(); }, []);
  const visible = funding === "all" ? items : items.filter(item => item.fundingClass === funding);
  const confirmed = items.filter(item => item.eligibility === "confirmed_eligible").length;
  const review = items.filter(item => item.eligibility === "cannot_determine" || item.eligibility === "probably_eligible").length;

  return <main>
    <header className="hero"><div><p className="eyebrow">SCHOLARSHIP AGENT</p><h1>Your funded Master's shortlist.</h1><p className="sub">Forestry-first intelligence across scholarships, studentships, fellowships and funded research positions worldwide.</p></div><button onClick={() => void load()} disabled={loading}>{loading ? "Matching…" : "Refresh matches"}</button></header>
    <section className="stats"><div><strong>{items.length}</strong><span>qualifying matches</span></div><div><strong>{confirmed}</strong><span>eligibility confirmed</span></div><div><strong>{review}</strong><span>need review</span></div></section>
    <section className="toolbar"><div><label>Funding</label><select value={funding} onChange={e => setFunding(e.target.value)}><option value="all">All qualifying</option><option value="fully_funded">Fully funded</option><option value="substantially_funded">Substantial funding</option></select></div><label className="check"><input type="checkbox" checked={includeReview} onChange={e => setIncludeReview(e.target.checked)} /> Include uncertain eligibility</label><p>Profile: Nigeria · Master's · Forestry/Wildlife + related environmental fields · CGPA 4.72/5</p></section>
    {error && <div className="error">{error}</div>}
    {!loading && !error && !visible.length && <div className="empty">No qualifying opportunities yet. Run discovery to populate the database.</div>}
    <section className="grid">{visible.map(item => <article className="card" key={item.id}>
      <div className="cardtop"><span className="score">{Math.round(item.score * 100)}% match</span><span className="pill">{labelFunding(item.fundingClass)}</span><span>Trust {item.trustLevel}/5</span></div>
      <h2>{item.title}</h2><p className="muted">{[item.provider, item.university, item.country].filter(Boolean).join(" · ") || "Provider not yet verified"}</p>
      <div className="status">{labelEligibility(item.eligibility)}{item.eligibilityConfidence !== undefined && <span> · {Math.round(item.eligibilityConfidence * 100)}% confidence</span>}</div>
      <div className="tags">{item.fields.slice(0, 6).map(field => <span key={field}>{field}</span>)}</div>
      <ul className="reasons">{item.reasons.slice(0, 4).map(reason => <li key={reason}>{reason}</li>)}</ul>
      <footer><span>{item.deadline ? `Deadline: ${new Date(item.deadline).toLocaleDateString()}` : "Deadline not yet verified"}</span><span className="actions"><a href={item.sourceUrl} target="_blank" rel="noreferrer">Source</a>{item.applicationUrl && <a href={item.applicationUrl} target="_blank" rel="noreferrer">Apply</a>}<button onClick={() => void openApplication(item.id)} disabled={appLoading}>Prepare application</button></span></footer>
    </article>)}</section>
    {activeApplication && <ApplicationPanel application={activeApplication} onClose={() => setActiveApplication(null)} onUpdate={setActiveApplication} />}
  </main>;
}

function ApplicationPanel({ application, onClose, onUpdate }: { application: Application; onClose: () => void; onUpdate: (application: Application) => void }) {
  const [status, setStatus] = React.useState(application.status); const [notes, setNotes] = React.useState(application.notes ?? ""); const [saving, setSaving] = React.useState(false);
  async function save() { setSaving(true); try { const response = await fetch(`${API}/api/applications/${application.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status, notes }) }); if (!response.ok) throw new Error("Unable to save application"); const data = await response.json() as { application: Application }; onUpdate(data.application); } catch (e) { console.error(e); } finally { setSaving(false); } }
  return <div className="overlay"><section className="workspace"><header><div><p className="eyebrow">APPLICATION WORKSPACE</p><h2>Prepare this application</h2><p className="muted">Review requirements and drafts here. Final submission remains under your control.</p></div><button onClick={onClose}>Close</button></header><div className="workspace-grid"><div><h3>Application status</h3><select value={status} onChange={e => setStatus(e.target.value)}><option value="discovered">Discovered</option><option value="review">Review</option><option value="preparing">Preparing</option><option value="ready">Ready</option><option value="submitted">Submitted</option><option value="withdrawn">Withdrawn</option></select><h3>Requirements</h3><ul className="requirements">{application.requirements.length ? application.requirements.map(req => <li key={req.id}><strong>{req.name}</strong><span>{req.required ? "Required" : "Optional"} · {req.status}</span></li>) : <li>No requirements extracted yet.</li>}</ul></div><div><h3>Answers</h3>{application.answers.length ? application.answers.map(answer => <article className="answer" key={answer.id}><strong>{answer.field}</strong><p>{answer.answer}</p><small>{answer.reviewed ? "Reviewed" : "Needs review"} · AI policy: {answer.aiPolicy}</small></article>) : <div className="empty">No answers prepared yet. Requirements and questions will be populated from verified sources.</div>}<h3>Notes</h3><textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Your application notes…" /><button onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "Save application"}</button></div></div></section></div>;
}

function labelFunding(value: string) { return value === "fully_funded" ? "Fully funded" : value === "substantially_funded" ? "Substantial funding" : value.replaceAll("_", " "); }
function labelEligibility(value: Match["eligibility"]) { return value === "confirmed_eligible" ? "Eligibility confirmed" : value === "probably_eligible" ? "Probably eligible" : value === "cannot_determine" ? "Needs verification" : "Not eligible"; }

createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
