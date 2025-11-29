import React, { useState } from 'react';
import { SavedAnalysis } from '../types';
import { Plus, MessageSquare, Trash2, ChevronLeft, Sparkles, LogOut, LogIn, Download, Cloud, CloudOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import AuthModal from './AuthModal';

interface Props {
    savedAnalyses: SavedAnalysis[];
    onLoadAnalysis: (analysis: SavedAnalysis) => void;
    onNewAnalysis: () => void;
    onRemoveAnalysis: (id: string) => void;
    isOpen: boolean;
    toggleSidebar: () => void;
    onExportData?: () => void;
}

const Sidebar: React.FC<Props> = ({ savedAnalyses, onLoadAnalysis, onNewAnalysis, onRemoveAnalysis, isOpen, toggleSidebar, onExportData }) => {
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const { user, isAuthenticated, signOut, isLoading } = useAuth();

    const handleSignOut = async () => {
        await signOut();
    };

    const getUserInitial = () => {
        if (user?.email) {
            return user.email.charAt(0).toUpperCase();
        }
        return '?';
    };

    const getUserDisplay = () => {
        if (user?.email) {
            // Show first part of email before @
            const emailName = user.email.split('@')[0];
            return emailName.length > 12 ? emailName.substring(0, 12) + '...' : emailName;
        }
        return 'User';
    };

    return (
        <>
            <div className={`bg-slate-900 text-slate-300 flex flex-col transition-all duration-300 ${isOpen ? 'w-64' : 'w-0'} overflow-hidden relative`}>

                {/* Toggle Button (Visible when open, absolute positioned) */}
                {isOpen && (
                    <button
                        onClick={toggleSidebar}
                        className="absolute top-4 right-4 p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                )}

                {/* Header / New Analysis */}
                <div className="p-4">
                    <div className="flex items-center gap-2 mb-6 px-2">
                        <Sparkles className="w-6 h-6 text-emerald-400" />
                        <span className="font-serif font-bold text-white text-lg tracking-tight">NativeNuance</span>
                    </div>

                    <button
                        onClick={onNewAnalysis}
                        className="w-full flex items-center gap-2 px-3 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all shadow-lg hover:shadow-emerald-900/20 font-medium text-sm"
                    >
                        <Plus className="w-4 h-4" />
                        New Analysis
                    </button>
                </div>

                {/* Sync Status Indicator */}
                <div className="px-4 pb-2">
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${isAuthenticated ? 'bg-emerald-900/30 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                        {isAuthenticated ? (
                            <>
                                <Cloud className="w-3.5 h-3.5" />
                                <span>Synced to cloud</span>
                            </>
                        ) : (
                            <>
                                <CloudOff className="w-3.5 h-3.5" />
                                <span>Local only</span>
                            </>
                        )}
                    </div>
                </div>

                {/* History List */}
                <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                    <div className="px-4 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        History
                    </div>

                    {savedAnalyses.length === 0 ? (
                        <div className="px-4 py-4 text-center text-slate-500 text-sm italic">
                            No saved analyses yet.
                        </div>
                    ) : (
                        savedAnalyses.map(analysis => (
                            <div key={analysis.id} className="group relative">
                                <button
                                    onClick={() => onLoadAnalysis(analysis)}
                                    className="w-full text-left px-3 py-3 rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-3 text-sm group-hover:text-white"
                                >
                                    <MessageSquare className="w-4 h-4 text-slate-500 group-hover:text-slate-400 shrink-0" />
                                    <div className="truncate flex-1">
                                        {analysis.fileName || analysis.analysisResult.summary.substring(0, 30) + "..."}
                                    </div>
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onRemoveAnalysis(analysis.id); }}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                                >
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            </div>
                        ))
                    )}
                </div>

                {/* Export Button */}
                {onExportData && savedAnalyses.length > 0 && (
                    <div className="px-4 pb-2">
                        <button
                            onClick={onExportData}
                            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 hover:text-white transition-all text-sm"
                        >
                            <Download className="w-4 h-4" />
                            Export as JSON
                        </button>
                    </div>
                )}

                {/* Footer - User Section */}
                <div className="p-4 border-t border-slate-800">
                    {isLoading ? (
                        <div className="flex items-center gap-3 px-2 py-2">
                            <div className="w-8 h-8 rounded-full bg-slate-700 animate-pulse" />
                            <div className="h-4 w-20 bg-slate-700 rounded animate-pulse" />
                        </div>
                    ) : isAuthenticated ? (
                        <div className="space-y-2">
                            <div className="flex items-center gap-3 px-2 py-2">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-blue-500 flex items-center justify-center text-white font-bold text-xs shadow-lg">
                                    {getUserInitial()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-slate-200 truncate">
                                        {getUserDisplay()}
                                    </div>
                                    <div className="text-xs text-slate-500">Signed in</div>
                                </div>
                            </div>
                            <button
                                onClick={handleSignOut}
                                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-all text-sm"
                            >
                                <LogOut className="w-4 h-4" />
                                Sign Out
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setIsAuthModalOpen(true)}
                            className="w-full flex items-center justify-center gap-2 px-3 py-3 bg-gradient-to-r from-emerald-600 to-blue-600 text-white rounded-lg hover:from-emerald-700 hover:to-blue-700 transition-all shadow-lg font-medium text-sm"
                        >
                            <LogIn className="w-4 h-4" />
                            Sign In to Sync
                        </button>
                    )}
                </div>
            </div>

            {/* Auth Modal */}
            <AuthModal 
                isOpen={isAuthModalOpen} 
                onClose={() => setIsAuthModalOpen(false)} 
            />
        </>
    );
};

export default Sidebar;
