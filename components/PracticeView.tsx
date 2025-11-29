
import React, { useState } from 'react';
import { GeneratedPractice } from '../types';
import { RefreshCw, Check, Volume2, X, ArrowRight, Loader2 } from 'lucide-react';
import { generateSpeech } from '../services/geminiService';

interface Props {
  data: GeneratedPractice;
  onClose: () => void;
  onNextBatch?: () => void;
  isNextAvailable?: boolean;
  isLoadingNext?: boolean;
}

const PracticeView: React.FC<Props> = ({ data, onClose, onNextBatch, isNextAvailable, isLoadingNext }) => {
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);

  const handlePlayAudio = async (text: string, index: number) => {
    if (playingIndex !== null) return;
    
    setPlayingIndex(index);
    try {
      await generateSpeech(text);
    } finally {
      setPlayingIndex(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-4xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white z-10 flex-shrink-0">
          <div>
            <h2 className="text-2xl font-serif font-bold text-slate-800">Practice Scenario</h2>
            <p className="text-sm text-slate-500">Compare and speak aloud</p>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-slate-50/50 scrollbar-thin">
          
          {isLoadingNext ? (
              <div className="flex flex-col items-center justify-center h-full opacity-50">
                 <Loader2 className="w-10 h-10 text-emerald-600 animate-spin mb-2" />
                 <p className="text-slate-500">Generating next scenario...</p>
              </div>
          ) : (
            <>
              <div className="bg-indigo-50 p-6 rounded-xl border border-indigo-100">
                <h3 className="text-sm font-bold text-indigo-600 uppercase tracking-wide mb-2">Context</h3>
                <p className="text-lg text-slate-800 font-serif">{data.scenario}</p>
              </div>

              <div className="space-y-8">
                {data.sentences.map((item, idx) => (
                  <div key={idx} className="group relative bg-white p-6 rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition-all">
                    <div className="absolute left-0 top-6 bottom-6 w-1 bg-slate-200 group-hover:bg-indigo-500 transition-colors rounded-r-full"></div>
                    
                    <div className="grid md:grid-cols-2 gap-8 mb-4">
                      {/* Standard Version */}
                      <div className="space-y-2 opacity-80">
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Typical (IELTS 6.0)</p>
                        <p className="text-slate-600 font-medium text-lg leading-relaxed font-serif border-l-2 border-slate-200 pl-4">
                          "{item.original_concept}"
                        </p>
                      </div>
                      
                      {/* Native Version */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <p className="text-xs text-emerald-600 font-bold uppercase tracking-wider flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            Native (Precise)
                          </p>
                          <button
                            onClick={() => handlePlayAudio(item.native_version, idx)}
                            className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full transition-colors ${
                              playingIndex === idx 
                                ? 'bg-emerald-100 text-emerald-700' 
                                : 'bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-600'
                            }`}
                          >
                            <Volume2 className={`w-3 h-3 ${playingIndex === idx ? 'animate-pulse' : ''}`} />
                            {playingIndex === idx ? 'Playing...' : 'Listen'}
                          </button>
                        </div>
                        <p className="text-slate-900 font-medium text-lg leading-relaxed font-serif border-l-2 border-emerald-500 pl-4 bg-emerald-50/30 py-2 rounded-r-lg">
                          "{item.native_version}"
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-50">
                      <p className="text-sm text-slate-600 italic leading-relaxed flex gap-2">
                        <span className="font-semibold text-indigo-600 not-italic flex-shrink-0">Why it's better:</span> 
                        {item.explanation}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="p-6 border-t border-slate-100 bg-white flex justify-between items-center flex-shrink-0">
          <div className="text-sm text-slate-400">
            {isNextAvailable ? "More words available" : "Set complete"}
          </div>
          <div className="flex gap-4">
            <button
                onClick={onClose}
                className="px-4 py-2 text-slate-500 hover:text-slate-800 font-medium transition-colors"
            >
                Close
            </button>
            {isNextAvailable && onNextBatch && (
                <button
                    onClick={onNextBatch}
                    disabled={isLoadingNext}
                    className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium transition-all shadow-lg hover:shadow-xl disabled:bg-slate-300"
                >
                    {isLoadingNext ? <Loader2 className="animate-spin w-4 h-4" /> : 'Practice Next Batch'}
                    {!isLoadingNext && <ArrowRight className="w-4 h-4" />}
                </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PracticeView;
