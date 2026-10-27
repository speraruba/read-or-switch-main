interface Token {
    text: string;
    sourceId?: number;
}

interface Change {
    start: number;
    end: number;
    replacement: string[];
}

function tokenize(text: string): string[] {
    return text.match(/\s+|[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu) || [];
}

// Diff only the changed middle. Streaming additions normally need no matrix;
// word-level alignment keeps final punctuation corrections separate from edits.
function changes(before: string[], after: string[]): Change[] {
    let start = 0;
    while (start < before.length && start < after.length && before[start] === after[start]) start++;
    let end = before.length;
    let afterEnd = after.length;
    while (end > start && afterEnd > start && before[end - 1] === after[afterEnd - 1]) { end--; afterEnd--; }
    if (start === end && start === afterEnd) return [];
    const a = before.slice(start, end);
    const b = after.slice(start, afterEnd);
    if (a.length * b.length > 250000) return [{ start, end, replacement: b }];
    const matrix = Array.from({ length: a.length + 1 }, () => new Uint32Array(b.length + 1));
    for (let i = a.length - 1; i >= 0; i--) {
        for (let j = b.length - 1; j >= 0; j--) {
            matrix[i][j] = a[i] === b[j] ? matrix[i + 1][j + 1] + 1 : Math.max(matrix[i + 1][j], matrix[i][j + 1]);
        }
    }
    const result: Change[] = [];
    let i = 0;
    let j = 0;
    while (i < a.length || j < b.length) {
        if (i < a.length && j < b.length && a[i] === b[j]) { i++; j++; continue; }
        const change: Change = { start: start + i, end: start + i, replacement: [] };
        while (i < a.length || j < b.length) {
            if (i < a.length && j < b.length && a[i] === b[j]) break;
            if (j < b.length && (i === a.length || matrix[i][j + 1] >= matrix[i + 1][j])) {
                change.replacement.push(b[j++]);
            } else { i++; }
        }
        change.end = start + i;
        result.push(change);
    }
    return result;
}

/** Keeps hand-edited words authoritative while applying new speech and final corrections. */
export function createEditableTranscript(initial: string): { edit: (text: string) => void; update: (transcript: string) => string } {
    let draft: Token[] = tokenize(initial).map(text => ({ text }));
    const source: Token[] = [];
    let nextId = 0;
    const protectedIds = new Set<number>();
    let started = false;
    return {
        edit(text) {
            const edits = changes(draft.map(token => token.text), tokenize(text));
            for (const edit of edits.reverse()) {
                for (const token of draft.slice(edit.start, edit.end)) {
                    if (token.sourceId !== undefined) protectedIds.add(token.sourceId);
                }
                draft.splice(edit.start, edit.end - edit.start, ...edit.replacement.map(text => ({ text })));
            }
        },
        update(transcript) {
            const edits = changes(source.map(token => token.text), tokenize(transcript));
            for (const edit of edits.reverse()) {
                const removed = source.slice(edit.start, edit.end);
                const replacement = edit.replacement.map(text => ({ text, sourceId: nextId++ }));
                const conflict = removed.some(token => token.sourceId !== undefined && protectedIds.has(token.sourceId));
                if (conflict) {
                    // A final ASR revision must not restore a word the user changed/deleted.
                    replacement.forEach(token => protectedIds.add(token.sourceId));
                } else {
                    const removedIds = new Set(removed.map(token => token.sourceId));
                    const firstRemoved = draft.findIndex(token => token.sourceId !== undefined && removedIds.has(token.sourceId));
                    let insertion = firstRemoved;
                    if (insertion < 0) {
                        const followingIds = new Set(source.slice(edit.end).map(token => token.sourceId));
                        insertion = draft.findIndex(token => token.sourceId !== undefined && followingIds.has(token.sourceId));
                    }
                    if (insertion < 0) insertion = draft.length;
                    draft = draft.filter(token => token.sourceId === undefined || !removedIds.has(token.sourceId));
                    if (!started && replacement.length && draft.length) {
                        draft.push({ text: "\n\n" });
                        insertion = draft.length;
                    }
                    draft.splice(insertion, 0, ...replacement);
                }
                if (replacement.length) started = true;
                source.splice(edit.start, edit.end - edit.start, ...replacement);
            }
            return draft.map(token => token.text).join("");
        },
    };
}
