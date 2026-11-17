import type {
  TranslateApiErrorResponse,
  TranslateApiResponse,
  TranslationErrorDetails,
  TranslationPair,
} from '../types';

export {
  englishNumberToPhoneticArabic,
  ensureVerseQuotesAndAlignment,
  formatTransliterationItemNumber,
  normalizeArabicNumerals,
  replaceNumberedListsInTransliteration,
} from './textFormatting';

export class TranslationError extends Error {
  details: TranslationErrorDetails;

  constructor(details: TranslationErrorDetails) {
    super(details.summary);
    this.name = 'TranslationError';
    this.details = details;
  }
}

export const translateAndAlignText = async (text: string): Promise<TranslationPair[]> => {
  let response: Response;
  try {
    response = await fetch('/api/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });
  } catch (networkErr) {
    throw new TranslationError({
      code: 'NETWORK_ERROR',
      summary: 'Could not connect to the translation server.',
      hint: 'Check your network connection or refresh the page and try again.',
      rawError: networkErr instanceof Error ? networkErr.message : String(networkErr),
    });
  }

  const rawBody = await response.text();
  let parsedBody: TranslateApiResponse | TranslateApiErrorResponse | null = null;

  if (rawBody) {
    try {
      parsedBody = JSON.parse(rawBody) as TranslateApiResponse | TranslateApiErrorResponse;
    } catch {
      parsedBody = null;
    }
  }

  if (!response.ok) {
    if (parsedBody && 'error' in parsedBody && parsedBody.error) {
      throw new TranslationError(parsedBody.error);
    }

    throw new TranslationError({
      code: 'SERVER_HTTP_ERROR',
      summary: `The translation server returned an unexpected error (HTTP ${response.status}).`,
      hint:
        response.status === 504 || response.status === 502
          ? 'The request may have timed out on a long passage. Try splitting the text into smaller sections.'
          : 'Please try again in a moment.',
      httpStatus: response.status,
      rawError: response.statusText || undefined,
      responsePreview: rawBody ? rawBody.slice(0, 240) : undefined,
    });
  }

  if (!parsedBody || !('pairs' in parsedBody) || !Array.isArray(parsedBody.pairs)) {
    throw new TranslationError({
      code: 'INVALID_SERVER_RESPONSE',
      summary: 'The translation server returned an unexpected response format.',
      hint: 'Please try again.',
      httpStatus: response.status,
      responsePreview: rawBody ? rawBody.slice(0, 240) : undefined,
    });
  }

  return parsedBody.pairs;
};
