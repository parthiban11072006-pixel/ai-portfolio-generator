import { useCallback, useEffect, useState } from "react";
import "./App.css";

const emptyPortfolio = null;

function encodePortfolioData(data) {
  const json = JSON.stringify(data);
  return btoa(unescape(encodeURIComponent(json)));
}

function decodePortfolioFromHash() {
  const hash = window.location.hash;
  if (!hash.startsWith("#p=")) return null;
  try {
    const encoded = hash.slice(3);
    const json = decodeURIComponent(escape(atob(encoded)));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export default function App() {
  const [file, setFile] = useState(null);
  const [portfolio, setPortfolio] = useState(emptyPortfolio);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copyMsg, setCopyMsg] = useState("");

  useEffect(() => {
    const fromLink = decodePortfolioFromHash();
    if (fromLink) setPortfolio(fromLink);
  }, []);

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    setFile(selected || null);
    setError("");
  };

  const handleGenerate = async () => {
    if (!file) {
      setError("Please select a PDF resume first.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("resume", file);

      // Backend port 5001-ல் ஓடுவதால் URL நேரடியாக இணைக்கப்பட்டுள்ளது
      const res = await fetch("http://localhost:5001/api/upload", {
        method: "POST",
        body: formData,
      });

      const body = await res.json();

      if (!res.ok || !body.success) {
        throw new Error(body.error || "Failed to generate portfolio");
      }

      setPortfolio(body.data);
      window.location.hash = `p=${encodePortfolioData(body.data)}`;
    } catch (err) {
      setError(err.message || "Something went wrong");
      setPortfolio(emptyPortfolio);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = useCallback(async () => {
    if (!portfolio) return;
    const url = `${window.location.origin}${window.location.pathname}#p=${encodePortfolioData(portfolio)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopyMsg("Link copied!");
      setTimeout(() => setCopyMsg(""), 2500);
    } catch {
      setCopyMsg("Could not copy — select URL from address bar");
    }
  }, [portfolio]);

  const skills = Array.isArray(portfolio?.skills) ? portfolio.skills : [];
  const projects = Array.isArray(portfolio?.projects) ? portfolio.projects : [];
  const contact = portfolio?.contact || {};

  return (
    <div className="app">
      <div className="bg-glow bg-glow-a" aria-hidden />
      <div className="bg-glow bg-glow-b" aria-hidden />

      <header className="header glass">
        <h1>🚀 AI Portfolio Generator</h1>
        <p className="tagline">Upload your resume PDF — get a polished portfolio in seconds</p>
      </header>

      <main className="main">
        <section className="upload-card glass">
          <label className="upload-label" htmlFor="resume-input">
            <span className="upload-icon">📄</span>
            <span>{file ? file.name : "Choose PDF resume"}</span>
          </label>
          <input
            id="resume-input"
            type="file"
            accept="application/pdf,.pdf"
            onChange={handleFileChange}
            disabled={loading}
          />

          <button
            type="button"
            className="btn-primary"
            onClick={handleGenerate}
            disabled={loading || !file}
          >
            {loading ? "Generating Magic... ✨" : "Generate Portfolio"}
          </button>

          {error && <p className="error-msg">{error}</p>}
        </section>

        {portfolio && (
          <article className="portfolio glass">
            <div className="portfolio-header">
              <div>
                <h2 className="candidate-name">{portfolio.name || "Your Name"}</h2>
                {portfolio.role && <span className="role-badge">{portfolio.role}</span>}
              </div>
              <button type="button" className="btn-secondary" onClick={handleCopyLink}>
                🔗 Copy Shareable Portfolio Link
              </button>
            </div>
            {copyMsg && <p className="copy-msg">{copyMsg}</p>}

            {portfolio.about && (
              <section className="section">
                <h3>About</h3>
                <p className="about-text">{portfolio.about}</p>
              </section>
            )}

            {skills.length > 0 && (
              <section className="section">
                <h3>Technical Skills</h3>
                <div className="skills-wrap">
                  {skills.map((skill) => (
                    <span key={skill} className="skill-chip">
                      {skill}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {projects.length > 0 && (
              <section className="section">
                <h3>Featured Projects</h3>
                <div className="projects-grid">
                  {projects.map((project, idx) => (
                    <div key={project.title || idx} className="project-card">
                      <h4>{project.title || "Untitled Project"}</h4>
                      <p>{project.description}</p>
                      {Array.isArray(project.tech) && project.tech.length > 0 && (
                        <div className="tech-tags">
                          {project.tech.map((t) => (
                            <span key={t} className="tech-tag">
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {(contact.email || contact.phone) && (
              <section className="section contact-section">
                <h3>Contact</h3>
                <div className="contact-row">
                  {contact.email && (
                    <a href={`mailto:${contact.email}`} className="contact-link">
                      ✉️ {contact.email}
                    </a>
                  )}
                  {contact.phone && (
                    <a href={`tel:${contact.phone.replace(/\s/g, "")}`} className="contact-link">
                      📞 {contact.phone}
                    </a>
                  )}
                </div>
              </section>
            )}
          </article>
        )}
      </main>

      <footer className="footer">
        <span>Powered by Gemini · Express · React</span>
      </footer>
    </div>
  );
}