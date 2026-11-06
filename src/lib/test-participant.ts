const TEST_PARTICIPANT_ID = "88888888";
const TEST_SESSION_KEY = "study.testParticipant";

// Scope this UI shortcut to the tab that registered the test ID.
export function rememberTestLogin(participantId: string): void {
    try {
        if (participantId === TEST_PARTICIPANT_ID) sessionStorage.setItem(TEST_SESSION_KEY, participantId);
        else sessionStorage.removeItem(TEST_SESSION_KEY);
    } catch {
        // Storage is optional for normal participation. Test navigation fails closed.
        return;
    }
}

export function canSkipStudyPage(participantId: string): boolean {
    try {
        return participantId === TEST_PARTICIPANT_ID && sessionStorage.getItem(TEST_SESSION_KEY) === participantId;
    } catch {
        return false;
    }
}
