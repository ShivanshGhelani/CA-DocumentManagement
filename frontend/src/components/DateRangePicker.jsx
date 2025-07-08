import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const CalendarDateRangePicker = ({ onRangeSelected, onClose, value, popoverOpen }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedRange, setSelectedRange] = useState({ start: null, end: null });
  const [hoverDate, setHoverDate] = useState(null);

  useEffect(() => {
    console.log('DateRangePicker rendered, popoverOpen:', popoverOpen, 'value:', value);
  }, [popoverOpen, value]);

  useEffect(() => {
    if (popoverOpen && value) {
      const valueStart = value.start ? value.start.getTime() : null;
      const valueEnd = value.end ? value.end.getTime() : null;
      const currentStart = selectedRange.start ? selectedRange.start.getTime() : null;
      const currentEnd = selectedRange.end ? selectedRange.end.getTime() : null;

      if (valueStart !== currentStart || valueEnd !== currentEnd) {
        setSelectedRange(value);
        if (value.start) {
          setCurrentDate(new Date(value.start));
        }
      }
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
    const prevMonth = new Date(year, month, 0); // last day of previous month
    const prevMonthDays = prevMonth.getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const dateNum = prevMonthDays - i;
      days.push({
        date: dateNum,
        isCurrentMonth: false,
        fullDate: new Date(year, month - 1, dateNum)
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
    const clickedDate = new Date(dayObj.fullDate);
    clickedDate.setHours(0, 0, 0, 0);

    if (!selectedRange.start || (selectedRange.start && selectedRange.end)) {
      setSelectedRange({ start: clickedDate, end: null });
    } else if (selectedRange.start && !selectedRange.end) {
      const startDate = new Date(selectedRange.start);
      startDate.setHours(0, 0, 0, 0);

      if (clickedDate.getTime() < startDate.getTime()) {
        setSelectedRange({ start: clickedDate, end: startDate });
      } else if (clickedDate.getTime() > startDate.getTime()) {
        setSelectedRange({ start: startDate, end: clickedDate });
      } else {
        setSelectedRange({ start: clickedDate, end: null });
      }
    }
  };

  useEffect(() => {
    if (selectedRange.start && selectedRange.end && onRangeSelected) {
      onRangeSelected(selectedRange);
    }
  }, [selectedRange, onRangeSelected]);

  const normalizeDate = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };

  const isDateInRange = (date) => {
    if (!selectedRange.start || !selectedRange.end) return false;
    const dateTime = normalizeDate(date);
    const startTime = normalizeDate(selectedRange.start);
    const endTime = normalizeDate(selectedRange.end);
    return dateTime >= startTime && dateTime <= endTime;
  };

  const isDateSelected = (date) => {
    if (!selectedRange.start) return false;
    const dateTime = normalizeDate(date);
    const startTime = normalizeDate(selectedRange.start);

    if (selectedRange.end) {
      const endTime = normalizeDate(selectedRange.end);
      return dateTime === startTime || dateTime === endTime;
    }

    return dateTime === startTime;
  };

  const isDateInHoverRange = (date) => {
    if (!selectedRange.start || selectedRange.end || !hoverDate) return false;
    const startTime = normalizeDate(selectedRange.start);
    const hoverTime = normalizeDate(hoverDate);
    const dateTime = normalizeDate(date);

    const [rangeStart, rangeEnd] = startTime < hoverTime
      ? [startTime, hoverTime]
      : [hoverTime, startTime];

    return dateTime >= rangeStart && dateTime <= rangeEnd;
  };

  const days = getDaysInMonth(currentDate);

  return (
    <div className="w-72 bg-white border border-gray-200 rounded-lg shadow-lg p-2 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => navigateMonth(-1)} className="p-1 hover:bg-gray-100 rounded">
          <ChevronLeft size={18} className="text-gray-600" />
        </button>
        <h2 className="text-base font-medium text-gray-900">
          {months[currentDate.getMonth()]} {currentDate.getFullYear()}
        </h2>
        <button onClick={() => navigateMonth(1)} className="p-1 hover:bg-gray-100 rounded">
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
      <div className="grid grid-cols-7 gap-0.5 mb-3">
        {days.map((dayObj, index) => {
          const isSelected = isDateSelected(dayObj.fullDate);
          const isInRange = isDateInRange(dayObj.fullDate);
          const isInHoverRange = isDateInHoverRange(dayObj.fullDate);
          const isToday = normalizeDate(dayObj.fullDate) === normalizeDate(new Date());

          return (
            <button
              key={index}
              onClick={() => handleDateClick(dayObj)}
              onMouseEnter={() => setHoverDate(dayObj.fullDate)}
              onMouseLeave={() => setHoverDate(null)}
              className={`
                w-8 h-8 text-xs rounded border-0 cursor-pointer transition-all duration-200
                ${!dayObj.isCurrentMonth ? 'text-gray-400 hover:bg-gray-100' : 'text-gray-900 hover:bg-gray-100'}
                ${isSelected ? 'bg-blue-600 text-white hover:bg-blue-700' : ''}
                ${isInRange && !isSelected ? 'bg-blue-100 text-blue-900' : ''}
                ${isInHoverRange && !isSelected ? 'bg-blue-50 text-blue-700' : ''}
                ${isToday && !isSelected ? 'bg-green-100 text-green-600 font-semibold' : ''}
              `}
            >
              {dayObj.date}
            </button>
          );
        })}
      </div>

      {/* Action buttons */}
      <div className="flex justify-between items-center pt-2 border-t border-gray-200">
        <button
          onClick={() => {
            setSelectedRange({ start: null, end: null });
            if (onRangeSelected) onRangeSelected({ start: null, end: null });
          }}
          className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 transition-colors"
        >
          Clear
        </button>
        <button
          onClick={onClose}
          className="px-4 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
};

export default CalendarDateRangePicker;
