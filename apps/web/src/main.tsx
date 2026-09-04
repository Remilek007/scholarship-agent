import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type Scholarship = {
  id: string;
  title: string;
  provider?: string;
  university?: string;
  country?: string;
  degreeLevel?: string;
  fundingClass: string;
  deadline?: string;
  trustLevel: number;
  fields: string[];
};

const API = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

function App() {
  const [items, setItems] = React.useState<Scholarship[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [funding, setFunding] = React.useState("all");

  async function load() {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ degreeLevel: "masters", minTrustLevel: "3", limit: "50" });
      if (funding !== "all") params.set("fundingClass", funding);
      const response = await fetch(`${API}/api/scholarships?${params}`);
      if (!response.ok) throw new Error(`API returned ${response.status}`);
      const data = await response.json() as { scholarships: Scholarship[] };
      setItems(data.scholarships ?? []);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load scholarships"); }
    finally { setLoading(false); }
  }

  React.useEffect(() => { void load(); }, [funding]);

  return <main>
    <header className="hero">
      <div>
        <p className="eyebrow">SCHOLARSHIP AGENT</p>
        <h1>Find funded Master's opportunities that fit you.</h1>
        <p className="sub">Forestry-first discovery across scholarships, universities, research positions and funding sources.</p>
      </div>
      <button onClick={() => void load()} disabled={loading}>{loading ? "Scanning…" : "Refresh opportunities"}</button>
    </header>

    <section className="stats">
      <div><strong>{items.length}</strong><span>verified candidates</span></div>
      <div><strong>Master's</strong><span>current target</span></div>
      <div><strong>Full + substantial</strong><span>funding filter</span></div>
    </section>

    <section className="toolbar">
      <div><label>Funding</label><select value={funding} onChange={e => setFunding(e.target.value)}><option value="all">All qualifying</option><option value="fully_funded">Fully funded</option><option value="substantially_funded">Substantially funded</option></select></div>
      <p>Official-source trust threshold: 3/5+</p>
    </section>

    {error && <div className="error">{error}. Make sure the API is running and VITE_API_URL points to it.</div>}
    {!loading && !error && !items.length && <div className="empty">No verified opportunities yet. Run discovery from the API to populate the dashboard.</div>}
    <section className="grid">
      {items.map(item => <article className="card" key={item.id}>
        <div className="cardtop"><span className="pill">{labelFunding(item.fundingClass)}</span><span>Trust {item.trustLevel}/5</span></div>
        <h2>{item.title}</h2>
        <p className="muted">{[item.provider, item.university, item.country].filter(Boolean).join(" · ") || "Provider not yet verified"}</p>
        <div className="tags">{item.fields.slice(0, 5).map(field => <span key={field}>{field}</span>)}</div>
        <footer>{item.deadline ? `Deadline: ${new Date(item.deadline).toLocaleDateString()}` : "Deadline not yet verified"}</footer>
      </article>)}
    </section>
  </main>;
}

function labelFunding(value: string) { return value === "fully_funded" ? "Fully funded" : value === "substantially_funded" ? "Substantial funding" : value.replaceAll("_", " "); }

createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
