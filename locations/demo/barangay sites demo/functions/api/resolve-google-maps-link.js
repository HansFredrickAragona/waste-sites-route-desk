import { resolveGoogleMapsShortLink } from "../../src/features/barangay-review/data/googleMapsShareResolver.js";

const MAX_BODY_BYTES = 4096;

function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function onRequest({ request }) {
  if (request.method !== "POST") {
    return jsonResponse(405, { message: "Use POST to resolve a Google Maps share link." });
  }

  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) {
    return jsonResponse(413, { message: "The Maps link is too long." });
  }

  let body;
  try {
    body = await request.text();
  } catch {
    return jsonResponse(400, { message: "Paste a valid Google Maps share link." });
  }

  if (new TextEncoder().encode(body).byteLength > MAX_BODY_BYTES) {
    return jsonResponse(413, { message: "The Maps link is too long." });
  }

  let sharedUrl;
  try {
    sharedUrl = JSON.parse(body).url;
  } catch {
    return jsonResponse(400, { message: "Paste a valid Google Maps share link." });
  }

  try {
    return jsonResponse(200, await resolveGoogleMapsShortLink(sharedUrl));
  } catch (error) {
    return jsonResponse(Number.isInteger(error?.status) ? error.status : 502, {
      message: error instanceof Error ? error.message : "Could not resolve this Google Maps share link.",
    });
  }
}
