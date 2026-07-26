import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/utils/db";
import { createClient } from "@/utils/supabase/server";
import { fetchWithRetry, getGitHubToken } from "@/utils/ai";

const GITHUB_MODELS_ENDPOINT = "https://models.github.ai/inference/chat/completions";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    if (!projectId) return NextResponse.json({ error: "projectId is required" }, { status: 400 });

    const project = await db.project.findUnique({
      where: { id: projectId },
      include: { metadata: true }
    });

    if (!project || project.userId !== user.id) {
      return NextResponse.json({ error: "Project not found or unauthorized" }, { status: 404 });
    }

    let thumbnailPrompt = "";
    let thumbnailConcepts = [];
    let selectedConceptId = null;

    if (project.brief) {
      try {
        const briefObj = JSON.parse(project.brief);
        thumbnailPrompt = briefObj.thumbnailPrompt || "";
        thumbnailConcepts = briefObj.thumbnailConcepts || [];
        selectedConceptId = briefObj.selectedConceptId || null;
      } catch (e) {}
    }

    return NextResponse.json({
      success: true,
      metadata: project.metadata ? {
        title: project.metadata.title,
        description: project.metadata.description,
        tags: project.metadata.tags,
        thumbnailPrompt,
        thumbnailConcepts,
        selectedConceptId
      } : null
    });

  } catch (err: any) {
    console.error("GET project metadata error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { projectId, regenerate = false } = await request.json();
    if (!projectId) return NextResponse.json({ error: "projectId is required" }, { status: 400 });

    const project = await db.project.findUnique({
      where: { id: projectId },
      include: { script: true, metadata: true, nichePreset: true }
    });

    if (!project || project.userId !== user.id) {
      return NextResponse.json({ error: "Project not found or unauthorized" }, { status: 404 });
    }

    // If metadata already exists and not regenerating, return it
    if (project.metadata && !regenerate) {
      let thumbnailPrompt = "";
      let thumbnailConcepts = [];
      let selectedConceptId = null;
      if (project.brief) {
        try {
          const briefObj = JSON.parse(project.brief);
          thumbnailPrompt = briefObj.thumbnailPrompt || "";
          thumbnailConcepts = briefObj.thumbnailConcepts || [];
          selectedConceptId = briefObj.selectedConceptId || null;
        } catch (e) {}
      }
      return NextResponse.json({
        success: true,
        metadata: {
          title: project.metadata.title,
          description: project.metadata.description,
          tags: project.metadata.tags,
          thumbnailPrompt,
          thumbnailConcepts,
          selectedConceptId
        }
      });
    }

    if (!project.script?.content) {
      return NextResponse.json({ error: "Script not found. Generate script first." }, { status: 400 });
    }

    // Resolve Niche Preset styling details & overrides
    let characterModifier = project.nichePreset?.characterModifier || "";
    let backgroundModifier = project.nichePreset?.backgroundModifier || "";
    let extraModifiersStr = project.nichePreset?.extraModifiers?.join(", ") || "";

    if (project.presetOverrides) {
      try {
        const overrides = typeof project.presetOverrides === "string"
          ? JSON.parse(project.presetOverrides)
          : project.presetOverrides;
        if (overrides.characterModifier) characterModifier = overrides.characterModifier;
        if (overrides.backgroundModifier) backgroundModifier = overrides.backgroundModifier;
        if (overrides.extraModifiers) {
          extraModifiersStr = Array.isArray(overrides.extraModifiers)
            ? overrides.extraModifiers.join(", ")
            : overrides.extraModifiers;
        }
      } catch (e) {}
    }

    let briefData: any = {};
    if (project.brief) {
      try {
        briefData = JSON.parse(project.brief);
      } catch (e) {}
    }

    const videoStyle = briefData.videoStyle || "doodle";

    const styleDescriptions: Record<string, string> = {
      doodle: "minimalist 2D hand-drawn stick figure doodles (black outline, watercolor paper background)",
      "2d-cartoon": "vibrant, clean 2D cartoon animation style with bold outlines and flat colors",
      "2d-cinematic": "cinematic 2D illustration in beautiful anime/Studio Ghibli style with soft lighting and detailed scenery",
      "3d-pixar": "charming 3D stylized character render in Pixar/Disney style, with warm lighting and soft clay-like textures",
      "3d-realistic": "ultra-realistic 3D cinematic CGI render with dramatic lighting and detailed textures",
      "live-action": "photorealistic live action cinematic B-roll scene with realistic depth of field and natural lighting",
      historical: "oil painting or ancient historical art style matching the specific historical era",
      fantasy: "epic sci-fi or fantasy concept art style with glowing lighting effects and cosmic details",
      retro: "detailed pixel art style with vibrant colors and retro 16-bit gaming aesthetic",
      abstract: "artistic abstract illustration with soft shapes, glowing gradients, and metaphorical designs",
    };

    const styleDesc = styleDescriptions[videoStyle] || styleDescriptions.doodle;

    // Compile dynamic outline beats representation
    const outlineText = briefData.outline?.map((beat: any, idx: number) => {
      return `Section ${idx + 1}: ${beat.title} (${beat.summary})`;
    }).join('\n') || '';
    const targetThumbnailConcept = briefData.targetThumbnailConcept || "";
    const targetThumbnailConceptPrompt = targetThumbnailConcept
      ? `A target thumbnail concept has been pre-planned for this video: "${targetThumbnailConcept}".
You MUST use this visual description and text overlay as the anchor for "concept_1". Design the visuals, textOverlay, and compiledPrompt for "concept_1" to align exactly with that visual promise to maintain narrative and visual consistency. For "concept_2" and "concept_3", you may generate alternative creative variations.`
      : `Look at the beginning of the video script (inside the [HOOK] section) for a comment starting with "// Target Thumbnail Concept:". If present, you MUST use this visual note description and text overlay as the anchor for "concept_1". Design the visuals, textOverlay, and compiledPrompt for "concept_1" to align exactly with that visual note to maintain narrative and visual consistency. For "concept_2" and "concept_3", you may generate alternative creative variations.`;

    const systemPrompt = `You are the Lead Creative Strategist for Eazi Studio, an automated YouTube video production platform. You have two combined areas of expertise: (1) a viral YouTube growth strategist who has studied thousands of top-performing thumbnails and titles across niches, and (2) a visual prompt engineer who writes precise, render-ready image prompts for AI generation tools (specifically Google Flow).

You will receive the video script, outline breakdown, and niche visual guides. Your job is to produce ONE JSON object matching the MetadataResponse schema exactly — nothing else.

====================================================================
INPUT STYLE CONSTRAINTS:
- characterModifier: "${characterModifier}"
- backgroundModifier: "${backgroundModifier}"
- extraModifiers: "${extraModifiersStr}"

You must treat characterModifier, backgroundModifier, and extraModifiers as non-negotiable style constraints. Every thumbnail concept's visuals and compiledPrompt MUST incorporate them faithfully. Never override or drop them.

====================================================================
CRITICAL RULE — THUMBNAIL VISUAL ANCHOR:
${targetThumbnailConceptPrompt}

====================================================================
OUTPUT JSON SCHEMA:
{
  "titles": ["title 1", "title 2", "title 3"],
  "description": "YouTube video description text with timestamps...",
  "tags": ["keyword1", "keyword2", "keyword3"],
  "thumbnailConcepts": [
    {
      "id": "concept_1",
      "angle": "Psychological hook angle (e.g. Contrarian, Urgency, Curiosity Gap)",
      "stylePresetId": "one of: bold_text_overlay, arrow_callout, curiosity_gap, face_reaction, before_after, minimalist_clean, collage_montage, illustrated_graphic, number_stat_driven",
      "textOverlay": {
        "subText": "Max 3 words, supporting context (e.g. 'THIS IS', 'HOW TO', 'GOD CALLS IT')",
        "mainText": "Max 2 words, ALL CAPS, high-impact hook word (e.g. 'A LIE', 'SIN', 'RICH')",
        "stylePreset": "one of: RED_BACKGROUND_BOX, YELLOW_TEXT, WHITE_TEXT_BLACK_SHADOW, OUTLINE_SLANTED",
        "position": "one of: left_side, right_side, top_center"
      },
      "visuals": {
        "subject": "Visual description of the main character/element, weaving in characterModifier",
        "background": "Background composition setting, weaving in backgroundModifier",
        "accent": "one of: NONE, RED_ARROW_POINTING_TO_CHARACTER, RED_ARROW_POINTING_TO_OBJECT, GOLDEN_GLOW_HALO, WARNING_SIGN_STOP"
      },
      "compiledPrompt": "A single flowing comma-separated visual prompt for Imagen 3/Google Flow, roughly 60-95 words, specifying videoStyle (${videoStyle}), subject, background, and lighting. You MUST include a clear instruction to render the text overlay directly inside the image, specifying the exact text overlay (both subText and mainText combined) in quotes and its visual style (e.g., 'featuring a large bold ALL-CAPS text overlay on the left side that reads \"THIS IS A LIE\" in heavy impact font with \"LIE\" highlighted in a red box background'). This guarantees the generated image has the text drawn directly in it."
    }
  ]
}

Thumbnail concept rules:
- Generate exactly 3 thumbnailConcepts, each using a DIFFERENT psychological angle and stylePresetId.
- textOverlay word count is strictly constrained: subText + mainText <= 5 words total.
- Keep output raw JSON only, no markdown code blocks.`;

    const userPrompt = `Project Title: ${project.title}
Niche: ${project.niche || "General"}
Visual Style: ${videoStyle} (${styleDesc})

OUTLINE SECTIONS:
${outlineText}

FULL VIDEO SCRIPT:
${project.script.content}`;

    const GITHUB_TOKEN = getGitHubToken();
    if (!GITHUB_TOKEN) {
      return NextResponse.json({ error: "GitHub Models Token missing." }, { status: 500 });
    }

    const aiResponse = await fetchWithRetry(GITHUB_MODELS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GITHUB_TOKEN}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        response_format: { type: "json_object" },
      }),
      cache: "no-store"
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("Metadata Generation API error:", errorText);
      return NextResponse.json({ error: `AI metadata generation failed: ${aiResponse.status}` }, { status: 502 });
    }

    const aiData = await aiResponse.json();
    const responseText = aiData.choices?.[0]?.message?.content;
    if (!responseText) {
      return NextResponse.json({ error: "AI returned empty metadata response." }, { status: 500 });
    }

    let parsed: any;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      const clean = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(clean);
    }

    const titles = parsed.titles || [project.title];
    const mainTitle = titles[0] || project.title;
    const description = parsed.description || "";
    const tags = parsed.tags || [];
    
    // Process and enrich generated thumbnailConcepts
    const thumbnailConcepts = (parsed.thumbnailConcepts || parsed.thumbnail_concepts || []).map((concept: any, idx: number) => {
      return {
        id: concept.id || `concept_${idx + 1}`,
        angle: concept.angle || "Visual Concept",
        stylePresetId: concept.stylePresetId || concept.style_preset_id || "bold_text_overlay",
        textOverlay: {
          subText: concept.textOverlay?.subText || concept.text_overlay?.sub_text || "",
          mainText: concept.textOverlay?.mainText || concept.text_overlay?.main_text || "",
          stylePreset: concept.textOverlay?.stylePreset || concept.text_overlay?.style_preset || "RED_BACKGROUND_BOX",
          position: concept.textOverlay?.position || concept.text_overlay?.position || "left_side"
        },
        visuals: {
          subject: concept.visuals?.subject || "",
          background: concept.visuals?.background || "",
          accent: concept.visuals?.accent || "NONE"
        },
        compiledPrompt: concept.compiledPrompt || concept.compiled_prompt || "",
        imageUrl: null
      };
    });

    const activeConceptId = thumbnailConcepts[0]?.id || "concept_1";

    // 1. Upsert VideoMetadata row
    await db.videoMetadata.upsert({
      where: { projectId },
      update: {
        title: mainTitle,
        description,
        tags,
      },
      create: {
        projectId,
        title: mainTitle,
        description,
        tags,
      }
    });

    // 2. Save structured thumbnailConcepts & metadata into project.brief JSON object
    const updatedBrief = {
      ...briefData,
      thumbnailConcepts,
      selectedConceptId: activeConceptId,
      thumbnailPrompt: thumbnailConcepts[0]?.compiledPrompt || "",
      metadataTitles: titles
    };

    await db.project.update({
      where: { id: projectId },
      data: {
        brief: JSON.stringify(updatedBrief),
        status: "METADATA"
      }
    });

    return NextResponse.json({
      success: true,
      metadata: {
        title: mainTitle,
        description,
        tags,
        thumbnailPrompt: thumbnailConcepts[0]?.compiledPrompt || "",
        thumbnailConcepts,
        selectedConceptId: activeConceptId,
        allTitles: titles
      }
    });

  } catch (err: any) {
    console.error("POST metadata generation error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { projectId, title, description, tags, thumbnailPrompt, thumbnailConcepts, selectedConceptId } = await request.json();
    if (!projectId) return NextResponse.json({ error: "projectId is required" }, { status: 400 });

    const project = await db.project.findUnique({
      where: { id: projectId }
    });

    if (!project || project.userId !== user.id) {
      return NextResponse.json({ error: "Project not found or unauthorized" }, { status: 404 });
    }

    // 1. Update VideoMetadata
    if (title || description || tags) {
      await db.videoMetadata.upsert({
        where: { projectId },
        update: {
          title,
          description,
          tags,
        },
        create: {
          projectId,
          title: title || project.title,
          description: description || "",
          tags: tags || [],
        }
      });
    }

    // 2. Update brief JSON
    let briefData: any = {};
    if (project.brief) {
      try { briefData = JSON.parse(project.brief); } catch {}
    }
    const updatedBrief = {
      ...briefData,
      thumbnailPrompt: thumbnailPrompt !== undefined ? thumbnailPrompt : briefData.thumbnailPrompt,
      thumbnailConcepts: thumbnailConcepts !== undefined ? thumbnailConcepts : briefData.thumbnailConcepts,
      selectedConceptId: selectedConceptId !== undefined ? selectedConceptId : briefData.selectedConceptId
    };

    // If active concept changed, update the active metadata thumbnailUrl to that concept's image
    if (selectedConceptId) {
      const activeConcept = updatedBrief.thumbnailConcepts?.find((c: any) => c.id === selectedConceptId);
      if (activeConcept?.imageUrl) {
        await db.videoMetadata.update({
          where: { projectId },
          data: { thumbnailUrl: activeConcept.imageUrl }
        });
      }
    }

    await db.project.update({
      where: { id: projectId },
      data: {
        brief: JSON.stringify(updatedBrief),
        status: "DONE"
      }
    });

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error("PUT project metadata error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
