import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp, Check } from 'lucide-react';

const Dropdown = ({
  options = [],
  value = null,
  onChange = () => {},
  placeholder = "Select an option",
  disabled = false,
  clearable = false,
  searchable = false,
  multiple = false,
  className = "",
  maxHeight = "200px",
  error = null,
  label = null,
  required = false,
  size = "medium", // small, medium, large
  variant = "default", // default, bordered, filled
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen, searchable]);

  // Filter options based on search term
  const filteredOptions = searchable && searchTerm
    ? options.filter(option =>
        option.label?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        option.value?.toString().toLowerCase().includes(searchTerm.toLowerCase())
      )
    : options;

  const handleOptionClick = (option) => {
    if (multiple) {
      const currentValues = Array.isArray(value) ? value : [];
      const isSelected = currentValues.some(v => v.value === option.value);
      
      if (isSelected) {
        // Remove from selection
        const newValues = currentValues.filter(v => v.value !== option.value);
        onChange(newValues);
      } else {
        // Add to selection
        onChange([...currentValues, option]);
      }
    } else {
      onChange(option);
      setIsOpen(false);
      setSearchTerm('');
    }
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange(multiple ? [] : null);
  };

  const isSelected = (option) => {
    if (multiple) {
      const currentValues = Array.isArray(value) ? value : [];
      return currentValues.some(v => v.value === option.value);
    }
    return value?.value === option.value;
  };

  const getDisplayValue = () => {
    if (multiple) {
      const values = Array.isArray(value) ? value : [];
      if (values.length === 0) return placeholder;
      if (values.length === 1) return values[0].label;
      return `${values.length} items selected`;
    }
    return value?.label || placeholder;
  };

  // Size classes
  const sizeClasses = {
    small: "px-2 py-1 text-sm min-h-[32px]",
    medium: "px-3 py-2 text-sm min-h-[40px]",
    large: "px-4 py-3 text-base min-h-[48px]"
  };

  // Variant classes
  const variantClasses = {
    default: "border border-gray-300 bg-white",
    bordered: "border-2 border-gray-300 bg-white",
    filled: "border border-gray-300 bg-gray-50"
  };

  const baseClasses = `
    relative w-full rounded-lg cursor-pointer transition-all duration-200
    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
    ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-100' : 'hover:border-gray-400'}
    ${error ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''}
    ${sizeClasses[size]}
    ${variantClasses[variant]}
    ${className}
  `;

  return (
    <div ref={dropdownRef} className="relative w-full">
      {/* Label */}
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      {/* Main dropdown button */}
      <div
        className={baseClasses}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <div className="flex items-center justify-between">
          <span className={`block truncate ${!value || (multiple && (!value || value.length === 0)) ? 'text-gray-500' : 'text-gray-900'}`}>
            {getDisplayValue()}
          </span>
          
          <div className="flex items-center space-x-1">
            {/* Clear button */}
            {clearable && value && (multiple ? value.length > 0 : true) && !disabled && (
              <button
                type="button"
                onClick={handleClear}
                className="p-1 hover:bg-gray-200 rounded-full transition-colors"
              >
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            
            {/* Dropdown arrow */}
            <div className="p-1">
              {isOpen ? (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Dropdown menu */}
      {isOpen && !disabled && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg">
          {/* Search input */}
          {searchable && (
            <div className="p-2 border-b border-gray-200">
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search options..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}

          {/* Options list */}
          <div className="max-h-60 overflow-auto py-1" style={{ maxHeight }}>
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500">
                {searchTerm ? 'No options found' : 'No options available'}
              </div>
            ) : (
              filteredOptions.map((option, index) => (
                <div
                  key={option.value || index}
                  className={`
                    relative cursor-pointer select-none px-3 py-2 text-sm transition-colors
                    ${isSelected(option) 
                      ? 'bg-blue-50 text-blue-900' 
                      : 'text-gray-900 hover:bg-gray-50'
                    }
                    ${option.disabled ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                  onClick={() => !option.disabled && handleOptionClick(option)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      {/* Option icon (if provided) */}
                      {option.icon && (
                        <span className="mr-2 flex-shrink-0">
                          {option.icon}
                        </span>
                      )}
                      
                      <div>
                        <div className="font-medium">{option.label}</div>
                        {option.description && (
                          <div className="text-xs text-gray-500">{option.description}</div>
                        )}
                      </div>
                    </div>
                    
                    {/* Check mark for selected items */}
                    {isSelected(option) && (
                      <Check className="w-4 h-4 text-blue-600" />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
};

export default Dropdown;
