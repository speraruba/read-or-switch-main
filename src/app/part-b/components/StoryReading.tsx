"use client";
import CountdownTimer from "@/app/components/CountdownTimer";
import { getApiPath } from "@/lib/api";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createActiveReadingTimer } from "@/lib/active-reading-timer";
import type { Segment, Story } from "../types";

interface StoryReadingProps {
  participantId: string;
  phase: "practice" | "formal";
  durationSeconds: number;
  onComplete: () => void;
}

export default function StoryReading({ participantId, phase, durationSeconds, onComplete }: StoryReadingProps) {
  const [stories, setStories] = useState<Story[]>([]);
  const [visitedStoryIds, setVisitedStoryIds] = useState<Set<number>>(new Set());

  const [view, setView] = useState<"selection" | "reading">("selection");
  const [currentStory, setCurrentStory] = useState<Story | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);

  const [timeLeft, setTimeLeft] = useState(durationSeconds);
  const [readingTimer] = useState(() => createActiveReadingTimer(durationSeconds * 1000));
  const loadingRef = useRef(false);
  const [isLoading, setIsLoading] = useState(false);
  const currentSegment = segments[currentSegmentIndex];
  const articleKey = currentStory && currentSegment ? `${currentStory.id}:${currentSegment.id}` : null;
  const completedRef = useRef(false);

  useEffect(() => {
    fetch(getApiPath(`/api/part-b/stories?phase=${phase}&participantId=${participantId}`))
      .then(res => res.json())
      .then(data => setStories(data))
      .catch(err => console.error(err));
  }, [phase, participantId]);

  useLayoutEffect(() => {
    if (view !== "reading" || articleKey === null) return;
    readingTimer.startArticle(articleKey, performance.now());
    const update = () => {
      const { remainingMs } = readingTimer.snapshot(performance.now());
      setTimeLeft(Math.ceil(remainingMs / 1000));
      if (remainingMs === 0 && !completedRef.current) {
        readingTimer.pause(performance.now());
        completedRef.current = true;
        onComplete();
      }
    };
    const visibilityChanged = () => {
      if (document.hidden) readingTimer.pause(performance.now());
      else readingTimer.resume(performance.now());
      update();
    };
    visibilityChanged();
    const timer = window.setInterval(update, 100);
    document.addEventListener("visibilitychange", visibilityChanged);
    return () => {
      readingTimer.pause(performance.now());
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", visibilityChanged);
    };
  }, [view, articleKey, readingTimer, onComplete]);

  const logAction = async (storyId: number, segmentId: number, type: "continue" | "switch" | "start_story") => {
    try {
      console.log(`Action: ${type}, Story: ${storyId}, Segment: ${segmentId}`);
    } catch (e) {
      console.error("Failed to log action", e);
    }
  };

  const handleSelectStory = async (story: Story) => {
    if (loadingRef.current || completedRef.current) return;
    loadingRef.current = true;
    setIsLoading(true);
    setCurrentStory(story);
    setSegments([]);
    setCurrentSegmentIndex(0);

    try {
      const res = await fetch(getApiPath(`/api/part-b/segments?storyId=${story.id}&phase=${phase}&participantId=${participantId}`));
      if (!res.ok) throw new Error("Failed to fetch segments");
      const data = await res.json();

      if (Array.isArray(data) && data.length > 0) {
        setSegments(data);
        setView("reading");
        logAction(story.id, data[0]?.id, "start_story");
      } else {
        throw new Error("No story segments available");
      }
    } catch (error) {
      console.error(error);
      alert("Failed to load story. Please try again.");
    } finally {
      loadingRef.current = false;
      setIsLoading(false);
    }
  };

  const handleContinue = () => {
    if (!currentStory) return;
    if (currentSegmentIndex < segments.length - 1) {
      const nextIndex = currentSegmentIndex + 1;
      setCurrentSegmentIndex(nextIndex);
      logAction(currentStory.id, segments[nextIndex].id, "continue");

      const scrollContainer = document.getElementById("story-scroll-container");
      if (scrollContainer) scrollContainer.scrollTop = 0;
    } else {
      finishStory();
    }
  };

  const handleSwitch = () => {
    if (!currentStory) return;
    logAction(currentStory.id, segments[currentSegmentIndex]?.id, "switch");
    finishStory();
  };

  const finishStory = () => {
    const { remainingMs } = readingTimer.pause(performance.now());
    setTimeLeft(Math.ceil(remainingMs / 1000));
    if (remainingMs === 0) {
      if (!completedRef.current) {
        completedRef.current = true;
        onComplete();
      }
      return;
    }
    if (currentStory) {
      setVisitedStoryIds(prev => new Set(prev).add(currentStory.id));
    }
    setView("selection");
    setCurrentStory(null);
    setSegments([]);
  };

  if (view === "selection") {
    const allVisited = stories.length > 0 && stories.every(s => visitedStoryIds.has(s.id));
    return (
      <div className="w-full h-full flex flex-col p-6">
        <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col">
          <div className="flex justify-between items-end mb-12 border-b border-[var(--border)] pb-6">
            <div>
              <h2 className="text-3xl font-serif font-medium text-[var(--foreground)] mb-2">Library</h2>
              <p className="text-[var(--muted)]">Choose a story to begin reading.</p>
            </div>
            <CountdownTimer seconds={timeLeft} label="Story reading time remaining" paused />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-4">
            {stories.map(story => {
              const isRead = visitedStoryIds.has(story.id);
              return (
                <button
                  type="button"
                  key={story.id}
                  onClick={() => handleSelectStory(story)}
                  disabled={isLoading}
                  className={`relative p-8 rounded-xl border text-left transition-all duration-300 flex flex-col justify-between h-48 group overflow-hidden ${
                    isRead
                      ? "bg-[var(--input-bg)] border-transparent text-[var(--muted)]"
                      : "bg-[var(--surface)] border-[var(--border)] hover:border-[var(--primary)] hover:shadow-lg hover:-translate-y-1"
                  }`}
                >
                  <div className="relative z-10">
                    <h3 className={`text-xl font-serif font-medium mb-2 ${!isRead && "group-hover:text-[var(--primary)]"} transition-colors`}>
                      {story.title}
                    </h3>
                    <div className="w-8 h-1 bg-[var(--border)] group-hover:bg-[var(--primary)] transition-colors rounded-full" />
                  </div>

                  {isRead && (
                    <span className="absolute bottom-6 right-6 text-xs font-bold uppercase tracking-widest text-[var(--muted)] border border-[var(--border)] px-3 py-1 rounded-full">
                      Completed
                    </span>
                  )}

                  {!isRead && (
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
                Complete Phase
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const progress = segments.length > 0 ? ((currentSegmentIndex + 1) / segments.length) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 bg-[var(--surface)] flex flex-col h-screen w-screen">
      <div className="shrink-0 h-16 flex items-center justify-between px-6 border-b border-[var(--border)] bg-[var(--surface)]/80 backdrop-blur-md z-20">
        <div className="flex items-center gap-4">
          <span className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] border border-[var(--border)] px-2 py-0.5 rounded">
            Reading
          </span>
          <h1 className="text-sm font-semibold text-[var(--foreground)] truncate max-w-md">
            {currentStory?.title}
          </h1>
        </div>
        <CountdownTimer seconds={timeLeft} label="Story reading time remaining" />
      </div>

      <div className="h-1 w-full bg-[var(--input-bg)] shrink-0">
        <div
          className="h-full bg-[var(--primary)] transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div
        id="story-scroll-container"
        className="flex-1 overflow-y-auto relative bg-[var(--background)] scroll-smooth"
      >
        <div className="min-h-full w-full max-w-7xl mx-auto px-4 md:px-6 py-8 md:py-12 flex flex-col items-center">

          {!currentSegment ? (
            <div className="flex flex-col items-center justify-center h-64 text-[var(--muted)] animate-pulse">
              <p>Loading story segment...</p>
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
            onClick={handleSwitch}
            className="border-2 border-[var(--primary)] text-[var(--primary)] px-8 py-3 rounded-lg hover:bg-[var(--primary)] hover:text-[var(--primary-fg)] active:scale-[0.98] transition-all font-semibold text-sm shadow-sm hover:shadow-md focus-ring uppercase tracking-widest"
          >
            Go to Other Stories
          </button>

          <div className="text-[10px] text-[var(--muted)] uppercase tracking-widest hidden md:block">
             {currentSegmentIndex + 1} <span className="mx-1 opacity-30">/</span> {segments.length}
          </div>

          <button
            type="button"
            onClick={handleContinue}
            disabled={!currentSegment}
            className="bg-[var(--primary)] text-[var(--primary-fg)] px-8 py-3 rounded-lg hover:opacity-90 active:scale-[0.98] transition-all font-semibold text-sm shadow-md hover:shadow-lg focus-ring uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue Reading this Story
          </button>
        </div>
      </div>
    </div>
  );
}
