import React from "react";
import { createRoot } from "react-dom/client";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import * as mammoth from "mammoth";
import "./styles.css";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.mjs", import.meta.url).toString();

const API = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

type Profile = {
  nationality: string; degreeLevel: "masters" | "phd" | "undergraduate"; targetFields: string[];
  minimumFunding: "substantial" | "full"; academicScore?: number; academicScale?: number;
  highestQualification?: string; degreeField?: string; workExperience?: string;
};
type Match = { id: string; title: string; provider?: string; university?: string; country?: string; fundingClass: string; deadline?: string; trustLevel: number; fields: string[]; score: number; eligibility: string; eligibilityConfidence?: number; reasons: string[]; sourceUrl: string; applicationUrl?: string; opportunityType?: string; };
type DiscoveryRecord = { id: string; url: string; title?: string; source: string; discoveryMethod: string; query?: string; status: string; discoveredAt: string; };
type Requirement = { id: string; name: string; required: boolean; status: string; sourceInstruction?: string };
type Answer = { id: string; field: string; answer: string; aiPolicy: string; reviewed: boolean };
type Application = { id: string; scholarshipId: string; status: string; aiPolicy: string; notes?: string; requirements: Requirement[]; answers: Answer[]; events: Array<{ eventType: string; createdAt: string }> };
type Preparation = { factualAnswers: Array<{ field: string; answer: string; aiPolicy: string; reviewed: boolean; source: string }>; questions: Array<{ field: string; prompt: string; category: string; status: string }>; warnings: string[] };
type DocumentAnalysis = { documentType: string; facts: Array<{ field: string; value: string; confidence: number; evidence: string }>; suggestedProfilePatch: Partial<Profile>; warnings: string[] };

const DEFAULT_PROFILE: Profile = { nationality: "Nigeria", degreeLevel: "masters", targetFields: ["forestry", "wildlife", "conservation", "natural_resources", "climate", "geospatial"], minimumFunding: "substantial", academicScore: 4.72, academicScale: 5, highestQualification: "B.Sc Forestry & Wildlife", degreeField: "Forestry & Wildlife", workExperience: "" };
const FIELD_OPTIONS = ["Forestry", "Wildlife", "Conservation", "Natural Resources", "Climate", "Geospatial/GIS", "Remote Sensing", "Forest Ecology", "Biodiversity", "Environmental Management", "Agroforestry", "Forest Carbon", "Ecology", "Land Management", "Environmental Policy"];

function App() {
  const [profile, setProfile] = React.useState<Profile>(() => loadProfile());
  const [matches, setMatches] = React.useState<Match[]>([]);
  const [discovery, setDiscovery] = React.useState<DiscoveryRecord[]>([]);
  const [tab, setTab] = React.useState<"matches" | "discovery">("matches");
  const [funding, setFunding] = React.useState("all");
  const [type, setType] = React.useState("all");
  const [search, setSearch] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [discovering, setDiscovering] = React.useState(false);
  const [error, setError] = React.useState("");
  const [notice, setNotice] = React.useState("");
  const [diagnostics, setDiagnostics] = React.useState<any>(null);
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [activeApplication, setActiveApplication] = React.useState<Application | null>(null);
  const [appLoading, setAppLoading] = React.useState(false);
  const [applicantDocument, setApplicantDocument] = React.useState<DocumentAnalysis | null>(null);
  const [cvBusy, setCvBusy] = React.useState(false);

  async function loadMatches(nextProfile = profile) {
    setLoading(true); setError("");
    try {
      const response = await fetch(`${API}/api/matches/top`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ profile: nextProfile, limit: 200 }) });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error ?? `Matching API returned ${response.status}`);
      setMatches(Array.isArray(data.matches) ? data.matches : []);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load matches"); }
    finally { setLoading(false); }
  }

  async function loadDiscovery() {
    try { const response = await fetch(`${API}/api/discovery/records?limit=500`); const data = await readJson(response); if (!response.ok) throw new Error(data.error ?? `Discovery records API returned ${response.status}`); setDiscovery(Array.isArray(data) ? data : []); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to load discovery records"); }
  }

  async function discover() {
    setDiscovering(true); setError(""); setNotice("");
    try {
      const response = await fetch(`${API}/api/discovery/run`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ profile, deepEnrich: true, limit: 100 }) });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error ?? `Discovery API returned ${response.status}`);
      setDiagnostics(data.diagnostics ?? null);
      setNotice(`Discovery completed: ${data.records?.length ?? 0} raw results, ${data.enriched?.length ?? 0} enriched, ${data.persistence?.verified ?? 0} verified.`);
      await Promise.all([loadMatches(profile), loadDiscovery()]);
      setTab("matches");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to run discovery"); }
    finally { setDiscovering(false); }
  }

  function saveProfile(next: Profile) { setProfile(next); localStorage.setItem("scholarship-agent-profile", JSON.stringify(next)); }

  async function openApplication(scholarshipId: string) {
    setAppLoading(true); setError("");
    try {
      const response = await fetch(`${API}/api/applications`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ scholarshipId }) });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error ?? `Application API returned ${response.status}`);
      setActiveApplication(data as Application);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to open application workspace"); }
    finally { setAppLoading(false); }
  }

  React.useEffect(() => { void Promise.all([loadMatches(profile), loadDiscovery()]); }, []);

  const visibleMatches = matches.filter((item) => (funding === "all" || item.fundingClass === funding) && (type === "all" || item.opportunityType === type) && matchesSearch(item, search));
  const visibleDiscovery = discovery.filter((item) => matchesSearch({ title: item.title ?? item.url, provider: item.source, fields: [item.discoveryMethod, item.query ?? ""] }, search));
  const confirmed = matches.filter((item) => item.eligibility === "confirmed_eligible").length;
  const review = matches.filter((item) => item.eligibility === "cannot_determine" || item.eligibility === "probably_eligible").length;

  return <main>
    <header className="hero">
      <div><div className="brandline"><span className="brandmark">SA</span><span>SCHOLARSHIP AGENT</span></div><h1>Find the funding that fits <em>your</em> academic profile.</h1><p className="sub">A Forestry-first discovery workspace for funded Master's scholarships, studentships, fellowships and research positions worldwide.</p></div>
      <div className="hero-actions"><button className="light" onClick={() => setProfileOpen(true)}>Applicant profile</button><button className="primary-light" onClick={() => void discover()} disabled={discovering}>{discovering ? "Discovering…" : "Run full discovery"}</button></div>
    </header>

    <section className="stats"><Stat value={discovery.length} label="discovered sources"/><Stat value={matches.length} label="enriched opportunities"/><Stat value={confirmed} label="eligibility confirmed"/><Stat value={review} label="need review"/></section>
    {notice && <div className="notice">✓ {notice}</div>}{error && <div className="error">{error}</div>}

    <section className="profile-strip"><div><span className="eyebrow dark">CURRENT SEARCH PROFILE</span><strong>{profile.nationality} · {prettyDegree(profile.degreeLevel)} · {profile.highestQualification || "Qualification not set"}</strong><p>{profile.targetFields.join(" · ") || "No target fields selected"} · {profile.minimumFunding === "full" ? "Fully funded" : "Fully or substantially funded"}</p></div><button onClick={() => setProfileOpen(true)}>Edit profile →</button></section>

    <nav className="tabs"><button className={tab === "matches" ? "active" : ""} onClick={() => setTab("matches")}>Ranked matches <b>{matches.length}</b></button><button className={tab === "discovery" ? "active" : ""} onClick={() => setTab("discovery")}>All discovery <b>{discovery.length}</b></button><button onClick={() => void loadDiscovery()}>↻ Refresh data</button></nav>

    <section className="toolbar"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tab === "matches" ? "Search opportunities, universities, fields…" : "Search discovered sources…"}/>{tab === "matches" && <><select value={funding} onChange={(e) => setFunding(e.target.value)}><option value="all">All funding</option><option value="fully_funded">Fully funded</option><option value="substantially_funded">Substantial funding</option></select><select value={type} onChange={(e) => setType(e.target.value)}><option value="all">All opportunity types</option><option value="scholarship">Scholarships</option><option value="studentship">Studentships</option><option value="research_position">Research positions</option><option value="assistantship">Assistantships</option><option value="fellowship">Fellowships</option></select></>}</section>

    {tab === "matches" ? <>{loading ? <Loading/> : <section className="result-list">{visibleMatches.map(item => <OpportunityCard key={item.id} item={item} onPrepare={openApplication} disabled={appLoading}/>)}{!visibleMatches.length && !error && <Empty title="No ranked opportunities" text="Run full discovery or adjust the filters. Reviewable opportunities remain visible even when eligibility cannot yet be confirmed."/>}</section>}</> : <section className="discovery-list">{visibleDiscovery.map(item => <DiscoveryCard key={item.id} item={item}/>)}{!visibleDiscovery.length && <Empty title="No discovery records" text="Run full discovery to populate this ledger."/>}</section>}

    {diagnostics && <section className="diagnostics"><div><span className="eyebrow dark">LAST DISCOVERY RUN</span><h2>Search coverage</h2></div><div className="diag-grid"><Metric label="Queries" value={diagnostics.queries}/><Metric label="Raw results" value={diagnostics.rawRecords}/><Metric label="Unique" value={diagnostics.uniqueRecords}/><Metric label="Enriched" value={diagnostics.enriched}/><Metric label="Verified" value={diagnostics.verified}/><Metric label="Healthy sources" value={`${diagnostics.sourcesHealthy ?? 0}/${diagnostics.sourcesConfigured ?? 0}`}/></div>{Array.isArray(diagnostics.sourceResults) && <details><summary>Source-by-source diagnostics</summary><div className="source-table">{diagnostics.sourceResults.map((s: any) => <div key={s.name}><strong>{s.name}</strong><span>{s.records} results</span><span>{s.errors} errors</span></div>)}</div></details>}</section>}

    {profileOpen && <ProfilePanel profile={profile} onClose={() => setProfileOpen(false)} onSave={(next) => { saveProfile(next); setProfileOpen(false); void loadMatches(next); }}/>} 
    {activeApplication && <ApplicationPanel application={activeApplication} profile={profile} onClose={() => setActiveApplication(null)} onUpdate={setActiveApplication}/>} 
  </main>;
}

function ProfilePanel({ profile, onClose, onSave }: { profile: Profile; onClose: () => void; onSave: (profile: Profile) => void }) {
  const [draft, setDraft] = React.useState(profile); const [cvText, setCvText] = React.useState(""); const [analysis, setAnalysis] = React.useState<DocumentAnalysis | null>(null); const [busy, setBusy] = React.useState(false); const [fileName, setFileName] = React.useState("");
  const update = (patch: Partial<Profile>) => setDraft(current => ({ ...current, ...patch }));
  async function analyze(text: string, name?: string) { setBusy(true); try { const response = await fetch(`${API}/api/documents/analyze`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, documentType: "cv" }) }); const data = await readJson(response); if (!response.ok) throw new Error(data.error ?? `Document API returned ${response.status}`); setAnalysis(data); } catch (e) { setAnalysis({ documentType: "unknown", facts: [], suggestedProfilePatch: {}, warnings: [e instanceof Error ? e.message : "Unable to analyze document"] }); } finally { setBusy(false); } if (name) setFileName(name); }
  async function handleFile(file: File) { const name = file.name.toLowerCase(); if (name.endsWith(".txt") || name.endsWith(".md") || name.endsWith(".json")) return analyze(await file.text(), file.name); if (name.endsWith(".pdf")) { setBusy(true); try { const buffer = await file.arrayBuffer(); const pdf = await pdfjsLib.getDocument({ data: buffer }).promise; let text = ""; for (let i = 1; i <= pdf.numPages; i++) { const page = await pdf.getPage(i); const content = await page.getTextContent(); text += content.items.map((item: any) => "str" in item ? item.str : "").join(" ") + "\n"; } await analyze(text, file.name); } catch (e) { setAnalysis({ documentType: "unknown", facts: [], suggestedProfilePatch: {}, warnings: [e instanceof Error ? e.message : "Unable to read PDF"] }); setBusy(false); } return; } if (name.endsWith(".docx")) { setBusy(true); try { const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() }); await analyze(result.value, file.name); } catch (e) { setAnalysis({ documentType: "unknown", facts: [], suggestedProfilePatch: {}, warnings: [e instanceof Error ? e.message : "Unable to read DOCX"] }); setBusy(false); } return; } setAnalysis({ documentType: "unknown", facts: [], suggestedProfilePatch: {}, warnings: ["Use PDF, DOCX, TXT, MD, or JSON for an academic CV."] }); }
  function applySuggestions() { if (!analysis) return; const patch = { ...analysis.suggestedProfilePatch }; if (typeof patch.targetFields === "string") patch.targetFields = patch.targetFields.split(", "); setDraft(current => ({ ...current, ...patch } as Profile)); }
  return <div className="overlay"><section className="panel profile-panel"><header className="panel-head"><div><span className="eyebrow dark">APPLICANT INTELLIGENCE</span><h2>Build your search profile</h2><p>Give discovery the facts it needs. Your CV can sharpen fields, academic matching and research-position searches.</p></div><button className="icon-btn" onClick={onClose}>×</button></header><div className="profile-layout"><div className="profile-form"><Field label="Nationality"><input value={draft.nationality} onChange={e => update({ nationality: e.target.value })}/></Field><Field label="Target degree"><select value={draft.degreeLevel} onChange={e => update({ degreeLevel: e.target.value as Profile["degreeLevel"] })}><option value="masters">Master's</option><option value="phd">PhD</option><option value="undergraduate">Undergraduate</option></select></Field><div className="two-col"><Field label="Academic score"><input type="number" step="0.01" value={draft.academicScore ?? ""} onChange={e => update({ academicScore: e.target.value ? Number(e.target.value) : undefined })}/></Field><Field label="Academic scale"><input type="number" step="0.1" value={draft.academicScale ?? ""} onChange={e => update({ academicScale: e.target.value ? Number(e.target.value) : undefined })}/></Field></div><Field label="Highest qualification"><input value={draft.highestQualification ?? ""} onChange={e => update({ highestQualification: e.target.value })}/></Field><Field label="Degree / discipline"><input value={draft.degreeField ?? ""} onChange={e => update({ degreeField: e.target.value })}/></Field><Field label="Funding requirement"><select value={draft.minimumFunding} onChange={e => update({ minimumFunding: e.target.value as Profile["minimumFunding"] })}><option value="substantial">Fully or substantially funded</option><option value="full">Fully funded only</option></select></Field><Field label="Relevant experience"><textarea value={draft.workExperience ?? ""} onChange={e => update({ workExperience: e.target.value })} placeholder="Forestry work, conservation projects, GIS, research, volunteering, internships…"/></Field><label className="field-label">Target fields</label><div className="chips">{FIELD_OPTIONS.map(field => { const active = draft.targetFields.includes(field); return <button key={field} className={active ? "chip active" : "chip"} onClick={() => update({ targetFields: active ? draft.targetFields.filter(x => x !== field) : [...draft.targetFields, field] })}>{field}</button>})}</div></div><div className="cv-box"><div className="upload-icon">CV</div><h3>Academic CV</h3><p>Upload a PDF or DOCX and the agent will extract explicit academic and experience evidence. You review every suggestion before it changes your profile.</p><label className="upload"><input type="file" accept=".pdf,.docx,.txt,.md,.json" onChange={e => { const file = e.target.files?.[0]; if (file) void handleFile(file); }}/><span>{busy ? "Analyzing CV…" : "Choose academic CV"}</span></label>{fileName && <small>Loaded: {fileName}</small>}<textarea className="cv-text" value={cvText} onChange={e => setCvText(e.target.value)} placeholder="Or paste your CV text here…"/><button className="secondary" disabled={!cvText.trim() || busy} onClick={() => void analyze(cvText)}>Analyze pasted CV</button>{analysis && <div className="analysis"><div className="analysis-head"><strong>{analysis.documentType.toUpperCase()} analysis</strong><button onClick={applySuggestions}>Apply suggestions</button></div>{analysis.facts.length ? analysis.facts.map(f => <div className="fact" key={f.field}><span>{prettyField(f.field)}</span><strong>{f.value}</strong><small>{Math.round(f.confidence * 100)}% confidence · {f.evidence}</small></div>) : <p>No explicit facts were extracted.</p>}{analysis.warnings.map(w => <small className="warning" key={w}>⚠ {w}</small>)}</div>}</div></div><footer className="panel-footer"><button className="secondary" onClick={onClose}>Cancel</button><button className="primary" onClick={() => onSave(draft)}>Save profile & refresh matches</button></footer></section></div>;
}

function ApplicationPanel({ application, profile, onClose, onUpdate }: { application: Application; profile: Profile; onClose: () => void; onUpdate: (app: Application) => void }) {
  const [status, setStatus] = React.useState(application.status); const [notes, setNotes] = React.useState(application.notes ?? ""); const [preparation, setPreparation] = React.useState<Preparation | null>(null); const [preparing, setPreparing] = React.useState(false); const [saving, setSaving] = React.useState(false); const [drafts, setDrafts] = React.useState<Record<string, string>>({}); const [error, setError] = React.useState("");
  React.useEffect(() => { const next: Record<string, string> = {}; application.answers.forEach(a => next[a.field] = a.answer); setDrafts(next); }, [application.answers]);
  const required = application.requirements.filter(r => r.required); const ready = required.filter(r => ["ready", "attached", "waived"].includes(r.status)); const readiness = required.length ? Math.round(ready.length / required.length * 100) : 0;
  async function prepare() { setPreparing(true); setError(""); try { const response = await fetch(`${API}/api/applications/${application.id}/prepare`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ profile }) }); const data = await readJson(response); if (!response.ok) throw new Error(data.error ?? `Application API returned ${response.status}`); setPreparation(data.preparation); if (data.application) { onUpdate(data.application); setStatus(data.application.status); } } catch (e) { setError(e instanceof Error ? e.message : "Unable to prepare application"); } finally { setPreparing(false); } }
  async function save() { setSaving(true); try { const response = await fetch(`${API}/api/applications/${application.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status, notes }) }); const data = await readJson(response); if (!response.ok) throw new Error(data.error ?? "Unable to save application"); onUpdate(data); } catch (e) { setError(e instanceof Error ? e.message : "Unable to save application"); } finally { setSaving(false); } }
  async function requirement(id: string, value: string) { const response = await fetch(`${API}/api/applications/${application.id}/requirements/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: value }) }); const data = await readJson(response); if (response.ok) onUpdate(data); else setError(data.error ?? "Unable to update requirement"); }
  async function answer(field: string) { const response = await fetch(`${API}/api/applications/${application.id}/answers`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ field, answer: drafts[field] ?? "", aiPolicy: "limited", reviewed: false }) }); const data = await readJson(response); if (!response.ok) return setError(data.error ?? "Unable to save answer"); const refreshed = await fetch(`${API}/api/applications/${application.id}`); if (refreshed.ok) onUpdate(await refreshed.json()); }
  return <div className="overlay"><section className="panel application-panel"><header className="panel-head"><div><span className="eyebrow dark">APPLICATION WORKSPACE</span><h2>Prepare application</h2><p>Facts are drawn from your profile only. Personal claims and final submission stay under your control.</p></div><button className="icon-btn" onClick={onClose}>×</button></header>{error && <div className="error">{error}</div>}<div className="readiness"><div><strong>{readiness}%</strong><span>application readiness</span></div><div className="progress"><i style={{ width: `${readiness}%` }}/></div><small>{ready.length} of {required.length} required items ready</small></div><div className="application-grid"><section><div className="section-title"><h3>Application control</h3><select value={status} onChange={e => setStatus(e.target.value)}><option value="discovered">Discovered</option><option value="review">Review</option><option value="preparing">Preparing</option><option value="ready">Ready</option><option value="submitted">Submitted</option><option value="withdrawn">Withdrawn</option></select></div><button className="primary wide" onClick={() => void prepare()} disabled={preparing}>{preparing ? "Preparing factual answers…" : "Prepare factual answers"}</button><h3>Requirements</h3>{application.requirements.length ? application.requirements.map(r => <div className="requirement" key={r.id}><div><strong>{r.name}</strong><small>{r.required ? "Required" : "Optional"}{r.sourceInstruction ? ` · ${r.sourceInstruction}` : ""}</small></div><select value={r.status} onChange={e => void requirement(r.id, e.target.value)}><option value="missing">Missing</option><option value="ready">Ready</option><option value="attached">Attached</option><option value="waived">Waived</option></select></div>) : <Empty title="No extracted requirements" text="This opportunity has not exposed a requirement list yet."/>}</section><section><h3>Prepared answers</h3>{application.answers.length ? application.answers.map(a => <article className="answer" key={a.id}><div><strong>{prettyField(a.field)}</strong><small>{a.reviewed ? "Reviewed" : "Needs review"} · profile fact · {a.aiPolicy}</small></div><textarea value={drafts[a.field] ?? a.answer} onChange={e => setDrafts(d => ({ ...d, [a.field]: e.target.value }))}/><button className="secondary" onClick={() => void answer(a.field)}>Save answer</button></article>) : <Empty title="No factual answers yet" text="Click Prepare factual answers to populate facts from your profile."/>}{preparation && <div className="question-bank"><h3>Information you still need to provide</h3>{preparation.questions.map(q => <article key={q.field}><strong>{prettyField(q.field)}</strong><p>{q.prompt}</p><small>Needs your input · {q.category}</small></article>)}{preparation.warnings.map(w => <small className="warning" key={w}>⚠ {w}</small>)}</div>}<h3>Notes</h3><textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Application notes…"/><button className="primary wide" onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "Save application"}</button></section></div></section></div>;
}

function OpportunityCard({ item, onPrepare, disabled }: { item: Match; onPrepare: (id: string) => void; disabled: boolean }) { return <article className="opportunity"><div className="op-top"><span className="match">{Math.round(item.score * 100)}% fit</span><span className="funding">{labelFunding(item.fundingClass)}</span><span className="trust">Trust {item.trustLevel}/5</span></div><div className="op-body"><div className="op-main"><span className="type">{labelType(item.opportunityType)}</span><h2>{item.title}</h2><p className="provider">{[item.provider, item.university, item.country].filter(Boolean).join(" · ") || "Provider not yet verified"}</p><div className="eligibility">{labelEligibility(item.eligibility)}{item.eligibilityConfidence !== undefined && ` · ${Math.round(item.eligibilityConfidence * 100)}% confidence`}</div><div className="tags">{item.fields.slice(0, 8).map(f => <span key={f}>{f}</span>)}</div></div><aside className="op-side"><strong>{item.deadline ? new Date(item.deadline).toLocaleDateString() : "Verify"}</strong><small>{item.deadline ? "application deadline" : "deadline"}</small><div className="actions"><a href={item.sourceUrl} target="_blank" rel="noreferrer">Source ↗</a>{item.applicationUrl && <a href={item.applicationUrl} target="_blank" rel="noreferrer">Apply ↗</a>}<button className="primary" onClick={() => onPrepare(item.id)} disabled={disabled}>Prepare application</button></div></aside></div><ul className="reasons">{item.reasons.slice(0, 4).map(r => <li key={r}>{r}</li>)}</ul></article>; }
function DiscoveryCard({ item }: { item: DiscoveryRecord }) { return <article className="discovery-row"><div className="source-badge">{item.source.slice(0, 2).toUpperCase()}</div><div><strong>{item.title || item.url}</strong><p>{item.source} · {item.discoveryMethod}{item.query ? ` · ${item.query}` : ""}</p></div><a href={item.url} target="_blank" rel="noreferrer">Open ↗</a></article>; }
function Stat({ value, label }: { value: React.ReactNode; label: string }) { return <div className="stat"><strong>{value}</strong><span>{label}</span></div>; }
function Metric({ label, value }: { label: string; value: React.ReactNode }) { return <div className="metric"><strong>{value}</strong><span>{label}</span></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="field-label">{label}{children}</label>; }
function Empty({ title, text }: { title: string; text: string }) { return <div className="empty"><strong>{title}</strong><p>{text}</p></div>; }
function Loading() { return <div className="loading">Loading your opportunity intelligence…</div>; }
function prettyDegree(value: string) { return value === "masters" ? "Master's" : value === "phd" ? "PhD" : "Undergraduate"; }
function labelFunding(value: string) { return value === "fully_funded" ? "Fully funded" : value === "substantially_funded" ? "Substantial funding" : value.replaceAll("_", " "); }
function labelType(value?: string) { return value ? value.replaceAll("_", " ").replace(/\b\w/g, x => x.toUpperCase()) : "Opportunity"; }
function labelEligibility(value: string) { return value === "confirmed_eligible" ? "Eligibility confirmed" : value === "probably_eligible" ? "Probably eligible" : value === "cannot_determine" ? "Needs verification" : "Not eligible"; }
function prettyField(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, x => x.toUpperCase()); }
function matchesSearch(item: any, query: string) { if (!query.trim()) return true; const haystack = [item.title, item.provider, item.university, item.country, ...(item.fields ?? [])].filter(Boolean).join(" ").toLowerCase(); return haystack.includes(query.toLowerCase()); }
function loadProfile(): Profile { try { const saved = localStorage.getItem("scholarship-agent-profile"); return saved ? { ...DEFAULT_PROFILE, ...JSON.parse(saved) } : DEFAULT_PROFILE; } catch { return DEFAULT_PROFILE; } }
async function readJson(response: Response): Promise<any> { const text = await response.text(); try { return text ? JSON.parse(text) : {}; } catch { return { error: text || response.statusText }; } }

createRoot(document.getElementById("root")!).render(<App/>);
