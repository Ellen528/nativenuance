
import { AnalysisResult, GeneratedPractice, SourceType, VocabularyItem } from "../types";

// Get Supabase URL from environment
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Helper to call Edge Functions
const callEdgeFunction = async (functionName: string, body: object) => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase not configured');
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `Failed to call ${functionName}`);
  }

  return response.json();
};

// --- Text Analysis (Deep Vocab Focus) ---

export const analyzeText = async (text: string, sourceType: SourceType): Promise<AnalysisResult> => {
  console.log('Calling analyze-text Edge Function...');
  
  const result = await callEdgeFunction('analyze-text', { text, sourceType });
  
  console.log('Analysis complete!');
  return result as AnalysisResult;
};

// --- Topic Strategy (Structure + Vocab) ---

export const generateTopicStrategy = async (topic: string): Promise<AnalysisResult> => {
  console.log('Calling generate-strategy Edge Function...');
  
  const result = await callEdgeFunction('generate-strategy', { topic });
  
  console.log('Strategy generation complete!');
  return result as AnalysisResult;
};

// --- Practice Generation ---

export const generatePractice = async (vocabulary: VocabularyItem[]): Promise<GeneratedPractice> => {
  console.log('Calling generate-practice Edge Function...');
  
  const result = await callEdgeFunction('generate-practice', { vocabulary });
  
  console.log('Practice generation complete!');
  return result as GeneratedPractice;
};

// --- Text to Speech (Browser-based fallback) ---

export const generateSpeech = async (text: string): Promise<void> => {
  // Use browser's built-in speech synthesis as a fallback
  // This avoids needing the TTS API key on the client
  return new Promise((resolve) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.9;
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      speechSynthesis.speak(utterance);
    } else {
      console.warn('Speech synthesis not supported');
      resolve();
    }
  });
};

// --- Word Lookup ---

export const lookupWord = async (word: string, context: string): Promise<{ definition: string; pronunciation: string }> => {
  console.log('Calling lookup-word Edge Function...');
  
  const result = await callEdgeFunction('lookup-word', { word, context });
  
  console.log('Word lookup complete!');
  return result as { definition: string; pronunciation: string };
};
