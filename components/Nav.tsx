import Logo from "./Logo";
import Magnetic from "./Magnetic";

export default function Nav() {
  return (
    <header className="nav">
      <div className="nav-inner" data-nav>
        <a href="#top" className="logo" aria-label="Loopmates home">
          <Logo />
        </a>
        <nav className="nav-links" aria-label="Sections">
          <a href="#demo">Demo</a>
          <a href="#features">Platform</a>
          <a href="#dots">Mates</a>
          <a href="#myspace">My Space</a>
          <a href="#safety">Safety</a>
        </nav>
        <Magnetic strength={0.25}>
          <a href="https://dashboard.loopmates.com" className="btn-violet">
            Get started
          </a>
        </Magnetic>
      </div>
    </header>
  );
}
