import { NextResponse, type NextRequest } from 'next/server';
import { fetchWithRetry, getGitHubToken } from '@/utils/ai';
import { db } from '@/utils/db';
import { createClient } from '@/utils/supabase/server';

const GITHUB_MODELS_ENDPOINT = 'https://models.github.ai/inference/chat/completions';

const FRAMEWORK_PROMPTS: Record<string, string> = {
  stoic_explainer: `Structure the body to align with the Hero's Journey beats in this fixed order — STATUS_QUO (Hook), CALL_TO_ADVENTURE (Bridge), TRIALS_WHAT (Concept Definition), TRIALS_HOW (The Practice), CRISIS_STORY (Vulnerable Turning Point), and REWARD_NEW_STATUS_QUO (CTA). Do not reorder or merge them.
Rules:
1. STATUS_QUO must establish a modern, relatable struggle.
2. CALL_TO_ADVENTURE must name the deeper emotional struggle (e.g., perfectionism, ego, fear).
3. TRIALS_WHAT must include exactly one analogy using the 3-step technique (name the abstract idea → map to a concrete image → return with new clarity).
4. TRIALS_HOW must contain at most 2 discrete action steps. Do not present a checklist longer than 2 items.
5. CRISIS_STORY must be told in first-person scene (specific moment, sensory detail) showcasing a personal setback or moment of vulnerability — not summarized as a dry lesson. Do not append an explicit "the moral of this is..." line.
6. Connect every milestone to the next using "but" or "therefore" — never "and then".`,

  narrative_documentary: `Structure the body as a 3-act Hero's Journey macro-structure, not flat milestone loops: DISRUPTION (Cold Open), STATUS_QUO (Act 1 Setup), TRIALS (Act 2 Complications + Midpoint Re-hook), CRISIS (Act 3 Climax/Turn), and REWARD (Resolution).
Rules:
1. DISRUPTION must open with a Cold Open beat — a moment from later in the story, or a striking factual claim — before any orienting context. Do not begin with standard scene-setting.
2. STATUS_QUO must establish who/what/where and the stakes (Situation + Desire of the 5-Line Core).
3. TRIALS must feature 2-3 complications where each milestone's stakes are strictly greater than the previous one. Raise the stakes explicitly.
4. Insert one re-hook breadcrumb at the Act 2 midpoint (~45-55% through the body): state a new unresolved question.
5. CRISIS must be the decisive moment of turn/climax where things go sideways or the ultimate conflict is resolved.
6. Ground all claims in the brief's source material only.
7. Every beat needs a richly specific visualCue.`,

  viral_listicle: `Structure the body as N repeated item blocks in countdown or build order. Integrate the Hero's Journey: QUEST_TEASE (Hook), RULES (Bridge), TRIALS_ITEM (Countdown items), CRISIS_TWIST (a mid-list personal failure or unexpected setback), REWARD_ITEM_1 (the ultimate item), and NEW_STATUS_QUO (CTA).
Rules:
1. QUEST_TEASE must plant a specific, nameless tease pointing at the #1 item ("and #3 might be the one you didn't expect"). Do not resolve this tease early.
2. TRIALS_ITEM blocks must stay brisk: Reveal → Detail → Payoff. Cap each item at 120–180 words.
3. CRISIS_TWIST must feature a mid-list item where the narrator reveals a vulnerable mistake, failure, or major setback they personally faced, showing how it broke their original assumptions.
4. REWARD_ITEM_1 must contain the single most surprising, valuable, or counter-intuitive entry.
5. Do not add a CTA after every item — only after the final one.`,

  case_study_breakdown: `Structure the body as a strict 3-part Hero's Journey macro-shape: TRIALS_WHAT_HAPPENED (The Quest), CRISIS_MECHANISM (The Ordeal / why it worked/failed), and REWARD_APPLY (The Elixir / what you can apply).
Rules:
1. Include at least 3 concrete specifics (numbers, named entities, dates) drawn only from the brief's source material.
2. TRIALS_WHAT_HAPPENED must outline the chronological steps and initial hurdles.
3. CRISIS_MECHANISM must target the pivot point where conventional wisdom failed, explaining the deeper psychological or analytical reason behind the success/failure.
4. REWARD_APPLY must translate the mechanism into an action the average viewer could realistically take — not a scaled-down version of what only a massive brand/subject could do.
5. Name the underlying mechanism explicitly in one sentence before moving into application ("what actually happened here wasn't X, it was Y").`,

  shortform_hook_loop: `Structure the body as exactly ONE Setup-Tension-Payoff loop mapping to STATUS_QUO_HOOK, TRIALS_TENSION, and REWARD_LOOP. Do not generate multiple milestones.
Rules:
1. Hard cap: 120-150 words total across the entire script.
2. No greeting, no channel reference, no "in this video" framing of any kind.
3. TRIALS_TENSION must feature a single quick complication or obstacle.
4. REWARD_LOOP must provide the resolution and end with a line that structurally echoes the opening line (repeat a key phrase or image) so the video loops seamlessly on replay.
5. Do not include a spoken subscribe/follow CTA.
6. Every beat of visualCue must specify a cut or visual change at least every 1-2 seconds.`,

  first_person_narrative: `Structure the body strictly as a first-person Hero's Journey: STATUS_QUO (Hook), CALL_TO_ADVENTURE (Bridge), TRIALS_MILESTONE (Chronological hurdles), CRISIS_DEFEAT (Lowest point / Ordeal), and REWARD_TRANSFORMATION (The lesson/elixir).
Rules:
1. Each milestone must include at least one specific sensory or emotional detail (a place, a physical sensation, an exact phrase someone said).
2. Do not moralize or lecture. Reflect on what was learned.
3. CRISIS_DEFEAT must be the absolute lowest emotional or technical point, exposing real vulnerability where the narrator failed.
4. REWARD_TRANSFORMATION must show a visible internal change: the narrator's understanding or emotional state at the final milestone must be demonstrably different from the hook.
5. CTA must invite reflection or comment ("have you felt this too?").`,

  mythology_fable: `Structure the body strictly as the 5-Line Core aligned with the Hero's Journey: STATUS_QUO (Situation), CALL_TO_ADVENTURE (Desire), TRIALS_ROAD (Conflict/Trials), CRISIS_ORDEAL (Change/Turning Point), REWARD_RESULT (Result), and MORAL_RETURN (Return with Elixir).
Rules:
1. Preserve factual/narrative fidelity to the source story — do not invent plot events or outcomes not present in it.
2. Do not fabricate direct quotes.
3. CRISIS_ORDEAL must be the climax of the story, highlighting the peak of testing or confrontation.
4. MORAL_RETURN must explicitly connect the story's resolution to a specific modern situation the viewer might face today.
5. Narrator voice: slightly elevated and storytelling in register, but conversational — "Guide, Not Guru" framing.`,

  contrarian_debunking: `Structure the body as a Hero's Journey: STATUS_QUO_MYTH, CALL_TO_ADVENTURE_BRIDGE, TRIALS_EVIDENCE_LOOP (Evidence loops), CRISIS_REBUTTAL (Dismantling the core premise), and REWARD_REFRAME (The corrected truth).
Rules:
1. Every debunking claim must be grounded in the brief's source material.
2. STATUS_QUO_MYTH must state the popular belief fully and fairly before challenging it.
3. CRISIS_REBUTTAL must be the definitive argument that completely breaks down the core premise of the myth.
4. REWARD_REFRAME must offer a constructive corrected understanding — never end on pure negation.
5. If evidence is contested or partial, say so explicitly.`,

  interactive_quiz: `Structure the body as N Question Rounds: STATUS_QUO_CHALLENGE (Hook), RULES_BRIDGE, TRIALS_QUESTION (Rounds 1 to N-1), CRISIS_ORDEAL_QUESTION (The final, hardest, most counter-intuitive round), and REWARD_WRAP (Score & Core Insight).
Rules:
1. The PAUSE beat is mandatory and must include a visualCue specifying an on-screen timer/countdown graphic.
2. TRIALS_QUESTION rounds must escalate in difficulty.
3. CRISIS_ORDEAL_QUESTION must be the hardest round, targetting a common misconception or deep blind spot that shatters typical viewer assumptions.
4. Cap each EXPLANATION beat at 40-60 words to keep pacing snappy.
5. Do not write "trick" questions.`,

  comparative_showdown: `Structure the body as N Rounds: STATUS_QUO_CONTENDERS (Hook), CRITERIA_BRIDGE, TRIALS_ROUND (Rounds 1 to N-1), CRISIS_UPSET_ROUND (The Upset round), and REWARD_VERDICT (Final verdict).
Rules:
1. State all criteria in the Bridge before Round 1.
2. Apply criteria consistently across contenders.
3. CRISIS_UPSET_ROUND is mandatory: include at least one round where the expected favorite loses to create narrative tension.
4. Cap each contender's case within a round at 60-90 words.
5. REWARD_VERDICT must transparently total the round wins.`
};

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId, regenerate = false, styleOverrides = {} } = await request.json();

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    const project = await db.project.findUnique({
      where: { id: projectId },
      include: { script: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (project.userId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized project access' }, { status: 403 });
    }

    if (project.script && !regenerate) {
      return NextResponse.json({ error: 'Script already exists. Pass regenerate: true to overwrite.' }, { status: 409 });
    }

    if (!project.brief) {
      return NextResponse.json({ error: 'Project brief is missing. Run ideation first.' }, { status: 422 });
    }

    let briefData;
    try {
      briefData = JSON.parse(project.brief);
    } catch (e) {
      return NextResponse.json({ error: 'Invalid project brief format in database.' }, { status: 422 });
    }

    // Fetch user channel profile for personalized tone & target avatar alignment
    const userProfile = await db.channelProfile.findUnique({
      where: { userId: user.id },
    }).catch(() => null);

    // Query 2-3 past completed project titles for universe building context
    const pastProjects = await db.project.findMany({
      where: {
        userId: user.id,
        status: 'DONE',
        NOT: { id: projectId }
      },
      take: 3,
      orderBy: { createdAt: 'desc' },
      select: { title: true }
    }).catch(() => []);

    const pastProjectsList = pastProjects.length > 0
      ? pastProjects.map((p, idx) => `${idx + 1}. "${p.title}"`).join('\n')
      : 'None (this is the first video on the channel).';

    const frameworkKey = briefData.framework || 'stoic_explainer';
    const frameworkRulePrompt = FRAMEWORK_PROMPTS[frameworkKey] || FRAMEWORK_PROMPTS.stoic_explainer;

    const personaTone = userProfile?.toneOfVoice || briefData.toneNotes || 'Warm, direct, relatable, conversational';
    const targetAvatar = userProfile?.audienceAvatar || briefData.targetAudience || 'General curious viewer';
    const contentNiche = userProfile?.niche || project.niche || 'General';
    const tone = styleOverrides.tone || personaTone;

    // Parse duration from the saved brief (e.g. "8-10 mins", "5 mins", "10-15 mins")
    const parseDurationToMinutes = (durationStr: string): number => {
      if (!durationStr) return 10;
      const matches = durationStr.match(/(\d+)/g);
      if (!matches) return 10;
      const nums = matches.map(Number);
      return Math.max(...nums);
    };

    const briefDuration = briefData.duration || '';
    const targetLength = styleOverrides.targetLengthMinutes || parseDurationToMinutes(briefDuration);

    // Scale max_tokens: ~150 words/min spoken, ~1.3 tokens/word = ~195 tokens/min. Add 20% headroom.
    const tokensForLength = Math.round(targetLength * 195 * 1.2);
    const maxTokens = Math.min(Math.max(tokensForLength, 3000), 8000);

    // Compile the outline beats text representation
    const outlineText = briefData.outline?.map((beat: any, idx: number) => {
      return `Beat ${idx + 1}:
- Section: ${beat.section}
- Beat Type: ${beat.beatType || 'N/A'}
- Title: ${beat.title}
- Summary: ${beat.summary}
- Metaphor/Analogy: ${beat.keyAnalogy || 'None'}
- Visual Direction: ${beat.visualCue || 'None'}
- Est. Duration: ${beat.estimatedSeconds}s`;
    }).join('\n\n') || 'No outline beats provided.';

    let keyPointsText = "";
    if (briefData.sourceSummaries && Array.isArray(briefData.sourceSummaries) && briefData.sourceSummaries.length > 0) {
      keyPointsText = `SOURCE MATERIAL KEY TAKEAWAYS & TEACHINGS:
${briefData.sourceSummaries.map((s: any, idx: number) => {
  const teachingsTitle = s.keyTeachingsTitle || "Key Teachings";
  const teachings = s.keyTeachings && Array.isArray(s.keyTeachings) && s.keyTeachings.length > 0
    ? s.keyTeachings.map((t: any, tIdx: number) => 
        `${tIdx + 1}. ${t.topic || 'N/A'}:\n   - Core Concept: ${t.description || 'N/A'}\n   - Actionable Advice: ${t.actionableAdvice || 'N/A'}`
      ).join('\n')
    : "- No key teachings listed.";
  const conclusion = s.conclusion ? `Conclusion/Warning: ${s.conclusion}` : "";
  
  return `Video ${idx + 1} ("${s.title}"):
Summary: ${s.summary || 'N/A'}
${teachingsTitle}:
${teachings}
${conclusion}`;
}).join('\n\n')}\n\n`;
    }

    const competitorChannels = Array.isArray(userProfile?.topCompetitorChannels)
      ? userProfile.topCompetitorChannels.join(', ')
      : (userProfile?.topCompetitorChannels ? String(userProfile.topCompetitorChannels) : '');

    const systemPrompt = `You are the lead YouTube scriptwriter for Eazi Studio.
Your task is to write a complete, high-retention video script based on the outline brief, reference source teachings, and creator persona.

CREATOR & AVATAR ALIGNMENT:
- Channel Niche: ${contentNiche}
- Target Audience Avatar: ${targetAvatar}
- Tone & Voice Register: ${tone}
- Top Niche Competitors / Role Model Channels: ${competitorChannels || 'Top Niche Creators'}

CRITICAL RULE — TOP CREATOR BENCHMARK & GAP EXPLOITATION:
Target Top Creators in your Niche: ${competitorChannels || 'Industry Top Creators'}
1. Style Calibration: Benchmark against the high-retention hook mechanics and narrative visual pacing of these top creators (${competitorChannels || 'niche leaders'}).
2. Competitor Gap Analysis: Analyze what these top creators (${competitorChannels || 'top creators'}) typically lack or struggle with in their videos (e.g., being overly academic, dry delivery, slow mid-video pacing, superficial advice, or corporate emotional distance).
3. Script Superiority Strategy: Write this script to EXPLOIT their gaps. Adopt their best visual pacing and hook strengths, BUT surpass them by delivering:
   - Deeper, more authentic emotional resonance (relatable human vulnerability).
   - Dynamic staccato sentence rhythm that moves faster and holds viewer attention tighter.
   - Clearer, high-contrast everyday metaphors that make complex ideas instantly click.

CRITICAL RULE — DUAL-LAYER STORYTELLING:
Every script must operate on TWO levels:
1. Surface Topic: The technical concept / tutorial / topic.
2. Deeper Emotional Struggle: The underlying human mindset or emotional challenge (e.g. fear of perfectionism, patience, fear of poverty, consistency). Connect the technical advice to this deeper emotional transformation.

CRITICAL RULE — SPOKEN SENTENCE RHYTHM & "BUT/THEREFORE" PACING:
1. No "And Then" Connections: Connect narrative beats using "BUT" (introducing a roadblock/conflict) or "THEREFORE" (showing consequence/result). Never write a linear list of "and then this happens".
2. Sentence Rhythm Variation: Vary sentence lengths dramatically. Mix short 3-5 word staccato sentences with medium and longer sentences for dynamic spoken cadence.
3. Gradual Complexity Ramp (0 to 100): Start with clear, accessible context before escalating into advanced concepts.
4. Interactive Co-Discovery: Pose challenges and hints so the viewer mentally engages ("ask the viewer to figure it out").

CRITICAL RULE — NARRATIVE UNIVERSE BUILDING:
For channel universe consistency, look at the past videos listed in the user prompt. When writing the script, find a place (e.g., in the bridge, during trials, or the crisis) to make a subtle, organic callback to one of these previous topics/lessons to encourage channel-wide binge-watching. Do not make it feel forced.

CRITICAL RULE — INTERNAL EDITORIAL ROAST (SELF-CRITIQUE):
Before generating the script paragraphs, perform a silent critique of the outline brief. Identify any areas that are dry, linear, or lack tension. When drafting, proactively correct these areas by introducing conflicts, visual changes, or emotional transitions to maximize viewer retention.

CRITICAL RULE — TARGET THUMBNAIL VISUAL NOTE:
At the very beginning of the script, inside the [HOOK] section, you MUST output a single-line visual note comment formatting: "// Target Thumbnail Concept: <Visual description of the high-converting thumbnail graphic matching this video topic, including any text overlay in quotes>". This comment will be parsed by our image rendering pipeline, so keep it strictly on a single line starting with "// Target Thumbnail Concept:".

CRITICAL RULE — SOURCE INTEGRATION (NO CITATIONS):
- Explicitly incorporate the specific insights, teachings, and examples from the source material.
- NEVER mention source video titles, channel names, or speaker names. Present all ideas organically as the narrator's direct voice.

FRAMEWORK SPECIFIC RULES (Key: ${frameworkKey}):
${frameworkRulePrompt}

OUTPUT FORMAT:
Provide the full script text. Separate major sections using capital headers in brackets: [HOOK], [BRIDGE], [BODY], and [CTA] or [MILESTONES]. Do NOT output any markdown comments, formatting notes, or metadata. Output ONLY the spoken narration text (except for the required "// Target Thumbnail Concept" comment line in [HOOK]).`;

    const userPrompt = `Project Title: ${project.title}
Niche: ${contentNiche}
Target Audience Avatar: ${targetAvatar}
Tone Override: ${tone}
Top Competitor Channels to Outperform: ${competitorChannels || 'Top Niche Creators'}
Target Length: ${targetLength} minutes (IMPORTANT: write enough content to fill ${targetLength} full minutes of spoken narration — approximately ${Math.round(targetLength * 150)} words minimum)

PAST VIDEOS ON THIS CHANNEL (FOR UNIVERSE CALLBACKS):
${pastProjectsList}

${keyPointsText}OUTLINE BRIEF:
${outlineText}

CTA PLAN:
Primary Ask: ${briefData.ctaPlan?.primaryAsk || 'watch_next'}
Script Line Reference: ${briefData.ctaPlan?.scriptLine || 'Watch the next video.'}

FINAL INSTRUCTION: Write the complete spoken script now using the Competitor Gap Exploitation strategy, "But/Therefore" transition logic, spoken sentence rhythm, 0-to-100 complexity ramping, and dual-layer emotional storytelling.`;

    const GITHUB_TOKEN = getGitHubToken();
    if (!GITHUB_TOKEN) {
      return NextResponse.json({ error: 'GitHub Models token is missing on the server.' }, { status: 500 });
    }

    const aiResponse = await fetchWithRetry(GITHUB_MODELS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: maxTokens,
      }),
      cache: 'no-store'
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('GitHub API error during script generation:', errorText);
      return NextResponse.json({ error: `AI generator failed with status: ${aiResponse.status}` }, { status: 502 });
    }

    const responseData = await aiResponse.json();
    const scriptContent = responseData.choices?.[0]?.message?.content;

    if (!scriptContent) {
      return NextResponse.json({ error: 'Empty script returned by the AI model.' }, { status: 500 });
    }

    let cleanedScript = scriptContent;
    let targetThumbnailConcept = "";

    const thumbnailRegex = /\/\/\s*Target\s+Thumbnail\s+Concept:\s*(.*)/i;
    const match = scriptContent.match(thumbnailRegex);
    if (match) {
      targetThumbnailConcept = match[1].trim();
      // Remove this line and clean up empty lines
      cleanedScript = scriptContent.replace(thumbnailRegex, "").replace(/^\s*[\r\n]/gm, "\n").trim();
    }

    // Save targetThumbnailConcept to project brief JSON
    if (targetThumbnailConcept) {
      briefData.targetThumbnailConcept = targetThumbnailConcept;
      await db.project.update({
        where: { id: projectId },
        data: {
          brief: JSON.stringify(briefData)
        }
      });
    }

    // Upsert the Script row with cleaned script
    const script = await db.script.upsert({
      where: { projectId },
      update: {
        content: cleanedScript,
        version: { increment: 1 }
      },
      create: {
        projectId,
        content: cleanedScript,
        version: 1
      }
    });

    // Advance project status to SCRIPT
    await db.project.update({
      where: { id: projectId },
      data: { status: 'SCRIPT' }
    });

    return NextResponse.json({ success: true, script });

  } catch (error: any) {
    console.error('Generate script error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
