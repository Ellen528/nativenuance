import React, { useState, useEffect, useRef } from 'react';
import { X, Volume2, Loader2, BookOpen } from 'lucide-react';
import { lookupWord, generateSpeech } from '../services/geminiService';

interface Props {
    word: string;
    context: string;
    position: { x: number; y: number };
    onClose: () => void;
    onAddNote: (word: string, definition: string, context: string) => void;
}

const WordLookupPopup: React.FC<Props> = ({ word, context, position, onClose, onAddNote }) => {
    const [data, setData] = useState<{ definition: string; pronunciation: string } | null>(null);
    const [loading, setLoading] = useState(true);
    const [playing, setPlaying] = useState(false);
    const popupRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let isMounted = true;
        const fetchDefinition = async () => {
            try {
                const result = await lookupWord(word, context);
                if (isMounted) {
                    setData(result);
                    setLoading(false);
                }
            } catch (error) {
                if (isMounted) {
                    setData({ definition: "Could not find definition.", pronunciation: "" });
                    setLoading(false);
                }
            }
        };

        fetchDefinition();
        return () => { isMounted = false; };
    }, [word, context]);

    const handlePlay = async () => {
        if (playing) return;
        setPlaying(true);
        try {
            await generateSpeech(word);
        } finally {
            setPlaying(false);
        }
    };

    // Adjust position to keep within viewport
    const style: React.CSSProperties = {
        top: position.y + 20, // Offset below cursor
        left: Math.min(Math.max(10, position.x - 150), window.innerWidth - 320), // Center but keep in bounds
    };

    return (
        <div
            ref={popupRef}
            className="fixed z-50 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 p-4 animate-fade-in"
            style={style}
            onMouseDown={(e) => e.stopPropagation()} // Prevent closing when clicking inside
        >
            <div className="flex justify-between items-start mb-3">
                <h4 className="font-serif font-bold text-lg text-slate-900 line-clamp-1" title={word}>
                    {word}
                </h4>
                <div className="flex gap-1">
                    <button
                        onClick={handlePlay}
                        className={`p-1 rounded-full hover:bg-slate-100 transition-colors ${playing ? 'text-emerald-500 animate-pulse' : 'text-slate-400'}`}
                    >
                        <Volume2 className="w-4 h-4" />
                    </button>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-full hover:bg-slate-100 text-slate-400 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-4 text-indigo-600">
                    <Loader2 className="w-6 h-6 animate-spin" />
                </div>
            ) : (
                <div>
                    {data?.pronunciation && (
                        <div className="text-sm font-mono text-indigo-600 mb-2 bg-indigo-50 inline-block px-2 py-0.5 rounded">
                            {data.pronunciation}
                        </div>
                    )}
                    <div className="text-sm text-slate-600 leading-relaxed">
                        {data?.definition}
                    </div>
                </div>
            )}

            <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between gap-1 text-xs text-slate-400">
                <div className="flex items-center gap-1">
                    <BookOpen className="w-3 h-3" />
                    <span>Context-aware definition</span>
                </div>
                {!loading && data && (
                    <button
                        onClick={() => onAddNote(word, data.definition, context)}
                        className="text-indigo-600 hover:text-indigo-700 font-medium hover:underline"
                    >
                        Add to Notes
                    </button>
                )}
            </div>
        </div>
    );
};

export default WordLookupPopup;
