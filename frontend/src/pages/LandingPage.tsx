import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const impactCards = [
  {
    title: 'AI adoption lift',
    description: 'Measure how AI-assisted workflows improve throughput and predictability across teams.',
  },
  {
    title: 'Review velocity',
    description: 'Track review speed and quality changes after AI recommendations are introduced.',
  },
  {
    title: 'Quality delta',
    description: 'Compare defect risk, release health, and process stability before and after AI adoption.',
  },
];

const workflowSteps = [
  {
    number: '1',
    title: 'Connect',
    description: 'Link GitHub, Jira, and AI tooling to build a complete view of AI-driven engineering activity.',
  },
  {
    number: '2',
    title: 'Measure',
    description: 'Capture AI adoption signals and delivery metrics in a single, trusted dashboard.',
  },
  {
    number: '3',
    title: 'Optimize',
    description: 'Discover the highest-impact actions and track how AI changes outcomes over time.',
  },
];

const LandingPage = () => {
  const { isAuthenticated } = useAuth();

  return (
    <main className="landing-shell">
      <section className="landing-hero">
        <div className="landing-copy">
          <span className="eyebrow">AI adoption metrics for engineering teams</span>
          <h1>Measure how AI changes engineering performance</h1>
          <p>
            See the real productivity, review, and quality impact of AI adoption across GitHub, Jira, and
            your delivery workflows.
          </p>
          <div className="hero-actions">
            {isAuthenticated ? (
              <Link to="/dashboard" className="button button-primary">
                View dashboard
              </Link>
            ) : (
              <>
                <Link to="/register" className="button button-primary">
                  Get started
                </Link>
                <Link to="/login" className="button button-secondary">
                  Log in
                </Link>
              </>
            )}
          </div>
        </div>

        <div className="landing-visual">
          <div className="visual-card visual-card-large">
            <p className="visual-tag">Productivity Growth</p>
            <div className="visual-content">
              <div className="metric-row">
                <div>
                  <h3>Throughput Per Developer</h3>
                  <p>Since AI adoption</p>
                </div>
                <span style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#0183ff' }}>+34%</span>
              </div>
              <svg
                width="100%"
                height="180"
                viewBox="0 0 300 180"
                style={{ marginTop: '1rem' }}
              >
                {/* Grid lines */}
                <line x1="30" y1="140" x2="280" y2="140" stroke="#e2e8f0" strokeWidth="1" />
                <line x1="30" y1="100" x2="280" y2="100" stroke="#e2e8f0" strokeWidth="1" opacity="0.5" />
                <line x1="30" y1="60" x2="280" y2="60" stroke="#e2e8f0" strokeWidth="1" opacity="0.5" />
                <line x1="30" y1="20" x2="280" y2="20" stroke="#e2e8f0" strokeWidth="1" opacity="0.5" />

                {/* Gradient fill under line */}
                <defs>
                  <linearGradient id="productivityGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#0183ff" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#0183ff" stopOpacity="0" />
                  </linearGradient>
                </defs>

                {/* Data polygon for fill */}
                <polygon
                  points="30,130 60,110 90,90 120,70 150,50 180,40 210,35 240,30 270,25"
                  fill="url(#productivityGradient)"
                />

                {/* Line chart */}
                <polyline
                  points="30,130 60,110 90,90 120,70 150,50 180,40 210,35 240,30 270,25"
                  fill="none"
                  stroke="#0183ff"
                  strokeWidth="2"
                />

                {/* Data points */}
                <circle cx="30" cy="130" r="3" fill="#0183ff" />
                <circle cx="60" cy="110" r="3" fill="#0183ff" />
                <circle cx="90" cy="90" r="3" fill="#0183ff" />
                <circle cx="120" cy="70" r="3" fill="#0183ff" />
                <circle cx="150" cy="50" r="3" fill="#0183ff" opacity="0.8" />
                <circle cx="180" cy="40" r="3" fill="#0183ff" opacity="0.8" />
                <circle cx="210" cy="35" r="3" fill="#0183ff" opacity="0.8" />
                <circle cx="240" cy="30" r="3" fill="#0183ff" opacity="0.8" />
                <circle cx="270" cy="25" r="3" fill="#0183ff" opacity="0.8" />

                {/* Axis labels */}
                <text x="30" y="160" fontSize="11" fill="#94a3b8" textAnchor="middle">
                  Month 1
                </text>
                <text x="270" y="160" fontSize="11" fill="#94a3b8" textAnchor="middle">
                  Month 8
                </text>
              </svg>
              <div className="metric-grid" style={{ marginTop: '1rem' }}>
                <div>
                  <p>PR velocity</p>
                  <strong>+28%</strong>
                </div>
                <div>
                  <p>Deploy frequency</p>
                  <strong>+42%</strong>
                </div>
                <div>
                  <p>Quality score</p>
                  <strong>+18%</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="ai-impact">
        <div className="impact-visual">
          <div className="impact-panel">
            <span className="panel-badge">AI insight</span>
            <h3>Cycle time is down 19%</h3>
            <p>Since AI adoption, PR cycle time is down 19% and sprint delivery has become more consistent.</p>
          </div>
          <div className="impact-panel impact-panel-secondary">
            <span className="panel-badge">Recommendation</span>
            <p>Scale AI-driven PR summarization across teams to sustain faster cycle times and reinforce consistent sprint delivery.</p>
          </div>
        </div>
        <div>
          <h2>Get answers about AI impact, not just dashboards.</h2>
          <p>
            Set your AI adoption date or other key focus points like new tooling rollouts, then track metrics from those milestones forward. Ask plain-English questions like “How did AI assistants affect review speed this sprint?” and get contextual insights, impact signals, and recommended next steps.
          </p>
          <ul className="impact-list">
            <li>Compare impact across teams and tools</li>
            <li>Spot quality regressions linked to AI-driven workflows</li>
            <li>Discover opportunities where AI lifts delivery speed most</li>
          </ul>
        </div>
      </section>

      <section className="workflow-section">
        <div className="workflow-header">
          <span className="eyebrow">How it works</span>
          <h2>Connect, measure, and optimize AI-driven engineering work</h2>
          <p>
            IntelBoard helps teams capture AI adoption signals, benchmark impact, and take the right actions to improve
            delivery quality over time.
          </p>
        </div>
        <div className="workflow-grid">
          {workflowSteps.map((step) => (
            <article key={step.number} className="workflow-card">
              <div className="workflow-number">{step.number}</div>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-footer">
        <h2>Start measuring AI impact today</h2>
        <div className="footer-action">
          <Link to="/register" className="button button-primary">
            Start your free trial
          </Link>
        </div>
      </section>
    </main>
  );
};

export default LandingPage;
