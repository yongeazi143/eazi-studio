import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/utils/db";

export async function POST(request: NextRequest) {
  let id: string | undefined;
  let email: string | undefined;
  let username: string | undefined;

  try {
    const body = await request.json();
    id = body.id;
    email = body.email;
    username = body.username;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!id || !email) {
    return NextResponse.json({ error: "Missing id or email" }, { status: 400 });
  }

  const normalizedUsername = username?.trim().toLowerCase() || null;

  try {
    // Upsert by Supabase UUID id
    const user = await db.user.upsert({
      where: { id },
      update: {
        email,
        name: normalizedUsername,
      },
      create: {
        id,
        email,
        name: normalizedUsername,
      },
    });

    return NextResponse.json({ success: true, user });
  } catch (error: any) {
    // If a row already exists for this email with a different id, just update the name
    if (error?.code === "P2002" || error?.message?.includes("unique")) {
      try {
        await db.user.updateMany({
          where: { email },
          data: { name: normalizedUsername },
        });
        return NextResponse.json({ success: true });
      } catch (updateErr: any) {
        console.error("Sync user fallback update error:", updateErr);
      }
    }

    console.error("Sync user error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
