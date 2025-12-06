
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { analyzeText, generatePractice, generateTopicStrategy } from './services/geminiService';
import { AnalysisResult, SourceType, VocabularyItem, GeneratedPractice, AppMode, SavedAnalysis, Note, AnalysisFolder } from './types';
import AnalysisView from './components/AnalysisView';
import PracticeView from './components/PracticeView';
import HistoryView from './components/HistoryView';
import Sidebar from './components/Sidebar';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { dataService } from './services/dataService';
import { Sparkles, FileText, Tv, Book, Mail, Loader2, ArrowRight, AlertCircle, Layers, Upload, File as FileIcon, X, Menu } from 'lucide-react';

// Example text for quick start
const EXAMPLE_TEXT = `While the tech giant's quarterly earnings beat expectations, the lukewarm guidance for Q4 sent shares tumbling in after-hours trading. Analysts cite saturating markets and headwinds in the supply chain as key factors dampening investor sentiment. However, bulls argue that the company's pivot to AI infrastructure is a long-term play that hasn't yet been priced in by the broader market.`;

const PRESET_TOPICS = [
  "Describe a challenging situation at work",
  "Discuss the impact of social media",
  "Describe a traditional festival in your country",
  "Talk about a book that influenced you",
  "Discuss the future of remote work"
];

const BATCH_SIZE = 5;

const AppContent: React.FC = () => {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  
  const [mode, setMode] = useState<AppMode>(AppMode.ANALYZE_TEXT);

  // Analysis State
  const [inputText, setInputText] = useState('');
  const [sourceType, setSourceType] = useState<SourceType>(SourceType.NEWS);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Topic Strategy State
  const [topicInput, setTopicInput] = useState('');

  // Sidebar State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Common State
  const [status, setStatus] = useState<'idle' | 'analyzing' | 'practicing' | 'complete'>('idle');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [practiceResult, setPracticeResult] = useState<GeneratedPractice | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Practice Queue State
  const [practiceQueue, setPracticeQueue] = useState<VocabularyItem[]>([]);
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [isGeneratingNext, setIsGeneratingNext] = useState(false);

  // History State
  const [savedAnalyses, setSavedAnalyses] = useState<SavedAnalysis[]>([]);
  const [analysisFolders, setAnalysisFolders] = useState<AnalysisFolder[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [currentAnalysisId, setCurrentAnalysisId] = useState<string | null>(null);

  const resultRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasLoadedCloudData = useRef(false);

  // Load data from localStorage
  const loadLocalData = useCallback(() => {
    const savedAnalysesData = localStorage.getItem('nativeNuance_analysisHistory');
    if (savedAnalysesData) {
      try {
        setSavedAnalyses(JSON.parse(savedAnalysesData));
      } catch (e) {
        console.error("Failed to parse analysis history", e);
      }
    }

    const savedFoldersData = localStorage.getItem('nativeNuance_analysisFolders');
    if (savedFoldersData) {
      try {
        setAnalysisFolders(JSON.parse(savedFoldersData));
      } catch (e) {
        console.error("Failed to parse folders", e);
      }
    }
  }, []);

  // Load data from Supabase
  const loadCloudData = useCallback(async (userId: string) => {
    setIsDataLoading(true);
    try {
      // Record user visit
      await dataService.recordVisit(userId);

      const [cloudAnalyses, cloudFolders] = await Promise.all([
        dataService.fetchAnalyses(userId),
        dataService.fetchFolders(userId),
      ]);

      // Merge with local data (cloud takes precedence)
      const localAnalyses = JSON.parse(localStorage.getItem('nativeNuance_analysisHistory') || '[]');
      const localFolders = JSON.parse(localStorage.getItem('nativeNuance_analysisFolders') || '[]');

      // Upload any local-only data to cloud
      if (localAnalyses.length > 0) {
        await dataService.syncAnalyses(userId, localAnalyses);
      }
      if (localFolders.length > 0) {
        await dataService.syncFolders(userId, localFolders);
      }

      // Fetch merged data
      const [mergedAnalyses, mergedFolders] = await Promise.all([
        dataService.fetchAnalyses(userId),
        dataService.fetchFolders(userId),
      ]);

      setSavedAnalyses(mergedAnalyses);
      setAnalysisFolders(mergedFolders);

      // Update localStorage with merged data
      localStorage.setItem('nativeNuance_analysisHistory', JSON.stringify(mergedAnalyses));
      localStorage.setItem('nativeNuance_analysisFolders', JSON.stringify(mergedFolders));
    } catch (error) {
      console.error('Error loading cloud data:', error);
      // Fall back to local data
      loadLocalData();
    } finally {
      setIsDataLoading(false);
    }
  }, [loadLocalData]);

  // Initial data load
  useEffect(() => {
    if (authLoading) return;

    if (isAuthenticated && user && !hasLoadedCloudData.current) {
      hasLoadedCloudData.current = true;
      loadCloudData(user.id);
    } else if (!isAuthenticated) {
      hasLoadedCloudData.current = false;
      loadLocalData();
    }
  }, [isAuthenticated, user, authLoading, loadCloudData, loadLocalData]);

  const saveAnalysis = async (notes: Note[] = []) => {
    if (!analysisResult) return;

    // Check if an analysis with the same source already exists
    // For uploaded files: match by fileName
    // For pasted text: match by inputText
    const existingAnalysis = savedAnalyses.find(a => {
      if (fileName && a.fileName) {
        // Both have file names - match by file name
        return a.fileName === fileName;
      } else if (!fileName && !a.fileName) {
        // Both are pasted text - match by content
        return a.inputText === inputText;
      }
      return false;
    });

    if (existingAnalysis) {
      // Update existing analysis (overwrite)
      const updatedAnalysis: SavedAnalysis = {
        ...existingAnalysis,
        date: Date.now(),
        sourceType,
        inputText, // Update with new content
        analysisResult,
        fileName,
        notes: notes.length > 0 ? notes : existingAnalysis.notes // Preserve notes if not provided
      };

      const newHistory = savedAnalyses.map(a => 
        a.id === existingAnalysis.id ? updatedAnalysis : a
      );
      setSavedAnalyses(newHistory);
      localStorage.setItem('nativeNuance_analysisHistory', JSON.stringify(newHistory));

      // Sync to cloud if authenticated
      if (isAuthenticated && user) {
        await dataService.updateAnalysis(user.id, updatedAnalysis);
      }
    } else {
      // Create new analysis
      const newAnalysis: SavedAnalysis = {
        id: crypto.randomUUID(),
        date: Date.now(),
        sourceType,
        inputText,
        analysisResult,
        fileName,
        notes
      };

      const newHistory = [newAnalysis, ...savedAnalyses];
      setSavedAnalyses(newHistory);
      localStorage.setItem('nativeNuance_analysisHistory', JSON.stringify(newHistory));

      // Sync to cloud if authenticated
      if (isAuthenticated && user) {
        await dataService.saveAnalysis(user.id, newAnalysis);
      }
    }
  };

  const loadAnalysis = (analysis: SavedAnalysis) => {
    setInputText(analysis.inputText);
    setSourceType(analysis.sourceType);
    setAnalysisResult(analysis.analysisResult);
    setFileName(analysis.fileName || null);
    setCurrentAnalysisId(analysis.id);
    setMode(AppMode.ANALYZE_TEXT);
    setStatus('complete');
  };

  const removeAnalysis = async (id: string) => {
    const newHistory = savedAnalyses.filter(a => a.id !== id);
    setSavedAnalyses(newHistory);
    localStorage.setItem('nativeNuance_analysisHistory', JSON.stringify(newHistory));

    // Sync to cloud if authenticated
    if (isAuthenticated && user) {
      await dataService.deleteAnalysis(user.id, id);
    }

    // If current analysis is removed, reset view
    if (analysisResult && savedAnalyses.find(a => a.id === id)?.analysisResult === analysisResult) {
      handleNewAnalysis();
    }
  };

  // Folder CRUD functions
  const createFolder = async (name: string, color?: string) => {
    const newFolder: AnalysisFolder = {
      id: crypto.randomUUID(),
      name,
      createdAt: Date.now(),
      color,
    };

    const newFolders = [...analysisFolders, newFolder];
    setAnalysisFolders(newFolders);
    localStorage.setItem('nativeNuance_analysisFolders', JSON.stringify(newFolders));

    if (isAuthenticated && user) {
      await dataService.createFolder(user.id, newFolder);
    }
  };

  const updateFolder = async (folder: AnalysisFolder) => {
    const newFolders = analysisFolders.map(f => f.id === folder.id ? folder : f);
    setAnalysisFolders(newFolders);
    localStorage.setItem('nativeNuance_analysisFolders', JSON.stringify(newFolders));

    if (isAuthenticated && user) {
      await dataService.updateFolder(user.id, folder);
    }
  };

  const deleteFolder = async (folderId: string) => {
    // Remove folder
    const newFolders = analysisFolders.filter(f => f.id !== folderId);
    setAnalysisFolders(newFolders);
    localStorage.setItem('nativeNuance_analysisFolders', JSON.stringify(newFolders));

    // Move analyses in this folder to uncategorized
    const newAnalyses = savedAnalyses.map(a => 
      a.folderId === folderId ? { ...a, folderId: null } : a
    );
    setSavedAnalyses(newAnalyses);
    localStorage.setItem('nativeNuance_analysisHistory', JSON.stringify(newAnalyses));

    if (isAuthenticated && user) {
      await dataService.deleteFolder(user.id, folderId);
      // Update all analyses that were in this folder
      const analysesToUpdate = savedAnalyses.filter(a => a.folderId === folderId);
      for (const analysis of analysesToUpdate) {
        await dataService.updateAnalysisFolder(user.id, analysis.id, null);
      }
    }
  };

  const moveAnalysisToFolder = async (analysisId: string, folderId: string | null) => {
    const newAnalyses = savedAnalyses.map(a => 
      a.id === analysisId ? { ...a, folderId } : a
    );
    setSavedAnalyses(newAnalyses);
    localStorage.setItem('nativeNuance_analysisHistory', JSON.stringify(newAnalyses));

    if (isAuthenticated && user) {
      await dataService.updateAnalysisFolder(user.id, analysisId, folderId);
    }
  };

  const handleNewAnalysis = () => {
    setAnalysisResult(null);
    setInputText('');
    setFileName(null);
    setCurrentAnalysisId(null);
    setMode(AppMode.ANALYZE_TEXT);
    setStatus('idle');
  };

  const handleExportData = () => {
    dataService.exportToJson(savedAnalyses, []);
  };

  const processFile = (file: File | undefined) => {
    if (!file) return;

    // Check for unsupported binary formats common in reading
    if (
      file.type.includes('pdf') ||
      file.name.toLowerCase().endsWith('.pdf') ||
      file.name.toLowerCase().endsWith('.epub') ||
      file.name.toLowerCase().endsWith('.mobi') ||
      file.name.toLowerCase().endsWith('.doc') ||
      file.name.toLowerCase().endsWith('.docx')
    ) {
      setError("Sorry, only plain text files (.txt, .md, .srt, .csv, .json) are supported right now. Please save your document as text first.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text === 'string') {
        setInputText(text);
        setFileName(file.name);
        setError(null);
      }
    };
    reader.onerror = () => {
      setError("Failed to read file.");
    };
    reader.readAsText(file);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    processFile(file);
    event.target.value = ''; // Reset
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    processFile(file);
  };

  const clearFile = () => {
    setFileName(null);
    setInputText('');
  };

  const handleAnalyzeText = async () => {
    if (!inputText.trim()) return;

    setStatus('analyzing');
    setError(null);
    setAnalysisResult(null);

    try {
      const result = await analyzeText(inputText, sourceType);
      setAnalysisResult(result);
      setStatus('complete');
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (e) {
      setError("Failed to analyze text. Please try again.");
      setStatus('idle');
    }
  };

  const handleTopicStrategy = async () => {
    if (!topicInput.trim()) return;

    setStatus('analyzing');
    setError(null);
    setAnalysisResult(null);

    try {
      const result = await generateTopicStrategy(topicInput);
      setAnalysisResult(result);
      setStatus('complete');
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (e) {
      setError("Failed to generate strategy. Please try again.");
      setStatus('idle');
    }
  };

  // Initial Practice Generation
  const handleGeneratePractice = async (selectedVocab: VocabularyItem[]) => {
    setStatus('practicing');
    setError(null);

    let itemsToPractice: VocabularyItem[] = [];

    // Case 1: User selected specific items. Practice ONLY those.
    if (selectedVocab.length > 0) {
      itemsToPractice = selectedVocab;
      setPracticeQueue([]); // No automatic next batch for custom selection
      setPracticeIndex(0);
    }
    // Case 2: No selection. Practice first 5 from the full list, queue the rest.
    else if (analysisResult?.vocabulary) {
      const allVocab = analysisResult.vocabulary;
      itemsToPractice = allVocab.slice(0, BATCH_SIZE);
      setPracticeQueue(allVocab); // Store full list
      setPracticeIndex(BATCH_SIZE); // Next batch starts at 5
    } else {
      setStatus('idle');
      return;
    }

    try {
      const practice = await generatePractice(itemsToPractice);
      setPracticeResult(practice);
    } catch (e) {
      setError("Failed to generate practice. Please try again.");
    } finally {
      setStatus('complete');
    }
  };

  // Next Batch Generation
  const handleNextPracticeBatch = async () => {
    if (practiceIndex >= practiceQueue.length) return;

    setIsGeneratingNext(true);
    const nextItems = practiceQueue.slice(practiceIndex, practiceIndex + BATCH_SIZE);

    try {
      const practice = await generatePractice(nextItems);
      setPracticeResult(practice);
      setPracticeIndex(prev => prev + BATCH_SIZE);
    } catch (e) {
      console.error("Failed to get next batch", e);
    } finally {
      setIsGeneratingNext(false);
    }
  };

  const loadExample = () => {
    setInputText(EXAMPLE_TEXT);
    setSourceType(SourceType.NEWS);
    setFileName(null);
  };

  const handleTopicClick = (topic: string) => {
    setTopicInput(topic);
  };

  const isNextAvailable = practiceQueue.length > 0 && practiceIndex < practiceQueue.length;

  // Show loading overlay when loading cloud data
  if (isDataLoading) {
    return (
      <div className="flex h-screen bg-slate-50 items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-emerald-600 animate-spin mx-auto mb-4" />
          <p className="text-lg text-slate-600">Syncing your data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden">

      <Sidebar
        savedAnalyses={savedAnalyses}
        onLoadAnalysis={loadAnalysis}
        onNewAnalysis={handleNewAnalysis}
        onRemoveAnalysis={removeAnalysis}
        isOpen={isSidebarOpen}
        toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        onExportData={handleExportData}
        onOpenHistory={() => setMode(AppMode.HISTORY)}
        isHistoryActive={mode === AppMode.HISTORY}
      />

      <div className="flex-1 flex flex-col h-full overflow-hidden relative">

        {!isSidebarOpen && (
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="absolute top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-sm border border-slate-200 text-slate-500 hover:text-slate-900"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <main className="flex-1 overflow-y-auto w-full">
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 h-full">

            {mode === AppMode.HISTORY && (
              <HistoryView
                savedAnalyses={savedAnalyses}
                onLoadAnalysis={loadAnalysis}
                onRemoveAnalysis={removeAnalysis}
                folders={analysisFolders}
                onCreateFolder={createFolder}
                onUpdateFolder={updateFolder}
                onDeleteFolder={deleteFolder}
                onMoveAnalysisToFolder={moveAnalysisToFolder}
              />
            )}

            {mode !== AppMode.HISTORY && (
              <div className={`mx-auto transition-all duration-500 ${analysisResult ? 'w-full' : 'max-w-3xl mt-[10vh]'}`}>

                {!analysisResult && (
                  <div className="text-center space-y-6 mb-12 animate-fade-in">
                    <div className="inline-flex items-center justify-center p-3 bg-slate-900 rounded-2xl mb-4 shadow-xl shadow-slate-200/50">
                      <Sparkles className="w-8 h-8 text-yellow-400" />
                    </div>
                    <h1 className="text-4xl md:text-5xl font-serif font-bold text-slate-900">
                      {mode === AppMode.ANALYZE_TEXT ? (
                        <>Speak with <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-blue-600">Precision</span></>
                      ) : (
                        <>Master Any <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">Scenario</span></>
                      )}
                    </h1>
                    <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                      {mode === AppMode.ANALYZE_TEXT
                        ? "Paste text or upload a file to extract native collocations and nuances without the fluff."
                        : "Select a topic to generate a strategic IELTS speaking structure and targeted vocabulary."
                      }
                    </p>

                    <div className="flex justify-center gap-2 mt-6">
                      <button
                        onClick={() => setMode(AppMode.ANALYZE_TEXT)}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${mode === AppMode.ANALYZE_TEXT ? 'bg-slate-200 text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        Text Analysis
                      </button>
                      <button
                        onClick={() => setMode(AppMode.TOPIC_STRATEGY)}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${mode === AppMode.TOPIC_STRATEGY ? 'bg-slate-200 text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        Topic Strategy
                      </button>
                    </div>
                  </div>
                )}

                {!analysisResult && (
                  <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-100 overflow-hidden transition-all animate-fade-in-up">

                    {mode === AppMode.ANALYZE_TEXT && (
                      <>
                        <div className="bg-slate-50 border-b border-slate-100 flex items-center p-2 gap-3">
                          <div className="flex gap-1 overflow-x-auto w-full no-scrollbar">
                            {Object.values(SourceType).map((type) => (
                              <button
                                key={type}
                                onClick={() => setSourceType(type)}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${sourceType === type
                                  ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                                  }`}
                              >
                                {type === SourceType.NEWS && <FileText className="w-4 h-4" />}
                                {type === SourceType.TV_TRANSCRIPT && <Tv className="w-4 h-4" />}
                                {type === SourceType.BOOK && <Book className="w-4 h-4" />}
                                {type === SourceType.EMAIL && <Mail className="w-4 h-4" />}
                                <span className="hidden md:inline">{type}</span>
                                <span className="md:hidden">{type.split(' ')[0]}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="p-6">
                          <div
                            className={`relative transition-all ${isDragging ? 'scale-[1.01] ring-2 ring-indigo-400 rounded-xl' : ''}`}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                          >
                            {fileName && (
                              <div className="absolute top-3 right-3 z-10 flex items-center gap-2 bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-xs font-bold shadow-sm">
                                <FileIcon className="w-3 h-3" />
                                {fileName}
                                <button onClick={clearFile} className="hover:bg-emerald-200 rounded-full p-0.5"><X className="w-3 h-3" /></button>
                              </div>
                            )}

                            <textarea
                              value={inputText}
                              onChange={(e) => setInputText(e.target.value)}
                              placeholder={isDragging ? "Drop file here to read..." : "Paste your text here, drop a file, or use the upload button below..."}
                              className={`w-full h-64 p-4 bg-slate-50 border rounded-xl resize-none font-sans text-base outline-none transition-shadow ${isDragging ? 'bg-indigo-50 border-indigo-300' : 'border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent'}`}
                            />
                          </div>

                          <div className="flex flex-col sm:flex-row justify-between items-center mt-6 gap-4 sm:gap-0">
                            <div className="flex items-center gap-4 w-full sm:w-auto">
                              <button onClick={loadExample} className="text-sm text-slate-500 hover:text-emerald-600 underline whitespace-nowrap">
                                Try example
                              </button>
                              <div className="h-4 w-px bg-slate-300 hidden sm:block"></div>

                              <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                                accept=".txt,.md,.srt,.csv,.json,.vtt"
                                className="hidden"
                              />
                              <button
                                onClick={triggerFileUpload}
                                className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-800 px-3 py-1.5 rounded-md hover:bg-indigo-50 transition-colors"
                              >
                                <Upload className="w-4 h-4" />
                                Upload File
                              </button>
                            </div>

                            <button
                              onClick={handleAnalyzeText}
                              disabled={status === 'analyzing' || !inputText.trim()}
                              className={`w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 rounded-xl font-bold text-white transition-all ${status === 'analyzing' || !inputText.trim() ? 'bg-slate-300' : 'bg-emerald-600 hover:bg-emerald-700 shadow-lg hover:shadow-emerald-200'
                                }`}
                            >
                              {status === 'analyzing' ? <Loader2 className="animate-spin" /> : <ArrowRight />}
                              Analyze Text
                            </button>
                          </div>
                        </div>
                      </>
                    )}

                    {mode === AppMode.TOPIC_STRATEGY && (
                      <div className="p-6">
                        <div className="mb-4 flex gap-2 flex-wrap">
                          {PRESET_TOPICS.map((topic, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleTopicClick(topic)}
                              className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-medium hover:bg-indigo-100 transition-colors"
                            >
                              {topic}
                            </button>
                          ))}
                        </div>
                        <input
                          type="text"
                          value={topicInput}
                          onChange={(e) => setTopicInput(e.target.value)}
                          placeholder="Enter a topic (e.g. 'Describing a traditional wedding')"
                          className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-sans text-lg outline-none transition-shadow"
                          onKeyDown={(e) => e.key === 'Enter' && handleTopicStrategy()}
                        />
                        <div className="flex justify-end mt-4">
                          <button
                            onClick={handleTopicStrategy}
                            disabled={status === 'analyzing' || !topicInput.trim()}
                            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white transition-all ${status === 'analyzing' || !topicInput.trim() ? 'bg-slate-300' : 'bg-indigo-600 hover:bg-indigo-700 shadow-lg'
                              }`}
                          >
                            {status === 'analyzing' ? <Loader2 className="animate-spin" /> : <Layers />}
                            Generate Strategy
                          </button>
                        </div>
                      </div>
                    )}

                    {error && (
                      <div className="mx-6 mb-6 p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2 border border-red-100">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        {error}
                      </div>
                    )}
                  </div>
                )}

                {analysisResult && (
                  <div ref={resultRef} className="animate-fade-in">
                    {status === 'practicing' && !practiceResult && (
                      <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
                        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
                        <p className="text-xl font-serif text-slate-800 animate-pulse">Crafting native scenarios...</p>
                      </div>
                    )}

                    <div className="w-full mx-auto">
                      <AnalysisView
                        data={analysisResult}
                        onGeneratePractice={handleGeneratePractice}
                        onSaveAnalysis={saveAnalysis}
                        initialNotes={currentAnalysisId ? savedAnalyses.find(a => a.id === currentAnalysisId)?.notes || [] : []}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        </main>
      </div>

      {practiceResult && (
        <PracticeView
          data={practiceResult}
          onClose={() => setPracticeResult(null)}
          onNextBatch={handleNextPracticeBatch}
          isNextAvailable={isNextAvailable}
          isLoadingNext={isGeneratingNext}
        />
      )}
    </div>
  );
};

// Wrap App with AuthProvider
const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
