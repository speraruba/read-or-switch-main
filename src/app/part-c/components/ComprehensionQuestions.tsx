"use client";
import { getApiPath } from "@/lib/api";

import { useState, useEffect } from "react";

interface Question {
    id: number;
    question_text: string;
    option_1: string;
    option_2: string;
    option_3: string;
    option_4: string;
    correct_option: number;
}

interface PartCQuestionsProps {
    participantId: string;
    onComplete: () => void;
}

export default function ComprehensionQuestions({ participantId, onComplete }: PartCQuestionsProps) {
    const [questions, setQuestions] = useState<Question[]>([]);
    const [responses, setResponses] = useState<Record<number, number>>({}); // qId -> optionIndex (1-4)
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [startTime, setStartTime] = useState(0);

    useEffect(() => {
        fetch(getApiPath("/api/part-c/questions"))
            .then(res => res.json())
            .then(data => {
                setQuestions(data);
                setStartTime(Date.now());
            })
            .catch(err => console.error(err));
    }, []);

    const handleSelectOption = (questionId: number, optionIndex: number) => {
        setResponses(prev => ({ ...prev, [questionId]: optionIndex }));
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        const now = Date.now();

        // Prepare data
        const responseData = questions.map(q => ({
            questionId: q.id,
            responseOption: responses[q.id] || 0,
            isCorrect: responses[q.id] === q.correct_option,
            reactionTimeMs: now - startTime
        }));

        try {
            const response = await fetch(getApiPath("/api/part-c/submit-questions"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    participantId,
                    responses: responseData
                })
            });
            if (!response.ok) throw new Error("Failed to submit responses");
            onComplete();
        } catch (e) {
            console.error(e);
            alert("Failed to submit responses");
            setIsSubmitting(false);
        }
    };

    const allAnswered = questions.length > 0 && questions.every(q => responses[q.id]);

    if (questions.length === 0) {
        return (
            <div className="max-w-xl mx-auto glass-panel p-8 rounded-xl shadow-sm mt-12 text-center text-[var(--muted)]">
                <p>Loading questions...</p>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto glass-panel p-10 rounded-xl shadow-sm mt-12">
            <h2 className="text-2xl font-semibold mb-6 text-[var(--foreground)]">Comprehension Questions</h2>
            <p className="mb-8 text-[var(--muted)] text-base">Please answer the following questions based on what you read.</p>

            <div className="space-y-6">
                {questions.map((q, idx) => (
                    <div key={q.id} className="border border-[var(--border)] p-6 rounded-lg bg-[var(--surface)] hover:border-[var(--muted)] transition-colors">
                        <div className="flex gap-4 mb-6">
                            <span className="font-mono text-[var(--muted)] text-sm">{idx + 1}.</span>
                            <p className="text-lg font-medium text-[var(--foreground)] leading-relaxed">
                                {q.question_text}
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 ml-8">
                            {[q.option_1, q.option_2, q.option_3, q.option_4].map((opt, optIdx) => {
                                const val = optIdx + 1;
                                return (
                                    <label
                                        key={val}
                                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${responses[q.id] === val
                                            ? "bg-[var(--input-bg)] border-[var(--primary)]/50 ring-1 ring-[var(--primary)]/20 shadow-sm"
                                            : "hover:bg-[var(--input-bg)] border-[var(--border)]"
                                            }`}
                                    >
                                        <input
                                            type="radio"
                                            name={`q-${q.id}`}
                                            checked={responses[q.id] === val}
                                            onChange={() => handleSelectOption(q.id, val)}
                                            className="w-4 h-4 text-[var(--primary)] focus:ring-[var(--primary)]"
                                        />
                                        <span className="text-sm font-medium text-[var(--foreground)]/90">{opt}</span>
                                    </label>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-12 text-center">
                <button
                    onClick={handleSubmit}
                    disabled={isSubmitting || !allAnswered}
                    className={`px-10 py-3 rounded-lg font-medium text-[var(--primary-fg)] transition-all focus-ring shadow-sm ${isSubmitting || !allAnswered
                        ? "bg-[var(--input-bg)] text-[var(--muted)] cursor-not-allowed"
                        : "bg-[var(--primary)] hover:opacity-90"
                        }`}
                >
                    {isSubmitting ? "Submitting..." : "Submit Answers"}
                </button>
            </div>
        </div>
    );
}
