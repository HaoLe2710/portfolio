type ServiceBinding = {
  fetch(request: Request): Promise<Response>;
};

type PagesContext = {
  request: Request;
  env: {
    ADMIN_API: ServiceBinding;
  };
};

const allowedMethods = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);

export async function onRequest({ request, env }: PagesContext) {
  if (!allowedMethods.has(request.method)) {
    return new Response("Method not allowed.", {
      status: 405,
      headers: { Allow: [...allowedMethods].join(", ") },
    });
  }

  const origin = request.headers.get("Origin");
  if (origin) {
    try {
      if (new URL(origin).origin !== new URL(request.url).origin) {
        return new Response(JSON.stringify({
          success: false,
          message: "Request origin is not allowed.",
          data: null,
          error: { code: "FORBIDDEN", message: "Request origin is not allowed." },
          timestamp: new Date().toISOString(),
          path: new URL(request.url).pathname,
        }), {
          status: 403,
          headers: {
            "Cache-Control": "no-store",
            "Content-Type": "application/json; charset=utf-8",
            "X-Content-Type-Options": "nosniff",
          },
        });
      }
    } catch {
      return new Response("Request origin is invalid.", { status: 403 });
    }
  }

  const upstream = await env.ADMIN_API.fetch(new Request(request));
  const headers = new Headers(upstream.headers);
  headers.set("Cache-Control", "no-store, private");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "same-origin");
  headers.set("X-Frame-Options", "DENY");
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}
