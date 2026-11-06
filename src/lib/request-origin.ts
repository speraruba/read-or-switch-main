export function isAllowedRequestOrigin(origin: string | null, requestUrl: string, publicDomain?: string, localDevHost?: string | null): boolean {
    if (!origin) return true;
    const url = new URL(requestUrl);
    if (origin === url.origin) return true;
    // Next normalizes loopback IPs to localhost in request.url. Recover the
    // browser's exact origin only for a matching loopback Host and port in dev.
    if (localDevHost && url.hostname === "localhost") {
        for (const hostname of ["127.0.0.1", "[::1]"]) {
            url.hostname = hostname;
            if (localDevHost === url.host && origin === url.origin) return true;
        }
    }
    // Railway terminates HTTPS before forwarding to the standalone server.
    // Trust its configured public domain, never client-provided proxy headers.
    return Boolean(publicDomain && origin === `https://${publicDomain}`);
}
