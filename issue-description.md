# GitHub API calls in `che-api` extension fail behind TLS-intercepting proxies (ZScaler, corporate proxies)

## Problem

The `che-api` extension's GitHub API calls (`getUser()`, `getTokenScopes()`) fail in enterprise environments that use TLS-intercepting proxies such as **ZScaler**, **Symantec**, or any corporate HTTPS proxy that re-signs certificates with a custom CA.

Two distinct issues were identified:

### 1. `axios` does not send CONNECT requests for HTTPS over HTTP proxy

The original implementation used `axios` to call `https://api.github.com/user`. When an HTTP proxy is configured (e.g. `HTTPS_PROXY=http://proxy:8080`), `axios` fails to issue a `CONNECT` request to establish a tunnel for the HTTPS connection. This is a known `axios` defect ([axios#4531](https://github.com/axios/axios/issues/4531), [axios#3384](https://github.com/axios/axios/issues/3384)).

**Result**: GitHub API calls hang or fail outright behind any HTTPS-intercepting proxy.

### 2. `fetch` (undici) does not honor `NODE_EXTRA_CA_CERTS` in VS Code extension host

After replacing `axios` with `globalThis.fetch`, a second problem emerged: `fetch` (backed by Node.js's `undici`) fails with `UNABLE_TO_VERIFY_LEAF_SIGNATURE` when HTTPS traffic is intercepted by a proxy using a custom CA certificate — even when the CA is correctly provided via the `NODE_EXTRA_CA_CERTS` environment variable.

In contrast, Node.js's native `https` module (patched by VS Code's `@vscode/proxy-agent`) correctly loads and trusts the custom CA under the same conditions.

**Result**: GitHub API calls fail with a TLS certificate error despite the custom CA being mounted and configured.

## How to reproduce

### Prerequisites

- [mitmproxy](https://mitmproxy.org/) installed on the host (simulates ZScaler's TLS interception)
- `podman` (or `docker`) available
- A valid GitHub personal access token

### Steps

1. **Start mitmproxy on the host:**

   ```bash
   mitmdump --listen-port 8080
   ```

2. **Run the che-code container with proxy settings and the mitmproxy CA:**

   ```bash
   podman run --rm -it -p 3100:3100 \
     -e CODE_HOST=0.0.0.0 \
     -e HTTPS_PROXY=http://host.containers.internal:8080 \
     -e HTTP_PROXY=http://host.containers.internal:8080 \
     -e NODE_EXTRA_CA_CERTS=/public-certs/mitmproxy-ca.crt \
     -v ~/.mitmproxy/mitmproxy-ca-cert.pem:/public-certs/mitmproxy-ca.crt:ro \
     quay.io/redhat-user-workloads/devspaces-tenant/devspaces/code-rhel9:3.28
   ```

3. **Open the editor** in a browser at `http://localhost:3100`.

4. **Trigger any flow that calls `che-api`'s `GithubService.getUser()`** (e.g. the Device Authentication flow after completing GitHub OAuth).

### Expected result

The GitHub API call succeeds, using the custom CA provided via `NODE_EXTRA_CA_CERTS` to verify the proxy's re-signed certificate.

### Actual result

- **With `axios` (before the fix):** the request hangs or fails because no `CONNECT` tunnel is established.
- **With `fetch` (after removing axios):** the request fails with:
  ```
  TypeError: fetch failed
    cause: Error: unable to verify the first certificate
      code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE'
  ```

### Workaround for testing

Setting `NODE_TLS_REJECT_UNAUTHORIZED=0` makes `fetch` succeed, confirming the issue is strictly about custom CA trust — not connectivity.

## Root cause analysis

### axios issue

`axios` uses Node.js's `http`/`https` modules internally but has a bug in its proxy handling: it does not issue a `CONNECT` request when making HTTPS requests through an HTTP proxy. This prevents establishing the required TLS tunnel.

### fetch/undici issue

VS Code's extension host (`proxyResolver.ts`) patches both `globalThis.fetch` and `require('https')` via `@vscode/proxy-agent` to inject proxy and certificate handling. However, the patched `fetch` (undici-based) does not properly integrate custom CAs from `NODE_EXTRA_CA_CERTS` in all environments. The patched `https` module does handle this correctly.

This is the same class of issue that upstream VS Code addressed in the `github-authentication` extension by implementing a fetcher fallback chain: `electron.net.fetch` → `globalThis.fetch` → `Node http/s` (see `code/extensions/github-authentication/src/node/fetch.ts`).

## Fix

The fix addresses both issues by:

1. **Removing the `axios` dependency** from `che-api`'s `GithubServiceImpl`.
2. **Implementing a fetch → https fallback chain** (similar to upstream `github-authentication`):
   - First attempts the request using `globalThis.fetch` (works in most environments, supports modern APIs).
   - If `fetch` fails (e.g. due to custom CA not being trusted), falls back to `https.request` (Node.js native module, correctly patched by VS Code to honor `NODE_EXTRA_CA_CERTS`).
3. **Adding diagnostic logging** at each step to simplify troubleshooting in customer environments.

## Environment

- **Affected component**: `code/extensions/che-api/src/impl/github-service-impl.ts`
- **Proxy types affected**: Any TLS-intercepting proxy (ZScaler, Symantec, mitmproxy, corporate MITM proxies)
- **Tested with**: `mitmproxy` 11.x simulating TLS interception, `podman` container with `che-code:next` and `code-rhel9:3.28` images
