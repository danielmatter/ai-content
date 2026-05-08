import "@/lib/db/migrate";

import { NextResponse } from "next/server";

import { apiError, getCurrentUserId, readJson, unauthorized } from "@/lib/api";
import { generateFormDraft, steeringSchema } from "@/lib/form-generation";

export async function POST(request: Request) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return unauthorized();
    }

    const input = await readJson(request, steeringSchema);
    const result = await generateFormDraft({
      target: "workspace",
      steering: input.steering,
      fields: ["name", "description"],
      context: { userId },
    });

    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}
