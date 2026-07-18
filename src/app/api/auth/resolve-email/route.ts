import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/utils/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username");

  if (!username) {
    return NextResponse.json({ error: "Username is required" }, { status: 400 });
  }

  const normalizedUsername = username.trim().toLowerCase();

  try {
    // 1. Primary lookup: check Prisma User table by name (case-insensitive)
    const user = await db.user.findFirst({
      where: {
        name: {
          equals: normalizedUsername,
          mode: "insensitive",
        },
      },
    });

    if (user?.email) {
      return NextResponse.json({ email: user.email });
    }

    // 2. Fallback: query Supabase auth.users metadata directly via raw SQL
    //    This handles cases where the Prisma User.name is stale or not yet synced
    const authResults = await db.$queryRaw<{ email: string }[]>`
      SELECT email
      FROM auth.users
      WHERE LOWER(raw_user_meta_data->>'name') = ${normalizedUsername}
         OR LOWER(email) = ${normalizedUsername}
      LIMIT 1
    `;

    if (authResults && authResults.length > 0 && authResults[0].email) {
      // Opportunistically sync the username back to Prisma so future lookups hit the fast path
      try {
        await db.user.updateMany({
          where: { email: authResults[0].email },
          data: { name: normalizedUsername },
        });
      } catch {
        // Non-fatal: sync failure doesn't block login
      }

      return NextResponse.json({ email: authResults[0].email });
    }

    return NextResponse.json({ error: "Username not found" }, { status: 404 });
  } catch (error: any) {
    console.error("Resolve email error:", error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
