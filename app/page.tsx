import SmoothSetup from "@/components/SmoothSetup";
import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import Marquee from "@/components/Marquee";
import Demo from "@/components/Demo";
import Features from "@/components/Features";
import DotsGrid from "@/components/DotsGrid";
import MySpace from "@/components/MySpace";
import Automations from "@/components/Automations";
import Safety from "@/components/Safety";
import Cta from "@/components/Cta";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <div className="progress" aria-hidden="true" />
      <Nav />
      <div id="smooth-wrapper">
        <div id="smooth-content">
          {/* SmoothSetup renders first so ScrollSmoother exists before any ScrollTrigger below */}
          <SmoothSetup />
          <main>
            <Hero />
            <Marquee />
            <Demo />
            <Features />
            <DotsGrid />
            <MySpace />
            <Automations />
            <Safety />
            <Cta />
          </main>
          <Footer />
        </div>
      </div>
    </>
  );
}
