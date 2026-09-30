import { createFrontendApiProxyHandlers } from "@clerk/nextjs/server";

// If createFrontendApiProxyHandlers is supported in the installed SDK:
let handlers;
try {
  handlers = createFrontendApiProxyHandlers();
} catch (e) {
  handlers = null;
}

// Robust proxy fallback if SDK helper is unavailable
async function proxyHandler(req) {
  if (handlers && handlers[req.method]) {
    return handlers[req.method](req);
  }

  const url = new URL(req.url);
  // Forward to Clerk's backend proxy receiver
  const targetUrl = new URL(url.pathname + url.search, "https://frontend-api.clerk.dev");

  const headers = new Headers(req.headers);
  headers.set("Clerk-Proxy-Url", `${url.origin}/__clerk`);
  if (process.env.CLERK_SECRET_KEY) {
    headers.set("Clerk-Secret-Key", process.env.CLERK_SECRET_KEY);
  }
  headers.delete("host");

  const res = await fetch(targetUrl.toString(), {
    method: req.method,
    headers,
    body: req.method !== "GET" && req.method !== "HEAD" ? await req.blob() : undefined,
    redirect: "manual",
  });

  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: res.headers,
  });
}

export const GET = proxyHandler;
export const POST = proxyHandler;
export const PUT = proxyHandler;
export const PATCH = proxyHandler;
export const DELETE = proxyHandler;
