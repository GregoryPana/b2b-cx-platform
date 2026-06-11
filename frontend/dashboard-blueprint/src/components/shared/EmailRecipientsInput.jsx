import { X } from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

export default function EmailRecipientsInput({
  label = "Email recipients",
  helperText = "Type an email and press Enter, Tab, comma, or Add.",
  placeholder = "name@example.com",
  recipients = [],
  draft = "",
  onDraftChange,
  onAddRecipient,
  onRemoveRecipient,
  onDraftBlur,
}) {
  const handleKeyDown = (event) => {
    if (["Enter", "Tab", ",", ";"].includes(event.key)) {
      event.preventDefault();
      onAddRecipient?.();
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-muted-foreground mb-1 block">{label}</label>
      <div className="rounded-md border bg-background p-2">
        {recipients.length ? (
          <div className="mb-2 flex flex-wrap gap-2">
            {recipients.map((recipient) => (
              <Badge key={recipient} variant="secondary" className="gap-1 pr-1">
                <span>{recipient}</span>
                <button
                  type="button"
                  className="rounded-full p-0.5 hover:bg-black/10"
                  onClick={() => onRemoveRecipient?.(recipient)}
                  aria-label={`Remove ${recipient}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        ) : null}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder={placeholder}
            value={draft}
            onChange={(event) => onDraftChange?.(event.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => onDraftBlur?.()}
          />
          <Button type="button" variant="outline" onClick={() => onAddRecipient?.()}>
            Add
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{helperText}</p>
    </div>
  );
}
