import { GoogleGenAI, Type } from "@google/genai";
import { TranslationPair } from '../types';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const translationSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      arabic: {
        type: Type.STRING,
        description: "The original Arabic sentence or phrase.",
      },
      english: {
        type: Type.STRING,
        description: "The corresponding English translation.",
      },
    },
    required: ["arabic", "english"],
  },
};

export const translateAndAlignText = async (text: string): Promise<TranslationPair[]> => {
  const prompt = `
    You are an expert translator specializing in Arabic to English.
    Your task is to take the provided Arabic text, translate it accurately into English, and segment the output based on the paragraph structure of the original text.
    Treat any block of text separated by one or more empty lines as a distinct paragraph or segment.
    The first segment should represent the title or the very first line of the source text.
    For each segment you identify, create a corresponding translation.
    If the text appears to be from a religious text like the Bible, please ensure the English translation aligns with a well-known version like the New King James Version (NKJV) where appropriate.
    The final output must be a valid JSON array of objects, where each object represents a pair of corresponding segments (the original Arabic segment and its English translation).
    
    Here is the Arabic text:
    ---
    ${text}
    ---
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: translationSchema,
      },
    });

    const jsonString = response.text;
    const result = JSON.parse(jsonString);
    return result as TranslationPair[];
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    throw new Error("Failed to translate and align text. The model may have returned an invalid response.");
  }
};