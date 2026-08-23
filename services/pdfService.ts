
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

// Helper to sanitize filenames.
const sanitizeFilename = (name: string): string => {
  return name.replace(/[^a-z0-9\s-]/gi, '').trim().replace(/\s+/g, ' ').slice(0, 50) || 'translation';
};

// Helper to convert a string to Title Case.
const toTitleCase = (str: string): string => {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export const exportToWord = (data: TranslationPair[]): void => {
  if (!data || data.length === 0) {
    console.error("No data available to export.");
    return;
  }

  const titlePair = data[0];
  const bodyPairs = data.length > 1 ? data.slice(1) : [];
  
  const FONT_FAMILY = 'Arial';
  const FONT_SIZE_PT = 24;
  const FONT_SIZE_HALF_PT = FONT_SIZE_PT * 2;
  
  const englishTitleText = toTitleCase(titlePair.english);

  // Helper to create paragraphs. 
  const createParagraphsFromText = (text: string, isRtl: boolean, alignment: AlignmentType) => {
    const lines = text.split(/\r?\n/);
    return lines.map(line => new Paragraph({
      alignment: alignment,   // RIGHT for Arabic
      children: [new TextRun({
        text: line.trim(),
        font: FONT_FAMILY,
        size: FONT_SIZE_HALF_PT,
        rtl: isRtl,           // This handles the character order correctly
      })],
    }));
  };

  // --- Create Title Paragraphs ---
  const arabicTitle = new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({
      text: titlePair.arabic,
      font: FONT_FAMILY,
      size: FONT_SIZE_HALF_PT,
      bold: true,
      underline: { type: UnderlineType.SINGLE },
      rtl: true,
    })],
  });

  const transliteratedTitle = titlePair.transliteration ? new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({
      text: titlePair.transliteration,
      font: FONT_FAMILY,
      size: FONT_SIZE_HALF_PT,
      bold: true,
      underline: { type: UnderlineType.SINGLE },
      rtl: true,
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
