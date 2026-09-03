
import {
  AlignmentType,
  Document,
  Packer,
  PageOrientation,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  UnderlineType,
  VerticalAlign,
  WidthType,
} from 'docx';
import saveAs from 'file-saver';
import type { TranslationPair } from '../types';
import { ensureVerseQuotesAndAlignment } from './geminiService';

// Helper to sanitize filenames.
const sanitizeFilename = (name: string): string => {
  return name.replace(/[^a-z0-9\s-]/gi, '').trim().replace(/\s+/g, ' ').slice(0, 50) || 'translation';
};

// Helper to format English title, preserving Scripture references and quoted verses.
const formatEnglishTitle = (str: string): string => {
  if (!str) return '';
  const trimmed = str.trim();
  if (/^["“«]/.test(trimmed) || /\d+:\d+/.test(trimmed)) {
    return trimmed;
  }
  return trimmed
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export const exportToWord = (rawPairs: TranslationPair[]): void => {
  if (!rawPairs || rawPairs.length === 0) {
    console.error("No data available to export.");
    return;
  }

  // Ensure verses are quoted across all three languages
  const data = ensureVerseQuotesAndAlignment(rawPairs);

  const titlePair = data[0];
  const bodyPairs = data.length > 1 ? data.slice(1) : [];
  
  const FONT_FAMILY = 'Arial';
  const FONT_SIZE_PT = 24;
  const FONT_SIZE_HALF_PT = FONT_SIZE_PT * 2;
  
  const englishTitleText = formatEnglishTitle(titlePair.english);

  // Helper to create paragraphs with proper RTL punctuation alignment and right-aligned text
  const createParagraphsFromText = (text: string, isRtl: boolean, alignment: AlignmentType) => {
    const lines = text.split(/\r?\n/);
    return lines.map(line => {
      let trimmed = line.trim();
      if (isRtl && trimmed) {
        if (/^["“«(\[]/.test(trimmed) && !trimmed.startsWith('\u200F')) {
          trimmed = '\u200F' + trimmed;
        }
        if (/[.!?"'\u061F\u060C\u00BB\u201D\u2019\])}]$/.test(trimmed) && !trimmed.endsWith('\u200F')) {
          trimmed = trimmed + '\u200F';
        }
      }
      return new Paragraph({
        alignment: alignment,
        children: [new TextRun({
          text: trimmed,
          font: FONT_FAMILY,
          size: FONT_SIZE_HALF_PT,
          rightToLeft: isRtl,
        })],
      });
    });
  };

  // --- Create Title Paragraphs ---
  let arabicTitleText = titlePair.arabic.trim();
  if (/^["“«(\[]/.test(arabicTitleText) && !arabicTitleText.startsWith('\u200F')) {
    arabicTitleText = '\u200F' + arabicTitleText;
  }
  if (/[.!?"'\u061F\u060C\u00BB\u201D\u2019\])}]$/.test(arabicTitleText) && !arabicTitleText.endsWith('\u200F')) {
    arabicTitleText = arabicTitleText + '\u200F';
  }

  const arabicTitle = new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({
      text: arabicTitleText,
      font: FONT_FAMILY,
      size: FONT_SIZE_HALF_PT,
      bold: true,
      underline: { type: UnderlineType.SINGLE },
      rightToLeft: true,
    })],
  });

  let transliteratedTitleText = titlePair.transliteration ? titlePair.transliteration.trim() : '';
  if (transliteratedTitleText) {
    if (/^["“«(\[]/.test(transliteratedTitleText) && !transliteratedTitleText.startsWith('\u200F')) {
      transliteratedTitleText = '\u200F' + transliteratedTitleText;
    }
    if (/[.!?"'\u061F\u060C\u00BB\u201D\u2019\])}]$/.test(transliteratedTitleText) && !transliteratedTitleText.endsWith('\u200F')) {
      transliteratedTitleText = transliteratedTitleText + '\u200F';
    }
  }

  const transliteratedTitle = transliteratedTitleText ? new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({
      text: transliteratedTitleText,
      font: FONT_FAMILY,
      size: FONT_SIZE_HALF_PT,
      bold: true,
      underline: { type: UnderlineType.SINGLE },
      rightToLeft: true,
    })],
  }) : null;

  const englishTitle = new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({
      text: englishTitleText,
      font: FONT_FAMILY,
      size: FONT_SIZE_HALF_PT,
      bold: true,
      underline: { type: UnderlineType.SINGLE },
    })],
  });

  const spacer = new Paragraph({ text: '' });

  // --- Create Body Table with 3 Columns ---
  // Table Width: 14400 twips (11 inches landscape minus 1 inch total margins)
  // Arabic (30% = 4320 twips)
  // Transliteration in Arabic script (35% = 5040 twips)
  // English (35% = 5040 twips)
  const tableWidth = 14400; 
  const arabicColWidth = 4320;
  const transliterationColWidth = 5040;
  const englishColWidth = 5040;

  // Generous padding between column borders and text (in twips: 240 twips = 12pt)
  const cellMargins = {
    top: 160,
    bottom: 160,
    left: 240,
    right: 240,
  };

  const tableRows = bodyPairs.map(pair => new TableRow({
    cantSplit: true, 
    children: [
      // Arabic Original Cell
      new TableCell({
        verticalAlign: VerticalAlign.TOP,
        margins: cellMargins,
        children: createParagraphsFromText(pair.arabic, true, AlignmentType.RIGHT),
      }),
      // Transliterated English Cell (in Arabic script)
      new TableCell({
        verticalAlign: VerticalAlign.TOP,
        margins: cellMargins,
        children: createParagraphsFromText(pair.transliteration || '', true, AlignmentType.RIGHT),
      }),
      // English Translation Cell
      new TableCell({
        verticalAlign: VerticalAlign.TOP,
        margins: cellMargins,
        children: createParagraphsFromText(pair.english, false, AlignmentType.LEFT),
      }),
    ],
  }));

  const bodyTable = new Table({
    rows: tableRows,
    width: { size: tableWidth, type: WidthType.DXA },
    columnWidths: [arabicColWidth, transliterationColWidth, englishColWidth],
    margins: cellMargins,
  });

  // --- Assemble Document ---
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: {
            width: 15840,  // 11 inches
            height: 12240, // 8.5 inches
          },
          orientation: PageOrientation.LANDSCAPE,
          margin: { top: 720, right: 720, bottom: 720, left: 720 }, // 0.5 inch margins
        },
      },
      children: [
        arabicTitle,
        ...(transliteratedTitle ? [transliteratedTitle] : []),
        englishTitle,
        spacer,
        ...(bodyPairs.length > 0 ? [bodyTable] : []),
      ],
    }],
  });

  // --- Generate and Download ---
  Packer.toBlob(doc).then(blob => {
    const baseFilename = sanitizeFilename(englishTitleText);
    const filename = `${baseFilename} (Arabic + Transliteration + English).docx`;
    saveAs(blob, filename);
  }).catch(error => {
    console.error("Error generating Word document:", error);
  });
};
