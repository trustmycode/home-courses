import { NextResponse } from "next/server";

import { getUserEmail } from "@/lib/access";

export async function GET() {
  return NextResponse.json({ email: getUserEmail() });
}

