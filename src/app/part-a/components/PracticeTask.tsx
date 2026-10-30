"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import RatingDemo from "@/app/components/RatingDemo";
import CountdownTimer from "@/app/components/CountdownTimer";
import { isStudyVisible } from "@/lib/study-display";
import { getApiPath } from "@/lib/api";
import SegmentFeedback from "./SegmentFeedback";
import { createActiveReadingTimer, PRACTICE_READING_DURATION_MS } from "@/lib/active-reading-timer";

interface Segment {
    id: string;
    story_id: string;
    content: string;
    segment_order: number;
    pass_id?: string;
    con_id?: string;
}

interface PracticeTaskProps {
    participantId: string;
    onComplete: () => void;
}

interface Subtopic {
    id: string;
    title: string;
    topic_id: string;
}

type ViewState = "instructions" | "subtopic-selection" | "reading" | "question";

export default function PracticeTask({ participantId, onComplete }: PracticeTaskProps) {
    const [view, setView] = useState<ViewState>("instructions");
    const [visitedStoryIds, setVisitedStoryIds] = useState<Set<string>>(new Set());

    const [subtopics, setSubtopics] = useState<Subtopic[]>([]);
    const [currentSubtopic, setCurrentSubtopic] = useState<Subtopic | null>(null);
    const [readingTimer] = useState(() => createActiveReadingTimer(PRACTICE_READING_DURATION_MS));
    const [secondsLeft, setSecondsLeft] = useState(PRACTICE_READING_DURATION_MS / 1000);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const savingRef = useRef(false);
    const [isLoadingArticle, setIsLoadingArticle] = useState(false);
    const loadingArticleRef = useRef(false);
    const [segments, setSegments] = useState<Segment[]>([]);
    const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);

    const [pendingAction, setPendingAction] = useState<"continue" | "switch" | "finish" | null>(null);

    useEffect(() => {
        // Fetch all subtopics directly
        fetch(getApiPath("/api/part-a/subtopics?phase=practice"))
            .then(res => res.json())
            .then(data => setSubtopics(data))
            .catch(err => console.error(err));
    }, []);

    const currentSegment = segments[currentSegmentIndex];
    const articleKey = currentSubtopic && currentSegment ? `${currentSubtopic.id}:${currentSegment.id}` : null;

    useLayoutEffect(() => {
        if (view !== "reading" || articleKey === null) return;
        readingTimer.startArticle(articleKey, Date.now());
        const update = () => {
            const snapshot = readingTimer.snapshot(Date.now());
            setSecondsLeft(Math.ceil(snapshot.remainingMs / 1000));
            if (snapshot.remainingMs === 0) {
                readingTimer.pause(Date.now());
                setPendingAction("finish");
                setView("question");
            }
        };
        const visibilityChanged = () => {
            if (!isStudyVisible()) readingTimer.pause(Date.now());
            else readingTimer.resume(Date.now());
            update();
        };
        visibilityChanged();
        const interval = window.setInterval(update, 100);
        document.addEventListener("visibilitychange", visibilityChanged);
        document.addEventListener("fullscreenchange", visibilityChanged);
        return () => {
            readingTimer.pause(Date.now());
            window.clearInterval(interval);
            document.removeEventListener("visibilitychange", visibilityChanged);
            document.removeEventListener("fullscreenchange", visibilityChanged);
        };
    }, [view, articleKey, readingTimer]);

    const handleStart = () => {
        setView("subtopic-selection");
    };

    const handleSelectSubtopic = async (subtopic: Subtopic) => {
        if (loadingArticleRef.current) return;
        loadingArticleRef.current = true;
        setIsLoadingArticle(true);
        setCurrentSubtopic(subtopic);

        try {
            const res = await fetch(getApiPath(`/api/part-a/segments?storyId=${subtopic.topic_id}&subtopicId=${subtopic.id}&phase=practice&participantId=${participantId}`));
            if (!res.ok) throw new Error("Failed to load article");
            const data: Segment[] = await res.json();
            if (!Array.isArray(data) || !data.length) throw new Error("No articles available");
            setSegments(data);

            setCurrentSegmentIndex(0);
            setView("reading");
            setVisitedStoryIds(prev => new Set(prev).add(subtopic.id));
        } catch (error) {
            console.error("Failed to load practice article:", error);
            alert("Failed to load article. Please try again.");
        } finally {
            loadingArticleRef.current = false;
            setIsLoadingArticle(false);
        }
    };

    const triggerQuestion = (action: "continue" | "switch") => {
        if (!currentSegment) return;
        const snapshot = readingTimer.pause(Date.now());
        setSecondsLeft(Math.ceil(snapshot.remainingMs / 1000));
        setPendingAction(snapshot.remainingMs === 0 ? "finish" : action);
        setView("question");
    };

    const handleFeedbackSubmit = async (unusedSummary: string, ratings: { questionId: string, value: number, reactionTimeMs: number }[]) => {
        if (!currentSegment || savingRef.current) return;
        savingRef.current = true;
        setIsSubmitting(true);
        const passRT = readingTimer.snapshot(Date.now()).articleTimeMs;

        try {
            const response = await fetch(getApiPath("/api/part-a/submit"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    participantId,
                    phase: "practice",
                    storyId: currentSubtopic?.topic_id,
                    subtopicId: currentSubtopic?.id,
                    conId: currentSegment.con_id,
                    passId: currentSegment.pass_id,
                    segmentOrder: currentSegment.segment_order,
                    passRT,
                    responses: ratings
                })
            });
            if (!response.ok) throw new Error("Failed to save practice ratings");
        } catch (e) {
            console.error("Failed to submit response", e);
            alert("Failed to save your answers. Please try again.");
            return;
        } finally {
            savingRef.current = false;
            setIsSubmitting(false);
        }

        if (pendingAction === "finish") {
            onComplete();
            return;
        }
        if (pendingAction === "switch") {
            if (currentSubtopic) {
                setVisitedStoryIds(prev => new Set(prev).add(currentSubtopic.id));
            }
            setView("subtopic-selection");
        } else if (pendingAction === "continue") {
            if (currentSegmentIndex < segments.length - 1) {
                setCurrentSegmentIndex(prev => prev + 1);
                setView("reading");
            } else {
                if (currentSubtopic) {
                    setVisitedStoryIds(prev => new Set(prev).add(currentSubtopic.id));
                }
                setView("subtopic-selection");
            }
        }
        setPendingAction(null);
    };

    if (view === "instructions") {
        return (
            <div className="max-w-4xl mx-auto glass-panel p-10 rounded-xl shadow-sm mt-12">
                <h2 className="text-3xl font-semibold mb-6 tracking-tight text-[var(--foreground)] text-center">Instructions</h2>
                
                <div className="text-[var(--muted)] text-lg space-y-6 leading-relaxed text-left">
                    <p>
                        In this practice round, your task is to learn about animals. There are three main topics, and your goal is to learn as much as you can about them. You will have 4 minutes of reading time to learn about animals before I ask you to recall aloud what you have learned. <strong>It is very important for you to pay attention to the articles and do your best to learn about the topics.</strong>
                    </p>
                    <p>
                        During the learning phase, you will select one topic at a time and read a collection of articles about it. You can read each article at your own pace. After you read each article, you have a choice. You can either continue reading about this topic by pressing the “Read the Next Article” button OR you can switch to a new topic by pressing “Go to Other Topics.” You only have 4 minutes of reading time to learn about animals, so do your best to <strong>concentrate and stay with a topic only as long as you feel you are still learning something</strong>. If the articles in the topic are <strong>either too hard or not helping you to learn anything new, you might want to decide to switch to a new topic</strong>. This is your choice. The timer runs only while you are viewing an article; choosing a topic and completing the ratings do not count toward the reading time.
                    </p>
                    <p>
                        Note that there are more articles than you can completely read within 4 minutes so you should make your decisions about <strong>whether to continue or stop reading carefully</strong> so that you can learn as much information as possible about animals.
                    </p>
                    <p>
                        After reading each article within a topic, you will be asked to rate how easy the text was, how much new information you thought was in the article, how much you learned from this article, AND how much you learned overall from the articles you have read so far today. You will be asked to make these ratings on a scale from 0 to 100 by moving the circle:
                    </p>
                    
                    <RatingDemo phase="practice" />

                    <p>
                        Again, after reading each article, you can decide to keep reading about this topic by moving to the next article, or to go back to the main page to choose another topic. Once you decide to leave a topic, you will not be able to return.
                    </p>
                    <p>
                        The goal is to learn as much about animals as possible instead of memorizing the passages word for word. You will need to do your best to <strong>optimize your learning outcome</strong>.
                    </p>
                    <p>
                        You will be asked to recall aloud what you have learned at the end of the task. Please try your best to learn as much information about animals in 4 minutes.
                    </p>
                    <p>
                        Please learn as many facts about animals as you can.
                    </p>
                </div>

                <div className="mt-10 text-center">
                    <button
                        type="button"
                        onClick={handleStart}
                        className="bg-[var(--primary)] text-[var(--primary-fg)] px-10 py-4 rounded-lg text-lg font-medium hover:opacity-90 transition-all focus-ring shadow-md"
                    >
                        Start
                    </button>
                </div>
            </div>
        );
    }

    if (view === "subtopic-selection") {
        const allVisited = subtopics.length > 0 && subtopics.every(sub => visitedStoryIds.has(sub.id));

        return (
            <div className="w-full h-full overflow-y-auto flex flex-col p-6 bg-blue-50">
                <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col mt-8">
                    <div className="flex justify-between items-end mb-12 border-b border-[var(--border)] pb-6">
                        <div>
                            <h2 className="text-3xl font-serif font-medium text-[var(--foreground)] mb-2">Practice Subtopics</h2>
                            <p className="text-[var(--muted)]">Choose a blue topic to begin reading. Green topics have already been visited.</p>
                        </div>
                        <CountdownTimer seconds={secondsLeft} label="Practice reading time remaining" paused />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-4">
                        {subtopics.map(sub => {
                            const isVisited = visitedStoryIds.has(sub.id);
                            return (
                                <button
                                    type="button"
                                    key={sub.id}
                                    onClick={() => !isVisited && handleSelectSubtopic(sub)}
                                    disabled={isVisited || isLoadingArticle}
                                    className={`relative p-8 rounded-xl border text-left transition-all duration-300 flex flex-col justify-between min-h-48 group ${isVisited
                                        ? "bg-emerald-100 border-emerald-800 text-emerald-950"
                                        : "bg-blue-100 border-blue-800 text-blue-950 hover:bg-blue-200 hover:shadow-lg"
                                        }`}
                                >
                                    <div className="relative z-10">
                                        <h3 className={`text-xl font-serif font-medium mb-2 ${!isVisited && "group-hover:text-[var(--primary)]"} transition-colors`}>
                                            {sub.title}
                                        </h3>
                                        <div className="w-8 h-1 bg-[var(--border)] group-hover:bg-[var(--primary)] transition-colors rounded-full" />
                                    </div>

                                    {isVisited && (
                                        <span className="absolute bottom-6 right-6 text-xs font-bold uppercase tracking-widest text-[var(--muted)] border border-[var(--border)] px-3 py-1 rounded-full">
                                            Visited
                                        </span>
                                    )}

                                    {!isVisited && (
                                        <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-[var(--primary)]/5 rounded-full group-hover:scale-150 transition-transform duration-500" />
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {allVisited && (
                        <div className="mt-auto pt-8 text-center">
                            <button
                                type="button"
                                onClick={onComplete}
                                className="bg-[var(--primary)] text-[var(--primary-fg)] px-10 py-4 rounded-full font-medium hover:opacity-90 transition-all shadow-lg hover:shadow-xl active:scale-[0.98] text-sm uppercase tracking-widest"
                            >
                                Continue to Recall
                            </button>
                        </div>
                    )}


                </div>
            </div>
        );
    }

    if (view === "reading" && currentSubtopic) {
        const currentSegment = segments[currentSegmentIndex];
        const progress = segments.length > 0 ? ((currentSegmentIndex + 1) / segments.length) * 100 : 0;

        return (
            <div className="fixed inset-0 z-50 bg-[var(--surface)] flex flex-col h-screen w-screen">
                <div className="shrink-0 h-16 flex items-center justify-between px-6 border-b border-[var(--border)] bg-[var(--surface)]/80 backdrop-blur-md z-20">
                    <div className="flex items-center gap-4">
                        <span className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] border border-[var(--border)] px-2 py-0.5 rounded">
                            Practice
                        </span>
                        <h1 className="text-sm font-semibold text-[var(--foreground)] truncate max-w-md">
                            {currentSubtopic.title}
                        </h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="hidden sm:inline text-xs font-medium text-[var(--muted)] uppercase tracking-wide">Segment {currentSegmentIndex + 1}/{segments.length}</span>
                        <CountdownTimer seconds={secondsLeft} label="Practice reading time remaining" />
                    </div>
                </div>

                <div className="h-1 w-full bg-[var(--input-bg)] shrink-0">
                    <div 
                        className="h-full bg-[var(--primary)] transition-all duration-500 ease-out"
                        style={{ width: `${progress}%` }}
                    />
                </div>

                <div className="flex-1 overflow-y-auto relative bg-[var(--background)] scroll-smooth">
                    <div className="min-h-full w-full max-w-7xl mx-auto px-4 md:px-6 py-8 md:py-12 flex flex-col items-center">
                        {!currentSegment ? (
                            <div className="flex flex-col items-center justify-center h-64 text-[var(--muted)] animate-pulse">
                                <p>Loading segment...</p>
                            </div>
                        ) : (
                            <div className="w-full">
                                <p className="text-xl md:text-2xl leading-loose font-serif text-[var(--foreground)] antialiased text-left border-l-4 border-[var(--border)] pl-6 py-2">
                                    {currentSegment.content}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="shrink-0 p-6 bg-[var(--surface)] border-t border-[var(--border)] z-20 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
                    <div className="max-w-7xl mx-auto flex items-center justify-between gap-6">
                        <button
                            type="button"
                            onClick={() => triggerQuestion("switch")}
                            disabled={!currentSegment}
                            className="border-2 border-[var(--primary)] text-[var(--primary)] px-8 py-3 rounded-lg hover:bg-[var(--primary)] hover:text-[var(--primary-fg)] active:scale-[0.98] transition-all font-semibold text-sm shadow-sm hover:shadow-md focus-ring uppercase tracking-widest"
                        >
                            Go to Other Topics
                        </button>
                        <button
                            type="button"
                            onClick={() => triggerQuestion("continue")}
                            disabled={!currentSegment}
                            className="bg-[var(--primary)] text-[var(--primary-fg)] px-8 py-3 rounded-lg hover:opacity-90 active:scale-[0.98] transition-all font-semibold text-sm shadow-md hover:shadow-lg focus-ring uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Read the Next Article
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (view === "question") {
        return (
            <div>
                <div className="flex justify-end"><CountdownTimer seconds={secondsLeft} label="Practice reading time remaining" paused /></div>
                {pendingAction === "finish" && <p role="status" className="mt-3 text-center">Reading time is up. Rate this article to finish practice.</p>}
                <fieldset disabled={isSubmitting} aria-busy={isSubmitting}>
                    <SegmentFeedback phase="practice" onSubmit={handleFeedbackSubmit} />
                </fieldset>
                {isSubmitting && <p role="status" className="text-center">Saving your answers…</p>}
            </div>
        );
    }

    return <div className="p-12 text-center">Loading...</div>;
}
