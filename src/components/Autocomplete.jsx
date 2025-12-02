import { useState, useEffect, useRef } from 'react';
import './Autocomplete.css';

/**
 * Autocomplete component with search and create-on-enter functionality
 *
 * @param {Object} props
 * @param {string} props.value - Current input value
 * @param {Function} props.onChange - Called when value changes
 * @param {Function} props.onSelect - Called when item selected (existing or newly created)
 * @param {Function} props.fetchOptions - Async function to fetch options from database
 * @param {string} props.placeholder - Input placeholder
 * @param {boolean} props.disabled - Whether input is disabled
 * @param {Function} props.onCreate - Async function to create new item, returns created item
 * @param {Function} props.renderOption - Optional function to render custom option display
 * @param {Function} props.getOptionLabel - Function to get label from option object
 * @param {Function} props.getOptionValue - Function to get value from option object
 * @param {number} props.minSearchLength - Minimum characters before searching (default: 0)
 * @param {number} props.debounceDelay - Debounce delay in ms (default: 100, use lower for offline/cache-first)
 */
export default function Autocomplete({
  value,
  onChange,
  onSelect,
  fetchOptions,
  placeholder = 'Type to search...',
  disabled = false,
  onCreate,
  renderOption,
  getOptionLabel = (opt) => opt?.name || opt,
  getOptionValue = (opt) => opt?.id || opt,
  minSearchLength = 0,
  debounceDelay = 100,
}) {
  const [inputValue, setInputValue] = useState(value || '');
  const [options, setOptions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [canCreate, setCanCreate] = useState(false);

  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  // Sync external value changes
  useEffect(() => {
    if (value !== inputValue) {
      setInputValue(value || '');
    }
  }, [value]);

  // Fetch options when input changes
  useEffect(() => {
    async function search() {
      const trimmedValue = inputValue.trim();

      // If minSearchLength is 0, always search (even on empty)
      if (minSearchLength > 0 && trimmedValue.length < minSearchLength) {
        setOptions([]);
        setCanCreate(false);
        return;
      }

      setIsLoading(true);
      try {
        const results = await fetchOptions(trimmedValue);
        setOptions(results || []);

        // Check if exact match exists
        const exactMatch = results.some(opt =>
          getOptionLabel(opt).toLowerCase() === trimmedValue.toLowerCase()
        );

        // Only allow create if there's actual text and no exact match
        setCanCreate(!exactMatch && trimmedValue.length > 0 && onCreate);
      } catch (err) {
        console.error('Error fetching options:', err);
        setOptions([]);
        // Still allow create on error, but only if there's text
        setCanCreate(trimmedValue.length > 0 && onCreate);
      } finally {
        setIsLoading(false);
      }
    }

    const debounce = setTimeout(search, debounceDelay);
    return () => clearTimeout(debounce);
  }, [inputValue, fetchOptions, minSearchLength, debounceDelay]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle input change
  function handleInputChange(e) {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange?.(newValue);
    setIsOpen(true);
    setHighlightedIndex(-1);
  }

  // Handle option selection
  function handleSelectOption(option) {
    const label = getOptionLabel(option);
    setInputValue(label);
    onChange?.(label);
    onSelect?.(option);
    setIsOpen(false);
    setHighlightedIndex(-1);
  }

  // Handle create new item
  async function handleCreateNew() {
    if (!canCreate || !onCreate) return;

    const trimmedValue = inputValue.trim();

    // Don't create if input is empty
    if (!trimmedValue) {
      return;
    }

    try {
      setIsLoading(true);
      const newItem = await onCreate(trimmedValue);

      if (newItem) {
        handleSelectOption(newItem);
      }
    } catch (err) {
      console.error('Error creating item:', err);
      alert('Failed to create: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  }

  // Handle keyboard navigation
  function handleKeyDown(e) {
    if (!isOpen && e.key !== 'Enter') {
      setIsOpen(true);
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => {
          const maxIndex = options.length + (canCreate ? 0 : -1);
          return prev < maxIndex ? prev + 1 : prev;
        });
        break;

      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : 0));
        break;

      case 'Enter':
        e.preventDefault();

        if (highlightedIndex >= 0 && highlightedIndex < options.length) {
          // Select highlighted option
          handleSelectOption(options[highlightedIndex]);
        } else if (canCreate && (highlightedIndex === options.length || highlightedIndex === -1)) {
          // Create new item
          handleCreateNew();
        }
        break;

      case 'Escape':
        setIsOpen(false);
        setHighlightedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  }

  // Handle input focus
  function handleFocus() {
    if (inputValue.trim().length >= minSearchLength) {
      setIsOpen(true);
    }
  }

  const showDropdown = isOpen && (options.length > 0 || canCreate || isLoading);

  return (
    <div className="autocomplete-wrapper" ref={wrapperRef}>
      <input
        ref={inputRef}
        type="text"
        className="autocomplete-input"
        value={inputValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
      />

      {showDropdown && (
        <div className="autocomplete-dropdown">
          {isLoading && (
            <div className="autocomplete-loading">Searching...</div>
          )}

          {!isLoading && options.length === 0 && !canCreate && (
            <div className="autocomplete-empty">No results found</div>
          )}

          {!isLoading && options.map((option, index) => {
            const label = getOptionLabel(option);
            const isHighlighted = index === highlightedIndex;

            return (
              <div
                key={getOptionValue(option)}
                className={`autocomplete-option ${isHighlighted ? 'highlighted' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault(); // Prevent input blur
                  handleSelectOption(option);
                }}
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                {renderOption ? renderOption(option) : label}
              </div>
            );
          })}

          {!isLoading && canCreate && (
            <div
              className={`autocomplete-option autocomplete-create ${
                highlightedIndex === options.length ? 'highlighted' : ''
              }`}
              onMouseDown={(e) => {
                e.preventDefault();
                handleCreateNew();
              }}
              onMouseEnter={() => setHighlightedIndex(options.length)}
            >
              <strong>Create new:</strong> "{inputValue.trim()}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}
