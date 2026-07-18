import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/utils/db";
import { createClient } from "@/utils/supabase/server";

// PUT /api/scenes - Update scene prompt/narration
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, imagePrompt, narration } = await request.json();
    if (!id) {
      return NextResponse.json({ error: "Missing scene id" }, { status: 400 });
    }

    // Verify ownership
    const scene = await db.scene.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!scene || scene.project.userId !== user.id) {
      return NextResponse.json({ error: "Scene not found or unauthorized" }, { status: 404 });
    }

    const updated = await db.scene.update({
      where: { id },
      data: {
        imagePrompt: imagePrompt !== undefined ? imagePrompt : scene.imagePrompt,
        narration: narration !== undefined ? narration : scene.narration,
      },
    });

    return NextResponse.json({ success: true, scene: updated });
  } catch (error: any) {
    console.error("Update scene error:", error);
    return NextResponse.json({ error: "Internal server error: " + error.message }, { status: 500 });
  }
}
