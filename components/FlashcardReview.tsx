import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  VocabularyReview, 
  ReviewStats, 
  SimpleQuality,
  DetailedExample,
  SavedAnalysis 
} from '../types';
import { dataService } from '../services/dataService';
import { previewIntervals } from '../services/sm2Algorithm';
import { generateSpeech } from '../services/geminiService';
import { 
  X, 
  Play, 
  RotateCcw, 
  Trophy, 
  Award, 
  ChevronRight, 
  Volume2,
  BookOpen,
  Target,
  TrendingUp,
  CheckCircle,
  XCircle,
  Clock,
  EyeOff,
  Loader2,
  Sparkles,
  GraduationCap,
  BarChart3,
  RefreshCw,
  FileText,
  Library
} from 'lucide-react';

// Study source types
type StudySource = 'text_analysis' | 'book_library';

interface Props {
  userId: string;
  savedAnalyses: SavedAnalysis[];
  hasBooks?: boolean;  // Whether user has any books in library
  onClose?: () => void;
}

const FlashcardReview: React.FC<Props> = ({ userId, savedAnalyses, hasBooks = false, onClose }) => {
  // Study source state
  const [studySource, setStudySource] = useState<StudySource>('text_analysis');

  // Dashboard state
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Session setup state
  const [showSetup, setShowSetup] = useState(false);
  const [sessionSize, setSessionSize] = useState(10);
  const [includeNew, setIncludeNew] = useState(true);
  const [includeDue, setIncludeDue] = useState(true);

  // Review session state
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewQueue, setReviewQueue] = useState<VocabularyReview[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [showAnswer, setShowAnswer] = useState(false);
  const [answerResult, setAnswerResult] = useState<'correct' | 'incorrect' | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(false);

  // Session results
  const [showResults, setShowResults] = useState(false);
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [sessionIncorrect, setSessionIncorrect] = useState(0);

  // Audio state
  const [playingId, setPlayingId] = useState<string | null>(null);

  // Re-queue tracking: how many times each card has been re-queued this session
  const requeueCountRef = useRef<Record<string, number>>({});
  const [requeuedMessage, setRequeuedMessage] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // Load stats on mount and when study source changes
  useEffect(() => {
    loadStats();
  }, [userId, studySource]);

  // Focus input when card changes
  useEffect(() => {
    if (isReviewing && !showAnswer && inputRef.current) {
      inputRef.current.focus();
    }
  }, [currentIndex, isReviewing, showAnswer]);

  // Auto-play pronunciation when answer is revealed
  useEffect(() => {
    if (isReviewing && showAnswer && reviewQueue[currentIndex] && !playingId) {
      const currentCard = reviewQueue[currentIndex];
      // Small delay to let the UI update first
      const timer = setTimeout(() => {
        handlePlayAudio(currentCard.term, currentCard.id);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [showAnswer, currentIndex, isReviewing]);

  // Keyboard shortcuts when answer is showing: a=again, s=hard, d=good, f=easy, space=good
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isReviewing || !showAnswer) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      switch (e.key.toLowerCase()) {
        case 'a':
          e.preventDefault();
          handleQualitySelect('again');
          break;
        case 's':
          e.preventDefault();
          handleQualitySelect('hard');
          break;
        case 'd':
        case ' ': // Space also triggers 'good'
          e.preventDefault();
          handleQualitySelect('good');
          break;
        case 'f':
          e.preventDefault();
          handleQualitySelect('easy');
          break;
        case 'n':
          e.preventDefault();
          handleSuspendWord();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isReviewing, showAnswer]);

  const loadStats = async () => {
    setIsLoadingStats(true);
    const sourceTypeFilter = studySource === 'text_analysis' ? 'text_analysis' : 'book_library';
    const reviewStats = await dataService.getReviewStats(userId, sourceTypeFilter);
    setStats(reviewStats);
    setIsLoadingStats(false);
  };

  // Sync vocabulary from saved analyses or books to review system
  const syncVocabulary = async () => {
    if (studySource === 'text_analysis') {
      if (savedAnalyses.length === 0) {
        setSyncMessage('No analyses found. Analyze some text first!');
        setTimeout(() => setSyncMessage(null), 3000);
        return;
      }

      setIsSyncing(true);
      setSyncMessage(null);
      
      try {
        const syncedCount = await dataService.syncVocabFromAnalyses(userId, savedAnalyses);
        if (syncedCount > 0) {
          setSyncMessage(`Synced ${syncedCount} new words from text analyses!`);
        } else {
          setSyncMessage('All text analysis vocabulary is already synced.');
        }
        await loadStats();
      } catch (error: any) {
        console.error('Sync error:', error);
        setSyncMessage(`Sync failed: ${error?.message || 'Unknown error. Check console for details.'}`);
        setIsSyncing(false);
        setTimeout(() => setSyncMessage(null), 8000);
        return;
      }
    } else {
      // Book library sync
      if (!hasBooks) {
        setSyncMessage('No books found. Add some books to your library first!');
        setTimeout(() => setSyncMessage(null), 3000);
        return;
      }

      setIsSyncing(true);
      setSyncMessage(null);
      
      try {
        const syncedCount = await dataService.syncVocabFromBooks(userId);
        if (syncedCount > 0) {
          setSyncMessage(`Synced ${syncedCount} new words from book library!`);
        } else {
          setSyncMessage('All book vocabulary is already synced.');
        }
        await loadStats();
      } catch (error: any) {
        console.error('Sync error:', error);
        setSyncMessage(`Sync failed: ${error?.message || 'Unknown error. Check console for details.'}`);
        setIsSyncing(false);
        setTimeout(() => setSyncMessage(null), 8000);
        return;
      }
    }
    
    setIsSyncing(false);
    setTimeout(() => setSyncMessage(null), 3000);
  };

  // Mask term in text for fill-in-blank style
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

  // Smart answer matching
  const stemWord = useCallback((word: string): string => {
    if (word.length < 4) return word;
    if (word.endsWith('ied')) return word.slice(0, -3) + 'y';
    if (word.endsWith('ed') && word.length > 4) return word.slice(0, -2);
    if (word.endsWith('ing') && word.length > 5) return word.slice(0, -3);
    if (word.endsWith('es') && word.length > 4) return word.slice(0, -2);
    if (word.endsWith('s') && word.length > 4) return word.slice(0, -1);
    return word;
  }, []);

  const normalizeForComparison = useCallback((text: string): string => {
    return text
      .toLowerCase()
      .replace(/[.,!?;:'"()\-–—]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .filter(w => !['the', 'a', 'an', 'to', 'be'].includes(w))
      .map(w => stemWord(w))
      .sort()
      .join(' ');
  }, [stemWord]);

  const checkAnswer = useCallback((userAnswer: string, correctTerm: string): boolean => {
    if (!userAnswer.trim() || !correctTerm) return false;
    
    const normalizedUser = normalizeForComparison(userAnswer);
    const normalizedCorrect = normalizeForComparison(correctTerm);
    
    if (normalizedUser === normalizedCorrect) return true;
    
    const userWords = normalizedUser.split(' ');
    const correctWords = normalizedCorrect.split(' ');
    const matchCount = userWords.filter(uw => 
      correctWords.some(cw => cw.includes(uw) || uw.includes(cw))
    ).length;
    
    const matchRatio = matchCount / Math.max(userWords.length, correctWords.length);
    return matchRatio >= 0.6;
  }, [normalizeForComparison]);

  const handlePlayAudio = async (text: string, id: string) => {
    if (playingId) return;
    setPlayingId(id);
    try {
      await generateSpeech(text);
    } finally {
      setPlayingId(null);
    }
  };

  const startSession = async () => {
    setIsLoadingSession(true);
    
    const sourceTypeFilter = studySource === 'text_analysis' ? 'text_analysis' : 'book_library';
    let cards: VocabularyReview[] = [];
    
    // Fetch due reviews first (priority)
    if (includeDue) {
      const dueCards = await dataService.fetchDueReviews(userId, sessionSize, sourceTypeFilter);
      cards = [...cards, ...dueCards];
    }
    
    // If we need more cards, fetch new ones
    if (includeNew && cards.length < sessionSize) {
      const remaining = sessionSize - cards.length;
      const newCards = await dataService.fetchNewWordsForReview(userId, remaining, sourceTypeFilter);
      cards = [...cards, ...newCards];
    }
    
    // If still not enough and we haven't included one type, try the other
    if (cards.length < sessionSize) {
      if (!includeDue) {
        const dueCards = await dataService.fetchDueReviews(userId, sessionSize - cards.length, sourceTypeFilter);
        cards = [...cards, ...dueCards];
      }
      if (!includeNew) {
        const newCards = await dataService.fetchNewWordsForReview(userId, sessionSize - cards.length, sourceTypeFilter);
        cards = [...cards, ...newCards];
      }
    }
    
    // Shuffle and limit to requested session size
    cards = cards.sort(() => Math.random() - 0.5).slice(0, sessionSize);
    
    if (cards.length === 0) {
      setIsLoadingSession(false);
      const sourceLabel = studySource === 'text_analysis' ? 'text analyses' : 'book library';
      alert(`No cards available for review. Try adding more vocabulary from your ${sourceLabel}!`);
      return;
    }
    
    requeueCountRef.current = {};
    setReviewQueue(cards);
    setCurrentIndex(0);
    setUserAnswer('');
    setShowAnswer(false);
    setAnswerResult(null);
    setSessionCorrect(0);
    setSessionIncorrect(0);
    setShowResults(false);
    setIsReviewing(true);
    setShowSetup(false);
    setIsLoadingSession(false);
  };

  const handleSubmitAnswer = () => {
    if (!userAnswer.trim()) return;
    
    const currentCard = reviewQueue[currentIndex];
    const isCorrect = checkAnswer(userAnswer, currentCard.term);
    
    setAnswerResult(isCorrect ? 'correct' : 'incorrect');
    setShowAnswer(true);
    
    if (isCorrect) {
      setSessionCorrect(prev => prev + 1);
    } else {
      setSessionIncorrect(prev => prev + 1);
    }
  };

  const handleSkip = () => {
    setAnswerResult('incorrect');
    setShowAnswer(true);
    setSessionIncorrect(prev => prev + 1);
  };

  const handleQualitySelect = async (quality: SimpleQuality) => {
    const currentCard = reviewQueue[currentIndex];

    // Update the review in the database
    await dataService.updateReviewAfterAnswer(userId, currentCard.id, quality);

    // Re-queue "again" cards so the user sees them again this session (max 2x per card)
    let newQueue = reviewQueue;
    if (quality === 'again') {
      const count = requeueCountRef.current[currentCard.id] || 0;
      if (count < 2) {
        requeueCountRef.current[currentCard.id] = count + 1;
        newQueue = [...reviewQueue, currentCard];
        setReviewQueue(newQueue);
        setRequeuedMessage(true);
        setTimeout(() => setRequeuedMessage(false), 2000);
      }
    }

    // Move to next card or show results
    if (currentIndex < newQueue.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setUserAnswer('');
      setShowAnswer(false);
      setAnswerResult(null);
    } else {
      setShowResults(true);
    }
  };

  const handleSuspendWord = async () => {
    const currentCard = reviewQueue[currentIndex];
    await dataService.suspendWord(userId, currentCard.id, true);
    
    // Move to next card
    if (currentIndex < reviewQueue.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setUserAnswer('');
      setShowAnswer(false);
      setAnswerResult(null);
    } else {
      setShowResults(true);
    }
  };

  const closeSession = () => {
    setIsReviewing(false);
    setShowResults(false);
    setReviewQueue([]);
    loadStats(); // Refresh stats
  };

  const retrySession = () => {
    setCurrentIndex(0);
    setUserAnswer('');
    setShowAnswer(false);
    setAnswerResult(null);
    setSessionCorrect(0);
    setSessionIncorrect(0);
    setShowResults(false);
    // Shuffle the queue again
    setReviewQueue(prev => [...prev].sort(() => Math.random() - 0.5));
  };

  // Get interval previews for current card
  const getIntervalPreviews = () => {
    if (!reviewQueue[currentIndex]) return null;
    const card = reviewQueue[currentIndex];
    return previewIntervals({
      easeFactor: card.easeFactor,
      interval: card.interval,
      repetitions: card.repetitions,
    });
  };

  // Dashboard View
  if (!isReviewing) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-100 to-purple-100 rounded-full mb-4">
            <GraduationCap className="w-5 h-5 text-indigo-600" />
            <span className="text-sm font-bold text-indigo-700">Spaced Repetition</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Flashcard Review</h1>
          <p className="text-slate-500">Master your vocabulary with scientifically-proven spaced repetition</p>
          
          {/* Study Source Selector */}
          <div className="flex justify-center mt-6">
            <div className="inline-flex bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setStudySource('text_analysis')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  studySource === 'text_analysis'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <FileText className="w-4 h-4" />
                Text Analysis
              </button>
              <button
                onClick={() => setStudySource('book_library')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  studySource === 'book_library'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Library className="w-4 h-4" />
                Book Library
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        {isLoadingStats ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          </div>
        ) : stats ? (
          <>
            {/* Main Progress Card */}
            <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-800">Overall Progress</h2>
                <div className="flex items-center gap-2 text-emerald-600">
                  <TrendingUp className="w-5 h-5" />
                  <span className="font-bold">{Math.round(stats.masteryPercentage)}% Mastered</span>
                </div>
              </div>
              
              {/* Progress Bar */}
              <div className="relative h-4 bg-slate-100 rounded-full overflow-hidden mb-4">
                <div 
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${stats.masteryPercentage}%` }}
                />
              </div>
              
              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-50 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-slate-800">{stats.totalWords}</div>
                  <div className="text-xs text-slate-500 font-medium">Total Words</div>
                </div>
                <div className="bg-emerald-50 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-emerald-600">{stats.masteredWords}</div>
                  <div className="text-xs text-emerald-600 font-medium">Mastered</div>
                </div>
                <div className="bg-amber-50 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-amber-600">{stats.learningWords}</div>
                  <div className="text-xs text-amber-600 font-medium">Learning</div>
                </div>
                <div className="bg-indigo-50 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-indigo-600">{stats.newWords}</div>
                  <div className="text-xs text-indigo-600 font-medium">New</div>
                </div>
              </div>
            </div>

            {/* Reviews Due Card */}
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl shadow-lg p-6 mb-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-5 h-5" />
                    <span className="font-medium">Reviews Due</span>
                  </div>
                  <div className="text-4xl font-bold">{stats.dueToday}</div>
                  <div className="text-indigo-200 text-sm mt-1">
                    Words that need to be reviewed again today
                  </div>
                  {stats.newWords > 0 && (
                    <div className="text-indigo-100 text-sm mt-2">
                      + {stats.newWords} new words available to learn
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setShowSetup(true)}
                  disabled={stats.totalWords === 0}
                  className="px-6 py-3 bg-white text-indigo-600 rounded-xl font-bold hover:bg-indigo-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Play className="w-5 h-5" />
                  Start Review
                </button>
              </div>
            </div>

            {/* No words message - with sync option if source has content */}
            {stats.totalWords === 0 && (
              <div className="bg-slate-50 rounded-2xl p-8 text-center">
                <BookOpen className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-slate-700 mb-2">No vocabulary yet</h3>
                {studySource === 'text_analysis' ? (
                  savedAnalyses.length > 0 ? (
                    <>
                      <p className="text-slate-500 mb-4">
                        You have {savedAnalyses.length} saved {savedAnalyses.length === 1 ? 'analysis' : 'analyses'} with vocabulary ready to sync.
                      </p>
                      <button
                        onClick={syncVocabulary}
                        disabled={isSyncing}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50"
                      >
                        {isSyncing ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <RefreshCw className="w-5 h-5" />
                        )}
                        Sync Vocabulary Now
                      </button>
                    </>
                  ) : (
                    <p className="text-slate-500">
                      Analyze some text first to build your vocabulary, then come back to review!
                    </p>
                  )
                ) : (
                  hasBooks ? (
                    <>
                      <p className="text-slate-500 mb-4">
                        You have books in your library with vocabulary ready to sync.
                      </p>
                      <button
                        onClick={syncVocabulary}
                        disabled={isSyncing}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50"
                      >
                        {isSyncing ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <RefreshCw className="w-5 h-5" />
                        )}
                        Sync Book Vocabulary Now
                      </button>
                    </>
                  ) : (
                    <p className="text-slate-500">
                      Add some books to your library and extract vocabulary first!
                    </p>
                  )
                )}
              </div>
            )}

            {/* Sync button when words exist */}
            {stats.totalWords > 0 && (
              (studySource === 'text_analysis' && savedAnalyses.length > 0) ||
              (studySource === 'book_library' && hasBooks)
            ) && (
              <div className="flex justify-center mt-4">
                <button
                  onClick={syncVocabulary}
                  disabled={isSyncing}
                  className="inline-flex items-center gap-2 px-4 py-2 text-slate-500 hover:text-indigo-600 text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {isSyncing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  {studySource === 'text_analysis' 
                    ? 'Sync new vocabulary from text analyses' 
                    : 'Sync new vocabulary from book library'}
                </button>
              </div>
            )}

            {/* Sync message */}
            {syncMessage && (
              <div className="text-center text-sm text-indigo-600 mt-2 font-medium">
                {syncMessage}
              </div>
            )}

            {/* Suspended words note */}
            {stats.suspendedWords > 0 && (
              <div className="text-center text-sm text-slate-400 mt-4">
                {stats.suspendedWords} words suspended (hidden from reviews)
              </div>
            )}
          </>
        ) : null}

        {/* Session Setup Modal */}
        {showSetup && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
              <h2 className="text-xl font-bold text-slate-800 mb-6">Review Session Setup</h2>
              
              {/* Session Size */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-3">
                  Number of cards
                </label>
                <div className="flex gap-2">
                  {[5, 10, 15, 20, 30].map(size => (
                    <button
                      key={size}
                      onClick={() => setSessionSize(size)}
                      className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                        sessionSize === size
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              {/* Include Options */}
              <div className="space-y-3 mb-6">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeDue}
                    onChange={(e) => setIncludeDue(e.target.checked)}
                    className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-slate-700">Include due reviews ({stats?.dueToday || 0} available)</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeNew}
                    onChange={(e) => setIncludeNew(e.target.checked)}
                    className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-slate-700">Include new words ({stats?.newWords || 0} available)</span>
                </label>
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowSetup(false)}
                  className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={startSession}
                  disabled={isLoadingSession || (!includeNew && !includeDue)}
                  className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoadingSession ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Play className="w-5 h-5" />
                      Start
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Review Session View
  const currentCard = reviewQueue[currentIndex];
  const intervalPreviews = getIntervalPreviews();

  if (showResults) {
    // Session Results
    const totalCards = reviewQueue.length;
    const percentage = totalCards > 0 ? Math.round((sessionCorrect / totalCards) * 100) : 0;
    const excellent = percentage >= 80;

    return (
      <div className="fixed inset-0 bg-slate-900/95 z-50 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
            {/* Result Icon */}
            <div className={`mx-auto w-24 h-24 rounded-full flex items-center justify-center mb-6 ${
              excellent 
                ? 'bg-gradient-to-br from-yellow-400 to-amber-500' 
                : 'bg-gradient-to-br from-indigo-400 to-indigo-500'
            }`}>
              {excellent ? (
                <Trophy className="w-12 h-12 text-white" />
              ) : (
                <Award className="w-12 h-12 text-white" />
              )}
            </div>

            {/* Message */}
            <h2 className={`text-3xl font-bold mb-2 ${
              excellent ? 'text-amber-600' : 'text-slate-700'
            }`}>
              {excellent ? 'Excellent!' : 'Good Progress!'}
            </h2>
            <p className="text-slate-500 mb-6">
              {excellent 
                ? 'You\'re doing great!' 
                : 'Keep practicing to improve your retention!'}
            </p>

            {/* Score */}
            <div className="text-5xl font-bold text-slate-800 mb-2">
              {percentage}%
            </div>
            <div className="text-slate-500 mb-6">
              {sessionCorrect} of {totalCards} correct
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden mb-6">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  excellent 
                    ? 'bg-gradient-to-r from-amber-400 to-amber-500' 
                    : 'bg-gradient-to-r from-indigo-400 to-indigo-500'
                }`}
                style={{ width: `${percentage}%` }}
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={retrySession}
                className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-5 h-5" />
                Review Again
              </button>
              <button
                onClick={closeSession}
                className={`flex-1 py-3 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 ${
                  excellent 
                    ? 'bg-amber-500 text-white hover:bg-amber-600' 
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                <CheckCircle className="w-5 h-5" />
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Active Review Card
  const example = currentCard.examples && currentCard.examples.length > 0 
    ? currentCard.examples[0].sentence 
    : currentCard.sourceContext;

  return (
    <div className="fixed inset-0 bg-slate-900/95 z-50 flex flex-col items-center justify-center p-4">
      {/* Close Button */}
      <button
        onClick={closeSession}
        className="absolute top-6 right-6 p-3 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Progress */}
      <div className="absolute top-6 left-6 text-slate-300 text-sm font-medium">
        {currentIndex + 1} / {reviewQueue.length}
      </div>

      {/* Score */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-4 text-sm">
        <span className="flex items-center gap-1 text-emerald-400">
          <CheckCircle className="w-4 h-4" /> {sessionCorrect}
        </span>
        <span className="flex items-center gap-1 text-red-400">
          <XCircle className="w-4 h-4" /> {sessionIncorrect}
        </span>
      </div>

      {/* Re-queue notification */}
      {requeuedMessage && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-amber-500/90 text-white text-xs font-medium rounded-full whitespace-nowrap">
          You'll see this again shortly
        </div>
      )}

      {/* Card */}
      <div className="w-full max-w-xl">
        <div className="bg-white rounded-2xl shadow-2xl p-6 min-h-[400px] flex flex-col">
          {/* Category Badge */}
          {currentCard.category && (
            <div className="flex justify-center mb-4">
              <span className="px-3 py-1 text-xs font-bold uppercase tracking-wider bg-indigo-100 text-indigo-700 rounded-full">
                {currentCard.category.replace(/_/g, ' ')}
              </span>
            </div>
          )}

          {/* Definition Card */}
          <div className="flex-1 flex flex-col justify-center text-center">
            <p className="text-xl text-slate-700 mb-4 leading-relaxed">
              {currentCard.definition}
            </p>
            
            {example && (
              <p className="text-slate-500 italic text-sm mb-4">
                "{maskTerm(example, currentCard.term)}"
              </p>
            )}

            {/* Answer Section */}
            {!showAnswer ? (
              <div className="mt-4 space-y-4">
                <input
                  ref={inputRef}
                  type="text"
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmitAnswer()}
                  placeholder="Type the phrase or word..."
                  className="w-full px-4 py-3 text-center text-lg border-2 border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-0 outline-none transition-colors"
                />
                <div className="flex gap-3">
                  <button
                    onClick={handleSkip}
                    className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-medium hover:bg-slate-200 transition-colors"
                  >
                    Skip
                  </button>
                  <button
                    onClick={handleSubmitAnswer}
                    disabled={!userAnswer.trim()}
                    className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50"
                  >
                    Check
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {/* Answer Result */}
                <div className={`p-4 rounded-xl ${
                  answerResult === 'correct' 
                    ? 'bg-emerald-50 border-2 border-emerald-200' 
                    : 'bg-red-50 border-2 border-red-200'
                }`}>
                  <div className="flex items-center justify-center gap-2 mb-2">
                    {answerResult === 'correct' ? (
                      <CheckCircle className="w-6 h-6 text-emerald-500" />
                    ) : (
                      <XCircle className="w-6 h-6 text-red-500" />
                    )}
                    <span className={`font-bold text-lg ${
                      answerResult === 'correct' ? 'text-emerald-700' : 'text-red-700'
                    }`}>
                      {answerResult === 'correct' ? 'Correct!' : 'Not quite'}
                    </span>
                  </div>
                  <div className="text-center">
                    <span className="font-bold text-slate-800 text-xl">{currentCard.term}</span>
                  </div>
                </div>

                {/* Audio Button */}
                <div className="flex justify-center">
                  <button
                    onClick={() => handlePlayAudio(currentCard.term, currentCard.id)}
                    className={`p-3 rounded-full bg-slate-100 hover:bg-slate-200 transition-colors ${
                      playingId === currentCard.id ? 'text-emerald-500 animate-pulse' : 'text-slate-500'
                    }`}
                  >
                    <Volume2 className="w-5 h-5" />
                  </button>
                </div>

                {/* All Examples */}
                {currentCard.examples && currentCard.examples.length > 0 && (
                  <div className="space-y-2 text-left">
                    {currentCard.examples.map((ex, i) => (
                      <div key={i} className="p-3 bg-slate-50 rounded-lg">
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          {ex.context_label}
                        </span>
                        <p className="text-sm text-slate-600 italic mt-1">"{ex.sentence}"</p>
                        {ex.explanation && (
                          <p className="text-xs text-slate-400 mt-1">{ex.explanation}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Quality Buttons */}
                <div className="space-y-2">
                  <p className="text-sm text-slate-500 text-center">How well did you know this?</p>
                  <div className="grid grid-cols-4 gap-2">
                    <button
                      onClick={() => handleQualitySelect('again')}
                      className="py-3 px-2 bg-red-100 text-red-700 rounded-xl font-medium hover:bg-red-200 transition-colors text-sm"
                    >
                      <div className="flex items-center justify-center gap-1">
                        Again
                        <kbd className="px-1 py-0.5 bg-red-200/50 rounded text-xs">A</kbd>
                      </div>
                      {intervalPreviews && (
                        <div className="text-xs opacity-70">{intervalPreviews.again}</div>
                      )}
                    </button>
                    <button
                      onClick={() => handleQualitySelect('hard')}
                      className="py-3 px-2 bg-amber-100 text-amber-700 rounded-xl font-medium hover:bg-amber-200 transition-colors text-sm"
                    >
                      <div className="flex items-center justify-center gap-1">
                        Hard
                        <kbd className="px-1 py-0.5 bg-amber-200/50 rounded text-xs">S</kbd>
                      </div>
                      {intervalPreviews && (
                        <div className="text-xs opacity-70">{intervalPreviews.hard}</div>
                      )}
                    </button>
                    <button
                      onClick={() => handleQualitySelect('good')}
                      className="py-3 px-2 bg-emerald-100 text-emerald-700 rounded-xl font-medium hover:bg-emerald-200 transition-colors text-sm"
                    >
                      <div className="flex items-center justify-center gap-1">
                        Good
                        <kbd className="px-1 py-0.5 bg-emerald-200/50 rounded text-xs">D</kbd>
                      </div>
                      {intervalPreviews && (
                        <div className="text-xs opacity-70">{intervalPreviews.good}</div>
                      )}
                    </button>
                    <button
                      onClick={() => handleQualitySelect('easy')}
                      className="py-3 px-2 bg-indigo-100 text-indigo-700 rounded-xl font-medium hover:bg-indigo-200 transition-colors text-sm"
                    >
                      <div className="flex items-center justify-center gap-1">
                        Easy
                        <kbd className="px-1 py-0.5 bg-indigo-200/50 rounded text-xs">F</kbd>
                      </div>
                      {intervalPreviews && (
                        <div className="text-xs opacity-70">{intervalPreviews.easy}</div>
                      )}
                    </button>
                  </div>
                </div>

                {/* Don't show again */}
                <button
                  onClick={handleSuspendWord}
                  className="w-full py-2 text-slate-400 hover:text-slate-600 text-sm flex items-center justify-center gap-2 transition-colors"
                >
                  <EyeOff className="w-4 h-4" />
                  Don't show again
                  <kbd className="px-1 py-0.5 bg-slate-100 rounded text-xs">N</kbd>
                </button>

                {/* Keyboard hints */}
                <p className="text-xs text-slate-400 text-center">
                  <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-600">Space</kbd> or <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-600">D</kbd> = Good
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FlashcardReview;
