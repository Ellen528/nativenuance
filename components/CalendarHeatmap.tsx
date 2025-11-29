import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Flame, Calendar } from 'lucide-react';
import { dataService } from '../services/dataService';

interface Props {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
}

interface DayData {
  date: string;
  count: number;
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const getIntensityClass = (count: number): string => {
  if (count === 0) return 'bg-slate-100';
  if (count === 1) return 'bg-emerald-200';
  if (count === 2) return 'bg-emerald-300';
  if (count <= 4) return 'bg-emerald-400';
  return 'bg-emerald-500';
};

const CalendarHeatmap: React.FC<Props> = ({ userId, isOpen, onClose }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [visitData, setVisitData] = useState<DayData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [totalVisits, setTotalVisits] = useState(0);
  const [streak, setStreak] = useState(0);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  useEffect(() => {
    if (isOpen && userId) {
      loadVisitData();
    }
  }, [isOpen, userId, year, month]);

  const loadVisitData = async () => {
    setIsLoading(true);
    try {
      const data = await dataService.fetchVisits(userId, year, month);
      setVisitData(data);
      
      // Calculate total visits this month
      const total = data.reduce((sum, day) => sum + day.count, 0);
      setTotalVisits(total);

      // Calculate streak (consecutive days with visits)
      calculateStreak(data);
    } catch (error) {
      console.error('Error loading visit data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateStreak = (data: DayData[]) => {
    const today = new Date();
    const visitDates = new Set(data.map(d => d.date));
    let currentStreak = 0;
    
    // Check from today backwards
    for (let i = 0; i < 365; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      const dateStr = checkDate.toISOString().split('T')[0];
      
      if (visitDates.has(dateStr)) {
        currentStreak++;
      } else if (i > 0) {
        // Skip today if no visit yet
        break;
      }
    }
    
    setStreak(currentStreak);
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  const getDaysInMonth = () => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();

    const days: (number | null)[] = [];
    
    // Add empty cells for days before the first of the month
    for (let i = 0; i < startingDay; i++) {
      days.push(null);
    }
    
    // Add the days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }

    return days;
  };

  const getVisitCount = (day: number): number => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayData = visitData.find(d => d.date === dateStr);
    return dayData?.count || 0;
  };

  const isToday = (day: number): boolean => {
    const today = new Date();
    return day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-blue-600 text-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Activity
            </h2>
            <button 
              onClick={onClose}
              className="text-white/80 hover:text-white text-2xl leading-none"
            >
              ×
            </button>
          </div>
          
          {/* Stats */}
          <div className="flex gap-4">
            <div className="bg-white/20 rounded-lg px-4 py-2 flex-1">
              <div className="text-2xl font-bold">{totalVisits}</div>
              <div className="text-xs text-white/80">visits this month</div>
            </div>
            <div className="bg-white/20 rounded-lg px-4 py-2 flex-1">
              <div className="text-2xl font-bold flex items-center gap-1">
                {streak}
                {streak > 0 && <Flame className="w-5 h-5 text-orange-300" />}
              </div>
              <div className="text-xs text-white/80">day streak</div>
            </div>
          </div>
        </div>

        {/* Calendar */}
        <div className="p-6">
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-4">
            <button 
              onClick={() => navigateMonth('prev')}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-slate-600" />
            </button>
            <h3 className="font-semibold text-slate-800">
              {MONTHS[month]} {year}
            </h3>
            <button 
              onClick={() => navigateMonth('next')}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              disabled={month === new Date().getMonth() && year === new Date().getFullYear()}
            >
              <ChevronRight className={`w-5 h-5 ${
                month === new Date().getMonth() && year === new Date().getFullYear() 
                  ? 'text-slate-300' 
                  : 'text-slate-600'
              }`} />
            </button>
          </div>

          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {DAYS_OF_WEEK.map(day => (
              <div key={day} className="text-center text-xs font-medium text-slate-400 py-1">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          {isLoading ? (
            <div className="h-48 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {getDaysInMonth().map((day, idx) => {
                if (day === null) {
                  return <div key={`empty-${idx}`} className="aspect-square"></div>;
                }
                
                const visitCount = getVisitCount(day);
                const todayClass = isToday(day) ? 'ring-2 ring-emerald-500 ring-offset-1' : '';
                
                return (
                  <div
                    key={day}
                    className={`aspect-square rounded-md flex items-center justify-center text-xs font-medium transition-all cursor-default ${getIntensityClass(visitCount)} ${todayClass}`}
                    title={`${day}: ${visitCount} visit${visitCount !== 1 ? 's' : ''}`}
                  >
                    <span className={visitCount > 0 ? 'text-white' : 'text-slate-500'}>
                      {day}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Legend */}
          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500">
            <span>Less</span>
            <div className="flex gap-1">
              <div className="w-4 h-4 rounded bg-slate-100"></div>
              <div className="w-4 h-4 rounded bg-emerald-200"></div>
              <div className="w-4 h-4 rounded bg-emerald-300"></div>
              <div className="w-4 h-4 rounded bg-emerald-400"></div>
              <div className="w-4 h-4 rounded bg-emerald-500"></div>
            </div>
            <span>More</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarHeatmap;

