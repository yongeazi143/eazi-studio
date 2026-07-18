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

    const { projectId } = await request.json();
    if (!projectId) {
      return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
    }

    const project = await db.project.findUnique({
      where: { id: projectId },
      include: { metadata: true }
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (project.userId !== user.id) {
      return NextResponse.json({ error: "Unauthorized access to project" }, { status: 403 });
    }

    let briefData: any = {};
    if (project.brief) {
      try {
        briefData = JSON.parse(project.brief);
      } catch (e) {}
    }

    // Delete all rendered images for concepts
    const thumbnailConcepts = briefData.thumbnailConcepts || [];
    const publicDir = path.join(process.cwd(), "public");

    thumbnailConcepts.forEach((concept: any) => {
      if (concept.imageUrl) {
        const cleanPath = concept.imageUrl.split("?")[0];
        const filePath = path.join(publicDir, cleanPath);
        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
          } catch (err) {
            console.error(`Failed to delete thumbnail concept file: ${filePath}`, err);
          }
        }
        concept.imageUrl = null; // Clear inside object
      }
    });

    // Clean up other legacy names if any
    const legacyPath = path.join(publicDir, "generated-images", projectId, "thumbnail.png");
    if (fs.existsSync(legacyPath)) {
      try { fs.unlinkSync(legacyPath); } catch {}
    }

    // Update brief JSON
    const updatedBrief = {
      ...briefData,
      thumbnailConcepts
    };

    await db.project.update({
      where: { id: projectId },
      data: {
        brief: JSON.stringify(updatedBrief)
      }
    });

    // Reset thumbnailUrl in VideoMetadata table
    if (project.metadata) {
      await db.videoMetadata.update({
        where: { projectId },
        data: { thumbnailUrl: null }
      });
    }

    return NextResponse.json({ success: true, thumbnailConcepts });

  } catch (err: any) {
    console.error("Thumbnail reset error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
