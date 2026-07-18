import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/utils/db";
import { createClient } from "@/utils/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId, conceptId } = await request.json();
    if (!projectId || !conceptId) {
      return NextResponse.json({ error: "Missing projectId or conceptId" }, { status: 400 });
    }

    const project = await db.project.findUnique({
      where: { id: projectId }
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

    const thumbnailConcepts = briefData.thumbnailConcepts || [];
    const targetConcept = thumbnailConcepts.find((c: any) => c.id === conceptId);
    if (!targetConcept) {
      return NextResponse.json({ error: "Concept not found in project" }, { status: 400 });
    }

    // Update active concept ID
    const updatedBrief = {
      ...briefData,
      selectedConceptId: conceptId,
      thumbnailPrompt: targetConcept.compiledPrompt || ""
    };

    await db.project.update({
      where: { id: projectId },
      data: {
        brief: JSON.stringify(updatedBrief)
      }
    });

    // If the concept already has a rendered image, sync it to the active VideoMetadata thumbnailUrl
    if (targetConcept.imageUrl) {
      await db.videoMetadata.upsert({
        where: { projectId },
        update: {
          thumbnailUrl: targetConcept.imageUrl
        },
        create: {
          projectId,
          title: project.title,
          description: "",
          tags: [],
          thumbnailUrl: targetConcept.imageUrl
        }
      });
    }

    return NextResponse.json({
      success: true,
      selectedConceptId: conceptId,
      thumbnailUrl: targetConcept.imageUrl || null
    });

  } catch (err: any) {
    console.error("Thumbnail select error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
