import { useEffect, useId, useState } from "react";
import { Input } from "../ui/input";

/**
 * Type-to-search picker backed by a native <datalist>.
 *
 * The visible text is local state so partial typing is never overwritten; the
 * parent only receives an id when the text exactly matches an option's label
 * (case-insensitive), and "" when it does not. Changing `value` from outside
 * (e.g. "Clear Filters") resets the text.
 */
export default function EntityCombobox({
  options,
  value,
  onChange,
  placeholder,
  getLabel = (option) => option.name,
  getValue = (option) => String(option.id),
  className,
  ...inputProps
}) {
  const listId = useId();
  const selected = options.find((option) => getValue(option) === String(value ?? ""));
  const selectedLabel = selected ? getLabel(selected) : "";
  const [text, setText] = useState(selectedLabel);

  useEffect(() => {
    setText(selectedLabel);
  }, [selectedLabel]);

  const handleChange = (event) => {
    const next = event.target.value;
    setText(next);
    const match = options.find((option) => String(getLabel(option) || "").toLowerCase() === next.trim().toLowerCase());
    const nextValue = match ? getValue(match) : "";
    if (nextValue !== String(value ?? "")) onChange(nextValue);
  };

  const unmatched = text.trim() !== "" && !selected;

  return (
    <>
      <Input
        type="text"
        list={listId}
        value={text}
        onChange={handleChange}
        placeholder={placeholder}
        className={className}
        aria-invalid={unmatched || undefined}
        {...inputProps}
      />
      <datalist id={listId}>
        {options.map((option) => (
          <option key={getValue(option)} value={getLabel(option)} />
        ))}
      </datalist>
      {unmatched ? <p className="mt-1 text-xs text-muted-foreground">Pick a name from the list to apply it.</p> : null}
    </>
  );
}
