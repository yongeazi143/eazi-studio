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

    const { sceneId, base64Image } = await request.json();
    if (!sceneId || !base64Image) {
      return NextResponse.json({ error: "Missing sceneId or base64Image" }, { status: 400 });
    }

    // 1. Retrieve the Scene and verify project ownership
    const scene = await db.scene.findUnique({
      where: { id: sceneId },
      include: { project: true },
    });

    if (!scene) {
      return NextResponse.json({ error: "Scene not found" }, { status: 404 });
    }

    if (scene.project.userId !== user.id) {
      return NextResponse.json({ error: "Unauthorized access to project" }, { status: 403 });
    }

    const projectId = scene.projectId;

    // 2. Decode base64 image into binary buffer
    const buffer = Buffer.from(base64Image, "base64");

    // 3. Define output path in public folder: public/generated-images/[projectId]/[sceneId].png
    const publicDir = path.join(process.cwd(), "public");
    const outputFolder = path.join(publicDir, "generated-images", projectId);
    const outputFilename = `${sceneId}.png`;
    const outputPath = path.join(outputFolder, outputFilename);

    // Ensure the folder exists recursively
    fs.mkdirSync(outputFolder, { recursive: true });

    // Write binary buffer to file
    fs.writeFileSync(outputPath, buffer);

    const relativeUrl = `/generated-images/${projectId}/${outputFilename}`;

    // 4. Update the Scene image URL in DB
    const updatedScene = await db.scene.update({
      where: { id: sceneId },
      data: { imageUrl: relativeUrl },
    });

    // 5. Check if all scenes in this project now have an image
    const allScenes = await db.scene.findMany({
      where: { projectId },
    });

    const completedScenesCount = allScenes.filter((s) => s.imageUrl !== null).length;
    const isProjectFullyRendered = completedScenesCount === allScenes.length;

    // If fully rendered, transition the project status to FLOW_COMPLETE
    if (isProjectFullyRendered) {
      await db.project.update({
        where: { id: projectId },
        data: { status: "FLOW_COMPLETE" },
      });
    } else if (scene.project.status === "PROMPTS") {
      // Transition to FLOW_PENDING if we've started rendering some scenes
      await db.project.update({
        where: { id: projectId },
        data: { status: "FLOW_PENDING" },
      });
    }

    return NextResponse.json({
      success: true,
      imageUrl: relativeUrl,
      completedCount: completedScenesCount,
      totalCount: allScenes.length,
    });
  } catch (error: any) {
    console.error("Image upload/saving error:", error);
    return NextResponse.json({ error: "Internal server error: " + error.message }, { status: 500 });
  }
}
