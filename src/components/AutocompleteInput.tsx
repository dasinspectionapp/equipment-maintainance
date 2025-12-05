import { useState, useEffect, useRef, useCallback } from 'react';
import { API_BASE } from '../utils/api';

interface AutocompleteInputProps {
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  className?: string;
  fieldName: string; // The field name to fetch autocomplete for
  delay?: number; // Debounce delay in ms
  onSuggestionSelected?: (value: string) => void; // Callback when suggestion is selected
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void; // Blur handler
}

export default function AutocompleteInput({
  name,
  value,
  onChange,
  placeholder,
  className = '',
  fieldName,
  delay = 300,
  onSuggestionSelected,
  onBlur
}: AutocompleteInputProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch autocomplete suggestions
  const fetchSuggestions = useCallback(async () => {
    if (!fieldName) return;

    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setSuggestions([]);
        setIsLoading(false);
        return;
      }

      // Ensure fieldName is clean - remove any unwanted suffixes
      const cleanFieldName = String(fieldName).split(':')[0].trim();
      const url = `${API_BASE}/api/inspection/autocomplete?field=${encodeURIComponent(cleanFieldName)}`;
      console.log('Fetching autocomplete from:', url, 'original fieldName:', fieldName, 'cleaned:', cleanFieldName);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Autocomplete API error:', response.status, errorData);
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      const data = await response.json();
      console.log('Autocomplete response received:', { success: data.success, count: data.count });

      if (data.success && data.values && Array.isArray(data.values)) {
        // Store all fetched values
        setSuggestions(data.values);
        
        // Show suggestions after they're loaded - will be kept visible by handleInputChange
        // Don't toggle here, let the input handler maintain visibility
      } else {
        console.warn('Autocomplete API response:', data);
        setSuggestions([]);
        setShowSuggestions(false);
      }
    } catch (error) {
      console.error('Error fetching autocomplete:', error);
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setIsLoading(false);
    }
  }, [fieldName]); // Remove value from deps to prevent function recreation on every keystroke

  // Fetch suggestions only when user starts typing (debounced)
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Only fetch suggestions if user has typed something
    if (value && value.trim().length > 0) {
      debounceRef.current = setTimeout(() => {
        // Fetch all available suggestions, then filter client-side
        fetchSuggestions();
      }, delay);
    } else {
      // Clear suggestions when input is empty
      setSuggestions([]);
      setShowSuggestions(false);
      setSelectedIndex(-1);
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [value, fetchSuggestions, delay]);

  // Effect to show dropdown when suggestions are first loaded
  // Only trigger when suggestions count changes, not on every value change
  useEffect(() => {
    // Show dropdown when suggestions are first loaded and user is typing
    if (suggestions.length > 0 && value && value.trim().length > 0) {
      setShowSuggestions(true);
    }
  }, [suggestions.length]); // Only when suggestions are loaded/unloaded

  // Handle input change - keep dropdown stable while typing
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e);
    setSelectedIndex(-1); // Reset selection when typing
    
    const newValue = e.target.value;
    
    // Maintain dropdown visibility: if suggestions exist and user is typing, keep it visible
    if (newValue.trim().length > 0) {
      // If suggestions are loaded, ensure dropdown stays visible
      if (suggestions.length > 0) {
        setShowSuggestions(true);
      }
      // If suggestions aren't loaded yet, they'll appear when fetchSuggestions completes
    } else {
      // Only hide when input is completely cleared
      setShowSuggestions(false);
    }
  };

  // Handle input focus - don't fetch/show suggestions on focus
  const handleFocus = () => {
    // Only show if we have suggestions and user has typed something
    if (value && value.trim().length > 0 && suggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

  // Handle input blur
  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    // Delay to allow click on suggestion
    setTimeout(() => {
      if (!suggestionsRef.current?.contains(document.activeElement)) {
        setShowSuggestions(false);
        setSelectedIndex(-1);
        // Call the parent onBlur handler if provided
        if (onBlur) {
          onBlur(e);
        }
      }
    }, 200);
  };

  // Handle suggestion selection
  const handleSelectSuggestion = (suggestion: string) => {
    const syntheticEvent = {
      target: {
        name,
        value: suggestion
      }
    } as React.ChangeEvent<HTMLInputElement>;
    
    onChange(syntheticEvent);
    setShowSuggestions(false);
    setSelectedIndex(-1);
    inputRef.current?.blur();
    
    // Call callback if provided
    if (onSuggestionSelected) {
      onSuggestionSelected(suggestion);
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Get filtered suggestions for navigation
    const filteredSuggestions = value.trim()
      ? suggestions.filter((s: string) => s.toLowerCase().includes(value.toLowerCase()))
      : suggestions;

    if (!showSuggestions || filteredSuggestions.length === 0) {
      if (e.key === 'ArrowDown' && filteredSuggestions.length > 0) {
        setShowSuggestions(true);
        setSelectedIndex(0);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < filteredSuggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < filteredSuggestions.length) {
          handleSelectSuggestion(filteredSuggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  return (
    <div className="relative w-full">
      <input
        ref={inputRef}
        type="text"
        name={name}
        value={value}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onBlur={(e) => handleBlur(e as React.FocusEvent<HTMLInputElement>)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      
      {/* Suggestions dropdown */}
      {showSuggestions && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto"
          onMouseDown={(e) => e.preventDefault()} // Prevent blur on click
        >
          {isLoading ? (
            <div className="px-4 py-2 text-sm text-gray-500">Loading...</div>
          ) : suggestions.length > 0 ? (
            (() => {
              // Filter suggestions based on current value
              const filteredSuggestions = value.trim()
                ? suggestions.filter((suggestion: string) =>
                    suggestion.toLowerCase().includes(value.toLowerCase())
                  )
                : suggestions;

              return filteredSuggestions.length > 0 ? (
                filteredSuggestions.map((suggestion, index) => (
                  <div
                    key={`${suggestion}-${index}`}
                    onClick={() => handleSelectSuggestion(suggestion)}
                    className={`px-4 py-2 text-sm cursor-pointer hover:bg-blue-50 ${
                      index === selectedIndex ? 'bg-blue-100' : ''
                    } ${index === 0 ? 'rounded-t-md' : ''} ${
                      index === filteredSuggestions.length - 1 ? 'rounded-b-md' : ''
                    }`}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    {suggestion}
                  </div>
                ))
              ) : (
                <div className="px-4 py-2 text-sm text-gray-500">No matches found</div>
              );
            })()
          ) : (
            <div className="px-4 py-2 text-sm text-gray-500">No suggestions available</div>
          )}
        </div>
      )}
    </div>
  );
}

