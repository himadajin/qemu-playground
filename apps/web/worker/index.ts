/**
 * Cloudflare Worker fetch handler for apps/web.
 *
 * `wrangler.jsonc`'s `assets.run_worker_first` sends only `/api/*` here;
 * every other request is served directly from the static assets built into
 * `dist/` without invoking this handler at all. This proxies `/api/*`
 * through unchanged (no path rewriting, headers untouched) to the
 * self-hosted API, reachable via a Cloudflare Tunnel. See
 * docs/internal/plans/001-prototype/infrastructure.md and
 * docs/user/self-hosting.md.
 */

interface Env {
  /** Tunnel origin the API is reachable at, e.g. "https://api-origin.example.com". */
  API_ORIGIN: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = new URL(env.API_ORIGIN);
    url.protocol = origin.protocol;
    url.host = origin.host;
    return fetch(new Request(url, request));
  },
};
