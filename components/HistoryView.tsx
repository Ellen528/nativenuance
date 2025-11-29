import React, { useState } from 'react';
import { SavedVocabularyItem, SavedAnalysis } from '../types';
import { Volume2, Trash2, RotateCw, ChevronLeft, ChevronRight, BookOpen, FileText, Calendar, ArrowRight } from 'lucide-react';
import { generateSpeech } from '../services/geminiService';

interface Props {
  items: SavedVocabularyItem[];
  onRemove: (id: string) => void;
  savedAnalyses: SavedAnalysis[];
  onLoadAnalysis: (analysis: SavedAnalysis) => void;
  onRemoveAnalysis: (id: string) => void;
}

const HistoryView: React.FC<Props> = ({ items, onRemove, savedAnalyses, onLoadAnalysis, onRemoveAnalysis }) => {
  const [activeTab, setActiveTab] = useState<'vocabulary' | 'analyses'>('vocabulary');
  const [mode, setMode] = useState<'list' | 'flashcard'>('list');
  const [cardIndex, setCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const handlePlayAudio = async (e: React.MouseEvent, text: string, id: string) => {
    e.stopPropagation();
    if (playingId) return;
    setPlayingId(id);
    try {
      await generateSpeech(text);
    } finally {
      setPlayingId(null);
    }
  };

  const nextCard = () => {
    setIsFlipped(false);
    setCardIndex((prev) => (prev + 1) % items.length);
  };

  const prevCard = () => {
    setIsFlipped(false);
    setCardIndex((prev) => (prev - 1 + items.length) % items.length);
  };

  if (items.length === 0 && savedAnalyses.length === 0) {
    return (
      <div className="text-center py-20">
        <BookOpen className="w-16 h-16 text-slate-200 mx-auto mb-4" />
        <h3 className="text-xl font-serif text-slate-600">No history yet.</h3>
        <p className="text-slate-400">Analyze text or topics and save results to see them here.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      {/* Tabs */}
      <div className="flex justify-center mb-8 border-b border-slate-200">
        <div className="flex gap-8">
          <button
            onClick={() => setActiveTab('vocabulary')}
            className={`pb-4 text-sm font-bold uppercase tracking-wider transition-all border-b-2 ${activeTab === 'vocabulary'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
          >
            Vocabulary ({items.length})
          </button>
          <button
            onClick={() => setActiveTab('analyses')}
            className={`pb-4 text-sm font-bold uppercase tracking-wider transition-all border-b-2 ${activeTab === 'analyses'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
          >
            Saved Analyses ({savedAnalyses.length})
          </button>
        </div>
      </div>

      {activeTab === 'vocabulary' ? (
        <>
          <div className="flex justify-center mb-8">
            <div className="bg-white p-1 rounded-lg border border-slate-200 flex shadow-sm">
              <button
                onClick={() => setMode('list')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${mode === 'list' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'
                  }`}
              >
                List Review
              </button>
              <button
                onClick={() => setMode('flashcard')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${mode === 'flashcard' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'
                  }`}
              >
                Flashcards
              </button>
            </div>
          </div>

          {mode === 'list' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {items.map((item) => (
                <div key={item.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all group">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                      {item.category}
                    </span>
                    <button
                      onClick={() => onRemove(item.id)}
                      className="text-slate-300 hover:text-red-500 transition-colors p-1"
                      title="Remove from history"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-2 mb-2">
                    <h4 className="text-xl font-bold text-slate-900 font-serif">{item.term}</h4>
                    <button
                      onClick={(e) => handlePlayAudio(e, item.term, item.id)}
                      className={`p-2 rounded-full hover:bg-slate-100 transition-colors ${playingId === item.id ? 'text-emerald-500 animate-pulse' : 'text-slate-400'}`}
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>

                  <p className="text-sm text-slate-600 mb-2">{item.definition}</p>
                  <p className="text-xs text-slate-400 italic">"{item.example_usage}"</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <div
                className="relative w-full max-w-xl h-80 perspective-1000 cursor-pointer group"
                onClick={() => setIsFlipped(!isFlipped)}
              >
                <div className={`relative w-full h-full transition-transform duration-500 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
                  {/* Front */}
                  <div className="absolute inset-0 backface-hidden bg-white rounded-2xl shadow-xl border border-slate-200 flex flex-col items-center justify-center p-8">
                    <span className="absolute top-6 left-6 text-xs font-bold text-slate-400 uppercase">{items[cardIndex].category}</span>
                    <h3 className="text-4xl font-serif font-bold text-slate-900 text-center">{items[cardIndex].term}</h3>
                    <p className="mt-6 text-slate-400 text-sm">Click to reveal definition</p>
                    <button
                      onClick={(e) => handlePlayAudio(e, items[cardIndex].term, items[cardIndex].id)}
                      className="absolute bottom-6 right-6 p-3 rounded-full bg-slate-50 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 transition-colors z-10"
                    >
                      <Volume2 className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Back */}
                  <div className="absolute inset-0 backface-hidden bg-slate-900 rounded-2xl shadow-xl rotate-y-180 flex flex-col items-center justify-center p-8 text-center">
                    <p className="text-white text-lg mb-4 font-medium">{items[cardIndex].definition}</p>
                    <div className="w-full border-t border-slate-700 my-4"></div>
                    <p className="text-emerald-400 italic text-sm">"{items[cardIndex].example_usage}"</p>
                    <p className="mt-4 text-slate-400 text-xs">{items[cardIndex].nuance}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-8 mt-8">
                <button onClick={prevCard} className="p-3 rounded-full bg-white shadow-md hover:bg-slate-50 text-slate-600">
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <span className="text-sm font-medium text-slate-500">
                  {cardIndex + 1} / {items.length}
                </span>
                <button onClick={nextCard} className="p-3 rounded-full bg-white shadow-md hover:bg-slate-50 text-slate-600">
                  <ChevronRight className="w-6 h-6" />
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-4">
          {savedAnalyses.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-300">
              <p className="text-slate-500">No saved analyses yet.</p>
            </div>
          ) : (
            savedAnalyses.map(analysis => (
              <div key={analysis.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all group">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold uppercase tracking-wider">
                      {analysis.sourceType}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <Calendar className="w-3 h-3" />
                      {new Date(analysis.date).toLocaleDateString()}
                    </span>
                  </div>
                  <button
                    onClick={() => onRemoveAnalysis(analysis.id)}
                    className="text-slate-300 hover:text-red-500 transition-colors p-2 hover:bg-red-50 rounded-full"
                    title="Remove analysis"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <h3 className="text-xl font-serif font-bold text-slate-900 mb-2 line-clamp-1">
                  {analysis.fileName || "Text Analysis"}
                </h3>

                <p className="text-slate-600 mb-6 line-clamp-2">
                  {analysis.analysisResult.summary}
                </p>

                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <div className="flex gap-4 text-sm text-slate-500">
                    <span className="flex items-center gap-1">
                      <BookOpen className="w-4 h-4" />
                      {analysis.analysisResult.vocabulary.length} words
                    </span>
                  </div>

                  <button
                    onClick={() => onLoadAnalysis(analysis)}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors"
                  >
                    Load Analysis <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default HistoryView;
