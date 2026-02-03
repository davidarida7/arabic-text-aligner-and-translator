
import React, { useState, useCallback, useEffect } from 'react';
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

const Loader: React.FC = () => {
  const [msgIndex, setMsgIndex] = useState(0);
  const messages = [
    "Analyzing Arabic text structure...",
    "Translating with high precision...",
    "Aligning segments for side-by-side view...",
    "Polishing the output...",
    "Almost there..."
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIndex((prev) => (prev + 1) % messages.length);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center space-y-4 p-8 animate-in fade-in duration-500">
      <div className="relative">
        <div className="w-16 h-16 border-4 border-blue-100 border-solid rounded-full"></div>
        <div className="absolute top-0 left-0 w-16 h-16 border-4 border-blue-600 border-t-transparent border-solid rounded-full animate-spin"></div>
      </div>
      <p className="text-slate-600 font-medium transition-all duration-300">{messages[msgIndex]}</p>
    </div>
  );
};

interface TranslationTableProps {
  data: TranslationPair[];
}
const TranslationTable: React.FC<TranslationTableProps> = ({ data }) => (
  <div className="w-full max-w-4xl mx-auto overflow-hidden rounded-lg shadow-lg border border-slate-200 animate-in slide-in-from-bottom-4 duration-700">
    <table className="min-w-full bg-white">
      <tbody className="text-slate-700">
        {data.map((pair, index) => (
          <tr key={index} className="border-b border-slate-200 hover:bg-slate-50 transition-colors duration-150">
            <td 
              className="py-4 px-6 text-right align-top font-serif whitespace-pre-wrap text-lg leading-relaxed" 
              dir="rtl" 
              lang="ar"
            >
              {pair.arabic}
            </td>
            <td className="py-4 px-6 text-left align-top whitespace-pre-wrap text-lg leading-relaxed">
              {pair.english}
            </td>
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
      setTimeout(() => setIsExporting(false), 800);
    }
  };

  const titlePair = translationPairs.length > 0 ? translationPairs[0] : null;
  const tableData = translationPairs.length > 1 ? translationPairs.slice(1) : [];

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col items-center">
      <Header />
      <main className="w-full flex-grow p-4 md:p-8 flex flex-col items-center">
        <div className="w-full max-w-4xl bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-8 transition-all hover:shadow-md">
          <h2 className="text-xl font-semibold text-slate-800 mb-4">Source Arabic Text</h2>
          <textarea
            value={arabicText}
            onChange={(e) => setArabicText(e.target.value)}
            placeholder="...أدخل النص العربي هنا (Enter Arabic text here...)"
            dir="rtl"
            lang="ar"
            className="w-full h-48 p-4 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-right font-serif text-lg resize-y outline-none"
            disabled={isLoading}
          />
          <div className="flex justify-end mt-4">
            <button
              onClick={handleTranslate}
              disabled={isLoading || !arabicText.trim()}
              className="px-8 py-3 bg-blue-600 text-white font-bold rounded-lg shadow hover:bg-blue-700 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center"
            >
              {isLoading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </span>
              ) : (
                'Translate & Align'
              )}
            </button>
          </div>
        </div>

        {isLoading && <Loader />}
        
        {error && (
          <div className="w-full max-w-4xl bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg my-4 animate-in fade-in" role="alert">
            <strong className="font-bold">Notice: </strong>
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        {translationPairs.length > 0 && !isLoading && (
          <div className="w-full flex-grow flex flex-col items-center">
            {titlePair && (
              <div className="text-center mb-8 max-w-4xl px-4 animate-in fade-in slide-in-from-top-2 duration-500">
                <h2 className="text-3xl font-bold text-slate-800 whitespace-pre-wrap mb-3 leading-tight" dir="rtl" lang="ar">
                  {titlePair.arabic}
                </h2>
                <div className="w-24 h-1 bg-blue-500 mx-auto mb-4 rounded-full"></div>
                <p className="text-2xl text-slate-600 whitespace-pre-wrap italic">
                  {titlePair.english}
                </p>
              </div>
            )}
            
            {tableData.length > 0 && <TranslationTable data={tableData} />}
            
            <div className="w-full max-w-4xl flex flex-col items-center justify-center mt-10 p-8 bg-white rounded-xl shadow-sm border border-slate-200 mb-12 animate-in fade-in delay-300">
              <h3 className="text-xl font-bold text-slate-800 mb-2">Ready to save?</h3>
              <p className="text-slate-500 mb-6">Download a professionally formatted side-by-side Microsoft Word document.</p>
              <button
                onClick={handleExport}
                disabled={isExporting}
                className="px-10 py-4 bg-green-600 text-white font-bold rounded-xl shadow-lg hover:bg-green-700 active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center"
              >
                {isExporting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creating Document...
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Export to Word (.docx)
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </main>
      <footer className="w-full p-6 text-center text-slate-400 text-sm">
        &copy; {new Date().getFullYear()} Arabic Aligner & Translator
      </footer>
    </div>
  );
};

export default App;
