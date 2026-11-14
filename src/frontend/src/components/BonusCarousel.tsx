import { ChevronRight } from "lucide-react";
import { useRef, useState } from "react";
import type { HomeData } from "../data/mock";
import { formatAmount, formatEur, formatEurWhole, formatPercent } from "../format";

type Bonus = HomeData["bonus"];

function BonusLadder({ bonus }: { bonus: Bonus }) {
  return (
    <div className="ladder">
      <div className="ladder-line ladder-line--next">
        <span>{formatPercent(bonus.nextLevel.percent)}</span>
        <span>{formatEurWhole(bonus.nextLevel.thresholdEur)}</span>
      </div>
      <div className="ladder-line ladder-line--current">
        <span>{formatPercent(bonus.currentLevel.percent)}</span>
        <span>{formatEurWhole(bonus.currentLevel.thresholdEur)}</span>
      </div>
      <div className="bonus-house">
        <svg className="bonus-house__shape" viewBox="0 0 500 275" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 76 L238 3 Q250 -1 262 3 L500 76 L500 261 Q500 275 486 275 L14 275 Q0 275 0 261 Z" />
        </svg>
        <div className="bonus-house__content">
          <div className="bonus-house__label">Bonus now</div>
          <div className="bonus-house__value">
            {formatAmount(bonus.nowEur)}
            <span className="bonus-house__currency">€</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function BonusCarousel({ bonus }: { bonus: Bonus }) {
  const [slide, setSlide] = useState(0);
  const track = useRef<HTMLDivElement>(null);

  const onScroll = () => {
    const el = track.current;
    if (el) setSlide(Math.round(el.scrollLeft / el.clientWidth));
  };
  const goTo = (i: number) => track.current?.scrollTo({ left: i * track.current.clientWidth, behavior: "smooth" });

  return (
    <section className="bonus" aria-label="S-Bonus">
      <div className="carousel" ref={track} onScroll={onScroll}>
        <div className="carousel__slide">
          <h1 className="bonus__title">To the next Bonus level {formatEur(bonus.toNextLevelEur)}</h1>
          <p className="bonus__subtitle">
            You may already be on the next Bonus level
            <button className="info-dot" aria-label="More information">
              i
            </button>
          </p>
          <BonusLadder bonus={bonus} />
          <button className="link-button">
            See your total benefits <ChevronRight size={22} strokeWidth={2.6} />
          </button>
        </div>
        <div className="carousel__slide carousel__slide--center">
          <h1 className="bonus__title">Your benefits this year</h1>
          <p className="bonus__subtitle">Bonus and other S-Etukortti benefits</p>
          <div className="benefit-total">{formatEur(18.4)}</div>
          <button className="link-button">
            See your total benefits <ChevronRight size={22} strokeWidth={2.6} />
          </button>
        </div>
      </div>
      <div className="dots" role="tablist">
        {[0, 1].map((i) => (
          <button
            key={i}
            role="tab"
            aria-selected={slide === i}
            aria-label={`Slide ${i + 1}`}
            className={`dot ${slide === i ? "dot--active" : ""}`}
            onClick={() => goTo(i)}
          />
        ))}
      </div>
    </section>
  );
}
