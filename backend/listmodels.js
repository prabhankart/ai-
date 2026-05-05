require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function listModels() {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`
  );
  const data = await response.json();
  
  console.log('\n✅ Models that support generateContent:\n');
  data.models
    .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
    .forEach(m => console.log('→', m.name));
}

listModels();