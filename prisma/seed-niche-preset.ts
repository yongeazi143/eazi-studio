/**
 * Seed script: creates the "Eazi Faith - Purity Doodle" NichePreset.
 *
 * Usage:
 *   npx tsx prisma/seed-niche-preset.ts <userId>
 *   # or set USER_ID env var:
 *   USER_ID=clxxxxx npx tsx prisma/seed-niche-preset.ts
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const userId = process.argv[2] || process.env.USER_ID;

  if (!userId) {
    console.error("ERROR: provide a userId as the first argument or via USER_ID env var.");
    console.error("  npx tsx prisma/seed-niche-preset.ts clxxxxxxxx");
    process.exit(1);
  }

  const presetData = {
    userId,
    name: "Eazi Faith - Purity Doodle",
    niche: "Faith / Motivational",
    videoStyle: "doodle",
    characterModifier:
      "simple clean stick figure character, round white head, a few thin strands of hair on top, single line stick body, wearing a solid black necktie",
    backgroundModifier:
      "soft very light charcoal-gray paper textured background, close to off-white, with a subtle vignette and gentle studio lighting",
    textOverlayEnabled: true,
    extraModifiers: [],
  };

  // Upsert: identify by userId + name
  const existing = await db.nichePreset.findFirst({
    where: { userId, name: presetData.name },
  });

  if (existing) {
    await db.nichePreset.update({
      where: { id: existing.id },
      data: presetData,
    });
    console.log(`✓ Updated existing preset "${presetData.name}" (id: ${existing.id})`);
  } else {
    const created = await db.nichePreset.create({ data: presetData });
    console.log(`✓ Created preset "${presetData.name}" (id: ${created.id})`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
