import { NextResponse } from "next/server";

import { requireUserEmail } from "@/lib/access";

export async function GET() {
  const emailOrResponse = await requireUserEmail();
  if (emailOrResponse instanceof NextResponse) return emailOrResponse;
  const email = emailOrResponse;
  
  return NextResponse.json({ email });
}

