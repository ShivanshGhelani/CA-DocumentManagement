import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const CalendarDateRangePicker = ({ onRangeSelected, onClose, value, popoverOpen }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedRange, setSelectedRange] = useState({ start: null, end: null });
  const [hoverDate, setHoverDate] = useState(null);

  // Debug: log when picker is rendered
  useEffect(() => {
    console.log('DateRangePicker rendered, popoverOpen:', popoverOpen, 'value:', value);
  }, [popoverOpen, value]);

  // Sync selectedRange with value prop and popover open state
  useEffect(() => {
    if (popoverOpen && value && (
      !selectedRange.start ||
      !selectedRange.end ||
      value.start?.getTime() !== selectedRange.start?.getTime() ||
      value.end?.getTime() !== selectedRange.end?.getTime()
    )) {
      setSelectedRange(value);
      if (value.start) setCurrentDate(new Date(value.start));
      console.log('DateRangePicker useEffect: syncing selectedRange with value');
    }
  }, [value, popoverOpen]);

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const daysOfWeek = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const navigateMonth = (direction) => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + direction);
      return newDate;
    });
  };

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];

    // Previous month's days
    const prevMonth = new Date(year, month - 1, 0);
    const prevMonthDays = prevMonth.getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      days.push({
        date: prevMonthDays - i,
        isCurrentMonth: false,
        fullDate: new Date(year, month - 1, prevMonthDays - i)
      });
    }

    // Current month's days
    for (let day = 1; day <= daysInMonth; day++) {
      days.push({
        date: day,
        isCurrentMonth: true,
        fullDate: new Date(year, month, day)
      });
    }

    // Next month's days
    const remainingDays = 42 - days.length; // 6 rows * 7 days
    for (let day = 1; day <= remainingDays; day++) {
      days.push({
        date: day,
        isCurrentMonth: false,
        fullDate: new Date(year, month + 1, day)
      });
    }

    return days;
  };

  const handleDateClick = (dayObj) => {
    const clickedDate = dayObj.fullDate;
    if (!selectedRange.start || (selectedRange.start && selectedRange.end)) {
      setSelectedRange({ start: clickedDate, end: null });
    } else if (selectedRange.start && !selectedRange.end) {
      if (clickedDate < selectedRange.start) {
        setSelectedRange({ start: clickedDate, end: selectedRange.start });
      } else {
        setSelectedRange({ start: selectedRange.start, end: clickedDate });
      }
    }
  };

  // When both dates are selected, call onRangeSelected (but do not close automatically)
  useEffect(() => {
    if (selectedRange.start && selectedRange.end) {
      if (onRangeSelected) onRangeSelected(selectedRange);
      // Do not call onClose() here; let parent control closing
    }
  }, [selectedRange, onRangeSelected]);

  const isDateInRange = (date) => {
    if (!selectedRange.start || !selectedRange.end) return false;
    return date >= selectedRange.start && date <= selectedRange.end;
  };

  const isDateSelected = (date) => {
    if (!selectedRange.start) return false;
    if (selectedRange.start && selectedRange.end) {
      return date.getTime() === selectedRange.start.getTime() || 
             date.getTime() === selectedRange.end.getTime();
    }
    return date.getTime() === selectedRange.start.getTime();
  };

  const isDateInHoverRange = (date) => {
    if (!selectedRange.start || selectedRange.end || !hoverDate) return false;
    const start = selectedRange.start < hoverDate ? selectedRange.start : hoverDate;
    const end = selectedRange.start < hoverDate ? hoverDate : selectedRange.start;
    return date >= start && date <= end;
  };

  const days = getDaysInMonth(currentDate);

  return (
    <div className="w-64 bg-white border border-gray-200 rounded-lg shadow-lg p-2 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => navigateMonth(-1)}
          className="p-1 hover:bg-gray-100 rounded"
        >
          <ChevronLeft size={18} className="text-gray-600" />
        </button>
        <h2 className="text-base font-medium text-gray-900">
          {months[currentDate.getMonth()]} {currentDate.getFullYear()}
        </h2>
        <button
          onClick={() => navigateMonth(1)}
          className="p-1 hover:bg-gray-100 rounded"
        >
          <ChevronRight size={18} className="text-gray-600" />
        </button>
      </div>

      {/* Days of week header */}
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {daysOfWeek.map(day => (
          <div key={day} className="text-center text-xs font-medium text-gray-500 py-1">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((dayObj, index) => {
          const isSelected = isDateSelected(dayObj.fullDate);
          const isInRange = isDateInRange(dayObj.fullDate);
          const isInHoverRange = isDateInHoverRange(dayObj.fullDate);
          const isToday = dayObj.fullDate.toDateString() === new Date().toDateString();

          return (
            <button
              key={index}
              onClick={() => handleDateClick(dayObj)}
              onMouseEnter={() => setHoverDate(dayObj.fullDate)}
              onMouseLeave={() => setHoverDate(null)}
              className={`
                w-8 h-8 text-xs rounded border-0 cursor-pointer transition-all duration-200
                ${!dayObj.isCurrentMonth 
                  ? 'text-gray-400 hover:bg-gray-100' 
                  : 'text-gray-900 hover:bg-gray-100'
                }
                ${isSelected 
                  ? 'bg-blue-600 text-white hover:bg-blue-700' 
                  : ''
                }
                ${isInRange && !isSelected 
                  ? 'bg-blue-100 text-blue-900' 
                  : ''
                }
                ${isInHoverRange && !isSelected 
                  ? 'bg-blue-50 text-blue-700' 
                  : ''
                }
                ${isToday && !isSelected 
                  ? 'bg-blue-50 text-blue-600 font-semibold' 
                  : ''
                }
              `}
            >
              {dayObj.date}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CalendarDateRangePicker;