/**
 * coi-serviceworker — Cross-Origin Isolation via Service Worker
 *
 * SharedArrayBuffer (required for .NET 9 WASM multi-threading) needs the page to be
 * "cross-origin isolated", which means the server must send:
 *   Cross-Origin-Opener-Policy: same-origin
 *   Cross-Origin-Embedder-Policy: require-corp
 *
 * Static hosts like GitHub Pages don't support custom response headers, so this
 * service worker intercepts every fetch and adds those headers to the response.
 *
 * Flow:
 *   1st load  — SW is registered; after it activates it posts "reload" to all clients.
 *   2nd load  — SW is active, injects headers, crossOriginIsolated === true, app runs.
 */

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", event =>
    event.waitUntil(
        self.clients.claim().then(() =>
            self.clients.matchAll({ type: "window" }).then(clients =>
                clients.forEach(c => c.postMessage({ type: "COI_RELOAD" }))
            )
        )
    )
);

self.addEventListener("fetch", event => {
    const req = event.request;

    // Skip opaque cache-only cross-origin requests (would throw on Response construction).
    if (req.cache === "only-if-cached" && req.mode !== "same-origin") return;

    event.respondWith(
        fetch(req).then(resp => {
            // Opaque responses (cross-origin no-cors) — can't modify headers.
            if (resp.type === "opaque" || resp.type === "opaqueredirect") return resp;

            const headers = new Headers(resp.headers);
            headers.set("Cross-Origin-Opener-Policy", "same-origin");
            headers.set("Cross-Origin-Embedder-Policy", "require-corp");

            return new Response(resp.body, {
                status:     resp.status,
                statusText: resp.statusText,
                headers,
            });
        })
    );
});
