require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function testAI() {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    console.log("📡 Connecting to Gemini...");
    const result = await model.generateContent("Say 'Hello! Your API Key is working.'");
    const response = await result.response;
    const text = response.text();

    console.log("✅ SUCCESS:", text);
  } catch (error) {
    console.error("❌ FAILED:", error.message);
  }
}

testAI();