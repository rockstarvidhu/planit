require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function listModels() {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    console.log("📡 Contacting Google to see available models...");
    
    // This asks Google: "What models can I use with my key?"
    // It works even if "generateContent" fails.
    const modelResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`
    );
    
    const data = await modelResponse.json();
    
    if (data.models) {
        console.log("\n✅ AVAILABLE MODELS:");
        data.models.forEach(m => {
            // Only show models that support generating content
            if (m.supportedGenerationMethods.includes("generateContent")) {
                console.log(`   👉 "${m.name.replace('models/', '')}"`);
            }
        });
    } else {
        console.error("❌ Error listing models:", data);
    }

  } catch (error) {
    console.error("❌ Network Error:", error.message);
  }
}

listModels();