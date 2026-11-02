import Logo from "./Logo";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-in">
        <a href="#top" className="logo" style={{ gap: 10 }}>
          <Logo size={30} fontSize={22} />
          <span style={{ fontSize: 13, color: "var(--muted)", marginLeft: 6, fontWeight: 500 }}>loopmates.com</span>
        </a>
        <nav style={{ display: "flex", flexWrap: "wrap", gap: 4 }} aria-label="Footer">
          <a href="#demo">Demo</a>
          <a href="#features">Platform</a>
          <a href="#dots">Mates</a>
          <a href="#safety">Safety</a>
          <a href="https://dashboard.loopmates.com" style={{ color: "var(--violet-deep)", fontWeight: 700 }}>Open dashboard</a>
        </nav>
        <small>© 2026 Loopmates. Build agents. Connect intelligence. Get work done.</small>
      </div>
    </footer>
  );
}
