import React from 'react';
import { Note } from '../types';
import { Trash2, MessageSquare, Clock } from 'lucide-react';

interface Props {
    notes: Note[];
    onRemoveNote: (id: string) => void;
}

const NotesSidebar: React.FC<Props> = ({ notes, onRemoveNote }) => {
    if (notes.length === 0) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 text-center">
                <MessageSquare className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                <h3 className="text-sm font-bold text-slate-700">No Notes Yet</h3>
                <p className="text-xs text-slate-500 mt-1">
                    Look up a word and click "Add Note" to save it here.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="w-4 h-4 text-indigo-600" />
                <h3 className="font-bold text-slate-800 uppercase tracking-wide text-xs">
                    Your Notes ({notes.length})
                </h3>
            </div>

            <div className="space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto scrollbar-thin pr-1">
                {notes.map((note) => (
                    <div key={note.id} className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 hover:border-indigo-200 transition-all group relative">
                        <button
                            onClick={() => onRemoveNote(note.id)}
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all p-1"
                            title="Delete note"
                        >
                            <Trash2 className="w-3 h-3" />
                        </button>

                        <div className="mb-2">
                            <h4 className="font-serif font-bold text-slate-900">{note.word}</h4>
                            <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                                <Clock className="w-3 h-3" />
                                {new Date(note.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>

                        <p className="text-xs text-slate-600 mb-2 leading-relaxed border-l-2 border-indigo-100 pl-2">
                            {note.definition}
                        </p>

                        <div className="bg-slate-50 p-2 rounded text-[10px] text-slate-500 italic">
                            "{note.context}"
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default NotesSidebar;
