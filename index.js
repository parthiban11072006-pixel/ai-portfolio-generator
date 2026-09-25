import dotenv from "dotenv";
import cors from "cors";
import express from "express";
import multer from "multer";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

// Google Gemini Model - Stable 1.5 Flash version
const GEMINI_MODEL = "gemini-3.6-flash";
const MAX_GEMINI_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 1200;

const app = express();
const PORT = process.env.PORT || 5001;

// CORS setup to allow frontend requests
app.use(cors());
app.use(express.json());

// Configure Multer for memory storage (PDF buffer)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// Initialize Gemini API Client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Helper function to call Gemini with retry logic
async function generatePortfolioFromPDF(fileBuffer, mimeType) {
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

  const prompt = `
  You are an expert HR and resume parser.
  Extract structured portfolio information from the provided resume PDF.
  
  Return ONLY a valid JSON object matching this exact structure without any markdown backticks or markdown code blocks:
  {
    "name": "Candidate Full Name",
    "role": "Current or Target Job Title",
    "about": "A concise professional summary/bio (2-3 sentences)",
    "skills": ["Skill 1", "Skill 2", "Skill 3"],
    "projects": [
      {
        "title": "Project Name",
        "description": "Short project description",
        "tech": ["Tech1", "Tech2"]
      }
    ],
    "contact": {
      "email": "email@example.com",
      "phone": "+1234567890"
    }
  }
  `;

  const pdfPart = {
    inlineData: {
      data: fileBuffer.toString("base64"),
      mimeType: mimeType,
    },
  };

  let lastError = null;

  for (let attempt = 1; attempt <= MAX_GEMINI_ATTEMPTS; attempt++) {
    try {
      const result = await model.generateContent([prompt, pdfPart]);
      const responseText = await result.response.text();
      
      // Clean clean markdown syntax if returned
      const cleanedJson = responseText
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();

      return JSON.parse(cleanedJson);
    } catch (err) {
      lastError = err;
      console.error(`Gemini Attempt ${attempt} failed:`, err.message);
      if (attempt < MAX_GEMINI_ATTEMPTS) {
        await new Promise((res) => setTimeout(res, RETRY_BASE_DELAY_MS * attempt));
      }
    }
  }

  throw lastError || new Error("Failed to process PDF with Gemini AI");
}

// API Endpoint for Resume Upload
app.post("/api/upload", upload.single("resume"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "Please upload a PDF resume file." });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ success: false, error: "GEMINI_API_KEY is missing in backend .env file." });
    }

    const portfolioData = await generatePortfolioFromPDF(req.file.buffer, req.file.mimetype);

    return res.json({
      success: true,
      data: portfolioData,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "An error occurred while generating portfolio.",
    });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log(`🤖 Using Gemini Model: ${GEMINI_MODEL}`);
});