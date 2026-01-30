
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AnalysisResult, VocabularyItem, VocabularyCategory, Note, UserProficiency, EnglishTestType, KnownWord } from '../types';
import { CheckCircle, BookOpen, Layout, Zap, Volume2, Quote, MessageCircle, Sparkles, ArrowRightCircle, AlignLeft, ChevronDown, ChevronUp, Grid, Smartphone, Check, Save, ChevronLeft, ChevronRight, RotateCcw, RotateCw, X, XCircle, GraduationCap, Trophy, Award, BarChart3, FileText } from 'lucide-react';
import { generateSpeech } from '../services/geminiService';
import WordLookupPopup from './WordLookupPopup';
import NotesSidebar from './NotesSidebar';
import FullTextView from './FullTextView';

interface Props {
  data: AnalysisResult;
  onGeneratePractice: (selected: VocabularyItem[]) => void;
  onSaveAnalysis: (notes: Note[]) => void;
  initialNotes?: Note[];
  // For tracking flashcard pass status
  analysisId?: string;
  flashcardPassed?: boolean;
  onUpdateFlashcardPassed?: (analysisId: string, passed: boolean) => void;
  // User proficiency for difficulty color coding
  proficiency?: UserProficiency | null;
  // For Full Text View
  originalText?: string;
  comprehensiveVocab?: VocabularyItem[];
  knownWords?: Record<string, KnownWord>;
  onMarkWord?: (term: string, isKnown: boolean, difficulty_level?: string) => void;
  isLoadingComprehensive?: boolean;
  onLoadComprehensive?: () => void;
}

// Helper function to determine difficulty color based on user's level
const getDifficultyColor = (difficultyLevel: string | undefined, proficiency: UserProficiency | null | undefined): { bg: string; text: string; label: string } => {
  if (!difficultyLevel) {
    return { bg: 'bg-slate-100', text: 'text-slate-500', label: 'Unknown' };
  }

  if (!proficiency) {
    // No proficiency set - just show neutral
    return { bg: 'bg-indigo-100', text: 'text-indigo-700', label: difficultyLevel };
  }

  // Parse the difficulty level to extract numeric value
  const extractScore = (level: string, testType: EnglishTestType): number | null => {
    const normalized = level.toUpperCase();
    
    // Handle IELTS scores (e.g., "IELTS 6-7", "IELTS 7+", "IELTS 8")
    if (testType === EnglishTestType.IELTS || normalized.includes('IELTS')) {
      const match = normalized.match(/(\d+(?:\.\d+)?)/);
      if (match) return parseFloat(match[1]);
    }
    
    // Handle TOEFL scores (e.g., "TOEFL 80+", "TOEFL 60-80")
    if (testType === EnglishTestType.TOEFL || normalized.includes('TOEFL')) {
      const match = normalized.match(/(\d+)/);
      if (match) return parseInt(match[1]);
    }
    
    // Handle CET scores (e.g., "CET-4 500+", "CET-6 550+")
    if (testType === EnglishTestType.CET4 || testType === EnglishTestType.CET6 || normalized.includes('CET')) {
      const match = normalized.match(/(\d{3,})/);
      if (match) return parseInt(match[1]);
    }

    return null;
  };

  const vocabScore = extractScore(difficultyLevel, proficiency.testType);
  const userScore = proficiency.score;

  if (vocabScore === null) {
    return { bg: 'bg-indigo-100', text: 'text-indigo-700', label: difficultyLevel };
  }

  // Compare scores based on test type
  let isAtLevel = false;
  let isSlightlyAbove = false;
  let isAdvanced = false;

  if (proficiency.testType === EnglishTestType.IELTS) {
    // IELTS: 0.5 band = at level, 1-1.5 = slightly above, 2+ = advanced
    const diff = vocabScore - userScore;
    isAtLevel = diff <= 0.5;
    isSlightlyAbove = diff > 0.5 && diff <= 1.5;
    isAdvanced = diff > 1.5;
  } else if (proficiency.testType === EnglishTestType.TOEFL) {
    // TOEFL: 10 points = at level, 10-25 = slightly above, 25+ = advanced
    const diff = vocabScore - userScore;
    isAtLevel = diff <= 10;
    isSlightlyAbove = diff > 10 && diff <= 25;
    isAdvanced = diff > 25;
  } else {
    // CET: 50 points = at level, 50-100 = slightly above, 100+ = advanced
    const diff = vocabScore - userScore;
    isAtLevel = diff <= 50;
    isSlightlyAbove = diff > 50 && diff <= 100;
    isAdvanced = diff > 100;
  }

  if (isAtLevel) {
    return { bg: 'bg-emerald-100', text: 'text-emerald-700', label: difficultyLevel };
  } else if (isSlightlyAbove) {
    return { bg: 'bg-amber-100', text: 'text-amber-700', label: difficultyLevel };
  } else if (isAdvanced) {
    return { bg: 'bg-red-100', text: 'text-red-700', label: difficultyLevel };
  }

  return { bg: 'bg-indigo-100', text: 'text-indigo-700', label: difficultyLevel };
};

const CATEGORY_CONFIG: Record<VocabularyCategory, { label: string; color: string; icon: React.ReactNode }> = {
  'idioms_fixed': {
    label: 'Idioms & Fixed Expressions',
    color: 'text-purple-700 bg-purple-50 border-purple-100',
    icon: <Sparkles className="w-5 h-5" />
  },
  'phrasal_verbs': {
    label: 'Phrasal Verbs',
    color: 'text-blue-700 bg-blue-50 border-blue-100',
    icon: <ArrowRightCircle className="w-5 h-5" />
  },
  'nuance_sarcasm': {
    label: 'Nuance & Sarcasm',
    color: 'text-pink-700 bg-pink-50 border-pink-100',
    icon: <MessageCircle className="w-5 h-5" />
  },
  'chunks_structures': {
    label: 'Structures & "Chunks"',
    color: 'text-indigo-700 bg-indigo-50 border-indigo-100',
    icon: <Layout className="w-5 h-5" />
  },
  'topic_specific': {
    label: 'Topic Specific Jargon',
    color: 'text-orange-700 bg-orange-50 border-orange-100',
    icon: <BookOpen className="w-5 h-5" />
  }
};

const AnalysisView: React.FC<Props> = ({ 
  data, 
  onGeneratePractice, 
  onSaveAnalysis, 
  initialNotes = [],
  analysisId,
  flashcardPassed = false,
  onUpdateFlashcardPassed,
  proficiency,
  originalText = '',
  comprehensiveVocab = [],
  knownWords = {},
  onMarkWord,
  isLoadingComprehensive = false,
  onLoadComprehensive,
}) => {
  const [selectedTerms, setSelectedTerms] = useState<Set<string>>(new Set());
  const [playingText, setPlayingText] = useState<string | null>(null);
  const [isTocOpen, setIsTocOpen] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'flashcard' | 'fulltext'>('list');
  const [savedAnalysis, setSavedAnalysis] = useState(false);

  // Word Lookup State
  const [lookupState, setLookupState] = useState<{ word: string; context: string; position: { x: number; y: number } } | null>(null);

  // Notes State - initialize with saved notes
  const [notes, setNotes] = useState<Note[]>(initialNotes);

  // Track flashcard index per category
  const [categoryIndices, setCategoryIndices] = useState<Record<string, number>>({});
  // Track flipped state per category
  const [flippedState, setFlippedState] = useState<Record<string, boolean>>({});

  // Fullscreen flashcard practice mode
  const [isFlashcardMode, setIsFlashcardMode] = useState(false);
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [answerResult, setAnswerResult] = useState<'correct' | 'incorrect' | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const flashcardInputRef = useRef<HTMLInputElement>(null);
  
  // Score tracking state
  const [correctCount, setCorrectCount] = useState(0);
  const [incorrectCount, setIncorrectCount] = useState(0);
  const [showResults, setShowResults] = useState(false);
  
  // Track if the test was passed in this session (used to sync when analysisId becomes available)
  const [sessionPassed, setSessionPassed] = useState(false);

  // Helper function to mask the vocabulary term in text
  const maskTerm = useCallback((text: string, term: string): string => {
    if (!text || !term) return text;
    
    let maskedText = text;
    const cleanTerm = term.replace(/[.,!?;:'"]+$/, '').trim();
    const subPhrases = cleanTerm.split(/[,;]|\s+and\s+/i)
      .map(s => s.trim())
      .filter(s => s.length > 2);
    
    const allTermsToMask = [cleanTerm, ...subPhrases];
    const uniqueTerms = [...new Set(allTermsToMask)];
    uniqueTerms.sort((a, b) => b.length - a.length);
    
    for (const phrase of uniqueTerms) {
      if (phrase.length < 3) continue;
      const escapedTerm = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escapedTerm}\\b`, 'gi');
      maskedText = maskedText.replace(regex, '_____');
    }
    
    return maskedText;
  }, []);

  // Reset notes when loading a different analysis
  useEffect(() => {
    setNotes(initialNotes);
  }, [initialNotes]);

  // Check and mark session as passed when results are shown with 90%+ score
  useEffect(() => {
    if (showResults) {
      const totalCards = data.vocabulary.length;
      const totalAnswered = correctCount + incorrectCount;
      const percentage = totalAnswered > 0 ? (correctCount / totalAnswered) * 100 : 0;
      
      // Mark session as passed if 90%+ and completed all cards
      if (percentage >= 90 && totalAnswered === totalCards) {
        setSessionPassed(true);
      }
    }
  }, [showResults, correctCount, incorrectCount, data.vocabulary.length]);

  // Sync sessionPassed to parent when analysisId becomes available (after saving)
  // This handles the case where user passes the test before saving the analysis
  useEffect(() => {
    if (sessionPassed && analysisId && onUpdateFlashcardPassed && !flashcardPassed) {
      onUpdateFlashcardPassed(analysisId, true);
    }
  }, [sessionPassed, analysisId, flashcardPassed, onUpdateFlashcardPassed]);

  // Keyboard shortcut: Space to go to next card when answer is showing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only when flashcard mode is open and answer is showing
      if (!isFlashcardMode || !showAnswer) return;
      
      // Don't trigger if typing in input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      if (e.code === 'Space') {
        e.preventDefault();
        handleFlashcardNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFlashcardMode, showAnswer]);

  useEffect(() => {
    const handleSelection = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) return;

      const text = selection.toString().trim();
      // Only lookup single words or short phrases (max 3 words)
      if (text.length > 0 && text.split(/\s+/).length <= 3) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        // Get context (surrounding text)
        let context = "";
        if (range.commonAncestorContainer.nodeType === Node.TEXT_NODE) {
          context = range.commonAncestorContainer.textContent || "";
        } else {
          context = range.commonAncestorContainer.textContent || "";
        }

        // Debounce or wait for mouse up (handled by event listener on container)
      }
    };
    // We'll use onMouseUp on the container instead
  }, []);

  const handleTextMouseUp = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      // Don't close if clicking inside the popup (handled by stopPropagation in popup)
      // But do close if clicking elsewhere with no selection
      // setLookupState(null); 
      return;
    }

    const text = selection.toString().trim();
    if (text.length > 0 && text.split(/\s+/).length <= 4) { // Allow up to 4 words
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      // Simple context extraction: take the whole paragraph text
      const context = selection.anchorNode?.parentElement?.textContent || text;

      setLookupState({
        word: text,
        context: context.substring(0, 200), // Limit context length
        position: { x: rect.left + (rect.width / 2), y: rect.bottom }
      });
    }
  };

  const closeLookup = () => {
    setLookupState(null);
    window.getSelection()?.removeAllRanges();
  };

  const addNote = (word: string, definition: string, context: string) => {
    const newNote: Note = {
      id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      word,
      definition,
      context,
      timestamp: Date.now()
    };
    setNotes(prev => [newNote, ...prev]);
    closeLookup();
  };

  const removeNote = (id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id));
  };

  const toggleTerm = (term: string) => {
    const newSet = new Set(selectedTerms);
    if (newSet.has(term)) newSet.delete(term);
    else newSet.add(term);
    setSelectedTerms(newSet);
  };

  const handlePracticeClick = () => {
    if (selectedTerms.size > 0) {
      const selectedItems = data.vocabulary.filter(v => selectedTerms.has(v.term));
      onGeneratePractice(selectedItems);
    } else {
      onGeneratePractice([]);
    }
  };

  const handlePlayAudio = async (e: React.MouseEvent, text: string) => {
    e.stopPropagation();
    if (playingText) return;

    setPlayingText(text);
    try {
      await generateSpeech(text);
    } finally {
      setPlayingText(null);
    }
  };

  const handleSaveAnalysisClick = () => {
    onSaveAnalysis(notes);
    setSavedAnalysis(true);
    setTimeout(() => setSavedAnalysis(false), 2000);
  };

  // Fullscreen flashcard functions
  const openFlashcardMode = () => {
    setIsFlashcardMode(true);
    setFlashcardIndex(0);
    setUserAnswer('');
    setAnswerResult(null);
    setShowAnswer(false);
    setCorrectCount(0);
    setIncorrectCount(0);
    setShowResults(false);
    setSessionPassed(false); // Reset session passed state for new practice
  };

  const closeFlashcardMode = () => {
    setIsFlashcardMode(false);
    setUserAnswer('');
    setAnswerResult(null);
    setShowAnswer(false);
    setCorrectCount(0);
    setIncorrectCount(0);
    setShowResults(false);
  };

  const retryFlashcards = () => {
    setFlashcardIndex(0);
    setUserAnswer('');
    setAnswerResult(null);
    setShowAnswer(false);
    setCorrectCount(0);
    setIncorrectCount(0);
    setShowResults(false);
    setSessionPassed(false); // Reset session passed state for retry
  };

  const handleFlashcardNext = () => {
    const totalCards = data.vocabulary.length;
    const isLastCard = flashcardIndex === totalCards - 1;
    
    if (isLastCard) {
      setShowResults(true);
    } else {
      setFlashcardIndex(prev => prev + 1);
      setUserAnswer('');
      setAnswerResult(null);
      setShowAnswer(false);
    }
  };

  const handleFlashcardPrev = () => {
    if (flashcardIndex > 0) {
      setFlashcardIndex(prev => prev - 1);
      setUserAnswer('');
      setAnswerResult(null);
      setShowAnswer(false);
    }
  };

  // Smart answer matching that handles variations like:
  // "overstepped her bound" ≈ "overstep the bound" ≈ "overstep bound"
  
  // Simple stemming: remove common verb endings to match tenses
  const stemWord = useCallback((word: string): string => {
    if (word.length < 4) return word;
    // Handle common verb endings: -ed, -ing, -s, -es
    if (word.endsWith('ied')) return word.slice(0, -3) + 'y'; // carried → carry
    if (word.endsWith('ed') && word.length > 4) return word.slice(0, -2); // overstepped → overstep, but not "red"
    if (word.endsWith('ing') && word.length > 5) return word.slice(0, -3); // running → runn → will match run
    if (word.endsWith('es') && word.length > 4) return word.slice(0, -2); // watches → watch
    if (word.endsWith('s') && !word.endsWith('ss') && word.length > 3) return word.slice(0, -1); // runs → run
    return word;
  }, []);

  const normalizeForComparison = useCallback((text: string): string => {
    return text
      .toLowerCase()
      .trim()
      // Remove common placeholder patterns
      .replace(/\(something\)/gi, '')
      .replace(/\(sth\)/gi, '')
      .replace(/\(someone\)/gi, '')
      .replace(/\(sb\)/gi, '')
      .replace(/\(somebody\)/gi, '')
      .replace(/\(one\)/gi, '')
      .replace(/\(one's\)/gi, '')
      .replace(/\(somewhere\)/gi, '')
      .replace(/\(somehow\)/gi, '')
      .replace(/\([^)]*\)/g, '') // Remove any remaining parenthetical content
      // Normalize common variations
      .replace(/\bsth\b/gi, '')
      .replace(/\bsb\b/gi, '')
      .replace(/\bsmth\b/gi, '')
      // Remove articles
      .replace(/\b(a|an|the)\b/gi, '')
      // Remove pronouns (her, his, their, my, your, its, our, one's)
      .replace(/\b(her|his|their|my|your|its|our|one's)\b/gi, '')
      // Remove common filler words
      .replace(/\b(it|to|of|in|on|at|for|with|by)\b/gi, '')
      // Clean up whitespace
      .replace(/\s+/g, ' ')
      .trim();
  }, []);

  // Simple similarity calculation (0 to 1)
  const calculateSimilarity = (str1: string, str2: string): number => {
    if (str1 === str2) return 1;
    if (!str1 || !str2) return 0;
    
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1;
    
    // Simple Levenshtein distance
    const matrix: number[][] = [];
    for (let i = 0; i <= shorter.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= longer.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= shorter.length; i++) {
      for (let j = 1; j <= longer.length; j++) {
        if (shorter[i-1] === longer[j-1]) {
          matrix[i][j] = matrix[i-1][j-1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i-1][j-1] + 1,
            matrix[i][j-1] + 1,
            matrix[i-1][j] + 1
          );
        }
      }
    }
    
    const distance = matrix[shorter.length][longer.length];
    return (longer.length - distance) / longer.length;
  };

  // Check if two words match (considering stems)
  const wordsMatch = useCallback((word1: string, word2: string): boolean => {
    if (word1 === word2) return true;
    const stem1 = stemWord(word1);
    const stem2 = stemWord(word2);
    // Check stem match
    if (stem1 === stem2) return true;
    // Check if one contains the other (for partial matches)
    if (stem1.length >= 3 && stem2.length >= 3) {
      if (stem1.includes(stem2) || stem2.includes(stem1)) return true;
    }
    return false;
  }, [stemWord]);

  const checkAnswerMatch = useCallback((userInput: string, correctTerm: string): boolean => {
    const normalizedUser = normalizeForComparison(userInput);
    const normalizedTerm = normalizeForComparison(correctTerm);
    
    // Exact match after normalization
    if (normalizedUser === normalizedTerm) return true;
    
    // Get core words (ignore very short words)
    const termWords = normalizedTerm.split(' ').filter(w => w.length > 2);
    const userWords = normalizedUser.split(' ').filter(w => w.length > 2);
    
    // If no significant words to compare, check similarity
    if (termWords.length === 0 || userWords.length === 0) {
      return calculateSimilarity(normalizedUser, normalizedTerm) >= 0.7;
    }
    
    // Check if user answer contains all key words from the term (using stem matching)
    const allTermWordsPresent = termWords.every(tw => 
      userWords.some(uw => wordsMatch(tw, uw))
    );
    
    // If all core words match, it's correct
    if (allTermWordsPresent) return true;
    
    // Fuzzy match: allow for minor typos using similarity
    const similarity = calculateSimilarity(normalizedUser, normalizedTerm);
    if (similarity >= 0.75) return true;
    
    return false;
  }, [normalizeForComparison, wordsMatch]);

  const handleCheckFlashcardAnswer = async () => {
    if (!userAnswer.trim()) return;
    const currentItem = data.vocabulary[flashcardIndex];
    const isCorrect = checkAnswerMatch(userAnswer, currentItem.term);
    setAnswerResult(isCorrect ? 'correct' : 'incorrect');
    setShowAnswer(true);
    
    // Track score
    if (isCorrect) {
      setCorrectCount(prev => prev + 1);
    } else {
      setIncorrectCount(prev => prev + 1);
    }
    
    try {
      await generateSpeech(currentItem.term);
    } catch (error) {
      console.error('Failed to pronounce:', error);
    }
  };

  const handleSkipFlashcard = async () => {
    setAnswerResult('incorrect');
    setShowAnswer(true);
    setIncorrectCount(prev => prev + 1);
    const currentItem = data.vocabulary[flashcardIndex];
    try {
      await generateSpeech(currentItem.term);
    } catch (error) {
      console.error('Failed to pronounce:', error);
    }
  };

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Flashcard Navigation
  const handlePrevCard = (cat: string, total: number) => {
    setCategoryIndices(prev => ({
      ...prev,
      [cat]: ((prev[cat] || 0) - 1 + total) % total
    }));
    setFlippedState(prev => ({ ...prev, [cat]: false }));
  };

  const handleNextCard = (cat: string, total: number) => {
    setCategoryIndices(prev => ({
      ...prev,
      [cat]: ((prev[cat] || 0) + 1) % total
    }));
    setFlippedState(prev => ({ ...prev, [cat]: false }));
  };

  const handleFlip = (cat: string) => {
    setFlippedState(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  // Group vocabulary by category
  const groupedVocab: Partial<Record<VocabularyCategory, VocabularyItem[]>> = {};
  data.vocabulary.forEach(item => {
    if (!groupedVocab[item.category]) groupedVocab[item.category] = [];
    groupedVocab[item.category]!.push(item);
  });

  const categoryOrder: VocabularyCategory[] = [
    'idioms_fixed',
    'phrasal_verbs',
    'topic_specific',
    'nuance_sarcasm',
    'chunks_structures'
  ];

  return (
    <div className="space-y-8 animate-fade-in pb-20" onMouseUp={handleTextMouseUp}>
      {lookupState && (
        <WordLookupPopup
          word={lookupState.word}
          context={lookupState.context}
          position={lookupState.position}
          onClose={closeLookup}
          onAddNote={addNote}
        />
      )}
      <div>
        {/* Top Bar: Summary + Actions */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 z-10">
          <div className="flex flex-col gap-6">
            {/* Header Content */}
            <div className="flex flex-col md:flex-row justify-between items-start gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-3 py-1 rounded-full bg-slate-900 text-white text-xs font-bold uppercase tracking-wider">
                    Tone: {data.tone}
                  </span>
                </div>
                <p className="text-slate-700 text-lg leading-relaxed font-serif italic">
                  "{data.summary}"
                </p>
              </div>
              <button
                onClick={handlePracticeClick}
                className="flex-shrink-0 flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 transition-all shadow-lg hover:shadow-emerald-200 whitespace-nowrap w-full md:w-auto justify-center"
              >
                <Zap className="w-4 h-4" />
                {selectedTerms.size > 0 ? `Practice Selected (${selectedTerms.size})` : 'Start Practice (First 5)'}
              </button>
            </div>

            {/* View Controls & Bulk Actions */}
            <div className="flex flex-col sm:flex-row justify-between items-center border-t border-slate-100 pt-4 gap-4">

              {/* View Toggle */}
              <div className="flex bg-slate-100 p-1 rounded-lg self-start">
                <button
                  onClick={() => setViewMode('list')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <Grid className="w-4 h-4" /> List
                </button>
                <button
                  onClick={() => setViewMode('flashcard')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'flashcard' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <Smartphone className="w-4 h-4" /> Flashcard
                </button>
                <button
                  onClick={() => {
                    setViewMode('fulltext');
                    // Load comprehensive vocabulary if not already loaded
                    if (comprehensiveVocab.length === 0 && onLoadComprehensive) {
                      onLoadComprehensive();
                    }
                  }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'fulltext' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <FileText className="w-4 h-4" /> Full Text
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={openFlashcardMode}
                  disabled={data.vocabulary.length === 0}
                  className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm disabled:bg-slate-300 disabled:cursor-not-allowed ${
                    flashcardPassed 
                      ? 'bg-amber-500 text-white hover:bg-amber-600' 
                      : 'bg-indigo-600 text-white hover:bg-indigo-700'
                  }`}
                >
                  {flashcardPassed ? (
                    <Trophy className="w-4 h-4" />
                  ) : (
                    <GraduationCap className="w-4 h-4" />
                  )}
                  {flashcardPassed ? 'Review Flashcards ✓' : 'Practice Flashcards'}
                </button>
                <button
                  onClick={handleSaveAnalysisClick}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 transition-colors shadow-sm"
                >
                  {savedAnalysis ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                  {savedAnalysis ? 'Saved!' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Full Text View Mode */}
        {viewMode === 'fulltext' && (
          <div className="mt-6">
            <FullTextView
              originalText={originalText}
              vocabulary={comprehensiveVocab.length > 0 ? comprehensiveVocab : data.vocabulary}
              proficiency={proficiency || null}
              knownWords={knownWords}
              onMarkWord={onMarkWord || (() => {})}
              isLoading={isLoadingComprehensive}
            />
          </div>
        )}

        {/* List and Flashcard View Modes */}
        {viewMode !== 'fulltext' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* Left Column: Navigation & Logical Structure (3 cols) */}
          <div className="lg:col-span-3 space-y-6">
            <div className="sticky top-24 space-y-6">

              {/* Navigation Menu */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden transition-all">
                <button
                  onClick={() => setIsTocOpen(!isTocOpen)}
                  className="w-full p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center hover:bg-slate-100 transition-colors"
                >
                  <h3 className="font-bold text-slate-800 uppercase tracking-wide text-xs flex items-center gap-2">
                    <AlignLeft className="w-4 h-4" /> Table of Contents
                  </h3>
                  {isTocOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </button>

                {isTocOpen && (
                  <div className="p-2 animate-fade-in">
                    {categoryOrder.map(cat => {
                      const count = groupedVocab[cat]?.length || 0;
                      if (count === 0) return null;
                      const config = CATEGORY_CONFIG[cat];
                      return (
                        <button
                          key={cat}
                          onClick={() => scrollToSection(cat)}
                          className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition-colors text-left group"
                        >
                          <span className={`text-sm font-medium ${config.color.split(' ')[0]}`}>
                            {config.label}
                          </span>
                          <span className="bg-slate-100 text-slate-500 text-xs font-bold px-2 py-1 rounded-full group-hover:bg-white group-hover:shadow-sm transition-all">
                            {count}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Structure Analysis (if present) */}
              {data.structure_analysis && data.structure_analysis.length > 0 && (
                <div>
                  <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900 mb-4 uppercase tracking-wide">
                    <Layout className="w-5 h-5 text-slate-400" />
                    Logical Flow
                  </h3>
                  <div className="bg-slate-50 rounded-xl p-1 space-y-1 max-h-[50vh] overflow-y-auto border border-slate-200 scrollbar-thin">
                    {data.structure_analysis.map((point, idx) => (
                      <div key={idx} className="relative">
                        <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-100 hover:border-indigo-200 transition-all">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">
                              {idx + 1}
                            </span>
                            <h4 className="font-bold text-slate-800 text-sm uppercase tracking-wide">{point.section}</h4>
                          </div>
                          <p className="text-sm text-slate-600 mb-3 pl-9">
                            {point.purpose}
                          </p>
                          <div className="ml-9 bg-indigo-50/50 p-2 rounded border border-indigo-100">
                            <p className="text-xs text-indigo-600 font-bold uppercase mb-1">Native Transition</p>
                            <p className="text-sm text-slate-900 font-medium font-serif italic">"{point.native_pattern}"</p>
                          </div>
                        </div>
                        {idx < (data.structure_analysis?.length || 0) - 1 && (
                          <div className="h-4 flex justify-center items-center">
                            <div className="w-px h-full bg-slate-300"></div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Main Content: Vocabulary Analysis (6 cols) */}
          <div className="lg:col-span-6">

            {categoryOrder.map((catKey, sectionIdx) => {
              const items = groupedVocab[catKey];
              if (!items || items.length === 0) return null;
              const config = CATEGORY_CONFIG[catKey];

              return (
                <div key={catKey} id={catKey} className="mb-12 animate-fade-in scroll-mt-40">
                  <div className={`flex items-center gap-3 mb-6 pb-2 border-b-2 ${config.color.split(' ')[2]}`}>
                    <div className={`p-2 rounded-lg ${config.color.split(' ')[1]} ${config.color.split(' ')[0]}`}>
                      {config.icon}
                    </div>
                    <h2 className={`text-xl font-bold ${config.color.split(' ')[0]}`}>
                      {config.label}
                    </h2>
                  </div>

                  {/* LIST VIEW MODE */}
                  {viewMode === 'list' && (
                    <div className="space-y-6">
                      {items.map((item, idx) => {
                        const isSelected = selectedTerms.has(item.term);

                        return (
                          <div
                            key={idx}
                            onClick={() => toggleTerm(item.term)}
                            className={`relative group bg-white rounded-xl border transition-all duration-300 overflow-hidden cursor-pointer ${isSelected
                              ? 'border-emerald-500 ring-1 ring-emerald-500 shadow-md'
                              : 'border-slate-200 hover:border-slate-300 hover:shadow-lg'
                              }`}
                          >
                            <div className="p-6 pb-4">
                              <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center gap-3 flex-wrap">
                                  <h3 className="text-2xl font-serif font-bold text-slate-900">{item.term}</h3>
                                  <button
                                    onClick={(e) => handlePlayAudio(e, item.term)}
                                    className={`p-2 rounded-full hover:bg-slate-100 transition-colors ${playingText === item.term ? 'text-emerald-500 animate-pulse' : 'text-slate-400'}`}
                                  >
                                    <Volume2 className="w-5 h-5" />
                                  </button>
                                  {/* Difficulty Badge */}
                                  {item.difficulty_level && (
                                    (() => {
                                      const diffColor = getDifficultyColor(item.difficulty_level, proficiency);
                                      return (
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${diffColor.bg} ${diffColor.text}`}>
                                          <BarChart3 className="w-3 h-3" />
                                          {diffColor.label}
                                        </span>
                                      );
                                    })()
                                  )}
                                </div>
                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 text-transparent'}`}>
                                  <CheckCircle className="w-4 h-4" />
                                </div>
                              </div>
                              <p className="text-slate-600 text-lg mb-4">{item.definition}</p>
                              <div className="grid md:grid-cols-2 gap-4 text-sm">
                                {item.source_context && (
                                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                                    <p className="text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                                      <Quote className="w-3 h-3" /> Context in Source
                                    </p>
                                    <p className="text-slate-700 italic">"{item.source_context}"</p>
                                  </div>
                                )}
                                {item.imagery_etymology && (
                                  <div className="bg-amber-50 p-3 rounded-lg border border-amber-100">
                                    <p className="text-xs font-bold text-amber-600 uppercase mb-1 flex items-center gap-1">
                                      <Sparkles className="w-3 h-3" /> Mental Image / Origin
                                    </p>
                                    <p className="text-slate-800">{item.imagery_etymology}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                            {item.examples && item.examples.length > 0 && (
                              <div className="bg-slate-50/80 p-6 border-t border-slate-100">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Native Usage Examples</p>
                                <div className="space-y-3">
                                  {item.examples.map((ex, exIdx) => (
                                    <div key={exIdx} className="flex gap-3 group/ex">
                                      <div className="mt-1 min-w-[100px]">
                                        <span className="text-xs font-semibold px-2 py-1 bg-white border border-slate-200 rounded text-slate-500">
                                          {ex.context_label}
                                        </span>
                                      </div>
                                      <div className="flex-1">
                                        <div className="flex items-start justify-between gap-2">
                                          <p className="text-slate-800 font-medium leading-relaxed">"{ex.sentence}"</p>
                                          <button
                                            onClick={(e) => handlePlayAudio(e, ex.sentence)}
                                            className={`opacity-0 group-hover/ex:opacity-100 transition-opacity p-1 text-slate-400 hover:text-emerald-600 ${playingText === ex.sentence ? 'opacity-100 text-emerald-600' : ''}`}
                                          >
                                            <Volume2 className="w-4 h-4" />
                                          </button>
                                        </div>
                                        {ex.explanation && <p className="text-slate-500 text-sm mt-1 italic">({ex.explanation})</p>}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* FLASHCARD MODE */}
                  {viewMode === 'flashcard' && (
                    <div className="relative">
                      {(() => {
                        const currentIndex = categoryIndices[catKey] || 0;
                        const isFlipped = flippedState[catKey] || false;
                        const currentItem = items[currentIndex];

                        return (
                          <div className="flex flex-col items-center">
                            {/* Card Container - Increased Height to 500px to prevent scrolling */}
                            <div
                              className="relative w-full max-w-2xl h-[500px] perspective-1000 cursor-pointer group mb-6"
                              onClick={() => handleFlip(catKey)}
                            >
                              <div className={`relative w-full h-full transition-transform duration-500 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
                                {/* Front */}
                                <div className="absolute inset-0 backface-hidden bg-white rounded-2xl shadow-lg border border-slate-200 flex flex-col items-center justify-center p-8 hover:shadow-xl transition-shadow">
                                  <div className={`mb-6 p-4 rounded-full transform scale-110 ${config.color.split(' ')[1]} ${config.color.split(' ')[0]}`}>
                                    {config.icon}
                                  </div>
                                  <h3 className="text-4xl md:text-5xl font-serif font-bold text-slate-900 text-center mb-4 leading-tight">{currentItem.term}</h3>

                                  <div className="flex gap-2 items-center text-slate-400 text-sm mt-8 animate-bounce">
                                    <RotateCw className="w-4 h-4" /> Click to flip
                                  </div>
                                  <button
                                    onClick={(e) => handlePlayAudio(e, currentItem.term)}
                                    className="absolute bottom-6 right-6 p-3 rounded-full bg-slate-50 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 transition-colors z-20"
                                  >
                                    <Volume2 className="w-5 h-5" />
                                  </button>
                                </div>

                                {/* Back */}
                                <div className="absolute inset-0 backface-hidden bg-slate-800 rounded-2xl shadow-lg rotate-y-180 flex flex-col p-6 overflow-y-auto">
                                  {/* Added Term Header for Context */}
                                  <h3 className="text-2xl font-serif font-bold text-emerald-400 mb-4 text-center shrink-0">{currentItem.term}</h3>

                                  <div className="flex-1 flex flex-col w-full gap-3">
                                    <p className="text-white text-lg font-medium leading-relaxed text-center">{currentItem.definition}</p>

                                    {currentItem.imagery_etymology && (
                                      <div className="bg-slate-700/50 p-3 rounded-lg border border-slate-600">
                                        <p className="text-xs font-bold text-slate-400 uppercase mb-1">Nuance</p>
                                        <p className="text-slate-200 text-sm">{currentItem.imagery_etymology}</p>
                                      </div>
                                    )}

                                    {currentItem.examples && currentItem.examples[0] && (
                                      <div className="text-slate-300 text-base italic border-t border-slate-700 pt-3 text-center">
                                        "{currentItem.examples[0].sentence}"
                                      </div>
                                    )}

                                    {/* User's Notes for this term */}
                                    {(() => {
                                      const termNotes = notes.filter(n => 
                                        n.word.toLowerCase() === currentItem.term.toLowerCase() ||
                                        currentItem.term.toLowerCase().includes(n.word.toLowerCase()) ||
                                        n.word.toLowerCase().includes(currentItem.term.toLowerCase())
                                      );
                                      if (termNotes.length === 0) return null;
                                      return (
                                        <div className="bg-amber-900/30 p-3 rounded-lg border border-amber-700/50 mt-2">
                                          <p className="text-xs font-bold text-amber-400 uppercase mb-2 flex items-center gap-1">
                                            <MessageCircle className="w-3 h-3" /> Your Notes
                                          </p>
                                          <div className="space-y-2">
                                            {termNotes.map(note => (
                                              <div key={note.id} className="text-sm">
                                                <p className="text-amber-100">{note.definition}</p>
                                                {note.context && (
                                                  <p className="text-amber-300/70 text-xs italic mt-1">"{note.context}"</p>
                                                )}
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Controls */}
                            <div className="flex items-center gap-8">
                              <button
                                onClick={() => handlePrevCard(catKey, items.length)}
                                className="p-3 rounded-full bg-white border border-slate-200 shadow-sm hover:bg-slate-50 text-slate-600 transition-all"
                              >
                                <ChevronLeft className="w-5 h-5" />
                              </button>
                              <span className="font-medium text-slate-500 text-sm bg-slate-100 px-3 py-1 rounded-full">
                                {currentIndex + 1} / {items.length}
                              </span>
                              <button
                                onClick={() => handleNextCard(catKey, items.length)}
                                className="p-3 rounded-full bg-white border border-slate-200 shadow-sm hover:bg-slate-50 text-slate-600 transition-all"
                              >
                                <ChevronRight className="w-5 h-5" />
                              </button>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right Column: Notes Sidebar (3 cols) */}
          <div className="lg:col-span-3 space-y-6">
            <div className="sticky top-24">
              <NotesSidebar notes={notes} onRemoveNote={removeNote} />
            </div>
          </div>
        </div>
        )}
      </div>

      {/* Fullscreen Flashcard Practice Modal */}
      {isFlashcardMode && data.vocabulary.length > 0 && (
        <div className="fixed inset-0 bg-slate-900/95 z-50 flex flex-col items-center justify-center p-4">
          {/* Close Button */}
          <button
            onClick={closeFlashcardMode}
            className="absolute top-6 right-6 p-3 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Progress */}
          <div className="absolute top-6 left-6 text-slate-400 text-sm font-medium">
            {flashcardIndex + 1} / {data.vocabulary.length}
          </div>

          {/* Results Screen */}
          {showResults ? (
            <div className="w-full max-w-md text-center">
              {(() => {
                const totalCards = data.vocabulary.length;
                const percentage = totalCards > 0 ? Math.round((correctCount / totalCards) * 100) : 0;
                const passed = percentage >= 90;

                return (
                  <div className="bg-white rounded-2xl shadow-2xl p-8 space-y-6">
                    {/* Result Icon */}
                    <div className={`mx-auto w-24 h-24 rounded-full flex items-center justify-center ${
                      passed 
                        ? 'bg-gradient-to-br from-yellow-400 to-amber-500' 
                        : 'bg-gradient-to-br from-slate-400 to-slate-500'
                    }`}>
                      {passed ? (
                        <Trophy className="w-12 h-12 text-white animate-bounce" />
                      ) : (
                        <Award className="w-12 h-12 text-white" />
                      )}
                    </div>

                    {/* Message */}
                    <div>
                      <h2 className={`text-3xl font-bold mb-2 ${
                        passed ? 'text-amber-600' : 'text-slate-700'
                      }`}>
                        {passed ? 'Excellent!' : 'Keep Practicing!'}
                      </h2>
                      <p className="text-slate-500">
                        {passed 
                          ? 'You\'ve mastered this material!' 
                          : 'You\'re making progress. Try again to reach 90%!'}
                      </p>
                      {passed && analysisId && (
                        <p className="text-emerald-600 text-sm font-medium mt-2 flex items-center justify-center gap-1">
                          <CheckCircle className="w-4 h-4" /> Progress saved!
                        </p>
                      )}
                    </div>

                    {/* Score */}
                    <div className="py-4">
                      <div className="text-5xl font-bold text-slate-800 mb-2">
                        {percentage}%
                      </div>
                      <div className="text-slate-500">
                        {correctCount} of {totalCards} correct
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          passed 
                            ? 'bg-gradient-to-r from-amber-400 to-amber-500' 
                            : 'bg-gradient-to-r from-indigo-400 to-indigo-500'
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>

                    {/* 90% threshold indicator */}
                    {!passed && (
                      <div className="text-sm text-slate-400">
                        Need {Math.ceil(totalCards * 0.9) - correctCount} more correct answers to pass (90%)
                      </div>
                    )}

                    {/* Buttons */}
                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={retryFlashcards}
                        className="flex-1 py-3 px-4 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
                      >
                        <RotateCcw className="w-5 h-5" />
                        Try Again
                      </button>
                      <button
                        onClick={closeFlashcardMode}
                        className={`flex-1 py-3 px-4 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 ${
                          passed 
                            ? 'bg-amber-500 text-white hover:bg-amber-600' 
                            : 'bg-indigo-600 text-white hover:bg-indigo-700'
                        }`}
                      >
                        <Check className="w-5 h-5" />
                        Done
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : (
          /* Card */
          <div className="w-full max-w-xl">
            {(() => {
              const currentItem = data.vocabulary[flashcardIndex];
              const example = currentItem.examples && currentItem.examples.length > 0 
                ? currentItem.examples[0].sentence 
                : null;

              return (
                <div className="bg-white rounded-2xl shadow-2xl p-6 min-h-[400px] flex flex-col">
                  {/* Category Badge */}
                  <div className="flex justify-center mb-4">
                    <span className="px-3 py-1 text-xs font-bold uppercase tracking-wider bg-indigo-100 text-indigo-700 rounded-full">
                      {currentItem.category.replace(/_/g, ' ')}
                    </span>
                  </div>

                  {/* Definition Card */}
                  <div className="p-5 bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl mb-5">
                    <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-3">Definition</p>
                    <p className="text-xl text-white font-serif leading-relaxed">
                      {maskTerm(currentItem.definition, currentItem.term)}
                    </p>
                  </div>

                  {/* Example Hint */}
                  {example && (
                    <div className="mb-5 p-4 bg-amber-50 rounded-xl border border-amber-200">
                      <p className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-2">💡 Hint (Example)</p>
                      <p className="text-slate-700 italic text-sm leading-relaxed">"{maskTerm(example, currentItem.term)}"</p>
                    </div>
                  )}

                  {/* Answer Section */}
                  <div className="flex-1 flex flex-col justify-end">
                    {!showAnswer ? (
                      <div className="space-y-4">
                        <div>
                          <p className="text-xs font-bold text-slate-400 uppercase mb-2">What's the term?</p>
                          <div className="flex gap-2">
                            <input
                              ref={flashcardInputRef}
                              type="text"
                              value={userAnswer}
                              onChange={(e) => setUserAnswer(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleCheckFlashcardAnswer()}
                              placeholder="Type your answer..."
                              className="flex-1 px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-lg font-serif"
                              autoFocus
                            />
                            <button
                              onClick={handleCheckFlashcardAnswer}
                              disabled={!userAnswer.trim()}
                              className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                              <Check className="w-5 h-5" />
                              Check
                            </button>
                          </div>
                        </div>
                        <button
                          onClick={handleSkipFlashcard}
                          className="w-full py-2 text-slate-400 hover:text-slate-600 text-sm font-medium transition-colors"
                        >
                          Skip & Show Answer
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Result */}
                        <div className={`p-4 rounded-xl flex items-center gap-3 ${
                          answerResult === 'correct' 
                            ? 'bg-emerald-50 border border-emerald-200' 
                            : 'bg-red-50 border border-red-200'
                        }`}>
                          {answerResult === 'correct' ? (
                            <CheckCircle className="w-6 h-6 text-emerald-600 flex-shrink-0" />
                          ) : (
                            <XCircle className="w-6 h-6 text-red-500 flex-shrink-0" />
                          )}
                          <div className="flex-1">
                            <p className={`font-bold ${answerResult === 'correct' ? 'text-emerald-700' : 'text-red-700'}`}>
                              {answerResult === 'correct' ? 'Correct!' : 'Not quite...'}
                            </p>
                            {answerResult === 'incorrect' && userAnswer && (
                              <p className="text-sm text-red-600">Your answer: "{userAnswer}"</p>
                            )}
                          </div>
                        </div>

                        {/* Correct Answer */}
                        <div className="p-4 bg-slate-900 rounded-xl">
                          <p className="text-xs font-bold text-slate-400 uppercase mb-2">Answer</p>
                          <div className="flex items-center justify-between">
                            <h3 className="text-2xl font-serif font-bold text-white">
                              {currentItem.term}
                            </h3>
                            <button
                              onClick={(e) => handlePlayAudio(e, currentItem.term)}
                              className={`p-3 rounded-full bg-slate-800 hover:bg-slate-700 transition-colors ${
                                playingText === currentItem.term ? 'text-emerald-400 animate-pulse' : 'text-slate-400'
                              }`}
                            >
                              <Volume2 className="w-5 h-5" />
                            </button>
                          </div>
                        </div>

                        {/* User's Notes for this term */}
                        {(() => {
                          const termNotes = notes.filter(n => 
                            n.word.toLowerCase() === currentItem.term.toLowerCase() ||
                            currentItem.term.toLowerCase().includes(n.word.toLowerCase()) ||
                            n.word.toLowerCase().includes(currentItem.term.toLowerCase())
                          );
                          if (termNotes.length === 0) return null;
                          return (
                            <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                              <p className="text-xs font-bold text-amber-600 uppercase mb-2 flex items-center gap-1">
                                <MessageCircle className="w-3 h-3" /> Your Notes
                              </p>
                              <div className="space-y-2">
                                {termNotes.map(note => (
                                  <div key={note.id} className="text-sm">
                                    <p className="text-slate-700">{note.definition}</p>
                                    {note.context && (
                                      <p className="text-slate-500 text-xs italic mt-1">"{note.context}"</p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}

                        {/* Next Button */}
                        <button
                          onClick={handleFlashcardNext}
                          className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
                        >
                          {flashcardIndex < data.vocabulary.length - 1 ? (
                            <>Next Card <ChevronRight className="w-5 h-5" /></>
                          ) : (
                            <>See Results <ChevronRight className="w-5 h-5" /></>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
          )}

          {/* Navigation - only show when not viewing results */}
          {!showResults && (
            <div className="flex items-center gap-8 mt-8">
              <button
                onClick={handleFlashcardPrev}
                disabled={flashcardIndex === 0}
                className="p-3 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <span className="text-sm font-medium text-slate-400">
                {flashcardIndex + 1} / {data.vocabulary.length}
              </span>
              <button
                onClick={handleFlashcardNext}
                disabled={flashcardIndex >= data.vocabulary.length - 1}
                className="p-3 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AnalysisView;
