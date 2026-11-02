import Image from "next/image";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-in">
        <a href="#top" className="logo" style={{ gap: 10 }}>
          <Image src="/dots/research.png" alt="" width={34} height={34} />
          <b style={{ fontSize: 22 }}>Loop<em>.</em></b>
          <span style={{ fontSize: 13, color: "var(--muted)", marginLeft: 6, fontWeight: 500 }}>loopdots.com</span>
        </a>
        <nav style={{ display: "flex", flexWrap: "wrap", gap: 4 }} aria-label="Footer">
          <a href="#demo">Demo</a>
          <a href="#features">Platform</a>
          <a href="#dots">Dots</a>
          <a href="#safety">Safety</a>
          <a href="https://dashboard.loopdots.com" style={{ color: "var(--violet-deep)", fontWeight: 700 }}>Open dashboard</a>
        </nav>
        <small>© 2026 Loop. Build agents. Connect intelligence. Get work done.</small>
      </div>
    </footer>
  );
}
