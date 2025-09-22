import React, { useState, useCallback } from 'react';
import { translateAndAlignText } from './services/geminiService';
import { exportToWord } from './services/pdfService';
import type { TranslationPair } from './types';

// --- Helper & UI Components ---

const Header: React.FC = () => (
  <header className="w-full bg-slate-800 text-white p-4 text-center shadow-md">
    <h1 className="text-2xl font-bold">Arabic Text Aligner & Translator</h1>
    <p className="text-sm text-slate-300">Translate, Align, and Export to Word</p>
  </header>
);

const Loader: React.FC<{ message?: string }> = ({ message = "Translating and aligning text..." }) => (
  <div className="flex flex-col items-center justify-center space-y-3 p-8">
    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent border-solid rounded-full animate-spin"></div>
    <p className="text-slate-600">{message}</p>
  </div>
);

interface TranslationTableProps {
  data: TranslationPair[];
}
const TranslationTable: React.FC<TranslationTableProps> = ({ data }) => (
  <div className="w-full max-w-4xl mx-auto overflow-hidden rounded-lg shadow-lg border border-slate-200">
    <table className="min-w-full bg-white">
      <tbody className="text-slate-700">
        {data.map((pair, index) => (
          <tr key={index} className="border-b border-slate-200 hover:bg-slate-50">
            <td className="py-3 px-6 text-right align-top font-serif" dir="rtl" lang="ar">{pair.arabic}</td>
            <td className="py-3 px-6 text-left align-top">{pair.english}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// --- Main App Component ---

const App: React.FC = () => {
  const [arabicText, setArabicText] = useState<string>('');
  const [translationPairs, setTranslationPairs] = useState<TranslationPair[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const handleTranslate = useCallback(async () => {
    if (!arabicText.trim()) {
      setError("Please enter some Arabic text to translate.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setTranslationPairs([]);

    try {
      const result = await translateAndAlignText(arabicText);
      setTranslationPairs(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred.");
    } finally {
      setIsLoading(false);
    }
  }, [arabicText]);

  const handleExport = () => {
    if (translationPairs.length === 0) {
      setError("There is nothing to export.");
      return;
    }
    setIsExporting(true);
    setError(null);
    try {
      exportToWord(translationPairs);
    } catch (err) {
       setError(err instanceof Error ? err.message : "An unknown error occurred during export.");
    } finally {
      // The generation is fast, but a timeout provides better UX feedback
      setTimeout(() => setIsExporting(false), 500);
    }
  };

  const titlePair = translationPairs.length > 0 ? translationPairs[0] : null;
  const tableData = translationPairs.length > 1 ? translationPairs.slice(1) : [];

  return (
    <div className="min-h-screen bg-slate-100 font-sans flex flex-col items-center">
      <Header />
      <main className="w-full flex-grow p-4 md:p-8 flex flex-col items-center">
        <div className="w-full max-w-4xl bg-white p-6 rounded-lg shadow-md mb-8">
          <h2 className="text-xl font-semibold text-slate-800 mb-4">Enter Arabic Text</h2>
          <textarea
            value={arabicText}
            onChange={(e) => setArabicText(e.target.value)}
            placeholder="...اكتب النص العربي هنا"
            dir="rtl"
            lang="ar"
            className="w-full h-48 p-3 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200 text-right font-serif resize-y"
            disabled={isLoading}
          />
          <div className="flex flex-col sm:flex-row justify-end items-center mt-4">
            <button
              onClick={handleTranslate}
              disabled={isLoading || !arabicText.trim()}
              className="w-full sm:w-auto px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors duration-200 flex items-center justify-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path d="M7 2a1 1 0 011-1h3.414a1 1 0 01.707.293l2.828 2.828a1 1 0 01.293.707V9a1 1 0 01-1 1h-1v1a1 1 0 102 0V9a3 3 0 00-3-3H8a3 3 0 00-3 3v1.586A3.001 3.001 0 005 15v1.5a1.5 1.5 0 002.321 1.28l.179-.089a4.95 4.95 0 00-.814-1.29V15a1 1 0 112 0v.01a4.978 4.978 0 002.049 2.503l.3.15a1.5 1.5 0 001.33-2.593l-.15-.3a4.978 4.978 0 00-2.503-2.049V13a1 1 0 112 0v.023c.961.189 1.832.615 2.56 1.242l.3.26a1.5 1.5 0 002.21-2.07l-.26-.3a6.953 6.953 0 00-3.48-1.725V9a1 1 0 10-2 0v1a1 1 0 11-2 0V9a1 1 0 011-1h1V3H8a1 1 0 01-1-1z" />
              </svg>
              Translate
            </button>
          </div>
        </div>

        {isLoading && <Loader />}
        
        {error && (
          <div className="w-full max-w-4xl bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg my-4" role="alert">
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        {translationPairs.length > 0 && !isLoading && (
          <div className="w-full flex-grow flex flex-col items-center">
            {titlePair && (
              <div className="text-center mb-6 max-w-4xl px-4">
                <h2 className="text-3xl font-bold text-slate-800" dir="rtl" lang="ar">{titlePair.arabic}</h2>
                <p className="text-2xl text-slate-600 mt-2">{titlePair.english}</p>
              </div>
            )}
            
            {tableData.length > 0 && <TranslationTable data={tableData} />}
            
            <div className="w-full max-w-4xl flex flex-col items-center justify-center mt-6 p-4 bg-white rounded-lg shadow-md">
              <h3 className="text-lg font-semibold text-slate-800 mb-3">Export Document</h3>
              <button
                onClick={handleExport}
                disabled={isExporting}
                className="px-6 py-2 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors duration-200 flex items-center justify-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                {isExporting ? 'Generating...' : 'Export to Word (.docx)'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
