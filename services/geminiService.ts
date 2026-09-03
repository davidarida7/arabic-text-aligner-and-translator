
import { GoogleGenAI, Type } from "@google/genai";
import { TranslationPair } from '../types';

let aiClient: GoogleGenAI | null = null;
const getAIClient = (): GoogleGenAI => {
  if (!aiClient) {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      throw new Error("API_KEY environment variable not set");
    }
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
};

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
    
    MANDATORY NUMBERED LISTS RULE (IN TRANSLITERATION ONLY):
    - Whenever there are numbered lists, enumerated points, or numbered items (e.g. 1-, 2-, 3-, 1., 2., 3., etc.):
      * In the 'transliteration' field ONLY: NEVER put numerical digits (such as 1, 2, 3... or ١, ٢, ٣...). Instead, you MUST write out the English number phonetically in Arabic script!
        - For example:
          - Write "وان -" instead of "1-" or "1 -"
          - Write "تو -" instead of "2-" or "2 -"
          - Write "ثري -" instead of "3-" or "3 -"
          - Write "فور -" instead of "4-" or "4 -"
          - Write "فايف -" instead of "5-" or "5 -"
          - Write "سكس -" instead of "6-" or "6 -"
          - Write "سفن -" instead of "7-" or "7 -"
          - Write "إيت -" instead of "8-" or "8 -"
          - Write "ناين -" instead of "9-" or "9 -"
          - Write "تن -" instead of "10-" or "10 -"
          - (and so forth for higher numbers, e.g. "إليفن -", "تويلف -", etc.)
      * In the 'arabic' field: KEEP the original Arabic numbering as written in the source (e.g. "1 -" or "١ -").
      * In the 'english' field: KEEP standard numerical digits (e.g. "1-", "2-", "3-").
      * This rule applies STRICTLY to the 'transliteration' column only.
    
    MANDATORY VERSE QUOTATION & PUNCTUATION RULE (IN ALL THREE LANGUAGES):
    - Whenever a segment is a verse, or contains a Scripture / Bible verse, hymn verse, liturgical verse, or sacred quotation (from the Old Testament, New Testament, Gospels, Psalms, Epistles, Prophets, etc.):
      YOU MUST SURROUND the verse text in standard double quotation marks ("...") in ALL THREE fields ('arabic', 'transliteration', and 'english').
    - If the input Arabic text does not have quotes around the verse, YOU MUST ADD quotation marks around the verse text in 'arabic'.
    - In 'transliteration': The transliterated English verse in Arabic script MUST be surrounded in quotation marks ("...").
    - In 'english': The English verse translation MUST be surrounded in quotation marks ("...").
    - When a verse has an attached book/chapter/verse citation or reference (e.g. 'John 1:1', '(Matthew 5:3)', '(يوحنا 1: 1)'):
      Place the quotation marks around the actual verse text itself, followed by the reference. For example:
        * arabic: "فِي الْبَدْءِ كَانَ الْكَلِمَةُ..." (يوحنا 1: 1)
        * transliteration: "إن ذا بيجينينج واز ذا وورد..." (جون 1: 1)
        * english: "In the beginning was the Word..." (John 1:1)
      If there is no separate citation and the segment is the verse, surround the whole verse: "..."
    - PUNCTUATION ALIGNMENT:
      In both 'arabic' and 'transliteration', ensure punctuation marks (such as periods '.', Arabic commas '،', colons ':', quotes '"', question marks '؟') are positioned in natural right-to-left order so that opening quotes are at the start of the verse (right) and closing quotes/periods are at the end (left).
    
    BIBLE REFERENCE RULE: If the text contains Bible references or is from the Bible, ensure the English translation aligns with a well-known version like the New King James Version (NKJV). 
    MANDATORY: You must use the full, unabbreviated name of every Bible book in every reference (e.g., '1 Corinthians' instead of '1 Cor.', 'Philippians' instead of 'Phil.', 'John' instead of 'Jn.', 'Psalms' instead of 'Ps.'). This is a strict requirement.
    
    The final output must be a valid JSON array of objects.
    
    Here is the Arabic text:
    ---
    ${text}
    ---
  `;

  try {
    const response = await getAIClient().models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: translationSchema,
        thinkingConfig: { thinkingBudget: 0 } 
      },
    });

    const jsonString = response.text;
    const result = JSON.parse(jsonString) as TranslationPair[];
    return ensureVerseQuotesAndAlignment(result);
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    throw new Error("Failed to translate and align text. The model may have returned an invalid response.");
  }
};

// Regex helpers to detect Scripture verses and citations
const scriptureRegex = /\b(Genesis|Exodus|Leviticus|Numbers|Deuteronomy|Joshua|Judges|Ruth|Samuel|Kings|Chronicles|Ezra|Nehemiah|Esther|Job|Psalms?|Proverbs|Ecclesiastes|Song of Solomon|Isaiah|Jeremiah|Lamentations|Ezekiel|Daniel|Hosea|Joel|Amos|Obadiah|Jonah|Micah|Nahum|Habakkuk|Zephaniah|Haggai|Zechariah|Malachi|Matthew|Mark|Luke|John|Acts|Romans|Corinthians|Galatians|Ephesians|Philippians|Colossians|Thessalonians|Timothy|Titus|Philemon|Hebrews|James|Peter|Jude|Revelation)\s+\d+[:\.]\s*\d+/i;
const arabicScriptureRegex = /\b(تكوين|خروج|لاويين|عدد|تثنية|يشوع|قضاة|راعوث|صموئيل|ملوك|أخبار الأيام|عزرا|نحميا|أستير|أيوب|مزمور|مزامير|أمثال|جامعة|نشيد الأنشاد|إشعياء|إرميا|مراثي|حزقيال|دانيال|هوشع|يوئيل|عاموس|عوبديا|يونان|ميخا|ناحوم|حبقوق|صفنيا|حجي|زكريا|ملاخي|متى|مرقس|لوقا|يوحنا|أعمال الرسل|رومية|كورنثوس|غلاطية|أفسس|فيلبي|كولوسي|تسالونيكي|تيموثاوس|تيطس|فليمون|عبرانيين|يعقوب|بطرس|يهوذا|رؤيا)\s+\d+[:\.]\s*\d+/;
const genericCitationRegex = /\(\s*([1-3]?\s*[\p{L}\s]+)?\s*\d+[:\.]\s*\d+([–\-]\d+)?\s*\)/u;

// Helper to convert an English number to its phonetic Arabic script transliteration (e.g. 1 -> "وان", 2 -> "تو", 3 -> "ثري")
export const englishNumberToPhoneticArabic = (num: number | string): string => {
  const n = typeof num === 'number' ? num : parseInt(num, 10);
  if (isNaN(n) || n < 1) return String(num);

  const ones = [
    '', 'وان', 'تو', 'ثري', 'فور', 'فايف', 'سكس', 'سفن', 'إيت', 'ناين',
    'تن', 'إليفن', 'تويلف', 'ثيرتين', 'فورتين', 'فيفتين', 'سكستين', 'سفنتين', 'إيتين', 'ناينتين'
  ];
  const tens = [
    '', '', 'توينتي', 'ثيرتي', 'فورتي', 'فيفتي', 'سكستي', 'سفنتي', 'إيتي', 'ناينتي'
  ];

  if (n < 20) return ones[n];
  if (n < 100) {
    const t = Math.floor(n / 10);
    const rem = n % 10;
    return rem === 0 ? tens[t] : `${tens[t]} ${ones[rem]}`;
  }
  if (n < 1000) {
    const h = Math.floor(n / 100);
    const rem = n % 100;
    const hStr = h === 1 ? 'وان هاندرد' : `${ones[h]} هاندرد`;
    return rem === 0 ? hStr : `${hStr} ${englishNumberToPhoneticArabic(rem)}`;
  }
  return String(n);
};

// Convert Arabic-Indic numerals (٠-٩) to ASCII digits
export const normalizeArabicNumerals = (str: string): string => {
  return str.replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
};

// Replaces numerical digits in list items inside transliterations with phonetic Arabic words
export const replaceNumberedListsInTransliteration = (text: string): string => {
  if (!text) return '';

  const lines = text.split(/\r?\n/);
  const converted = lines.map(line => {
    let l = line.trim();
    if (!l) return line;

    let quotePrefix = '';
    let quoteSuffix = '';
    if (/^["“«]/.test(l)) {
      quotePrefix = l[0];
      l = l.slice(1).trim();
    }
    if (/["”»]$/.test(l)) {
      quoteSuffix = l[l.length - 1];
      l = l.slice(0, -1).trim();
    }

    // Pattern 1: Leading list number:
    // "1-", "1 -", "1.", "1:", "(1)", "1)", "- 1", "-1", "١-", etc.
    const leadingRegex = /^[\u200F\s]*([-\(]?\s*([0-9]+|[٠-٩]+)\s*[-\)\.:]\s*)/;
    const leadingMatch = l.match(leadingRegex);
    if (leadingMatch) {
      const fullMatch = leadingMatch[1];
      const digits = normalizeArabicNumerals(leadingMatch[2]);
      const phonetic = englishNumberToPhoneticArabic(digits);
      let sep = ' - ';
      if (fullMatch.includes(':')) sep = ': ';
      else if (fullMatch.includes('.')) sep = '. ';
      else sep = ' - ';

      const rest = l.slice(leadingMatch[0].length).trim();
      return `${quotePrefix}${phonetic}${sep}${rest}${quoteSuffix}`;
    }

    // Pattern 2: Trailing list number caused by BiDi inversion (e.g. "text - 1", "text 3-"):
    // Guard against Bible chapter/verse citations like "(John 1: 1)" or "(جون 1: 1)"
    if (!/\)\s*$/.test(l)) {
      const trailingRegex = /[\s]+(?:[-–]\s*([0-9]+|[٠-٩]+)|([0-9]+|[٠-٩]+)\s*[-–])[\s\u200F]*$/;
      const trailingMatch = l.match(trailingRegex);
      if (trailingMatch) {
        const rawDigits = trailingMatch[1] || trailingMatch[2];
        const digits = normalizeArabicNumerals(rawDigits);
        const phonetic = englishNumberToPhoneticArabic(digits);
        const rest = l.slice(0, trailingMatch.index).trim();
        return `${quotePrefix}${phonetic} - ${rest}${quoteSuffix}`;
      }
    }

    return line;
  });

  return converted.join('\n');
};

// Formats transliteration for a pair, guaranteeing list numbers are written phonetically in Arabic script
export const formatTransliterationItemNumber = (pair: {
  arabic?: string;
  transliteration?: string;
  english?: string;
}): string => {
  let trans = pair.transliteration || '';
  const arabic = pair.arabic || '';
  const english = pair.english || '';

  // 1. Direct line-by-line list number replacement
  trans = replaceNumberedListsInTransliteration(trans);

  // 2. If transliteration does not start with a phonetic number, but English or Arabic has a numbered item
  const enMatch = english.trim().match(/^([0-9]+)\s*[-–\.:\)]/);
  const arMatch = arabic.trim().match(/^[\u200F\s]*([0-9]+|[٠-٩]+)\s*[-–\.:\)]/);
  const listNum = enMatch ? parseInt(enMatch[1], 10) : (arMatch ? parseInt(normalizeArabicNumerals(arMatch[1]), 10) : null);

  if (listNum !== null && listNum >= 1) {
    const phoneticWord = englishNumberToPhoneticArabic(listNum);
    const trimmedTrans = trans.trim();
    if (!trimmedTrans.startsWith(phoneticWord)) {
      const phoneticCheck = /^(وان|تو|ثري|فور|فايف|سكس|سفن|إيت|ناين|تن|إليفن|تويلف|ثيرتين|فورتين|فيفتين|سكستين|سفنتين|إيتين|ناينتين|توينتي)/;
      if (!phoneticCheck.test(trimmedTrans)) {
        trans = `${phoneticWord} - ${trimmedTrans}`;
      }
    }
  }

  return trans;
};

const isVerseSegment = (str: string): boolean => {
  if (!str) return false;
  const trimmed = str.trim();
  if (/^["“«]/.test(trimmed)) return true;
  if (scriptureRegex.test(trimmed)) return true;
  if (arabicScriptureRegex.test(trimmed)) return true;
  if (genericCitationRegex.test(trimmed)) return true;
  return false;
};

const quoteVerseText = (text: string): string => {
  if (!text) return "";
  const trimmed = text.trim();
  if (!trimmed) return "";

  // Check if there is an attached citation at the end, e.g. (John 1:1) or (يوحنا 1: 1)
  const citationMatch = trimmed.match(/(\s*[\(\[][^\)\]]+[\)\]]\s*)$/);
  let mainText = trimmed;
  let citation = "";

  if (citationMatch && citationMatch.index !== undefined) {
    mainText = trimmed.slice(0, citationMatch.index).trim();
    citation = citationMatch[0].trim();
  }

  // Strip existing wrapping quotes if present
  const stripped = mainText.replace(/^["“«]+|["”»]+$/g, "").trim();
  if (!stripped) return trimmed;

  const quoted = `"${stripped}"`;
  return citation ? `${quoted} ${citation}` : quoted;
};

export const ensureVerseQuotesAndAlignment = (pairs: TranslationPair[]): TranslationPair[] => {
  return pairs.map(pair => {
    // Format transliteration list numbers (e.g. "ثري" instead of "3")
    const formattedTransliteration = formatTransliterationItemNumber(pair);
    const pairWithFormattedTrans = {
      ...pair,
      transliteration: formattedTransliteration,
    };

    const isVerse =
      isVerseSegment(pair.arabic) ||
      isVerseSegment(pairWithFormattedTrans.transliteration) ||
      isVerseSegment(pair.english);

    if (!isVerse) {
      return pairWithFormattedTrans;
    }

    return {
      arabic: quoteVerseText(pair.arabic),
      transliteration: quoteVerseText(pairWithFormattedTrans.transliteration),
      english: quoteVerseText(pair.english),
    };
  });
};
