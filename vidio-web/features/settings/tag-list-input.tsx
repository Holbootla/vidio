"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils/cn";

interface TagListInputProps {
  id: string;
  label: string;
  description?: string;
  values: string[];
  placeholder?: string;
  disabled?: boolean;
  onChange: (values: string[]) => void;
}

export function TagListInput({
  id,
  label,
  description,
  values,
  placeholder,
  disabled,
  onChange,
}: TagListInputProps) {
  const [draft, setDraft] = useState("");
  const listId = `${id}-list`;

  const handleAdd = () => {
    const next = draft.trim();
    if (!next || values.includes(next)) {
      return;
    }
    onChange([...values, next]);
    setDraft("");
  };

  const handleRemove = (value: string) => {
    onChange(values.filter((item) => item !== value));
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleAdd();
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      <div className="flex gap-2">
        <Input
          id={id}
          value={draft}
          disabled={disabled}
          placeholder={placeholder}
          aria-describedby={values.length > 0 ? listId : undefined}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        <Button
          type="button"
          variant="secondary"
          disabled={disabled || !draft.trim()}
          onClick={handleAdd}
        >
          Add
        </Button>
      </div>
      {values.length > 0 ? (
        <ul id={listId} role="list" aria-label={`${label} values`} className="flex flex-wrap gap-2">
          {values.map((value) => (
            <li key={value}>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-sm",
                  disabled && "opacity-60",
                )}
              >
                <span>{value}</span>
                <button
                  type="button"
                  className="rounded-full p-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`Remove ${value}`}
                  disabled={disabled}
                  onClick={() => handleRemove(value)}
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No values added yet.</p>
      )}
    </div>
  );
}
