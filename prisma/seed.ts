import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const opsPassword = await bcrypt.hash("ivay-ops-dev", 12);
  await prisma.user.upsert({
    where: { email: "ops@ivay.tech" },
    update: {},
    create: { email: "ops@ivay.tech", passwordHash: opsPassword, role: "OPS" },
  });

  const account = await prisma.account.upsert({
    where: { id: "demo-account" },
    update: {},
    create: {
      id: "demo-account",
      name: "Demo Client Co.",
      notifyEmail: "reports@democlient.test",
    },
  });

  const clientPassword = await bcrypt.hash("ivay-client-dev", 12);
  await prisma.user.upsert({
    where: { email: "client@democlient.test" },
    update: {},
    create: {
      email: "client@democlient.test",
      passwordHash: clientPassword,
      role: "CLIENT",
      accountId: account.id,
    },
  });

  // Kept as a spare demo record for the Numbers page -- not assigned to
  // either campaign below. Both campaigns place calls through the telephony
  // backend's own default outbound number now (see lib/telephony/bland.ts);
  // this Twilio number turned out to be a trial account, which forces a
  // mandatory disclaimer onto every call and isn't fixable in code.
  await prisma.phoneNumber.upsert({
    where: { number: "+15005550006" },
    update: {},
    create: { number: "+15005550006", region: "US-East", trunkName: "dev-trunk", accountId: account.id },
  });

  const enBotConfig = await prisma.botConfig.upsert({
    where: { id: "demo-bot-config-en" },
    update: {},
    create: {
      id: "demo-bot-config-en",
      name: "English Outreach Agent",
      provider: "IVAY_VOICE",
      config: {
        language: "en-US",
        voice: "Karen",
        voiceName: "Karen",
        firstSentence: "Hi, this is Ivay calling — do you have a quick moment?",
        task: "You are calling on behalf of Ivay, a voice AI company, to introduce our services and see if they would be a good fit for the person you are calling. Be warm, brief, and conversational. Ask if they have a moment to chat, and if so, briefly explain what Ivay does and ask a qualifying question about their needs.",
      },
    },
  });

  // Voice is a clone of a real German speaker (ivay's own sample), built via
  // Bland's /v1/voices/clone -- this id is specific to ivay's Bland account
  // voice library, not a generic catalog entry. "de" (not "de-DE") is the
  // language code Bland's API actually accepts for German.
  const deBotConfig = await prisma.botConfig.upsert({
    where: { id: "demo-bot-config-de" },
    update: {},
    create: {
      id: "demo-bot-config-de",
      name: "German Outreach Agent",
      provider: "IVAY_VOICE",
      config: {
        language: "de",
        voice: "6a7ae0e5-bb97-423f-9b3c-43dae315a7be",
        voiceName: "Stefanie (cloned)",
        firstSentence: "Hallo... hier ist Stefanie von Ivay. Haben Sie kurz... einen Moment Zeit?",
        task: "Du rufst im Auftrag von Ivay an, einem Voice-AI-Unternehmen, um unsere Dienstleistungen vorzustellen. Sprich langsam, ruhig und in einem natuerlichen Gespraechston -- mit kurzen Pausen zwischen den Gedanken, so wie ein Mensch am Telefon sprechen wuerde, nicht hastig oder abgehackt. Verwende kurze Saetze mit natuerlichen Sprechpausen. Frage, ob gerade Zeit fuer ein kurzes Gespraech ist, und erklaere dann in Ruhe, was Ivay macht.",
      },
    },
  });

  const enCampaign = await prisma.campaign.upsert({
    where: { id: "demo-campaign" },
    update: {},
    create: {
      id: "demo-campaign",
      accountId: account.id,
      name: "Spring Outreach (English)",
      maxConcurrent: 3,
      botConfigId: enBotConfig.id,
    },
  });

  const deCampaign = await prisma.campaign.upsert({
    where: { id: "demo-campaign-de" },
    update: {},
    create: {
      id: "demo-campaign-de",
      accountId: account.id,
      name: "Frühjahrskampagne (German)",
      maxConcurrent: 3,
      botConfigId: deBotConfig.id,
    },
  });

  await prisma.lead.createMany({
    data: [
      { campaignId: enCampaign.id, name: "Alex Rivera", phone: "+15005550101" },
      { campaignId: enCampaign.id, name: "Jordan Lee", phone: "+15005550102" },
      { campaignId: enCampaign.id, name: "Sam Patel", phone: "+15005550103" },
    ],
    skipDuplicates: true,
  });

  await prisma.lead.createMany({
    data: [
      { campaignId: deCampaign.id, name: "Lena Fischer", phone: "+15005550201" },
      { campaignId: deCampaign.id, name: "Jonas Weber", phone: "+15005550202" },
      { campaignId: deCampaign.id, name: "Mira Schulz", phone: "+15005550203" },
    ],
    skipDuplicates: true,
  });

  console.log("Seeded: ops@ivay.tech / ivay-ops-dev");
  console.log("Seeded: client@democlient.test / ivay-client-dev");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
