export default function App() {
  return (
    <main className="page">
      <header className="header">
        <div>
          <p className="eyebrow">Governance Dashboard</p>
          <h1>B2B CX Performance Overview</h1>
        </div>
        <button className="cta" type="button">Export Snapshot</button>
      </header>
      <section className="grid">
        <article>
          <h2>Net Promoter Score</h2>
          <p className="metric">+42</p>
          <p className="caption">Approved visits only</p>
        </article>
        <article>
          <h2>Coverage</h2>
          <p className="metric">68%</p>
          <p className="caption">Businesses visited YTD</p>
        </article>
        <article>
          <h2>Action Items</h2>
          <p className="metric">17</p>
          <p className="caption">Open follow-ups</p>
        </article>
      </section>
    </main>
  );
}
