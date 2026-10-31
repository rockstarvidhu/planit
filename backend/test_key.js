require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function testAI() {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    console.log("📡 Connecting to Gemini...");
    const result = await model.generateContent("Say 'Hello! Your API Key is working.'", { timeout: 8000 });
    const response = await result.response;
    const text = response.text();

    console.log("✅ SUCCESS: received a text response", typeof text === "string");
  } catch (error) {
    console.error("❌ FAILED: provider request did not succeed");
  }
}

testAI();