/**
 * Cloudflare Worker fetch handler for apps/web.
 *
 * `wrangler.jsonc`'s `assets.run_worker_first` sends only `/api/*` here;
 * every other request is served directly from the static assets built into
 * `dist/` without invoking this handler at all. This proxies `/api/*`
 * through unchanged (no path rewriting) to the self-hosted API, reachable
 * via a Cloudflare Tunnel. The Tunnel hostname is itself protected by a
 * Cloudflare Access service-token policy, so the token credentials
 * (Worker secrets) are attached as headers when configured; everything
 * else in the request is forwarded as-is. See
 * docs/internal/specs/deployment.md and
 * docs/user/self-hosting.md.
 */

interface Env {
  /** Tunnel origin the API is reachable at, e.g. "https://api-origin.example.com". */
  API_ORIGIN: string;
  /** Cloudflare Access service token for the API hostname (Worker secrets). */
  CF_ACCESS_CLIENT_ID?: string;
  CF_ACCESS_CLIENT_SECRET?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = new URL(env.API_ORIGIN);
    url.protocol = origin.protocol;
    url.host = origin.host;
    const proxied = new Request(url, request);
    if (env.CF_ACCESS_CLIENT_ID && env.CF_ACCESS_CLIENT_SECRET) {
      proxied.headers.set("CF-Access-Client-Id", env.CF_ACCESS_CLIENT_ID);
      proxied.headers.set("CF-Access-Client-Secret", env.CF_ACCESS_CLIENT_SECRET);
    }
    const response = await fetch(proxied);
    // Access on the API hostname sets its own CF_Authorization session cookie
    // after service-token auth. Forwarding it would overwrite the browser's
    // CF_Authorization cookie for this hostname (a different Access app) and
    // break the user's session, so never forward Set-Cookie from the API.
    const headers = new Headers(response.headers);
    headers.delete("Set-Cookie");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
