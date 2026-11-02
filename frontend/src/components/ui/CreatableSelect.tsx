"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type CreatableSelectProps = {
  value: string;
  options: string[];
  placeholder?: string;
  addLabel?: string;
  createButtonLabel?: string;
  onChange: (value: string) => void;
  onCreate?: (value: string) => Promise<void> | void;
};

export function CreatableSelect({
  value,
  options,
  placeholder = "Search or select",
  addLabel = "Add option",
  createButtonLabel = "Add new",
  onChange,
  onCreate
}: CreatableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newValue, setNewValue] = useState("");

  const normalizedOptions = useMemo(
    () => Array.from(new Set(options.filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [options]
  );

  const visibleOptions = normalizedOptions.filter((option) =>
    option.toLowerCase().includes(value.trim().toLowerCase())
  );
  const exactMatch = normalizedOptions.some(
    (option) => option.toLowerCase() === value.trim().toLowerCase()
  );
  const canAdd = Boolean(value.trim()) && !exactMatch && onCreate;

  async function createOption() {
    const optionToCreate = (isCreating ? newValue : value).trim();

    if (!optionToCreate || isAdding || !onCreate) {
      return;
    }

    setIsAdding(true);
    try {
      await onCreate(optionToCreate);
      onChange(optionToCreate);
      setNewValue("");
      setIsCreating(false);
      setIsOpen(false);
    } finally {
      setIsAdding(false);
    }
  }

  return (
    <div className="creatable-select">
      <Input
        value={value}
        placeholder={placeholder}
        onChange={(event) => {
          onChange(event.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => window.setTimeout(() => setIsOpen(false), 120)}
      />
      {isOpen ? (
        <div className="creatable-menu">
          {visibleOptions.length > 0 ? (
            visibleOptions.slice(0, 8).map((option) => (
              <button
                key={option}
                type="button"
                className="creatable-option"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(option);
                  setIsOpen(false);
                }}
              >
                {option}
              </button>
            ))
          ) : (
            <div className="creatable-empty">No matching project type</div>
          )}
          {canAdd ? (
            <Button type="button" variant="secondary" className="creatable-add" disabled={isAdding} onMouseDown={(event) => event.preventDefault()} onClick={createOption}>
              {isAdding ? "Adding..." : `${addLabel}: ${value.trim()}`}
            </Button>
          ) : null}
        </div>
      ) : null}
      {onCreate ? (
        <div className="creatable-manage">
          {isCreating ? (
            <div className="creatable-create-row">
              <Input
                value={newValue}
                placeholder="Enter new option"
                onChange={(event) => setNewValue(event.target.value)}
              />
              <Button type="button" variant="secondary" disabled={isAdding || !newValue.trim()} onClick={createOption}>
                {isAdding ? "Adding..." : "Add"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setNewValue("");
                  setIsCreating(false);
                }}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button type="button" variant="ghost" className="creatable-trigger" onClick={() => setIsCreating(true)}>
              + {createButtonLabel}
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
