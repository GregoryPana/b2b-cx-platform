export default function App() {
  return (
    <main className="page">
      <section className="hero">
        <p className="eyebrow">Survey Console</p>
        <h1>B2B Customer Experience Visit</h1>
        <p className="lead">
          Structured visit assessments with governance, action tracking, and clear status transitions.
        </p>
      </section>
      <section className="status">
        <div>
          <span className="label">Current Status</span>
          <strong>Draft</strong>
        </div>
        <div>
          <span className="label">Next Step</span>
          <strong>Complete responses</strong>
        </div>
      </section>
    </main>
  );
}
