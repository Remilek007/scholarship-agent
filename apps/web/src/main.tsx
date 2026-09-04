import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type Match = {
  id: string;
  title: string;
  provider?: string;
  university?: string;
  country?: string;
  fundingClass: string;
  deadline?: string;
  trustLevel: number;
  fields: string[];
  score: number;
  eligibility: "confirmed_eligible" | "probably_eligible" | "cannot_determine" | "not_eligible";
  reasons: string[];
  sourceUrl: string;
  applicationUrl?: string;
};

const API = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
const PROFILE = {
  nationality: "Nigeria",
  degreeLevel: "masters",
  targetFields: ["forestry", "wildlife", "conservation", "natural_resources", "climate", "geospatial"],
  minimumFunding: "substantially_funded",
  academicScore: 4.72,
  academicScale: 5
};

function App() {
  const [items, setItems] = React.useState<Match[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [funding, setFunding] = React.useState("all");
  const [includeReview, setIncludeReview] = React.useState(false);

  async function load() {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ limit: "20", minTrustLevel: "1" });
      if (includeReview) params.set("includeReview", "true");
      const response = await fetch(`${API}/api/matches?${params}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(PROFILE)
      });
      if (!response.ok) throw new Error(`API returned ${response.status}`);
      const data = await response.json() as { matches: Match[] };
      setItems(data.matches ?? []);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to calculate matches"); }
    finally { setLoading(false); }
  }

  React.useEffect(() => { void load(); }, [includeReview]);
  const visible = funding === "all" ? items : items.filter(item => item.fundingClass === funding);
  const ready = items.filter(item => item.eligibility !== "cannot_determine").length;
  const review = items.filter(item => item.eligibility === "cannot_determine").length;

  return <main>
    <header className="hero">
      <div>
        <p className="eyebrow">SCHOLARSHIP AGENT</p>
        <h1>Your funded Master's shortlist.</h1>
        <p className="sub">Forestry-first intelligence across scholarships, universities, research positions and funding sources.</p>
      </div>
      <button onClick={() => void load()} disabled={loading}>{loading ? "Matching…" : "Find best matches"}</button>
    </header>

    <section className="stats">
      <div><strong>{items.length}</strong><span>top matches</span></div>
      <div><strong>{ready}</strong><span>ready for review</span></div>
      <div><strong>{review}</strong><span>need verification</span></div>
    </section>

    <section className="toolbar">
      <div><label>Funding</label><select value={funding} onChange={e => setFunding(e.target.value)}><option value="all">All qualifying</option><option value="fully_funded">Fully funded</option><option value="substantially_funded">Substantial funding</option></select></div>
      <label className="check"><input type="checkbox" checked={includeReview} onChange={e => setIncludeReview(e.target.checked)} /> Include uncertain eligibility</label>
      <p>Ranked for Nigeria · Master's · Forestry/Wildlife + related fields</p>
    </section>

    {error && <div className="error">{error}. Make sure the API is running and VITE_API_URL points to it.</div>}
    {!loading && !error && !visible.length && <div className="empty">No matching opportunities yet. Run discovery to populate the database.</div>}
    <section className="grid">
      {visible.map(item => <article className="card" key={item.id}>
        <div className="cardtop"><span className="score">{item.score}% match</span><span className="pill">{labelFunding(item.fundingClass)}</span><span>Trust {item.trustLevel}/5</span></div>
        <h2>{item.title}</h2>
        <p className="muted">{[item.provider, item.university, item.country].filter(Boolean).join(" · ") || "Provider not yet verified"}</p>
        <div className="status">{labelEligibility(item.eligibility)}</div>
        <div className="tags">{item.fields.slice(0, 6).map(field => <span key={field}>{field}</span>)}</div>
        <ul className="reasons">{item.reasons.slice(0, 3).map(reason => <li key={reason}>{reason}</li>)}</ul>
        <footer>
          <span>{item.deadline ? `Deadline: ${new Date(item.deadline).toLocaleDateString()}` : "Deadline not yet verified"}</span>
          <span className="actions"><a href={item.sourceUrl} target="_blank" rel="noreferrer">Source</a>{item.applicationUrl && <a href={item.applicationUrl} target="_blank" rel="noreferrer">Apply</a>}</span>
        </footer>
      </article>)}
    </section>
  </main>;
}

function labelFunding(value: string) { return value === "fully_funded" ? "Fully funded" : value === "substantially_funded" ? "Substantial funding" : value.replaceAll("_", " "); }
function labelEligibility(value: Match["eligibility"]) {
  return value === "confirmed_eligible" ? "Eligibility confirmed" : value === "probably_eligible" ? "Probably eligible" : value === "cannot_determine" ? "Needs verification" : "Not eligible";
}

createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
