import { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function App() {
  const [nps, setNps] = useState(null);
  const [coverage, setCoverage] = useState(null);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const headers = {
      "X-User-Id": "3",
      "X-User-Role": "Manager"
    };

    Promise.all([
      fetch(`${API_BASE}/dashboard/nps`, { headers }),
      fetch(`${API_BASE}/dashboard/coverage`, { headers }),
      fetch(`${API_BASE}/dashboard/category-breakdown`, { headers })
    ])
      .then(async ([npsRes, coverageRes, catRes]) => {
        const npsData = await npsRes.json();
        const coverageData = await coverageRes.json();
        const catData = await catRes.json();

        if (!npsRes.ok || !coverageRes.ok || !catRes.ok) {
          setError(npsData.detail || coverageData.detail || catData.detail || "Failed to load");
          return;
        }

        setNps(npsData);
        setCoverage(coverageData);
        setCategories(catData);
      })
      .catch(() => setError("Failed to load dashboard data"));
  }, []);

  return (
    <main className="page">
      <header className="header">
        <div>
          <p className="eyebrow">Governance Dashboard</p>
          <h1>B2B CX Performance Overview</h1>
        </div>
        <button className="cta" type="button">Export Snapshot</button>
      </header>

      {error ? <p className="notice">{error}</p> : null}

      <section className="grid">
        <article>
          <h2>Net Promoter Score</h2>
          <p className="metric">{nps?.nps ?? "--"}</p>
          <p className="caption">Approved NPS responses</p>
        </article>
        <article>
          <h2>Coverage</h2>
          <p className="metric">{coverage?.coverage_percent ?? "--"}%</p>
          <p className="caption">Businesses visited YTD</p>
        </article>
        <article>
          <h2>Repeat Visits</h2>
          <p className="metric">{coverage?.repeat_visits ?? "--"}</p>
          <p className="caption">Multi-visit accounts</p>
        </article>
      </section>

      <section className="table">
        <h2>Category Breakdown</h2>
        <div className="table-row header-row">
          <span>Category</span>
          <span>Average Score</span>
          <span>Responses</span>
        </div>
        {categories.length === 0 ? (
          <p className="caption">No category data yet.</p>
        ) : (
          categories.map((item) => (
            <div className="table-row" key={item.category}>
              <span>{item.category}</span>
              <span>{item.average_score}</span>
              <span>{item.response_count}</span>
            </div>
          ))
        )}
      </section>
    </main>
  );
}
