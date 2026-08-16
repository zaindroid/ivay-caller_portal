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

  const number = await prisma.phoneNumber.upsert({
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
        voice: "June",
        task: "You are calling on behalf of Ivay, a voice AI company. Introduce yourself briefly, explain this is a quick outreach call, and ask if they have a moment to chat.",
      },
    },
  });

  const deBotConfig = await prisma.botConfig.upsert({
    where: { id: "demo-bot-config-de" },
    update: {},
    create: {
      id: "demo-bot-config-de",
      name: "German Outreach Agent",
      provider: "IVAY_VOICE",
      config: {
        language: "de-DE",
        voice: "Florian",
        task: "Du rufst im Auftrag von Ivay an, einem Voice-AI-Unternehmen. Stelle dich kurz vor und frage, ob gerade Zeit für ein kurzes Gespräch ist.",
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
      phoneNumberId: number.id,
      botConfigId: enBotConfig.id,
    },
  });

  // No phone number assigned yet — pending a real number/trunk for the
  // German leg (self-serve German DIDs require local business KYC with
  // every provider; plan is to use a non-German number here for now).
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
