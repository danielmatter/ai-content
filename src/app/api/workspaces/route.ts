import "@/lib/db/migrate";

import { NextResponse } from "next/server";

import { apiError, getCurrentUserId, readJson, slugify, unauthorized, workspaceSchema } from "@/lib/api";
import { db, makeId, now } from "@/lib/db/client";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return unauthorized();
  }

  const workspaces = db
    .prepare("SELECT * FROM workspaces WHERE user_id = ? ORDER BY updated_at DESC")
    .all(userId);

  return NextResponse.json({ workspaces });
}

export async function POST(request: Request) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return unauthorized();
    }

    const input = await readJson(request, workspaceSchema);
    const createdAt = now();
    const workspace = {
      id: makeId("wrk"),
      user_id: userId,
      name: input.name,
      slug: input.slug || slugify(input.name),
      description: input.description,
      created_at: createdAt,
      updated_at: createdAt,
    };

    db.prepare(
      `INSERT INTO workspaces (id, user_id, name, slug, description, created_at, updated_at)
       VALUES (@id, @user_id, @name, @slug, @description, @created_at, @updated_at)`,
    ).run(workspace);

    return NextResponse.json({ workspace }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
