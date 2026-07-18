import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/utils/db";
import { createClient } from "@/utils/supabase/server";
import fs from "fs";
import path from "path";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
    }

    // Verify project ownership
    const project = await db.project.findUnique({
      where: { id: projectId },
    });

    if (!project || project.userId !== user.id) {
      return NextResponse.json({ error: "Project not found or unauthorized" }, { status: 404 });
    }

    // 1. Delete generated files from local storage if they exist
    const projectDir = path.join(process.cwd(), "public", "generated-images", projectId);
    if (fs.existsSync(projectDir)) {
      try {
        fs.rmSync(projectDir, { recursive: true, force: true });
      } catch (err) {
        console.error("Failed to delete local generated-images directory:", err);
      }
    }

    // 2. Set imageUrl to null in database
    await db.scene.updateMany({
      where: { projectId },
      data: { imageUrl: null },
    });

    // 3. Reset project status to PROMPTS
    await db.project.update({
      where: { id: projectId },
      data: { status: "PROMPTS" },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Reset scenes images error:", error);
    return NextResponse.json({ error: "Internal server error: " + error.message }, { status: 500 });
  }
}
