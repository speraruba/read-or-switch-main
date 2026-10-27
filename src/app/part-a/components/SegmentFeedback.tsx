"use client";

import { type ChangeEvent, type KeyboardEvent, useEffect, useRef, useState } from "react";

interface SegmentFeedbackProps {
  onSubmit: (
    summary: string,
    responses: Array<{ questionId: string; value: number; reactionTimeMs: number }>
  ) => void;
}

const GENERIC_RATING_QUESTIONS = [
  {
    id: "c1",
    text: "Compared to the other articles that you have read today, how much new information was in this article?",
  },
  {
    id: "c2",
    text: "How easy was this article to read?",
  },
  {
    id: "c3",
    text: "How much did you learn from this article?",
  },
  {
    id: "c4",
    text: "How much did you learn overall from the articles you have read so far today (including this article)?",
  },
];

export default function SegmentFeedback({ onSubmit }: SegmentFeedbackProps) {
  const [step, setStep] = useState(0);
  const [responses, setResponses] = useState<Record<string, number>>({});
  const [currentValue, setCurrentValue] = useState<number>(50);
  const [hasInteracted, setHasInteracted] = useState(false);
  const sliderRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void step;
    setCurrentValue(50);
    setHasInteracted(false);
    
    const timer = setTimeout(() => {
      sliderRef.current?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, [step]);

  const handleNext = () => {
    if (!hasInteracted) return;

    const currentQuestion = GENERIC_RATING_QUESTIONS[step];
    const newResponses = {
      ...responses,
      [currentQuestion.id]: currentValue,
    };
    setResponses(newResponses);

    if (step < GENERIC_RATING_QUESTIONS.length - 1) {
      setStep((prev) => prev + 1);
    } else {
      onSubmit(
        "",
        Object.entries(newResponses).map(([qid, val]) => ({
          questionId: qid,
          value: val,
          reactionTimeMs: 0,
        }))
      );
    }
  };

  const markInteracted = () => {
    if (!hasInteracted) setHasInteracted(true);
  };

  const handleSliderChange = (e: ChangeEvent<HTMLInputElement>) => {
    setCurrentValue(parseInt(e.target.value, 10));
    markInteracted();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const interactionKeys = [
      "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown",
      "Home", "End", "PageUp", "PageDown"
    ];
    if (interactionKeys.includes(e.key)) {
      markInteracted();
    }
    if (e.key === "Enter" && hasInteracted) {
      handleNext();
    }
  };

  const currentQuestion = GENERIC_RATING_QUESTIONS[step];
  const progress = ((step + 1) / GENERIC_RATING_QUESTIONS.length) * 100;
  const isLastStep = step === GENERIC_RATING_QUESTIONS.length - 1;

  const getValueLabel = (val: number) => {
    if (val === 50) return "Neutral";
    if (val < 25) return "Low";
    if (val < 50) return "Below Average";
    if (val < 75) return "Above Average";
    return "High";
  };

  return (
    <div className="max-w-2xl mx-auto my-12 p-8 glass-panel rounded-2xl shadow-sm transition-all duration-500 ease-out border border-border/50">
      <div className="flex flex-col gap-6 mb-12">
        <div className="flex justify-between items-end">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted/80">
            Assessment
          </h2>
          <span className="text-xs font-medium text-muted tabular-nums">
            Step {step + 1} of {GENERIC_RATING_QUESTIONS.length}
          </span>
        </div>
        <div className="h-1 w-full bg-input rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="mb-16 min-h-[4rem]">
        <h3 className="text-2xl font-medium leading-snug text-foreground animate-in fade-in slide-in-from-bottom-2 duration-500">
          {currentQuestion.text}
        </h3>
      </div>

      <div className="relative px-2 mb-12">
        <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-muted/60 mb-10 select-none">
          <span>Not at all</span>
          <span>Very much</span>
        </div>

        <div className="relative flex items-center group py-6">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-px h-6 bg-border z-0" />

          <input
            ref={sliderRef}
            type="range"
            min="0"
            max="100"
            value={currentValue}
            onChange={handleSliderChange}
            onPointerDown={markInteracted}
            onKeyDown={handleKeyDown}
            className={`
              relative w-full h-3 bg-input rounded-full appearance-none cursor-pointer z-10
              focus:outline-none focus-ring
              transition-opacity duration-300
              ${hasInteracted ? "opacity-100" : "opacity-90 hover:opacity-100"}
              
              [&::-webkit-slider-thumb]:appearance-none
              [&::-webkit-slider-thumb]:w-7 [&::-webkit-slider-thumb]:h-7
              [&::-webkit-slider-thumb]:rounded-full
              [&::-webkit-slider-thumb]:bg-surface
              [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-primary
              [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-primary/5
              [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:duration-150
              [&::-webkit-slider-thumb]:hover:scale-110
              [&::-webkit-slider-thumb]:active:scale-95
              
              [&::-moz-range-thumb]:appearance-none
              [&::-moz-range-thumb]:w-7 [&::-moz-range-thumb]:h-7
              [&::-moz-range-thumb]:rounded-full
              [&::-moz-range-thumb]:bg-surface
              [&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-primary
              [&::-moz-range-thumb]:shadow-lg [&::-moz-range-thumb]:shadow-primary/5
              [&::-moz-range-thumb]:transition-transform [&::-moz-range-thumb]:duration-150
              [&::-moz-range-thumb]:hover:scale-110
              [&::-moz-range-thumb]:active:scale-95
            `}
            aria-label={currentQuestion.text}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={currentValue}
            aria-valuetext={getValueLabel(currentValue)}
            aria-description={hasInteracted ? `Current value: ${currentValue}` : "Adjust the slider to provide your answer"}
            aria-orientation="horizontal"
          />
        </div>

        <div className="mt-8 flex flex-col items-center justify-center h-20 space-y-2">
          <div
            className={`
              text-5xl font-bold tracking-tight tabular-nums transition-all duration-500 ease-out
              ${hasInteracted ? "text-foreground scale-100 blur-0" : "text-muted/40 scale-95 blur-[0.5px]"}
            `}
          >
            {currentValue}
          </div>
          
          <div className="h-6 overflow-hidden">
            <span 
              className={`
                text-sm font-medium transition-all duration-300 block
                ${hasInteracted ? "text-muted opacity-100 translate-y-0" : "text-transparent opacity-0 translate-y-2"}
              `}
            >
              {getValueLabel(currentValue)}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-center gap-6 pt-8 border-t border-border/50">
        <div className="h-8 flex items-center min-w-[200px]">
           {!hasInteracted ? (
            <output className="text-xs font-medium text-muted/70 flex items-center gap-2 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-muted/70" />
              Adjust slider to continue
            </output>
          ) : (
            <output className="text-xs font-medium text-primary/80 flex items-center gap-2 animate-in fade-in duration-300">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              Response ready
            </output>
          )}
        </div>
        
        <button
          type="button"
          onClick={handleNext}
          disabled={!hasInteracted}
          aria-disabled={!hasInteracted}
          className={`
            relative px-8 py-3 rounded-xl font-semibold text-sm transition-all duration-300
            focus-ring overflow-hidden flex items-center gap-2
            ${hasInteracted 
              ? "bg-primary text-primary-fg shadow-lg shadow-primary/10 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 cursor-pointer" 
              : "bg-input text-muted cursor-not-allowed opacity-50 grayscale"
            }
          `}
        >
          <span>{isLastStep ? "Complete Assessment" : "Next Question"}</span>
          <svg
            aria-hidden="true"
            className={`w-4 h-4 transition-transform duration-300 ${hasInteracted ? "group-hover:translate-x-1" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </button>
      </div>
    </div>
  );
}
