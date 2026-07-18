import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/utils/db";
import { createClient } from "@/utils/supabase/server";

// GET  /api/niche-presets        → list current user's presets
// POST /api/niche-presets        → create a new preset
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const presets = await db.nichePreset.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ presets });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const {
      name,
      niche,
      videoStyle,
      characterModifier,
      backgroundModifier,
      textOverlayEnabled,
      extraModifiers,
    } = body;

    if (!name || !videoStyle || !characterModifier || !backgroundModifier) {
      return NextResponse.json({ error: "Missing required fields: name, videoStyle, characterModifier, backgroundModifier" }, { status: 400 });
    }

    const preset = await db.nichePreset.create({
      data: {
        userId: user.id,
        name,
        niche: niche || null,
        videoStyle,
        characterModifier,
        backgroundModifier,
        textOverlayEnabled: textOverlayEnabled ?? false,
        extraModifiers: extraModifiers ?? [],
      },
    });

    return NextResponse.json({ preset }, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
