import HouseFilm from "@/components/house/HouseFilm";

export default function Home() {
  return (
    <>
      <header className="nav">
        <a href="#top" data-go="hero" className="nav-word" aria-label="Loopmates, back to the top">loopmates</a>
        <nav aria-label="Sections">
          <a href="#mates" data-go="inside">The Mates</a>
          <a href="#how" data-go="how">How it works</a>
          <a href="#limits" data-go="limits">Limits</a>
        </nav>
        <a href="#join" data-go="join" className="nav-join">Join the list</a>
      </header>
      <div id="smooth-wrapper">
        <div id="smooth-content">
          <main>
            <HouseFilm />
          </main>
        </div>
      </div>
    </>
  );
}
