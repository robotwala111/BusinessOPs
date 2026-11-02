import { useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/Input";
import type { ChangeEvent, InputHTMLAttributes } from "react";

type AutocompleteInputProps = InputHTMLAttributes<HTMLInputElement> & {
  options: string[];
};

export function AutocompleteInput({
  options,
  onBlur,
  onChange,
  onFocus,
  value,
  ...props
}: AutocompleteInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputValue = String(value ?? "");
  const filteredOptions = useMemo(() => {
    const query = inputValue.trim().toLowerCase();
    const uniqueOptions = Array.from(new Set(options.filter(Boolean)));

    if (!query) {
      return uniqueOptions.slice(0, 8);
    }

    return uniqueOptions
      .filter((option) => option.toLowerCase().includes(query))
      .slice(0, 8);
  }, [inputValue, options]);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onChange?.(event);
    setIsOpen(true);
  }

  function selectOption(option: string) {
    onChange?.({
      target: { value: option },
      currentTarget: { value: option }
    } as ChangeEvent<HTMLInputElement>);
    setIsOpen(false);
  }

  return (
    <div className="autocomplete-field">
      <Input
        {...props}
        value={value}
        autoComplete="off"
        className={`autocomplete-input ${props.className ?? ""}`.trim()}
        onBlur={(event) => {
          blurTimerRef.current = setTimeout(() => setIsOpen(false), 120);
          onBlur?.(event);
        }}
        onChange={handleChange}
        onFocus={(event) => {
          if (blurTimerRef.current) {
            clearTimeout(blurTimerRef.current);
          }
          setIsOpen(true);
          onFocus?.(event);
        }}
      />
      {isOpen && filteredOptions.length > 0 ? (
        <div className="autocomplete-menu" role="listbox">
          {filteredOptions.map((option) => (
            <button
              key={option}
              type="button"
              className="autocomplete-option"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectOption(option)}
              role="option"
              aria-selected={option === value}
            >
              {option}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
