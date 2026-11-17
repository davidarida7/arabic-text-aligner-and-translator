import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type { GenerateContentResponse } from '@google/genai';
import type { TranslationErrorDetails, TranslationPair } from './types.ts';
import { ensureVerseQuotesAndAlignment } from './services/textFormatting.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MODEL_NAME = 'gemini-4-hydrogen';

class DetailedTranslationError extends Error {
  details: TranslationErrorDetails;

  constructor(details: TranslationErrorDetails) {
    super(details.summary);
    this.name = 'DetailedTranslationError';
    this.details = details;
  }
}

let aiClient: GoogleGenAI | null = null;
const getAIClient = (): GoogleGenAI => {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new DetailedTranslationError({
        code: 'MISSING_API_KEY',
        summary: 'Gemini API key is not configured on the server.',
        hint: 'Please ensure GEMINI_API_KEY is set in Settings > Secrets.',
        httpStatus: 500,
        model: MODEL_NAME,
      });
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
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
        description: 'The original Arabic sentence or phrase.',
      },
      transliteration: {
        type: Type.STRING,
        description:
          'Phonetic transliteration of the English translation written in Arabic script (Arabic letters phonetically spelling the English words).',
      },
      english: {
        type: Type.STRING,
        description: 'The corresponding English translation.',
      },
    },
    required: ['arabic', 'transliteration', 'english'],
  },
};

const buildPrompt = (text: string): string => `
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

const createPreview = (raw: string, focusTail = false): string => {
  const trimmed = raw.trim();
  if (!trimmed) return '(empty)';
  if (trimmed.length <= 260) return trimmed;
  if (focusTail) {
    return `...${trimmed.slice(-240)}`;
  }
  return `${trimmed.slice(0, 120)} ... ${trimmed.slice(-120)}`;
};

const stripMarkdownFences = (raw: string): string => {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i);
  return fenceMatch ? fenceMatch[1].trim() : trimmed;
};

const extractUpstreamError = (err: unknown): DetailedTranslationError => {
  if (err instanceof DetailedTranslationError) {
    return err;
  }

  const record = (err && typeof err === 'object' ? err : {}) as Record<string, unknown>;
  let rawMessage =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : JSON.stringify(err);

  let httpStatus =
    typeof record.status === 'number'
      ? record.status
      : typeof record.statusCode === 'number'
        ? record.statusCode
        : undefined;

  let apiStatusText = typeof record.code === 'string' ? record.code : undefined;

  // @google/genai errors sometimes embed a JSON payload inside err.message
  try {
    const parsedMsg = JSON.parse(rawMessage);
    const nested = parsedMsg?.error ?? parsedMsg;
    if (nested && typeof nested === 'object') {
      if (typeof nested.code === 'number' && !httpStatus) httpStatus = nested.code;
      if (typeof nested.status === 'string') apiStatusText = nested.status;
      if (typeof nested.message === 'string') rawMessage = nested.message;
    }
  } catch {
    // Message is plain text
  }

  if (!httpStatus) {
    const statusMatch = rawMessage.match(/\b(400|401|403|404|408|413|429|500|502|503|504)\b/);
    if (statusMatch) {
      httpStatus = parseInt(statusMatch[1], 10);
    }
  }

  const upperMsg = `${apiStatusText ?? ''} ${rawMessage}`.toUpperCase();

  if (upperMsg.includes('API_KEY_INVALID') || (httpStatus === 400 && upperMsg.includes('API KEY'))) {
    return new DetailedTranslationError({
      code: 'API_KEY_INVALID',
      summary: 'The Gemini API rejected the configured API key.',
      hint: 'Please check or update your API key in the Settings > Secrets panel.',
      httpStatus: httpStatus ?? 400,
      model: MODEL_NAME,
      rawError: rawMessage,
    });
  }

  if (httpStatus === 403 || upperMsg.includes('PERMISSION_DENIED')) {
    return new DetailedTranslationError({
      code: 'PERMISSION_DENIED',
      summary: 'Permission denied when calling the Gemini API (403).',
      hint: 'Please check your API key and permissions in the Settings > Secrets panel.',
      httpStatus: 403,
      model: MODEL_NAME,
      rawError: rawMessage,
    });
  }

  if (httpStatus === 404 || upperMsg.includes('NOT_FOUND')) {
    return new DetailedTranslationError({
      code: 'MODEL_NOT_FOUND',
      summary: `The Gemini model "${MODEL_NAME}" was not found or is unavailable (404).`,
      hint: 'Verify the configured model name is supported for your API key.',
      httpStatus: 404,
      model: MODEL_NAME,
      rawError: rawMessage,
    });
  }

  if (httpStatus === 429 || upperMsg.includes('RESOURCE_EXHAUSTED') || upperMsg.includes('QUOTA') || upperMsg.includes('RATE')) {
    return new DetailedTranslationError({
      code: 'RATE_LIMITED',
      summary: 'Gemini API rate limit or quota exceeded (429).',
      hint: 'Wait a few seconds and try again, or check your quota/billing in Settings > Secrets.',
      httpStatus: 429,
      model: MODEL_NAME,
      rawError: rawMessage,
    });
  }

  if (httpStatus === 400) {
    return new DetailedTranslationError({
      code: 'BAD_REQUEST',
      summary: 'The Gemini API rejected the request parameters (400).',
      hint: 'Try simplifying or shortening the input text and running it again.',
      httpStatus: 400,
      model: MODEL_NAME,
      rawError: rawMessage,
    });
  }

  if (httpStatus && httpStatus >= 500) {
    return new DetailedTranslationError({
      code: 'UPSTREAM_UNAVAILABLE',
      summary: `The Gemini API service encountered a temporary error (${httpStatus}).`,
      hint: 'This is usually transient. Please wait a moment and try again.',
      httpStatus,
      model: MODEL_NAME,
      rawError: rawMessage,
    });
  }

  return new DetailedTranslationError({
    code: apiStatusText || 'API_ERROR',
    summary: 'The Gemini API call failed before returning a response.',
    hint: 'Check the diagnostic details below and try again.',
    httpStatus: httpStatus ?? 502,
    model: MODEL_NAME,
    rawError: rawMessage,
  });
};

const isTransientError = (err: DetailedTranslationError): boolean => {
  const status = err.details.httpStatus;
  return (
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    err.details.code === 'UPSTREAM_UNAVAILABLE'
  );
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const callGeminiWithRetry = async (prompt: string): Promise<GenerateContentResponse> => {
  const maxAttempts = 3;
  let lastError: DetailedTranslationError | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await getAIClient().models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: translationSchema,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });
    } catch (err) {
      lastError = extractUpstreamError(err);
      if (attempt < maxAttempts && isTransientError(lastError)) {
        const backoffMs = 600 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 250);
        console.warn(`Transient Gemini API error (attempt ${attempt}/${maxAttempts}), retrying in ${backoffMs}ms:`, lastError.details.rawError);
        await sleep(backoffMs);
        continue;
      }
      throw lastError;
    }
  }

  throw lastError!;
};

const parseAndValidateResponse = (response: GenerateContentResponse): TranslationPair[] => {
  const blockReason = response.promptFeedback?.blockReason
    ? String(response.promptFeedback.blockReason)
    : undefined;

  if (blockReason) {
    throw new DetailedTranslationError({
      code: 'PROMPT_BLOCKED',
      summary: `The request was blocked by the model's safety filter (${blockReason}).`,
      hint: 'Review or rephrase the input Arabic text and try again.',
      httpStatus: 422,
      blockReason,
      model: MODEL_NAME,
      rawError: response.promptFeedback?.blockReasonMessage || `promptFeedback.blockReason = ${blockReason}`,
    });
  }

  const candidate = response.candidates?.[0];
  const finishReason = candidate?.finishReason ? String(candidate.finishReason) : undefined;
  const rawText = response.text ?? '';

  if (!rawText.trim()) {
    if (finishReason && ['SAFETY', 'PROHIBITED_CONTENT', 'SPII', 'BLOCKLIST'].includes(finishReason)) {
      throw new DetailedTranslationError({
        code: 'SAFETY_BLOCKED',
        summary: `The model stopped generating due to content safety filters (${finishReason}).`,
        hint: 'Try editing or splitting the passage if any wording triggered a false positive.',
        httpStatus: 422,
        finishReason,
        model: MODEL_NAME,
      });
    }

    if (finishReason === 'RECITATION') {
      throw new DetailedTranslationError({
        code: 'RECITATION_BLOCKED',
        summary: 'The model stopped generating due to recitation/copyright checks (RECITATION).',
        hint: 'Try translating a shorter excerpt or slightly rephrasing the source text.',
        httpStatus: 422,
        finishReason,
        model: MODEL_NAME,
      });
    }

    if (finishReason === 'MAX_TOKENS') {
      throw new DetailedTranslationError({
        code: 'OUTPUT_TRUNCATED',
        summary: 'The model reached its output token limit before producing a response (MAX_TOKENS).',
        hint: 'Your input text may be too long for a single run. Try splitting it into smaller sections.',
        httpStatus: 502,
        finishReason,
        model: MODEL_NAME,
      });
    }

    throw new DetailedTranslationError({
      code: 'EMPTY_RESPONSE',
      summary: 'The model returned an empty response with no JSON content.',
      hint: 'Try running the translation again. If this repeats, try shortening the input text.',
      httpStatus: 502,
      finishReason: finishReason ?? 'UNKNOWN',
      model: MODEL_NAME,
      rawError: `candidates=${response.candidates?.length ?? 0}, finishReason=${finishReason ?? 'none'}`,
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch (firstParseErr) {
    const cleaned = stripMarkdownFences(rawText);
    try {
      parsed = JSON.parse(cleaned);
    } catch (secondParseErr) {
      const parseErrMsg =
        secondParseErr instanceof Error
          ? secondParseErr.message
          : firstParseErr instanceof Error
            ? firstParseErr.message
            : 'Invalid JSON';

      if (finishReason === 'MAX_TOKENS') {
        throw new DetailedTranslationError({
          code: 'OUTPUT_TRUNCATED',
          summary: 'The translation was cut off before the JSON output could finish (MAX_TOKENS).',
          hint: 'The source text is too long for a single response. Split it into smaller chunks and translate them separately.',
          httpStatus: 502,
          finishReason,
          model: MODEL_NAME,
          rawError: `${parseErrMsg} (response length: ${rawText.length} chars)`,
          responsePreview: createPreview(rawText, true),
        });
      }

      throw new DetailedTranslationError({
        code: 'MALFORMED_JSON',
        summary: 'The model returned text that could not be parsed as valid JSON.',
        hint: 'Try running the translation again. If it persists, try splitting the text into smaller paragraphs.',
        httpStatus: 502,
        finishReason,
        model: MODEL_NAME,
        rawError: `${parseErrMsg} (response length: ${rawText.length} chars)`,
        responsePreview: createPreview(rawText, false),
      });
    }
  }

  if (!Array.isArray(parsed)) {
    throw new DetailedTranslationError({
      code: 'INVALID_SCHEMA',
      summary: `Expected a JSON array of translation rows, but received ${typeof parsed}.`,
      hint: 'Try running the translation again.',
      httpStatus: 502,
      finishReason,
      model: MODEL_NAME,
      responsePreview: createPreview(rawText, false),
    });
  }

  if (parsed.length === 0) {
    throw new DetailedTranslationError({
      code: 'EMPTY_SEGMENTS',
      summary: 'The model returned an empty list ([]) with no translated segments.',
      hint: 'Verify that the input contains readable Arabic text and try again.',
      httpStatus: 502,
      finishReason,
      model: MODEL_NAME,
    });
  }

  const normalized: TranslationPair[] = parsed.map((item, idx) => {
    if (!item || typeof item !== 'object') {
      throw new DetailedTranslationError({
        code: 'INVALID_SCHEMA',
        summary: `Translation row #${idx + 1} was not a valid object (received ${typeof item}).`,
        hint: 'Try running the translation again.',
        httpStatus: 502,
        finishReason,
        model: MODEL_NAME,
        responsePreview: createPreview(rawText, false),
      });
    }

    const row = item as Record<string, unknown>;
    if (typeof row.arabic !== 'string' || typeof row.english !== 'string' || typeof row.transliteration !== 'string') {
      const missing = ['arabic', 'transliteration', 'english'].filter(k => typeof row[k] !== 'string');
      throw new DetailedTranslationError({
        code: 'INVALID_SCHEMA',
        summary: `Translation row #${idx + 1} is missing required text fields: ${missing.join(', ')}.`,
        hint: 'Try running the translation again.',
        httpStatus: 502,
        finishReason,
        model: MODEL_NAME,
        rawError: `Present keys: ${Object.keys(row).join(', ') || '(none)'}`,
        responsePreview: createPreview(rawText, false),
      });
    }

    return {
      arabic: row.arabic,
      transliteration: row.transliteration,
      english: row.english,
    };
  });

  return ensureVerseQuotesAndAlignment(normalized);
};

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.post('/api/translate', async (req, res) => {
    const text = req.body?.text;
    if (typeof text !== 'string' || !text.trim()) {
      const details: TranslationErrorDetails = {
        code: 'INVALID_INPUT',
        summary: 'Please enter some Arabic text to translate.',
        httpStatus: 400,
      };
      res.status(400).json({ error: details });
      return;
    }

    try {
      const prompt = buildPrompt(text);
      const response = await callGeminiWithRetry(prompt);
      const pairs = parseAndValidateResponse(response);
      res.json({ pairs });
    } catch (err) {
      const detailed = extractUpstreamError(err);
      console.error('Translation error:', detailed.details);
      const status = detailed.details.httpStatus && detailed.details.httpStatus >= 400
        ? detailed.details.httpStatus
        : 500;
      res.status(status).json({ error: detailed.details });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
