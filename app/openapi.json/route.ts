import { NextResponse } from "next/server";

const spec = {
  openapi: "3.0.3",
  info: { title: "Ivay Caller Portal", version: "0.1.0" },
  paths: {
    "/health": { get: { summary: "Liveness check", responses: { "200": { description: "OK" } } } },
    "/ready": { get: { summary: "Readiness check", responses: { "200": { description: "Ready" }, "503": { description: "Not ready" } } } },
    "/version": { get: { summary: "Build info", responses: { "200": { description: "OK" } } } },
    "/api/auth/login": { post: { summary: "Log in", responses: { "200": { description: "OK" }, "401": { description: "Invalid credentials" } } } },
    "/api/auth/logout": { post: { summary: "Log out", responses: { "200": { description: "OK" } } } },
    "/api/bot/callback": {
      post: {
        summary: "Bot bridge transfer callback (scoped per campaign via x-campaign-token)",
        responses: { "200": { description: "Transferred" }, "401": { description: "Invalid/missing campaign token" } },
      },
    },
  },
};

export async function GET() {
  return NextResponse.json(spec);
}
