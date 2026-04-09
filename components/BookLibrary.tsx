import React, { useState, useEffect } from 'react';
import { SavedBook } from '../types';
import { dataService } from '../services/dataService';
import { Book, Clock, Trash2, BookOpen, Loader2, Plus, ChevronRight } from 'lucide-react';

interface BookLibraryProps {
  userId: string;
  onSelectBook: (book: SavedBook) => void;
  onUploadNew: () => void;
}

const BookLibrary: React.FC<BookLibraryProps> = ({ userId, onSelectBook, onUploadNew }) => {
  const [books, setBooks] = useState<SavedBook[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadBooks();
  }, [userId]);

  const loadBooks = async () => {
    setIsLoading(true);
    try {
      const fetchedBooks = await dataService.fetchBooks(userId);
      setBooks(fetchedBooks);
    } catch (error) {
      console.error('Error loading books:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteBook = async (e: React.MouseEvent, bookId: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this book?')) return;

    setDeletingId(bookId);
    try {
      await dataService.deleteBook(userId, bookId);
      setBooks(books.filter(b => b.id !== bookId));
    } catch (error) {
      console.error('Error deleting book:', error);
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return 'Never opened';
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const getProgressPercentage = (book: SavedBook): number => {
    if (!book.progress || book.progress.length === 0) return 0;
    
    // Count total chapters (flattening nested structure)
    const countChapters = (chapters: typeof book.structure): number => {
      let count = 0;
      for (const chapter of chapters) {
        count++;
        if (chapter.children) {
          count += countChapters(chapter.children);
        }
      }
      return count;
    };
    
    const totalChapters = countChapters(book.structure);
    const studiedChapters = book.progress.filter(p => p.isStudied).length;
    
    return totalChapters > 0 ? Math.round((studiedChapters / totalChapters) * 100) : 0;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">My Book Library</h2>
          <p className="text-slate-500 mt-1">
            {books.length} {books.length === 1 ? 'book' : 'books'} in your library
          </p>
        </div>
        <button
          onClick={onUploadNew}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add New Book
        </button>
      </div>

      {books.length === 0 ? (
        <div className="text-center py-16 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
          <Book className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-600 mb-2">No books yet</h3>
          <p className="text-slate-400 mb-6">Upload a PDF book to start learning</p>
          <button
            onClick={onUploadNew}
            className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Upload Your First Book
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {books.map((book) => {
            const progress = getProgressPercentage(book);
            
            return (
              <div
                key={book.id}
                onClick={() => onSelectBook(book)}
                className="group bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg hover:border-emerald-300 transition-all cursor-pointer"
              >
                {/* Book Cover Placeholder */}
                <div className="h-24 bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center relative">
                  <BookOpen className="w-10 h-10 text-white/30" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                  
                  {/* Delete button */}
                  <button
                    onClick={(e) => handleDeleteBook(e, book.id)}
                    disabled={deletingId === book.id}
                    className="absolute top-2 right-2 p-2 bg-white/90 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50"
                  >
                    {deletingId === book.id ? (
                      <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4 text-red-500" />
                    )}
                  </button>
                </div>

                {/* Book Info */}
                <div className="p-4">
                  <h3 className="font-semibold text-slate-800 line-clamp-2 mb-1 group-hover:text-emerald-600 transition-colors">
                    {book.title}
                  </h3>
                  {book.author && (
                    <p className="text-sm text-slate-500 mb-2">{book.author}</p>
                  )}
                  
                  <div className="flex items-center gap-2 text-xs text-slate-400 mb-3">
                    <Clock className="w-3 h-3" />
                    <span>{formatDate(book.lastOpenedAt)}</span>
                    <span className="text-slate-300">•</span>
                    <span>{book.pageCount} pages</span>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-2">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-500">Progress</span>
                      <span className="font-medium text-emerald-600">{progress}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-emerald-500 rounded-full transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Continue Reading Button */}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                    <span className="text-sm text-emerald-600 font-medium group-hover:underline">
                      {progress > 0 ? 'Continue Reading' : 'Start Reading'}
                    </span>
                    <ChevronRight className="w-4 h-4 text-emerald-600 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default BookLibrary;
