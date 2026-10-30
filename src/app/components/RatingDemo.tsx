"use client";

import { useId, useState } from "react";

import { getReadingRatingQuestions, READING_RATING_INSTRUCTION, type ReadingPhase } from "@/lib/reading-ratings";

export default function RatingDemo({ phase }: { phase?: ReadingPhase }): React.JSX.Element {
    const id = useId();
    const questions = getReadingRatingQuestions(phase);
    const [values, setValues] = useState([50, 50, 50, 50]);
    return <div className="rounded-xl border-2 border-blue-800 bg-blue-50 p-6 my-6 text-left space-y-8">
        <p className="font-semibold text-blue-950">Try moving the circles below. These practice ratings are not saved.</p>
        <p>{READING_RATING_INSTRUCTION}</p>
        {questions.map((question, index) => <div key={question.id}>
            <label htmlFor={`${id}-${index}`} className="block font-semibold mb-3">{index + 1}. {question.text}</label>
            <input id={`${id}-${index}`} type="range" min={0} max={100} step={1} value={values[index]}
                onChange={event => setValues(previous => previous.map((value, position) => position === index ? Number(event.target.value) : value))}
                className="rating-demo-slider w-full my-5 cursor-pointer focus-ring" aria-valuetext={`${values[index]} out of 100`} />
            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-4">
                <span>0 · {question.lowLabel}</span>
                <output htmlFor={`${id}-${index}`} className="font-bold text-2xl text-center tabular-nums">{values[index]}</output>
                <span className="text-right">100 · {question.highLabel}</span>
            </div>
        </div>)}
        <p>Drag a circle, click the scale, or use the arrow keys while the slider is selected.</p>
    </div>;
}
