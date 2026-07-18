import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/utils/db";
import { createClient } from "@/utils/supabase/server";

// PUT /api/script - Save/update the script content for a project
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId, content } = await request.json();

    if (!projectId) {
      return NextResponse.json({ error: "Project ID is required" }, { status: 400 });
    }

    if (content === undefined) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 });
    }

    // Verify ownership
    const project = await db.project.findUnique({
      where: { id: projectId },
    });

    if (!project || project.userId !== user.id) {
      return NextResponse.json({ error: "Project not found or unauthorized" }, { status: 404 });
    }

    const script = await db.script.upsert({
      where: { projectId },
      update: {
        content,
        version: { increment: 1 }
      },
      create: {
        projectId,
        content,
        version: 1
      }
    });

    return NextResponse.json({ success: true, script });
  } catch (error: any) {
    console.error("Save script error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
