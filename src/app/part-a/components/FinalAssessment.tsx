"use client";
import { getApiPath } from "@/lib/api";

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
interface AssessmentQuestion {
    id: string | number;
    questionID?: string;
    choiceA?: string;
    choiceB?: string;
    choiceC?: string;
    choiceD?: string;
    option_1?: string;
    option_2?: string;
    option_3?: string;
    option_4?: string;
    correctAns?: string;
    correct_option?: number;
    questionText?: string;
    question_text?: string;
    text?: string;
}

interface FinalAssessmentProps {
    participantId: string;
    onComplete: () => void;
}

interface FinalResponseData {
    questionId: string;
    responseIndex: number;
    isCorrect: boolean;
    reactionTimeMs: number;
}

export default function FinalAssessment({ participantId, onComplete }: FinalAssessmentProps) {
    const [questions, setQuestions] = useState<AssessmentQuestion[]>([]);
    const [responses, setResponses] = useState<Record<string, string>>({});
    const [responseData, setResponseData] = useState<FinalResponseData[]>([]);
    const startTimeRef = useRef(0);
    const [isDone, setIsDone] = useState(false);
    const [accuracy, setAccuracy] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        startTimeRef.current = performance.now();

        // Fetch questions for this participant (based on what they read in Formal phase)
        fetch(getApiPath(`/api/part-a/questions?phase=formal&participantId=${participantId}`))
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    setQuestions(data);
                } else {
                    console.error("Failed to load questions", data);
                }
            })
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
    }, [participantId]);

    const handleResponse = (event: ChangeEvent<HTMLInputElement>, id: string | number, val: string) => {
        const questionId = String(id);
        const reactionTime = startTimeRef.current ? event.timeStamp - startTimeRef.current : 0;

        setResponses(prev => ({ ...prev, [questionId]: val }));

        setResponseData(prev => {
            const filtered = prev.filter(p => p.questionId !== questionId);
            // Use questionID if available (from part_a_questions), otherwise fallback to id
            const q = questions.find(qq => String(qq.questionID || qq.id) === questionId);

            // Note: Question interface in part-b/types usually has 'id'. 
            // In DB it is questionID. The query returns columns.
            // If API returns `select *`, it returns `questionID`.
            // Let's assume the API returns objects with `questionID` (or mapped to id if Question type mandates it).
            // However, previous usage in FormalTask implied `Question` type is used.
            // The API response is raw DB rows unless mapped.
            // Raw DB: questionID, choiceA, choiceB...
            // FormalTask uses `option_1`, `option_2`? 
            // Let's check part_a_questions columns again.
            // questionID, choiceA, choiceB, choiceC, choiceD, correctAns.

            // I need to map DB columns to what `FinalAssessment` expects or update `FinalAssessment` to stick to DB columns.

            // The DB columns: choiceA, choiceB...
            // The Question type (if shared) might expect option_1...
            // Let's adapt here.

            let isCorrect = false;
            let index = 0;

            if (q) {
                // Determine index of selected val
                // Options are q.choiceA, q.choiceB ...
                // or q.option_1 if mapped.
                // Let's handle generic property access or map previously.

                // Better: Map data on fetch.

                // But for now inside this function:
                // Assuming q has choiceA...D
                const options = [
                    q.choiceA || q.option_1,
                    q.choiceB || q.option_2,
                    q.choiceC || q.option_3,
                    q.choiceD || q.option_4
                ];

                index = options.indexOf(val) + 1;

                // correctAns in DB is 'A', 'B', 'C', or '1', '2'?
                // Schema says varchar(10).
                // If it's 'A', 'B', etc. we need mapping.

                const correctVal = q.correctAns || q.correct_option;
                if (typeof correctVal === 'number' || (typeof correctVal === 'string' && !isNaN(parseInt(correctVal)))) {
                    isCorrect = index === parseInt(String(correctVal));
                } else {
                    const map: Record<string, number> = { 
                        A: 1, B: 2, C: 3, D: 4,
                        a: 1, b: 2, c: 3, d: 4 
                    };
                    const key = String(correctVal).trim();
                    isCorrect = index === map[key];
                }
            }

            return [...filtered, {
                questionId: questionId,
                responseIndex: index,
                isCorrect: isCorrect,
                reactionTimeMs: reactionTime
            }];
        });
    };

    const handleSubmit = async () => {
        try {
            const response = await fetch(getApiPath("/api/part-a/final"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ participantId, responses: responseData })
            });
            if (!response.ok) throw new Error("Failed to save responses");

            const correctCount = responseData.filter(r => r.isCorrect).length;
            const total = questions.length;
            setAccuracy(total > 0 ? Math.round((correctCount / total) * 100) : 0);

            setIsDone(true);
        } catch (e) {
            console.error(e);
            alert("Failed to save responses");
        }
    };

    if (loading) return <div className="p-10 text-center">Loading questions...</div>;

    if (questions.length === 0) {
        return (
            <div className="max-w-xl mx-auto glass-panel p-12 rounded-xl shadow-sm mt-12 text-center">
                <h2 className="text-2xl font-semibold mb-4 text-[var(--foreground)]">No Questions Found</h2>
                <p className="text-[var(--muted)] mb-8">It seems you haven&apos;t read any articles that have associated comprehension questions.</p>
                <button type="button" onClick={onComplete} className="bg-[var(--primary)] text-[var(--primary-fg)] px-6 py-3 rounded-lg">Continue</button>
            </div>
        );
    }

    if (isDone) {
        return (
            <div className="max-w-xl mx-auto glass-panel p-12 rounded-xl shadow-sm mt-12 text-center">
                <h2 className="text-3xl font-semibold mb-6 text-[var(--foreground)]">Assessment Complete</h2>
                <div className="text-xl mb-8 flex flex-col items-center gap-2">
                    <span className="text-[var(--muted)] text-base">Your Accuracy</span>
                    <span className="text-4xl font-bold text-[var(--primary)]">{accuracy}%</span>
                </div>
                <p className="text-[var(--muted)] mb-8">You have completed all study tasks.</p>
                <button type="button" onClick={onComplete} className="bg-[var(--primary)] text-[var(--primary-fg)] px-6 py-3 rounded-lg focus-ring">Finish Study</button>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto glass-panel p-10 rounded-xl shadow-sm mt-12">
            <h2 className="text-3xl font-semibold mb-4 text-[var(--foreground)]">Comprehension Questions</h2>
            <p className="mb-8 text-[var(--muted)] text-lg">
                These questions complete Part A. The multiple-choice questions here are based on the passages you read in the formal task. Please do your best to answer each question carefully. If you are not sure, please select &ldquo;I don&apos;t know the answer&rdquo;.
            </p>

            <div className="grid grid-cols-1 gap-8">
                {questions.map((q, idx) => {
                    const qId = q.questionID || q.id;
                    const options = [
                        q.choiceA || q.option_1,
                        q.choiceB || q.option_2,
                        q.choiceC || q.option_3,
                        q.choiceD || q.option_4
                    ].filter((option): option is string => typeof option === "string" && option.length > 0); // Filter out undefined if schema varies

                    return (
                        <div key={qId} className="border border-[var(--border)] p-6 rounded-lg bg-[var(--surface)] hover:border-[var(--muted)] transition-colors">
                            <div className="border-l-4 border-[var(--foreground)] pl-3 mb-4">
                                <h3 className="font-semibold text-[var(--foreground)]">Question {idx + 1}</h3>
                            </div>
                            <p className="mb-6 text-[var(--foreground)] font-medium leading-relaxed min-h-[60px]">{q.questionText || q.question_text || q.text}</p>

                            <div className="space-y-3">
                                {options.map((opt) => (
                                    <label key={opt} className={`block border p-3 rounded-lg cursor-pointer transition-colors ${responses[qId] === opt ? "bg-[var(--input-bg)] border-[var(--primary)]/50 ring-1 ring-[var(--primary)]/20" : "hover:bg-[var(--input-bg)] border-[var(--border)]"}`}>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="radio"
                                                name={`q-${qId}`}
                                                value={opt}
                                                checked={responses[qId] === opt}
                                                onChange={(event) => handleResponse(event, qId, opt)}
                                                className="w-4 h-4 text-[var(--primary)] focus:ring-[var(--primary)]"
                                            />
                                            <span className="text-sm font-medium text-[var(--foreground)]/90">{opt}</span>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="text-center mt-12 mb-8">
                <button
                    type="button"
                    onClick={handleSubmit}
                    className="bg-[var(--primary)] text-[var(--primary-fg)] px-10 py-3 rounded-lg text-lg font-medium hover:opacity-90 transition-all shadow-sm focus-ring"
                >
                    Submit Answers
                </button>
            </div>
        </div>
    );
}
