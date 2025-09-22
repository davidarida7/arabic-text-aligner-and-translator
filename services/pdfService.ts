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
// Removes invalid characters, collapses whitespace to single spaces, and trims.
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

  // --- Create Title Paragraphs ---
  const arabicTitle = new Paragraph({
    alignment: AlignmentType.CENTER,
    bidirectional: true,
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
    children: [
      // Arabic Cell
      new TableCell({
        verticalAlign: VerticalAlign.TOP,
        children: [new Paragraph({
          bidirectional: true,
          children: [new TextRun({
            text: pair.arabic,
            font: FONT_FAMILY,
            size: FONT_SIZE_HALF_PT,
            rtl: true,
          })],
        })],
      }),
      // English Cell
      new TableCell({
        verticalAlign: VerticalAlign.TOP,
        children: [new Paragraph({
          alignment: AlignmentType.LEFT,
          children: [new TextRun({
            text: pair.english,
            font: FONT_FAMILY,
            size: FONT_SIZE_HALF_PT,
          })],
        })],
      }),
    ],
  }));

  // For landscape orientation, a standard Letter page is 11" x 8.5".
  // 1 inch = 1440 twips (DXA).
  // With 0.5-inch margins (720 twips each), usable width is 10 inches = 14400 twips.
  const tableWidth = 14400;
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
            // Explicitly set page dimensions for landscape for maximum compatibility.
            // US Letter Landscape: 11" x 8.5"
            width: 15840,  // 11 inches in twips
            height: 12240, // 8.5 inches in twips
          },
          orientation: PageOrientation.LANDSCAPE,
          margin: { top: 720, right: 720, bottom: 720, left: 720 }, // 0.5 inch in twips
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