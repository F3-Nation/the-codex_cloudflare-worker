let cachedF3Content = { css: null, header: null, footer: null };
let cacheTimestamp = null;
const CACHE_DURATION = 3600000;

async function getF3NationContent() {
  const now = Date.now();
  
  if (cachedF3Content.css && cachedF3Content.header && cachedF3Content.footer && cacheTimestamp && (now - cacheTimestamp) < CACHE_DURATION) {
    return cachedF3Content;
  }
  
  try {
    const f3Response = await fetch('https://f3nation.com/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    const f3Html = await f3Response.text();
    
    const cssLinks = [];
    const linkRegex = /<link[^>]+rel=["\']stylesheet["\'][^>]*href=["\']([^"\']+)["\'][^>]*>/gi;
    let match;
    
    while ((match = linkRegex.exec(f3Html)) !== null) {
      const href = match[1];
      if (href.startsWith('http') || href.startsWith('//')) {
        cssLinks.push(href.startsWith('//') ? 'https:' + href : href);
      } else if (href.startsWith('/')) {
        cssLinks.push('https://f3nation.com' + href);
      }
    }
    
    const headerRegex = /<div class="fullSection[^>]*id="section-nzlkOpzvNv"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/i;
    const headerMatch = f3Html.match(headerRegex);
    const extractedHeader = headerMatch ? headerMatch[0] : null;

    const footerRegex = /<div class="fullSection[^>]*id="section-nzty_IeBlY"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/i;
    const footerMatch = f3Html.match(footerRegex);
    const extractedFooter = footerMatch ? footerMatch[0] : null;

    let combinedCSS = '';
    for (const cssUrl of cssLinks.slice(0, 5)) {
      try {
        const cssResponse = await fetch(cssUrl);
        const cssContent = await cssResponse.text();
        combinedCSS += cssContent + '\n';
      } catch (e) {
        console.error('Failed to fetch CSS:', cssUrl, e);
      }
    }
    
    cachedF3Content = { css: combinedCSS, header: extractedHeader, footer: extractedFooter };
    cacheTimestamp = now;
    
    return cachedF3Content;
    
  } catch (error) {
    console.error('Failed to fetch F3Nation content:', error);
    return {
      css: `
        .c-nav-menu .nav-menu-wrapper { display: flex; align-items: center; justify-content: space-between; padding: 0 20px; background: #1a1a1a; height: 70px; }
        .branding { display: flex; align-items: center; }
        .nav-menu { display: flex; list-style: none; margin: 0; padding: 0; gap: 40px; }
        .nav-menu-item > a { color: #fff; text-decoration: none; font-weight: 600; text-transform: uppercase; font-size: 14px; letter-spacing: 1px; }
        .nav-menu-item:hover > a { color: #007cba; }
        .dropdown-menu { position: absolute; top: 100%; left: 0; background: #fff; box-shadow: 0 8px 25px rgba(0,0,0,0.15); min-width: 200px; opacity: 0; visibility: hidden; transition: all 0.3s; }
        .dropdown:hover .dropdown-menu { opacity: 1; visibility: visible; }
        .dropdown-item a { display: block; padding: 12px 20px; color: #333; text-decoration: none; }
        .dropdown-item a:hover { background: #f5f5f5; color: #007cba; }
      `,
      header: ``,
      footer: ``
    };
  }
}

addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  
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

  if (url.pathname.startsWith("/_next") || url.pathname.startsWith("/static")) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "https://f4nation.com",
          "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    const assetUrl = new URL(url.pathname + url.search, "https://codex.f3nation.com");
    const headers = new Headers(request.headers);
    headers.set("Host", "codex.f3nation.com");
    
    const assetResponse = await fetch(assetUrl, { method: request.method, headers, body: request.body });
    
    const newResponse = new Response(assetResponse.body, assetResponse);
    
    newResponse.headers.set("Access-Control-Allow-Origin", "https://f4nation.com");
    newResponse.headers.append("Vary", "Origin");
    
    return newResponse;
  }
  
  const codexUrl = new URL(url.pathname + url.search, "https://codex.f3nation.com");
  const proxyHeaders = new Headers(request.headers);
  proxyHeaders.set("Host", "codex.f3nation.com");
  proxyHeaders.set("X-F3-Worker-Proxy", "true");
  
  const proxyResponse = await fetch(codexUrl, {
    method: request.method,
    headers: proxyHeaders,
    body: request.method === "GET" ? undefined : request.body,
  });
  
  const contentType = proxyResponse.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) {
    return proxyResponse;
  }
  
  const f3Content = await getF3NationContent();
  const headerToUse = f3Content.header || ``;
  const footerToUse = f3Content.footer || ``;
  
  return new HTMLRewriter()
    .on("head", {
      element(el) {
        el.append(`<style>${f3Content.css}</style>`, { html: true });
      },
    })
    .on("body", {
      element(el) {
        if (headerToUse) el.prepend(headerToUse, { html: true });
        if (footerToUse) el.append(footerToUse, { html: true });
      },
    })
    .on("link[href]", {
      element(el) {
        const href = el.getAttribute("href");
        if (href?.startsWith("/") && !href.startsWith("//")) {
          el.setAttribute("href", "https://codex.f3nation.com" + href);
        }
      },
    })
    .on("script[src]", {
      element(el) {
        const src = el.getAttribute("src");
        if (src?.startsWith("/") && !src.startsWith("//")) {
          el.setAttribute("src", "https://codex.f3nation.com" + src);
        }
      },
    })
    .on("img[src]", {
      element(el) {
        const src = el.getAttribute("src");
        if (src?.startsWith("/") && !src.startsWith("//")) {
          el.setAttribute("src", "https://codex.f3nation.com" + src);
        }
      },
    })
    .transform(proxyResponse);
}
