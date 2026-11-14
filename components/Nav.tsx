import Logo from "./Logo";

export default function Nav() {
  return (
    <header className="nav">
      <div className="nav-inner">
        <a href="#top" className="logo" aria-label="Loopmates, back to top">
          <Logo />
        </a>
        <nav className="nav-links" aria-label="Sections">
          <a className="navlink" href="#mates">Mates</a>
          <a className="navlink" href="#runs">Runs</a>
          <a className="navlink" href="#calls">Calls</a>
          <a className="navlink" href="#integrations">Integrations</a>
          <a className="navlink" href="#safety">Safety</a>
        </nav>
        <a href="#install" className="btn btn-acc btn-sm">Run your own</a>
      </div>
    </header>
  );
}
