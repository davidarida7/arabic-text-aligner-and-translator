
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
  // We explicitly set Alignment to RIGHT for Arabic and remove bidirectional: true 
  // because Word often treats bidi+right as a "Start" alignment that defaults to Left in many viewers.
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

  // --- Create Body Table ---
  const tableRows = bodyPairs.map(pair => new TableRow({
    cantSplit: true, 
    children: [
      // Arabic Cell
      new TableCell({
        verticalAlign: VerticalAlign.TOP,
        children: createParagraphsFromText(pair.arabic, true, AlignmentType.RIGHT),
      }),
      // English Cell
      new TableCell({
        verticalAlign: VerticalAlign.TOP,
        children: createParagraphsFromText(pair.english, false, AlignmentType.LEFT),
      }),
    ],
  }));

  const tableWidth = 14400; // 10 inches in twips
  const columnWidth = tableWidth / 2;

  const bodyTable = new Table({
    rows: tableRows,
    width: { size: tableWidth, type: WidthType.DXA },
    columnWidths: [columnWidth, columnWidth],
  });

  // --- Assemble Document ---
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: {
            width: 15840,  
            height: 12240, 
          },
          orientation: PageOrientation.LANDSCAPE,
          margin: { top: 720, right: 720, bottom: 720, left: 720 },
        },
      },
      children: [
        arabicTitle,
        englishTitle,
        spacer,
        ...(bodyPairs.length > 0 ? [bodyTable] : []),
      ],
    }],
  });

  // --- Generate and Download ---
  Packer.toBlob(doc).then(blob => {
    const baseFilename = sanitizeFilename(englishTitleText);
    const filename = `${baseFilename} (Arabic + English).docx`;
    saveAs(blob, filename);
  }).catch(error => {
    console.error("Error generating Word document:", error);
  });
};
