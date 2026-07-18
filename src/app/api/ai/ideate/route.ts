import { NextResponse } from "next/server";
import { fetchWithRetry, getGitHubToken } from "@/utils/ai";

const GITHUB_MODELS_ENDPOINT =
  "https://models.github.ai/inference/chat/completions";

// How far back "recent" is allowed to reach for grounding videos.
const RECENCY_WINDOW_DAYS = 90;

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function truncateTranscript(text: string, maxWords = 25000): string {
  if (!text) return "";
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return text;
  
  const introWordCount = 15000;
  const outroWordCount = 10000;
  
  const intro = words.slice(0, introWordCount).join(" ");
  const outro = words.slice(words.length - outroWordCount).join(" ");
  
  return `${intro}\n\n...[Transcript middle sections truncated to stay within AI memory limits]...\n\n${outro}`;
}

async function fetchRealtimeYouTubeContext(query: string): Promise<string> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey || !query) return "";
  try {
    const publishedAfter = isoDaysAgo(RECENCY_WINDOW_DAYS);

    const searchRes = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(
        query,
      )}&type=video&maxResults=5&order=relevance&publishedAfter=${publishedAfter}&key=${apiKey}`,
      { 
        cache: "no-store",
        signal: AbortSignal.timeout(3000)
      },
    );
    const searchData = await searchRes.json();

    // If the recency-filtered search comes back empty, don't silently fall
    // back to unfiltered (potentially old) results — that would reintroduce
    // the stale-data problem. Instead report nothing and let the system
    // prompt handle the "no grounding available" case explicitly.
    if (!searchData.items || searchData.items.length === 0) return "";

    return searchData.items
      .map((item: any, i: number) => {
        const publishedAt = item.snippet?.publishedAt
          ? new Date(item.snippet.publishedAt).toISOString().split("T")[0]
          : "unknown date";
        return `Trending Reference Video ${i + 1}: "${item.snippet?.title}" by channel "${item.snippet?.channelTitle}" (published ${publishedAt})`;
      })
      .join("\n");
  } catch (e) {
    console.error("Failed to fetch real-time YouTube context for grounding", e);
    return "";
  }
}

export async function POST(request: Request) {
  try {
    const {
      topic,
      niche,
      duration,
      videoStyle,
      sourceText,
      framework = "stoic_explainer",
    } = await request.json();

    const GITHUB_TOKEN = getGitHubToken();

    if (!GITHUB_TOKEN) {
      return NextResponse.json(
        {
          error: "GitHub Models API token is missing in environment variables.",
        },
        { status: 500 },
      );
    }

    const styleDescriptions: Record<string, string> = {
      doodle:
        "minimalist 2D hand-drawn stick figure doodles (yellow fill, black outline, dot eyes, circular head, watercolor paper background)",
      "2d-cartoon":
        "vibrant, clean 2D cartoon animation style with bold outlines and flat colors",
      "2d-cinematic":
        "cinematic 2D illustration in beautiful anime/Studio Ghibli style with soft lighting and detailed scenery",
      "3d-pixar":
        "charming 3D stylized character render in Pixar/Disney style, with warm lighting and soft clay-like textures",
      "3d-realistic":
        "ultra-realistic 3D cinematic CGI render with dramatic lighting and detailed textures",
      "live-action":
        "photorealistic live action cinematic B-roll scene with realistic depth of field and natural lighting",
      historical:
        "oil painting or ancient historical art style matching the specific historical era",
      fantasy:
        "epic sci-fi or fantasy concept art style with glowing lighting effects and cosmic details",
      retro:
        "detailed pixel art style with vibrant colors and retro 16-bit gaming aesthetic",
      abstract:
        "artistic abstract illustration with soft shapes, glowing gradients, and metaphorical designs",
    };

    const chosenStyleDescription =
      styleDescriptions[videoStyle] || styleDescriptions.doodle;

    // Fetch live trending video titles on YouTube to ground the LLM
    const searchQuery = topic || niche || "AI and Technology";
    const realtimeContext = await fetchRealtimeYouTubeContext(searchQuery);

    // Anchor the model to an explicit "today" so it can reason about
    // recency instead of relying on its own (older) training cutoff.
    const currentDateStr = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    let inputContext = `Current Date: ${currentDateStr}
Topic/Concept: ${topic}
Niche: ${niche || "General"}
Target Duration: ${duration || "3-5 minutes"}
Visual Style: ${videoStyle || "Standard"} (Visual Description: ${chosenStyleDescription})
Selected Framework Key: ${framework}`;

    if (realtimeContext) {
      inputContext += `\n\nReal-time YouTube Search Grounding (actual videos published within the last ${RECENCY_WINDOW_DAYS} days on this topic, with publish dates):\n${realtimeContext}`;
    } else {
      inputContext += `\n\nReal-time YouTube Search Grounding: UNAVAILABLE for this request (no recent videos found or grounding could not be fetched). Do not invent or imply specific "currently trending" videos, creators, or statistics — write titles/hooks/outline using evergreen framing instead.`;
    }

    const cleanSourceText = sourceText ? truncateTranscript(sourceText) : "";

    if (cleanSourceText) {
      inputContext += `\n\nSource Material / Transcripts to extract and remix:\n${cleanSourceText}`;
    }

    const systemPrompt = `You are the lead YouTube strategist and scriptwriter for Eazi Studio.
Your goal is to generate high-converting, highly engaging YouTube video concepts.

Recency rules (critical):
- Treat the "Current Date" given in the input as authoritative — it may be more recent than your own knowledge cutoff.
- Only reference specific real-world events, statistics, videos, or trends as "current"/"trending" if they are explicitly provided to you in the "Real-time YouTube Search Grounding" section below. Never present your own recalled knowledge as up to date.
- If grounding is marked UNAVAILABLE, do not reference specific dates, named creators, or claimed-current statistics — favor evergreen, timeless phrasing instead of anything that could be stale or wrong.
- Titles, hooks, and visual cues should read as fresh and current in tone (avoid dated slang, old memes, or references to past years as if they were "now"), even when no live grounding data is available.

We support 10 distinct script frameworks. You must generate the outline beats matching the chosen framework key ("${framework}"):

1. "stoic_explainer" (Educational / Stoic Explainer):
   - hook: Promise-Solution-Proof.
   - bridge: "Guide, Not Guru" concept intro.
   - milestone (beatType: "concept_what"): Define the concept with 1 analogy (3-step analogy technique).
   - milestone (beatType: "concept_why"): Why the mind resists it (tension).
   - milestone (beatType: "concept_how"): Concrete 1-2 step practice.
   - milestone (beatType: "concept_story"): An illustrative anecdote.
   - cta: Hook-Curiosity-Action.

2. "narrative_documentary" (Narrative Documentary):
   - hook (beatType: "cold_open"): Factual cold open or climax preview.
   - bridge (beatType: "act_1_setup"): Context & stakes.
   - milestone (beatType: "act_2_complication"): 2-3 complications of escalating stakes.
   - milestone (beatType: "act_2_rehook"): Midpoint re-hook/attention reset.
   - milestone (beatType: "act_3_climax"): Climax/Turn.
   - milestone (beatType: "resolution"): New reality post-turn.
   - cta: lingering mystery CTA pointing to next video.

3. "viral_listicle" (Viral Listicle / Compilation):
   - hook: Context Lean -> Scroll Stop -> Contrarian Snapback.
   - bridge: criteria/stakes.
   - milestone (beatType: "list_item"): Countdown of items (Rehook breadcrumb at start of each item).
   - cta: next list CTA.

4. "case_study_breakdown" (Case Study / Analytical Breakdown):
   - hook: Question -> Preview.
   - bridge: 5-Line Core Setup (Situation & Desire).
   - milestone (beatType: "what_happened"): Factual timeline.
   - milestone (beatType: "why_mechanism"): Explaining the secret mechanism (Interactive Tension).
   - milestone (beatType: "what_to_apply"): Actionable viewer takeaway.
   - cta: Next case study CTA.

5. "shortform_hook_loop" (Short-Form Hook Loop under 60s):
   - hook (beatType: "instant_hook"): Shocking question hook.
   - milestone (beatType: "core_loop"): One main loop (Setup-Tension-Payoff).
   - cta (beatType: "loop_back"): closing line loops back to opening line.

6. "first_person_narrative" (First-Person Narrative / Personal Essay):
   - hook: Vulnerability to Authority hook.
   - bridge: Why sharing now / deeper emotional problem.
   - milestone (beatType: "vulnerable_beat"): trials & lowest point (Crisis).
   - milestone (beatType: "identity_shift"): identity shift payoff.
   - cta: reflective CTA.

7. "mythology_fable" (Mythology / Fable Narrative):
   - hook: Grand promise of the legend.
   - bridge: World-building.
   - milestone (beatType: "situation"): Situation of the myth.
   - milestone (beatType: "desire"): Desire of protagonist.
   - milestone (beatType: "conflict_trial"): The Trial (using but/therefore pacing).
   - milestone (beatType: "change"): Turning point.
   - milestone (beatType: "result"): Moral lesson.
   - cta: next fable CTA.

8. "contrarian_debunking" (Contrarian Debunking):
   - hook: Scroll Stop -> Contrarian Snapback.
   - bridge: Why the myth persists.
   - milestone (beatType: "myth_restate"): Sub-claim debunking (Evidence & Reframe).
   - cta: solution CTA.

9. "interactive_quiz" (Interactive Quiz / Q&A):
   - hook: Challenge viewer intelligence.
   - bridge: Rules & Stakes.
   - milestone (beatType: "question"): Pose question.
   - milestone (beatType: "pause"): Guess timer.
   - milestone (beatType: "reveal"): Reveal answer.
   - milestone (beatType: "explanation"): Snappy explanation.
   - cta: Level 2 quiz CTA.

10. "comparative_showdown" (Comparative Showdown / Versus):
    - hook: Contenders + stakes.
    - bridge: Selection criteria.
    - milestone (beatType: "criterion"): Round criterion.
    - milestone (beatType: "contender_a_case"): A's argument.
    - milestone (beatType: "contender_b_case"): B's argument.
    - milestone (beatType: "round_winner"): Round winner call.
    - milestone (beatType: "finalVerdict"): Final overall winner.
    - cta: next matchup CTA.

You MUST structure the outline beats matching the chosen framework.

Visual Cues Rule:
Every outline beat must contain a "visualCue" field. This is a one-line description of the B-roll/scene matching the selected style: ${chosenStyleDescription}. Do NOT output stickman descriptions unless the selected style is "doodle". Keep visual descriptions tailored strictly to this aesthetic.

You MUST output a strictly valid JSON object matching exactly this schema:
{
  "titleCandidates": [
    { "title": "CTR 98% Title Candidate", "score": 98 },
    { "title": "CTR 92% Title Candidate", "score": 92 },
    { "title": "CTR 85% Title Candidate", "score": 85 },
    { "title": "CTR 81% Title Candidate", "score": 81 },
    { "title": "CTR 76% Title Candidate", "score": 76 }
  ],
  "hookCandidates": [
    { "type": "bold_claim", "text": "Hook text option 1", "onScreenText": "CAPTION TEXT" },
    { "type": "scenario", "text": "Hook text option 2", "onScreenText": "CAPTION TEXT" },
    { "type": "contrarian", "text": "Hook text option 3", "onScreenText": "CAPTION TEXT" }
  ],
  "outline": [
    {
      "id": "beat-1",
      "section": "hook" | "bridge" | "milestone" | "cta",
      "beatType": "framework_specific_beat_type",
      "title": "Beat Title",
      "summary": "Brief summary of what this beat teaches/explains",
      "keyAnalogy": "Concrete metaphor or analogy (optional, else null)",
      "visualCue": "Scene drawing direction matching ${videoStyle} style",
      "estimatedSeconds": 15
    }
  ],
  "ctaPlan": {
    "primaryAsk": "subscribe" | "watch_next" | "comment" | "like",
    "scriptLine": "Final spoken call-to-action line"
  }
}

Title Formatting Conventions (apply real YouTube title patterns, not generic sentence-case titles):
- Selective ALL CAPS: capitalize ONE (occasionally two) high-impact word(s) per title for emphasis — e.g. the surprising word, the number, or the payoff word. Never cap the whole title. Example: "I Tried This for 30 Days and It Was INSANE" not "i tried this for 30 days and it was insane" and not "I TRIED THIS FOR 30 DAYS."
- Numerals over spelled-out numbers: "5 Habits" not "Five Habits".
- Brackets/parentheses for context tags where natural: "(Not What You Think)", "[Real Talk]", "(Explained Simply)" — use sparingly, at most one per title.
- Curiosity gap phrasing: withhold the payoff ("The Real Reason...", "Nobody Tells You This About...", "Why This Actually Works") rather than stating the full answer in the title.
- Colon subtitle structure is allowed for clarity: "Stoicism: The One Habit That Changes Everything".
- Power/emotion words used naturally (not stacked): Secret, Truth, Mistake, Nobody, Actually, Real, Finally — pick one angle, don't cram three into one title.
- Emojis: at most one, only if it reads naturally for the niche/style (e.g. faith or educational content should generally skip emojis entirely; use judgment based on the niche field).
- Vary the 5 candidates across DIFFERENT conventions above — don't apply the same formatting trick to all 5. At least one candidate should be a clean, no-gimmick title as a control/baseline.
- Do not overdo punctuation (no "!!!", no more than one "?" per title).

Important Rules:
1. Provide exactly 5 title candidates, each with an AI predicted CTR score (from 0 to 100).
2. Make title candidates highly viral and click-worthy, following the Title Formatting Conventions above.
3. Sort title candidates by score in descending order.
4. Do NOT wrap the JSON in markdown code blocks. Output raw JSON only.`;

    const response = await fetchWithRetry(GITHUB_MODELS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GITHUB_TOKEN}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: inputContext },
        ],
        temperature: 0.7,
        max_tokens: 4000,
        response_format: { type: "json_object" },
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("GitHub API Error:", errorText);
      return NextResponse.json(
        { error: `GitHub Models API error: ${response.status}` },
        { status: response.status },
      );
    }

    const data = await response.json();
    const rawText = data.choices?.[0]?.message?.content;

    if (!rawText) {
      return NextResponse.json(
        { error: "Empty response from AI." },
        { status: 500 },
      );
    }

    let parsedResult;
    try {
      parsedResult = JSON.parse(rawText);
    } catch (e) {
      const cleanText = rawText
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();
      parsedResult = JSON.parse(cleanText);
    }

    if (
      parsedResult.titleCandidates &&
      Array.isArray(parsedResult.titleCandidates)
    ) {
      parsedResult.titleCandidates.sort(
        (a: any, b: any) => (b.score || 0) - (a.score || 0),
      );
    }

    return NextResponse.json({ result: parsedResult });
  } catch (error: any) {
    console.error("AI Ideation Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 },
    );
  }
}
