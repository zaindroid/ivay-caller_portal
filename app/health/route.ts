import { NextResponse } from "next/server";

// Pure liveness check -- deliberately does not touch the database. A slow
// query here can cascade into every app on the node getting marked
// unhealthy at once (see zorc's platform contract). Use /ready for the
// dependency check.
export async function GET() {
  return NextResponse.json({ status: "ok" });
}
