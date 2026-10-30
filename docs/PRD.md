# Product Requirement Document (PRD): Narrative Text Foraging Study

## 1. Overview
This project aims to develop a web-based experiment platform to study the effects of surprise (predictability) on the tradeoff between exploitation (continuing to read the current story) and exploration (switching to a new story) in narrative text foraging.

## 2. Research Question
To examine how the predictability of the last sentence in a text segment influences a reader's decision to continue reading the same story or switch to a different one.

## 3. User Flow
The experiment consists of the following stages:
1.  **Informed Consent**: Participant agrees to the study terms.
2.  **Demographic Information**: Collection of basic user data.
3.  **Part A: Multi-text Learning Study**: Practice (4 minutes) → speech-to-text recall → Formal (15 minutes) → speech-to-text recall → written summary.
4.  **Part B: Story Reading Study**: Practice (4 minutes, stories with titles) → speech-to-text recall → Formal (15 minutes, stories with titles) → speech-to-text recall → written summary.
5.  **Part C: Sentence Reading Study**: Instructions → reading (no overall time limit) → voice recall → comprehension questions. Part C has no practice/formal split and no written summary.
6.  **Cognitive Tests**: Letter Comparison (two rounds of ten pairs) → Vocabulary Test.
7.  **Debriefing and Thank You**.

The execution order is A → B → C. The five recalls require speech-to-text, with live read-only transcripts. Written summaries follow formal recalls in Parts A and B only. Part C has one reading task and one recall, without a phase label or written summary. Cognitive tests run after Part C comprehension and before debriefing. Part B comprehension questions and the Final assessment remain outside the current flow.

## 4. Functional Requirements

### 4.1 General
-   **Platform**: Desktop browser with Fullscreen and microphone support. Fullscreen is required from study entry through cognitive tests. Exiting fullscreen blocks interaction without resetting progress.
-   **Entry**: Participant ID plus exact matching confirmation and consent. Do not collect name or email.
-   **Accessibility**: 20px base text, larger controls, visible focus, stronger contrast, interactive rating demonstrations, and blue/green available/visited topic cards with text labels.
-   **Timing**: All countdowns accumulate only visible reading time. Topic/story selection, post-sentence decisions, questions, recall, loading, hidden tabs, and fullscreen interruptions do not count.
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
    -   After formal recall, a separate typed summary asks for about 100 words on what the participant remembered most about Bone Graft, Blood Donation, Corneal Transplants, Liver Cancer, and Colorectal Cancer. Keep the length guidance in the instructions without a word-count display below the input; 100 words is guidance, not a hard limit. Save as part `a`, phase `formal`, task `summary`, input method `typed` in `study_text_responses` before continuing to Part B.

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
-   **Timing**: No overall countdown or timeout. Do not display sentence or current-word timers. Continue logging visible word/sentence durations, pausing for decisions, saving, hidden tabs, and fullscreen interruptions. Flush logs before advancing to recall after the final topic.
-   **Progress**: During reading and sentence decisions, show the current topic and sentence positions with totals from the loaded material (for example, `Topic 1 / 16 · Sentence 1 / 6`).
-   **Stimuli**: 20 sentences total.
-   **Display Format**:
    -   Show one word at a time (RSVP or self-paced reading?). *Source says "Show one word at a time".*
    -   Grouped in sequences of 5 sentences.
-   **Tasks**:
    -   **Voice Recall**: After reading, the participant recalls what they learned using voice input. Saving recall leads directly to comprehension questions; there is no written summary.
    -   **Comprehension Questions**: User answers questions about the sentences.

### 4.5 Cognitive Measures
-   After Part C comprehension saves, show Letter Comparison, then Vocabulary.
-   Save responses, correctness, and reaction times in milliseconds before advancing. Loading or saving failures must not skip a test.
-   **Keyboard**: S = same, D = different, applied to the highlighted pair. Move to the first unanswered pair after each response. Ignore repeats, composition, modifier shortcuts, and input outside fullscreen. Mouse and keyboard share the existing round-start timestamp baseline.
-   Retain the existing `part_a_letter_item` and `part_a_vocabulary_*` tables and records.

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

## Recall and Summary Storage and Instruction Sources

New responses use `study_text_responses`, with separate `task` values (`recall` / `summary`), `part`, `phase`, `input_method`, and a unique `submission_id` for safe retries. Apply `npm run db:migrate:study-responses` to existing installations; the production upgrade includes it. Legacy `part_*_summaries` tables are preserved and are not relabeled or mixed with new responses. Development seeders clear new responses only for their own part.

Recall has no typing/editing fallback. Speech errors retain captured text and provide retry/researcher guidance. Transcription requires the existing configured voice service and microphone access. Summary is a separate written task after formal recalls in Parts A and B only. Part C submits recall without a phase; the server maps it to the existing `formal` database enum solely for storage compatibility and rejects Part C summaries. Existing records are preserved.

The referenced chat, `Archive/`, three Word documents under `docs/`, PRD, and prior SummaryInput/CognitiveTests revisions were checked. No verified previous Text Foraging recording instructions or Letter Comparison instructions were found. Current instructions describe the implemented controls; replace them with approved historical wording when supplied. The consent form contains Zoom recording information, but it is not a participant recording workflow. `GEMINI.md` is not present.
