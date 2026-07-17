export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (body) {
      console.warn(
        "[CSP-VIOLATION]",
        JSON.stringify({
          blocked: body["blocked-uri"],
          directive: body["violated-directive"],
          doc: body["document-uri"],
          sample: body["script-sample"]?.slice(0, 120),
        }),
      );
    }
  } catch {
    // ignore
  }
  return new Response(null, { status: 204 });
}
