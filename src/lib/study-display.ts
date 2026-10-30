export const FULLSCREEN_REQUIRED = !(process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_DISABLE_FULLSCREEN === "true");

export function isStudyVisible(): boolean {
    return !document.hidden && (!FULLSCREEN_REQUIRED || document.fullscreenElement !== null);
}

export async function enterStudyFullscreen(): Promise<void> {
    if (!FULLSCREEN_REQUIRED || document.fullscreenElement) return;
    if (!document.documentElement.requestFullscreen) {
        throw new Error("This browser does not support full screen. Please use a desktop browser or contact the researcher.");
    }
    try {
        await document.documentElement.requestFullscreen();
    } catch {
        throw new Error("Full screen is required to continue. Please try again or contact the researcher.");
    }
}
