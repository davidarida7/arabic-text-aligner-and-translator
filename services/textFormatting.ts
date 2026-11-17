import type { TranslationPair } from '../types.ts';

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
