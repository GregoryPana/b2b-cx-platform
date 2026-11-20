import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select } from "../ui/select";
import { Textarea } from "../ui/textarea";

// The two pieces of a response editor that the B2B and Mystery Shopper review panels both need.
// Flat on purpose (design system 4.2): rows are separated by rules, not wrapped in more boxes.

export function ReviewActionPoints({ responseId, actions, timeframeOptions, onAdd, onUpdate, onRemove }) {
  const list = Array.isArray(actions) ? actions : [];
  return (
    <div className="border-t pt-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Action points{list.length ? ` (${list.length})` : ""}</p>
        <Button type="button" size="sm" variant="outline" onClick={() => onAdd(responseId)}>Add action</Button>
      </div>
      {list.length === 0 ? <p className="mt-2 text-xs text-muted-foreground">No action points on this response.</p> : null}
      <div className="divide-y">
        {list.map((action, index) => (
          <div key={`${responseId}-action-${index}`} className="grid grid-cols-1 gap-2 py-3 md:grid-cols-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground md:col-span-2">Action {index + 1}</p>
            <Textarea aria-label={`Action ${index + 1} required`} className="min-h-20 resize-y md:col-span-2" placeholder="Action required" value={action.action_required || ""} onChange={(event) => onUpdate(responseId, index, "action_required", event.target.value)} />
            <Input aria-label={`Action ${index + 1} lead owner`} placeholder="Lead owner" value={action.action_owner || ""} onChange={(event) => onUpdate(responseId, index, "action_owner", event.target.value)} />
            <Select aria-label={`Action ${index + 1} timeframe`} value={action.action_timeframe || ""} onChange={(event) => onUpdate(responseId, index, "action_timeframe", event.target.value)}>
              <option value="">Action timeframe</option>
              {(timeframeOptions || []).map((option) => (
                <option key={`${responseId}-${index}-${option}`} value={option}>{option}</option>
              ))}
            </Select>
            <Textarea aria-label={`Action ${index + 1} support needed`} className="min-h-20 resize-y" placeholder="Support needed" value={action.action_support_needed || ""} onChange={(event) => onUpdate(responseId, index, "action_support_needed", event.target.value)} />
            <Textarea aria-label={`Action ${index + 1} comments`} className="min-h-20 resize-y" placeholder="Comments" value={action.action_comments || ""} onChange={(event) => onUpdate(responseId, index, "action_comments", event.target.value)} />
            <div className="md:col-span-2">
              <Button type="button" size="sm" variant="destructive" onClick={() => onRemove(responseId, index)}>Remove action {index + 1}</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ReviewSaveBar({ dirty, saving, onSave }) {
  return (
    <div className="flex items-center justify-end gap-3">
      {dirty && !saving ? <span role="status" className="text-xs font-medium text-amber-700 dark:text-amber-400">Unsaved changes</span> : null}
      <Button type="button" size="sm" variant={dirty ? "default" : "outline"} onClick={onSave} disabled={saving}>
        {saving ? "Saving..." : "Save changes"}
      </Button>
    </div>
  );
}
