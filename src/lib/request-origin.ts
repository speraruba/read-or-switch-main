export function isAllowedRequestOrigin(origin: string | null, requestUrl: string, publicDomain?: string): boolean {
    if (!origin) return true;
    if (origin === new URL(requestUrl).origin) return true;
    // Railway terminates HTTPS before forwarding to the standalone server.
    // Trust its configured public domain, never client-provided proxy headers.
    return Boolean(publicDomain && origin === `https://${publicDomain}`);
}
