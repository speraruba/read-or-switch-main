"use client";

import TestSkip from "@/app/components/TestSkip";
import { useRef, useState, type FormEvent } from "react";

import { getApiPath } from "@/lib/api";
import type { Story } from "../types";

interface StorySurveyProps {
    participantId: string;
    phase: "practice" | "formal";
    story: Story;
    onComplete: () => void;
}

export default function StorySurvey({ participantId, phase, story, onComplete }: StorySurveyProps): React.JSX.Element {
    const [ratings, setRatings] = useState<Record<number, number>>({});
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(false);
    const submitting = useRef(false);
    const questions = [
        `The story ${story.title} is interesting and engaging to read.`,
        `The story ${story.title} is easy to read.`,
        `The story ${story.title} is informative to read.`,
        `I learned a lot from the story ${story.title}.`,
        `I would like to continue reading the story ${story.title}.`,
    ];

    const complete = questions.every((_, i) => ratings[i] !== undefined);

    function selectRating(item: number, value: number): void {
        setRatings(previous => ({ ...previous, [item]: value }));
    }

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (submitting.current || !complete) return;
        submitting.current = true;
        setSaving(true);
        setError(false);
        try {
            const response = await fetch(getApiPath("/api/part-b/story-ratings"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ participantId, phase, storyId: story.id, ratings: questions.map((_, i) => ratings[i]) }),
            });
            if (!response.ok) throw new Error("Story ratings could not be saved");
            onComplete();
        } catch {
            setError(true);
        } finally {
            submitting.current = false;
            setSaving(false);
        }
    }

    return <section className="max-w-3xl mx-auto glass-panel p-6 sm:p-10 rounded-xl">
        <TestSkip participantId={participantId} onSkip={onComplete} disabled={saving} />
        <h2 className="text-3xl font-semibold mb-4">{story.title}</h2>
        <p className="mb-8">Please choose the answer that best describes your thoughts about the story (1=Totally Disagree, 7= Totally Agree)</p>
        <form onSubmit={submit} className="space-y-8">
            {questions.map((question, i) => <div key={question}>
                <label htmlFor={`story-rating-${i}`} className="block mb-3 font-medium">{question}</label>
                <input id={`story-rating-${i}`} type="range" min={1} max={7} step={1}
                    value={ratings[i] ?? 4} disabled={saving}
                    aria-describedby={`story-scale-${i}`}
                    aria-valuetext={ratings[i] === undefined ? "Unanswered" : `${ratings[i]} out of 7`}
                    className="rating-demo-slider w-full my-4 cursor-pointer focus-ring"
                    onChange={event => selectRating(i, event.currentTarget.valueAsNumber)}
                    onClick={event => selectRating(i, event.currentTarget.valueAsNumber)}
                    onKeyDown={event => {
                        if (event.key === " " || event.key === "Enter") {
                            event.preventDefault();
                            selectRating(i, event.currentTarget.valueAsNumber);
                        }
                    }} />
                <div aria-hidden="true" className="mx-[0.9rem] flex justify-between tabular-nums">
                    {[1, 2, 3, 4, 5, 6, 7].map(value => <span key={value} className="flex w-0 justify-center">
                        <span className={ratings[i] === value ? "rounded bg-blue-800 px-2 font-bold text-white" : ""}>{value}</span>
                    </span>)}
                </div>
                <div id={`story-scale-${i}`} className="mt-2 flex justify-between gap-3 text-sm font-medium">
                    <span>1 · Totally Disagree</span><span className="text-right">7 · Totally Agree</span>
                </div>
            </div>)}
            {error && <p role="alert">Your ratings could not be saved. Please try again.</p>}
            <button disabled={saving || !complete} className="rounded-lg bg-[var(--primary)] text-white px-6 py-3 focus-ring disabled:opacity-50">
                {saving ? "Saving…" : "Next"}
            </button>
        </form>
    </section>;
}
