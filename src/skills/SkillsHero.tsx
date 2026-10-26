import { ArrowUpRight, Check, Code2, Layers3, Sparkles } from "lucide-react";
import "../scss/list-views.scss";

export default function SkillsHero({ onScenario }: { onScenario: () => void }) {
  return (
    <section className="hero">
      <div className="hero-copy">
        <span className="hero-label">
          <span className="live-dot" /> THE RIGHT PEOPLE. THE RIGHT
          POSSIBILITIES.
        </span>
        <h2>
          Great work starts
          <br />
          with the right skills.
        </h2>
        <p>
          Your team has the talent. Find the perfect combination
          <br className="desktop-br" /> for whatever comes next.
        </p>
        <button onClick={onScenario}>
          Explore scenarios <ArrowUpRight size={17} />
        </button>
      </div>
      <div className="hero-art" aria-hidden="true">
        <div className="orbit orbit-one" />
        <div className="orbit orbit-two" />
        <div className="orbit orbit-three" />
        <div className="art-center">
          <span className="brand-mark">
            <i />
            <i />
            <i />
            <i />
          </span>
        </div>
        <div className="floating-skill float-react">
          <Code2 size={23} />
          <span>Development</span>
          <i />
        </div>
        <div className="floating-skill float-design">
          <Layers3 size={20} />
          <span>Design</span>
          <i />
        </div>
        <div className="floating-skill float-match">
          <span className="match-check">
            <Check size={17} />
          </span>
          <div>
            Perfect match<span>Potential, connected.</span>
          </div>
          <Sparkles size={17} />
        </div>
        <span className="art-dot dot-one" />
        <span className="art-dot dot-two" />
        <span className="art-star">✳</span>
      </div>
    </section>
  );
}
