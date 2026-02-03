
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
    
    CRITICAL FORMATTING RULE: If a segment (a row) contains internal single line breaks that are NOT empty lines, you MUST preserve these line breaks by using the newline character (\\n) in your JSON string output for both 'arabic' and 'english' fields.
    
    BIBLE REFERENCE RULE: If the text contains Bible references or is from the Bible, ensure the English translation aligns with a well-known version like the New King James Version (NKJV). 
    MANDATORY: You must use the full, unabbreviated name of every Bible book in every reference (e.g., '1 Corinthians' instead of '1 Cor.', 'Philippians' instead of 'Phil.', 'John' instead of 'Jn.', 'Psalms' instead of 'Ps.'). This is a strict requirement.
    
    The final output must be a valid JSON array of objects.
    
    Here is the Arabic text:
    ---
    ${text}
    ---
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: translationSchema,
        thinkingConfig: { thinkingBudget: 0 } 
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
