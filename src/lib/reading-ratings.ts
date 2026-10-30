export type ReadingPhase = "practice" | "formal";

export const READING_RATING_INSTRUCTION = "Please make a rating from 0 to 100 by moving the circle on the scale.";

// Wording/order from CogSearch's prac_c1–c4 and task_c1–c4 templates.
// Keep this app's existing storage meanings: c1 = new information, c2 = ease.
// Display order is independent of the saved question ID.
export function getReadingRatingQuestions(phase?: ReadingPhase): { id: string; text: string; lowLabel: string; highLabel: string }[] {
    return [
        { id: "c2", text: "How easy was this article to read?", lowLabel: "Very Difficult", highLabel: "Very Easy" },
        { id: "c1", text: "Including the other articles that you have read today, how much new information was in this article?", lowLabel: "No New Information", highLabel: "Completely New Information" },
        { id: "c3", text: "How much did you learn from this particular article?", lowLabel: "Didn’t Learn Anything at All", highLabel: "Learned a Lot" },
        {
            id: "c4",
            text: phase === "practice"
                ? "How much did you learn overall from the practice article?"
                : phase === "formal"
                    ? "How much do you learn about Donation, Medical Transplants, and Cancer?"
                    : "How much did you learn overall from the articles you have read so far today (including this article)?",
            lowLabel: "Didn’t Learn Anything at All",
            highLabel: "Learned a Lot",
        },
    ];
}
