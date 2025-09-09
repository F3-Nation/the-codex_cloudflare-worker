// === Paste your static header/footer HTML here ===
const f3NationHeaderHtml = `
<!-- Paste your header div HTML here test-->
`;

const f3NationFooterHtml = `
<!-- Paste your footer div HTML here -->
`;

addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Handle Codex routes and assets
  if (
    url.pathname.startsWith("/exicon") ||
    url.pathname.startsWith("/lexicon") ||
    url.pathname.startsWith("/submit") ||
    url.pathname.startsWith("/_next") ||
    url.pathname.startsWith("/static")
  ) {
    event.respondWith(handleProxy(event.request));
  }
});

async function handleProxy(request) {
  const url = new URL(request.url);

  // Proxy static assets directly from Codex
  if (url.pathname.startsWith("/_next") || url.pathname.startsWith("/static")) {
    const assetUrl = new URL(url.pathname + url.search, "https://codex.f3nation.com");
    const headers = new Headers(request.headers);
    headers.set("Host", "codex.f3nation.com"); // Fix redirect
    return fetch(assetUrl, { method: request.method, headers, body: request.body });
  }

  // Proxy HTML pages from Codex
  const codexUrl = new URL(url.pathname + url.search, "https://codex.f3nation.com");
  const proxyHeaders = new Headers(request.headers);
  proxyHeaders.set("Host", "codex.f3nation.com"); // Fix redirect

  const proxyResponse = await fetch(codexUrl, {
    method: request.method,
    headers: proxyHeaders,
    body: request.method === "GET" ? undefined : request.body,
  });

  const contentType = proxyResponse.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) {
    return proxyResponse;
  }

  // Inject static header/footer and rewrite relative asset URLs
  return new HTMLRewriter()
    .on("body", {
      element(el) {
        if (f3NationHeaderHtml) el.prepend(f3NationHeaderHtml, { html: true });
        if (f3NationFooterHtml) el.append(f3NationFooterHtml, { html: true });
      },
    })
    // Rewrite links to codex
    .on("link[href]", {
      element(el) {
        const href = el.getAttribute("href");
        if (href?.startsWith("/")) el.setAttribute("href", "https://codex.f3nation.com" + href);
      },
    })
    .on("script[src]", {
      element(el) {
        const src = el.getAttribute("src");
        if (src?.startsWith("/")) el.setAttribute("src", "https://codex.f3nation.com" + src);
      },
    })
    .on("img[src]", {
      element(el) {
        const src = el.getAttribute("src");
        if (src?.startsWith("/")) el.setAttribute("src", "https://codex.f3nation.com" + src);
      },
    })
    .transform(proxyResponse);
}
