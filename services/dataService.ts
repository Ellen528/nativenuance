import { supabase } from './supabaseClient';
import { SavedAnalysis, SavedVocabularyItem, SourceType } from '../types';

// Database row types (matching Supabase schema)
interface DbSavedAnalysis {
  id: string;
  user_id: string;
  date: number;
  source_type: string;
  input_text: string;
  analysis_result: object;
  file_name: string | null;
  created_at: string;
}

interface DbSavedVocabulary {
  id: string;
  user_id: string;
  term: string;
  definition: string;
  category: string;
  source_context: string | null;
  imagery_etymology: string | null;
  examples: object | null;
  nuance: string | null;
  date_added: number;
  created_at: string;
}

// Transform database row to app type
const dbToAnalysis = (row: DbSavedAnalysis): SavedAnalysis => ({
  id: row.id,
  date: row.date,
  sourceType: row.source_type as SourceType,
  inputText: row.input_text,
  analysisResult: row.analysis_result as SavedAnalysis['analysisResult'],
  fileName: row.file_name,
});

const dbToVocabulary = (row: DbSavedVocabulary): SavedVocabularyItem => ({
  id: row.id,
  term: row.term,
  definition: row.definition,
  category: row.category as SavedVocabularyItem['category'],
  source_context: row.source_context ?? undefined,
  imagery_etymology: row.imagery_etymology ?? undefined,
  examples: (row.examples as SavedVocabularyItem['examples']) ?? [],
  nuance: row.nuance ?? undefined,
  dateAdded: row.date_added,
});

export const dataService = {
  // ==================== ANALYSES ====================

  /**
   * Fetch all analyses for the current user
   */
  async fetchAnalyses(userId: string): Promise<SavedAnalysis[]> {
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('saved_analyses')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching analyses:', error);
      return [];
    }

    return (data || []).map(dbToAnalysis);
  },

  /**
   * Save a new analysis
   */
  async saveAnalysis(userId: string, analysis: SavedAnalysis): Promise<SavedAnalysis | null> {
    if (!supabase) {
      console.warn('Supabase not configured, skipping cloud save');
      return null;
    }

    console.log('Saving analysis to Supabase...', { userId, analysisId: analysis.id });

    const { data, error } = await supabase
      .from('saved_analyses')
      .insert({
        id: analysis.id,
        user_id: userId,
        date: analysis.date,
        source_type: analysis.sourceType,
        input_text: analysis.inputText,
        analysis_result: analysis.analysisResult,
        file_name: analysis.fileName || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving analysis to Supabase:', error);
      return null;
    }

    console.log('Analysis saved successfully to Supabase!', data);
    return dbToAnalysis(data);
  },

  /**
   * Delete an analysis
   */
  async deleteAnalysis(userId: string, analysisId: string): Promise<boolean> {
    if (!supabase) return false;

    const { error } = await supabase
      .from('saved_analyses')
      .delete()
      .eq('id', analysisId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting analysis:', error);
      return false;
    }

    return true;
  },

  /**
   * Sync multiple analyses (used when user logs in to upload local data)
   */
  async syncAnalyses(userId: string, analyses: SavedAnalysis[]): Promise<void> {
    if (!supabase || analyses.length === 0) return;

    // Get existing IDs to avoid duplicates
    const { data: existing } = await supabase
      .from('saved_analyses')
      .select('id')
      .eq('user_id', userId);

    const existingIds = new Set((existing || []).map(e => e.id));

    // Filter out analyses that already exist
    const newAnalyses = analyses.filter(a => !existingIds.has(a.id));

    if (newAnalyses.length === 0) return;

    const { error } = await supabase
      .from('saved_analyses')
      .insert(newAnalyses.map(analysis => ({
        id: analysis.id,
        user_id: userId,
        date: analysis.date,
        source_type: analysis.sourceType,
        input_text: analysis.inputText,
        analysis_result: analysis.analysisResult,
        file_name: analysis.fileName || null,
      })));

    if (error) {
      console.error('Error syncing analyses:', error);
    }
  },

  // ==================== VOCABULARY ====================

  /**
   * Fetch all vocabulary items for the current user
   */
  async fetchVocabulary(userId: string): Promise<SavedVocabularyItem[]> {
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('saved_vocabulary')
      .select('*')
      .eq('user_id', userId)
      .order('date_added', { ascending: false });

    if (error) {
      console.error('Error fetching vocabulary:', error);
      return [];
    }

    return (data || []).map(dbToVocabulary);
  },

  /**
   * Save vocabulary items
   */
  async saveVocabularyItems(userId: string, items: SavedVocabularyItem[]): Promise<void> {
    if (!supabase || items.length === 0) return;

    const { error } = await supabase
      .from('saved_vocabulary')
      .insert(items.map(item => ({
        id: item.id,
        user_id: userId,
        term: item.term,
        definition: item.definition,
        category: item.category,
        source_context: item.source_context || null,
        imagery_etymology: item.imagery_etymology || null,
        examples: item.examples || [],
        nuance: item.nuance || null,
        date_added: item.dateAdded,
      })));

    if (error) {
      console.error('Error saving vocabulary:', error);
    }
  },

  /**
   * Delete a vocabulary item
   */
  async deleteVocabularyItem(userId: string, itemId: string): Promise<boolean> {
    if (!supabase) return false;

    const { error } = await supabase
      .from('saved_vocabulary')
      .delete()
      .eq('id', itemId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting vocabulary:', error);
      return false;
    }

    return true;
  },

  /**
   * Sync vocabulary items (used when user logs in)
   */
  async syncVocabulary(userId: string, items: SavedVocabularyItem[]): Promise<void> {
    if (!supabase || items.length === 0) return;

    // Get existing IDs
    const { data: existing } = await supabase
      .from('saved_vocabulary')
      .select('id')
      .eq('user_id', userId);

    const existingIds = new Set((existing || []).map(e => e.id));

    // Filter out items that already exist
    const newItems = items.filter(item => !existingIds.has(item.id));

    if (newItems.length === 0) return;

    await this.saveVocabularyItems(userId, newItems);
  },

  // ==================== EXPORT ====================

  /**
   * Export all data as JSON and trigger download
   */
  exportToJson(analyses: SavedAnalysis[], vocabulary: SavedVocabularyItem[]): void {
    const exportData = {
      exportDate: new Date().toISOString(),
      appName: 'NativeNuance',
      version: '1.0',
      data: {
        analyses,
        vocabulary,
      },
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `nativenuance-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },
};

