import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/utils/db";
import { createClient } from "@/utils/supabase/server";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/niche-presets/[id]
export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const preset = await db.nichePreset.findUnique({ where: { id } });

    if (!preset || preset.userId !== user.id) {
      return NextResponse.json({ error: "Preset not found" }, { status: 404 });
    }

    return NextResponse.json({ preset });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PUT /api/niche-presets/[id]
export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const existing = await db.nichePreset.findUnique({ where: { id } });
    if (!existing || existing.userId !== user.id) {
      return NextResponse.json({ error: "Preset not found" }, { status: 404 });
    }

    const body = await request.json();
    const updated = await db.nichePreset.update({
      where: { id },
      data: {
        name: body.name ?? existing.name,
        niche: body.niche !== undefined ? body.niche : existing.niche,
        videoStyle: body.videoStyle ?? existing.videoStyle,
        characterModifier: body.characterModifier ?? existing.characterModifier,
        backgroundModifier: body.backgroundModifier ?? existing.backgroundModifier,
        textOverlayEnabled: body.textOverlayEnabled !== undefined ? body.textOverlayEnabled : existing.textOverlayEnabled,
        extraModifiers: body.extraModifiers ?? existing.extraModifiers,
      },
    });

    return NextResponse.json({ preset: updated });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/niche-presets/[id]
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const existing = await db.nichePreset.findUnique({ where: { id } });
    if (!existing || existing.userId !== user.id) {
      return NextResponse.json({ error: "Preset not found" }, { status: 404 });
    }

    // Detach preset from any projects before deleting (onDelete: SetNull handles this via DB cascade)
    await db.nichePreset.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
