const { processUserMessage } = require('../src/lib/ai/engine');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testPipeline() {
  const spokenText = "What tasks is Dani working on?";
  console.log(`Testing full AI engine with spoken query: "${spokenText}"`);

  const response = await processUserMessage(spokenText, "voice_test_convo");
  console.log("\nAI Response:");
  console.log("-----------------------------------------");
  console.log(response.content);
  console.log("-----------------------------------------");
  console.log("Tools called:", response.toolCalls?.map(t => t.name));
  console.log("Provider used:", response.providerUsed);

  // Clean up test message in chatMessage table
  await prisma.chatMessage.deleteMany({ where: { conversationId: "voice_test_convo" } });
}

testPipeline()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
