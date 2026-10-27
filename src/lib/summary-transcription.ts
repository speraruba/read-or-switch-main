interface TranscriptionOptions {
    endpoint: string;
    participantId: string;
    language: string;
    onReady: () => void;
    onText: (text: string) => void;
    onEnd: (error?: string) => void;
}

export interface TranscriptionSession {
    start: () => Promise<void>;
    stop: () => void;
    cancel: () => void;
}

// WebRTC negotiates microphone audio with Safari as well as Chromium; no browser
// SpeechRecognition implementation or browser-exposed OpenAI key is required.
export function createSummaryTranscription(options: TranscriptionOptions): TranscriptionSession {
    let peer: RTCPeerConnection | undefined;
    let channel: RTCDataChannel | undefined;
    let stream: MediaStream | undefined;
    let closed = false;
    let stopping = false;
    let ready = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let flushTimer: ReturnType<typeof setTimeout> | undefined;
    const abort = new AbortController();
    const transcripts = new Map<string, string>();

    const cleanup = () => {
        closed = true;
        clearTimeout(timer);
        clearTimeout(flushTimer);
        abort.abort();
        stream?.getTracks().forEach(track => track.stop());
        channel?.close();
        peer?.close();
    };
    const finish = (error?: string) => {
        if (closed) return;
        cleanup();
        options.onEnd(error);
    };

    return {
        cancel: cleanup,
        stop: () => {
            if (closed || stopping) return;
            if (!ready) {
                finish();
                return;
            }
            stopping = true;
            // Silence the track first and allow in-flight RTP audio to reach the
            // server before committing the final turn over the data channel.
            stream?.getTracks().forEach(track => { track.enabled = false; });
            flushTimer = setTimeout(() => {
                if (closed) return;
                stream?.getTracks().forEach(track => track.stop());
                if (channel?.readyState !== "open") {
                    finish("Connection lost. Review the captured text before submitting.");
                    return;
                }
                channel.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
                timer = setTimeout(() => finish("The final words could not be confirmed. Review the captured text before submitting."), 15000);
            }, 400);
        },
        start: async () => {
            try {
                if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === "undefined") {
                    finish("Microphone access requires a current browser and HTTPS (or localhost).");
                    return;
                }
                timer = setTimeout(() => finish("Connection timed out. Please try again."), 30000);
                const microphone = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
                if (closed) {
                    microphone.getTracks().forEach(track => track.stop());
                    return;
                }
                stream = microphone;
                peer = new RTCPeerConnection();
                stream.getAudioTracks().forEach(track => {
                    peer?.addTrack(track, microphone);
                    track.onended = () => {
                        if (!closed && !stopping) finish("The microphone disconnected. Your captured text is preserved.");
                    };
                });
                channel = peer.createDataChannel("oai-events");
                channel.onopen = () => {
                    if (closed || stopping) return;
                    clearTimeout(timer);
                    ready = true;
                    options.onReady();
                };
                channel.onclose = () => {
                    if (!closed) finish("Voice connection closed. Your captured text is preserved.");
                };
                peer.onconnectionstatechange = () => {
                    if (peer?.connectionState === "failed" || peer?.connectionState === "disconnected") {
                        finish("Voice connection interrupted. Your captured text is preserved; please try again.");
                    }
                };
                channel.onmessage = (message: MessageEvent) => {
                    if (closed || typeof message.data !== "string") return;
                    let event: unknown;
                    try { event = JSON.parse(message.data); } catch { return; }
                    if (!event || typeof event !== "object" || !("type" in event)) return;
                    if (event.type === "error" || event.type === "conversation.item.input_audio_transcription.failed") {
                        finish("Transcription could not finish. Review the captured text or try again.");
                        return;
                    }
                    if (!("item_id" in event) || typeof event.item_id !== "string") return;
                    if (event.type === "conversation.item.input_audio_transcription.delta" && "delta" in event && typeof event.delta === "string") {
                        transcripts.set(event.item_id, (transcripts.get(event.item_id) || "") + event.delta);
                    } else if (event.type === "conversation.item.input_audio_transcription.completed" && "transcript" in event && typeof event.transcript === "string") {
                        transcripts.set(event.item_id, event.transcript);
                    } else return;
                    options.onText(Array.from(transcripts.values()).filter(Boolean).join(" ").trim());
                    if (stopping && event.type === "conversation.item.input_audio_transcription.completed") finish();
                };
                const offer = await peer.createOffer();
                if (closed) return;
                await peer.setLocalDescription(offer);
                const response = await fetch(options.endpoint, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ sdp: offer.sdp, participantId: options.participantId, language: options.language }),
                    signal: abort.signal,
                });
                const data: unknown = await response.json();
                if (closed) return;
                if (!response.ok || !data || typeof data !== "object" || !("sdp" in data) || typeof data.sdp !== "string") {
                    finish(data && typeof data === "object" && "error" in data && typeof data.error === "string" ? data.error : "Voice input could not connect. Please try again.");
                    return;
                }
                await peer.setRemoteDescription({ type: "answer", sdp: data.sdp });
            } catch (error) {
                if (closed) return;
                finish(error instanceof DOMException && error.name === "NotAllowedError"
                    ? "Allow microphone access in your browser settings, then try again."
                    : "Unable to start voice input. Check your microphone and internet connection, then try again.");
            }
        },
    };
}
