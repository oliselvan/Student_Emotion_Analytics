
import { GoogleGenAI, Type } from "@google/genai";
import { EmotionalAnalysis, TextSentimentResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Generates a professional invitation email body using Gemini.
 */
export const generateInvitationEmail = async (teacherEmail: string, studentEmail: string): Promise<{ subject: string; body: string } | null> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Generate a professional and welcoming invitation email from a teacher (${teacherEmail}) to a student (${studentEmail}) to join the 'Sentient Learning Platform' (SLP). The platform helps monitor well-being and engagement. Keep it concise, friendly, and include a 'Claim Your Profile' call to action. Return as JSON.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            subject: { type: Type.STRING },
            body: { type: Type.STRING },
          },
          required: ["subject", "body"],
        },
      },
    });

    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Email Generation Error:", error);
    return null;
  }
};

/**
 * Analyzes a student's facial expression using Gemini 3 Flash.
 */
export const analyzeFaceExpression = async (base64Image: string): Promise<EmotionalAnalysis | null> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Image,
            },
          },
          {
            text: "Analyze this student during an online class. Determine: 1. Primary emotion. 2. Engagement level. 3. Stress Score (0-10). 4. Attention/Focus Score (0-10) based on eye contact and posture. 5. A one-sentence summary of their current state.",
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            emotion: { type: Type.STRING },
            engagement: { type: Type.STRING },
            stressScore: { type: Type.NUMBER },
            attentionScore: { type: Type.NUMBER },
            confidence: { type: Type.NUMBER },
            summary: { type: Type.STRING },
          },
          required: ["emotion", "engagement", "stressScore", "attentionScore", "confidence", "summary"],
        },
      },
    });

    const result = JSON.parse(response.text || '{}');
    return result as EmotionalAnalysis;
  } catch (error) {
    console.error("Gemini Image Analysis Error:", error);
    return null;
  }
};

export const analyzeStudentJournal = async (text: string): Promise<TextSentimentResult | null> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze the following student reflection or journal entry for emotional health and engagement markers: "${text}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            sentiment: { type: Type.STRING },
            stressScore: { type: Type.NUMBER },
            keywords: { 
                type: Type.ARRAY,
                items: { type: Type.STRING }
            },
            interventionRecommended: { type: Type.BOOLEAN },
            analysis: { type: Type.STRING },
          },
          required: ["sentiment", "stressScore", "keywords", "interventionRecommended", "analysis"],
        },
      },
    });

    const result = JSON.parse(response.text || '{}');
    return result as TextSentimentResult;
  } catch (error) {
    console.error("Gemini Text Analysis Error:", error);
    return null;
  }
};

/**
 * Resizes a base64 image to a target width/height to save Firestore space.
 */
const resizeImage = (base64Str: string, maxWidth: number = 256, maxHeight: number = 256): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7)); // Use JPEG with 0.7 quality for significant savings
      } else {
        resolve(base64Str);
      }
    };
    img.onerror = () => resolve(base64Str);
    img.src = base64Str;
  });
};

export const generateAIAvatar = async (studentName: string, gender?: string): Promise<string | null> => {
  try {
    const genderPrompt = gender ? ` ${gender}` : "";
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ 
          text: `High-quality 3D Pixar-style character avatar of a${genderPrompt} student named ${studentName}. 
          Expressive friendly face, soft studio lighting, vibrant colors, clean solid pastel background. 
          Cinematic render, detailed textures, minimal head and shoulders only, centered composition.` 
        }],
      },
      config: { 
        imageConfig: { 
          aspectRatio: "1:1",
        } 
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        const rawBase64 = `data:image/png;base64,${part.inlineData.data}`;
        // Resize to 256x256 JPEG to stay well under Firestore limits
        return await resizeImage(rawBase64, 256, 256);
      }
    }
    return null;
  } catch (error) {
    console.error("Gemini Image Generation Error:", error);
    return null;
  }
};
