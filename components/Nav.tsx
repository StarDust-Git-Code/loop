import Image from "next/image";
import Magnetic from "./Magnetic";

export default function Nav() {
  return (
    <header className="nav">
      <div className="nav-inner" data-nav>
        <a href="#top" className="logo" aria-label="Loop home">
          <Image src="/dots/research.png" alt="" width={44} height={44} priority />
          <b>
            Loop<em>.</em>
          </b>
        </a>
        <nav className="nav-links" aria-label="Sections">
          <a href="#demo">Demo</a>
          <a href="#features">Platform</a>
          <a href="#dots">Dots</a>
          <a href="#myspace">My Space</a>
          <a href="#safety">Safety</a>
        </nav>
        <Magnetic strength={0.25}>
          <a href="https://dashboard.loopdots.com" className="btn-violet">
            Get started
          </a>
        </Magnetic>
      </div>
    </header>
  );
}
