require('dotenv').config();

async function listModels() {
  try {
    
    console.log("📡 Contacting Google to see available models...");
    
    // This asks Google: "What models can I use with my key?"
    // It works even if "generateContent" fails.
    const modelResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`,
        { signal: AbortSignal.timeout(8000) }
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
        console.error("❌ Error listing models: provider rejected request");
    }

  } catch (error) {
    console.error("❌ Network Error: provider unavailable");
  }
}

listModels();