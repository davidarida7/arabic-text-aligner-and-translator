
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
      transliteration: {
        type: Type.STRING,
        description: "Phonetic transliteration of the English translation written in Arabic script (Arabic letters phonetically spelling the English words).",
      },
      english: {
        type: Type.STRING,
        description: "The corresponding English translation.",
      },
    },
    required: ["arabic", "transliteration", "english"],
  },
};

export const translateAndAlignText = async (text: string): Promise<TranslationPair[]> => {
  const prompt = `
    You are an expert translator and linguist specializing in Arabic and English.
    Your task is to take the provided Arabic text, translate it accurately into English, and provide a phonetic transliteration of the English translation written using Arabic script (Arabic letters).
    
    Treat any block of text separated by one or more empty lines as a distinct paragraph or segment.
    The first segment should represent the title or the very first line of the source text.
    For each segment you identify, create:
    1. 'arabic': The original Arabic text segment.
    2. 'transliteration': The English translation transliterated phonetically into Arabic script (spelling out the English words phonetically using Arabic letters).
    3. 'english': The corresponding accurate English translation.
    
    CRITICAL PHONETIC TRANSLITERATION RULES (English -> Arabic script):
    - Transliterate the pronunciation of English words phonetically into Arabic letters.
    - MANDATORY RULE FOR 'G' / 'g': You must ALWAYS use the Arabic letter 'ج' (jeem) for the English letter 'g' / 'G' (both hard 'g' as in 'give', 'good', 'God', 'grace', 'glory', 'beginning', 'great' and soft 'g' as in 'generation', 'gentle').
      * Examples:
        - "give" -> "جيف" (NEVER write "غيف")
        - "good" -> "جود" (NEVER write "غود")
        - "God" -> "جاد" or "جود" (NEVER write "غاد")
        - "grace" -> "جريس" (NEVER write "غريس")
        - "glory" -> "جلوري" (NEVER write "غلوري")
        - "beginning" -> "بيجينينج" (NEVER write "بيغينينغ")
        - "great" -> "جريت" (NEVER write "غريت")
      * STRICT PROHIBITION: NEVER use the Arabic letter 'غ' (ghayn) for English 'g' / 'G' sounds under any circumstance. Always use 'ج'.
    - Transliterate 'th' (voiced as in 'the', 'this', 'that') to 'ذا', 'ذس', 'ذات'.
    - Transliterate 'th' (unvoiced as in 'through', 'three', 'faith') to 'ثرو', 'ثري', 'فيث'.
    - Transliterate 'v' to 'ف' or 'ڤ' (e.g. "give" -> "جيف", "saved" -> "سيفد").
    - Transliterate 'p' to 'ب' (e.g. "peace" -> "بيس").
    - Transliterate 'ch' to 'تش' (e.g. "church" -> "تشيرتش").
    - Transliterate 'sh' to 'ش' (e.g. "shall" -> "شال").
    
    CRITICAL FORMATTING RULE: If a segment (a row) contains internal single line breaks that are NOT empty lines, you MUST preserve these line breaks by using the newline character (\\n) in your JSON string output for 'arabic', 'transliteration', and 'english' fields.
    
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
