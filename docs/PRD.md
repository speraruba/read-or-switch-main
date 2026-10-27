# Product Requirement Document (PRD): Narrative Text Foraging Study

## 1. Overview
This project aims to develop a web-based experiment platform to study the effects of surprise (predictability) on the tradeoff between exploitation (continuing to read the current story) and exploration (switching to a new story) in narrative text foraging.

## 2. Research Question
To examine how the predictability of the last sentence in a text segment influences a reader's decision to continue reading the same story or switch to a different one.

## 3. User Flow
The experiment consists of the following stages:
1.  **Informed Consent**: Participant agrees to the study terms.
2.  **Demographic Information**: Collection of basic user data.
3.  **Part A: Multi-text Learning Study**: Practice (4 minutes) → speech-to-text recall → Formal (15 minutes) → speech-to-text recall.
4.  **Part B: Story Reading Study**: Practice (4 minutes, stories with titles) → speech-to-text recall → Formal (15 minutes, stories with titles) → speech-to-text recall.
5.  **Part C: Sentence Reading Study**: Instructions → reading (10 minutes) → speech-to-text recall → comprehension questions.
6.  **Debriefing and Thank You**.

The execution order is A → B → C. The five recalls allow speech-to-text and keyboard editing. Part B comprehension questions and Cognitive/Final assessments are excluded from the current flow; their historical data remains intact.

## 4. Functional Requirements

### 4.1 General
-   **Platform**: Web-based application (accessible via browser).
-   **Timing**: All countdowns accumulate only visible reading time. Topic/story selection, post-sentence decisions, questions, recall, loading and hidden tabs do not count.
-   **Data Logging**: All user interactions (clicks, reading times, text inputs, answers) must be logged.

### 4.2 Part A: Multi-text Learning Study
- **Practice timing**: 4 minutes of cumulative visible article time; pause during topic selection, loading, questions, saving, and when the tab is hidden. At timeout, finish ratings for the current article and save before Practice recall.
-   **Practice Phase**:
    -   Duration: 4 minutes.
    -   Topic: "Animal task".
    -   Article ratings during the task.
    -   Speech-to-text recall after the task, saved with its practice/formal phase.
-   **Formal Task Phase**:
    -   Duration: 15 minutes.
    -   Topic: "Health task".
    -   Article ratings during the task.
    -   Speech-to-text recall after the task, saved with its practice/formal phase.

- **Formal timing**: 15 minutes of cumulative visible article time, using the same pause and timeout rules as Practice. At timeout, save the current article ratings before Formal recall.

### 4.3 Part B: Story Reading Study (Core Task)
This part investigates the "foraging" behavior.

#### 4.3.1 Practice Phase
-   **Duration**: 4 minutes.
-   **Content**: 3 Stories.
-   **Structure per Story**:
    -   6 text segments per story.
    -   Length: ~50 words per segment (45-55 words).
-   **Task Flow**:
    1.  User sees titles of available stories.
    2.  User selects a story to start reading.
    3.  User reads one text segment at a time.
    4.  **Manipulation**: The last sentence of the text varies in predictability (Predictable vs. Unpredictable).
    5.  **Decision Point**: After each segment, the user chooses to:
        -   **Continue**: Read the next segment of the current story.
        -   **Switch**: Go back to the main menu to select a different story.
    6.  **Post-Task**:
        -   Recall with speech-to-text.

#### 4.3.2 Formal Task Phase
-   **Duration**: 15 minutes.
-   **Content**: 5 Stories.
-   **Structure per Story**:
    -   6 text segments per story.
    -   Length: ~220 words per segment (200-250 words).
-   **Task Flow**: Same as Practice Phase (Select -> Read -> Decide -> Repeat).
-   **Post-Task**:
    -   Recall with speech-to-text.

### 4.4 Part C: Sentence Reading Study
-   **Timing**: Allow 10 cumulative minutes of visible word reading. Pause during Continue/Switch decisions, saving waits, questions, recall, instructions and hidden tabs. Use the same active clock for word/sentence durations. On timeout, stop reading, save timing logs, and proceed to recall.
-   **Stimuli**: 20 sentences total.
-   **Display Format**:
    -   Show one word at a time (RSVP or self-paced reading?). *Source says "Show one word at a time".*
    -   Grouped in sequences of 5 sentences.
-   **Tasks**:
    -   **Written Summary**: After the sequence, user writes a summary.
    -   **Comprehension Questions**: User answers questions about the sentences.

### 4.5 Cognitive Measures
-   Legacy components only; not part of the current participant flow.

## 5. Content & Stimuli
The content includes stories with alternative endings for the text segments.
*See `Paragraph_unexpected_20251023.docx` for specific text examples.*

**Example Structure:**
-   **Predictable Ending**: The text concludes in a way that logically follows the preceding context.
-   **Unpredictable Ending**: The text concludes with a surprising twist or unexpected event.

## 6. Data Collection Requirements
The system must record:
-   **Timestamp** for every event.
-   **Reading Time**: Time spent on each text segment.
-   **Navigation Choices**: Whether the user continued or switched after each segment.
-   **Story Selection**: Which story was chosen and in what order.
-   **Input Data**:
    -   Demographic details.
    -   Written summaries.
    -   Answers to comprehension questions.
-   **Cognitive Measure Scores**.

## 7. Technical Constraints & Notes
-   Ensure smooth transitions between segments.
-   Prevent back-navigation (browser back button should be disabled or handled).
-   Progress saving (optional but recommended in case of disconnect).

---
*Based on documents: `Task_Design_Jiajun_20251110.docx`, `Study Design_Narrative Text Foraging.docx`, `Paragraph_unexpected_20251023.docx`.*
