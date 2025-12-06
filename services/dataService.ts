import { supabase } from './supabaseClient';
import { SavedAnalysis, SavedVocabularyItem, SourceType, Note, AnalysisFolder } from '../types';

// Database row types (matching Supabase schema)
interface DbSavedAnalysis {
  id: string;
  user_id: string;
  date: number;
  source_type: string;
  input_text: string;
  analysis_result: object;
  file_name: string | null;
  notes: object | null;
  folder_id: string | null;
  created_at: string;
}

interface DbUserVisit {
  id: string;
  user_id: string;
  visited_at: string;
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

interface DbAnalysisFolder {
  id: string;
  user_id: string;
  name: string;
  color: string | null;
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
  notes: (row.notes as Note[]) || [],
  folderId: row.folder_id || null,
});

const dbToFolder = (row: DbAnalysisFolder): AnalysisFolder => ({
  id: row.id,
  name: row.name,
  createdAt: new Date(row.created_at).getTime(),
  color: row.color || undefined,
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
   * Save a new analysis or update existing one
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
        notes: analysis.notes || [],
        folder_id: analysis.folderId || null,
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
   * Update an existing analysis
   */
  async updateAnalysis(userId: string, analysis: SavedAnalysis): Promise<SavedAnalysis | null> {
    if (!supabase) {
      console.warn('Supabase not configured, skipping cloud update');
      return null;
    }

    console.log('Updating analysis in Supabase...', { userId, analysisId: analysis.id });

    const { data, error } = await supabase
      .from('saved_analyses')
      .update({
        date: analysis.date,
        source_type: analysis.sourceType,
        input_text: analysis.inputText,
        analysis_result: analysis.analysisResult,
        file_name: analysis.fileName || null,
        notes: analysis.notes || [],
        folder_id: analysis.folderId || null,
      })
      .eq('id', analysis.id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating analysis in Supabase:', error);
      return null;
    }

    console.log('Analysis updated successfully in Supabase!', data);
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
        folder_id: analysis.folderId || null,
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

  // ==================== FOLDERS ====================

  /**
   * Fetch all folders for the current user
   */
  async fetchFolders(userId: string): Promise<AnalysisFolder[]> {
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('analysis_folders')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching folders:', error);
      return [];
    }

    return (data || []).map(dbToFolder);
  },

  /**
   * Create a new folder
   */
  async createFolder(userId: string, folder: AnalysisFolder): Promise<AnalysisFolder | null> {
    if (!supabase) {
      console.warn('Supabase not configured, skipping cloud save');
      return null;
    }

    const { data, error } = await supabase
      .from('analysis_folders')
      .insert({
        id: folder.id,
        user_id: userId,
        name: folder.name,
        color: folder.color || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating folder:', error);
      return null;
    }

    return dbToFolder(data);
  },

  /**
   * Update a folder
   */
  async updateFolder(userId: string, folder: AnalysisFolder): Promise<AnalysisFolder | null> {
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('analysis_folders')
      .update({
        name: folder.name,
        color: folder.color || null,
      })
      .eq('id', folder.id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating folder:', error);
      return null;
    }

    return dbToFolder(data);
  },

  /**
   * Delete a folder
   */
  async deleteFolder(userId: string, folderId: string): Promise<boolean> {
    if (!supabase) return false;

    const { error } = await supabase
      .from('analysis_folders')
      .delete()
      .eq('id', folderId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting folder:', error);
      return false;
    }

    return true;
  },

  /**
   * Update analysis folder assignment
   */
  async updateAnalysisFolder(userId: string, analysisId: string, folderId: string | null): Promise<boolean> {
    if (!supabase) return false;

    const { error } = await supabase
      .from('saved_analyses')
      .update({ folder_id: folderId })
      .eq('id', analysisId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error updating analysis folder:', error);
      return false;
    }

    return true;
  },

  /**
   * Sync folders (used when user logs in)
   */
  async syncFolders(userId: string, folders: AnalysisFolder[]): Promise<void> {
    if (!supabase || folders.length === 0) return;

    const { data: existing } = await supabase
      .from('analysis_folders')
      .select('id')
      .eq('user_id', userId);

    const existingIds = new Set((existing || []).map(e => e.id));
    const newFolders = folders.filter(f => !existingIds.has(f.id));

    if (newFolders.length === 0) return;

    const { error } = await supabase
      .from('analysis_folders')
      .insert(newFolders.map(folder => ({
        id: folder.id,
        user_id: userId,
        name: folder.name,
        color: folder.color || null,
      })));

    if (error) {
      console.error('Error syncing folders:', error);
    }
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

  // ==================== USER VISITS ====================

  /**
   * Record a user visit
   */
  async recordVisit(userId: string): Promise<void> {
    if (!supabase) return;

    const { error } = await supabase
      .from('user_visits')
      .insert({
        id: crypto.randomUUID(),
        user_id: userId,
        visited_at: new Date().toISOString(),
      });

    if (error) {
      console.error('Error recording visit:', error);
    }
  },

  /**
   * Fetch user visits for a given month
   */
  async fetchVisits(userId: string, year: number, month: number): Promise<{ date: string; count: number }[]> {
    if (!supabase) return [];

    // Get start and end of the month
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);

    const { data, error } = await supabase
      .from('user_visits')
      .select('visited_at')
      .eq('user_id', userId)
      .gte('visited_at', startDate.toISOString())
      .lte('visited_at', endDate.toISOString());

    if (error) {
      console.error('Error fetching visits:', error);
      return [];
    }

    // Aggregate visits by date
    const visitCounts: Record<string, number> = {};
    (data || []).forEach((row: { visited_at: string }) => {
      const date = row.visited_at.split('T')[0]; // YYYY-MM-DD
      visitCounts[date] = (visitCounts[date] || 0) + 1;
    });

    return Object.entries(visitCounts).map(([date, count]) => ({ date, count }));
  },
};

