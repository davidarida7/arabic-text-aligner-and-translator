export interface TranslationPair {
  arabic: string;
  transliteration: string;
  english: string;
}

export interface TranslationErrorDetails {
  code: string;
  summary: string;
  hint?: string;
  httpStatus?: number;
  finishReason?: string;
  blockReason?: string;
  model?: string;
  rawError?: string;
  responsePreview?: string;
}

export interface TranslateApiResponse {
  pairs: TranslationPair[];
}

export interface TranslateApiErrorResponse {
  error: TranslationErrorDetails;
}
