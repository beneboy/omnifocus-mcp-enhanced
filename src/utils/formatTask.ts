/**
 * Shared task formatting utilities.
 *
 * Every MCP tool that renders tasks to text should use these helpers
 * so output is consistent and the "Blocked vs Deferred" distinction
 * is handled in one place.
 */

// === Types ===

export interface TaskData {
  name: string;
  flagged?: boolean;
  completed?: boolean;
  dueDate?: string | null;
  deferDate?: string | null;
  plannedDate?: string | null;
  completedDate?: string | null;
  taskStatus?: string;
  estimatedMinutes?: number | null;
  note?: string;
  tags?: Array<{ name: string } | string>;
  projectName?: string;
  inInbox?: boolean;
}

export interface FormatTaskOptions {
  /** Compact mode for dumpDatabase (M/D dates, #hashtag status, inline <tags>) */
  compact?: boolean;
  /** Override bullet character (default: '- ') */
  bullet?: string;
  /** Show project name inline after task name */
  showProject?: boolean;
  /** Append a type indicator in brackets, e.g. [due] or [deferred] */
  typeIndicator?: string;
  /** Show completion time instead of full date (for completed task views) */
  showCompletionTime?: boolean;
  /** Bold these tag names in the Tags line */
  highlightTags?: string[];
  /** Show note detail line (default: true) */
  showNote?: boolean;
  /** Show tags detail line (default: true) */
  showTags?: boolean;
}

// === Compact-mode status abbreviations ===

const COMPACT_STATUS: Record<string, string> = {
  'Next': '#next',
  'Available': '#avail',
  'Blocked': '#block',
  'Deferred': '#defer',
  'DueSoon': '#due',
  'Overdue': '#over',
  'Completed': '#compl',
  'Dropped': '#drop',
};

// === Core helpers ===

/**
 * Resolve the display status for a task.
 * Maps "Blocked" → "Deferred" when the task has a future defer date,
 * since OmniFocus uses Task.Status.Blocked for both dependency-blocked
 * and deferred-until-future-date tasks.
 */
export function resolveDisplayStatus(
  taskStatus: string | undefined,
  deferDate: string | null | undefined
): string {
  if (!taskStatus) return '';
  if (taskStatus !== 'Blocked') return taskStatus;

  if (deferDate) {
    const defer = new Date(deferDate);
    if (!isNaN(defer.getTime()) && defer > new Date()) {
      return 'Deferred';
    }
  }
  return 'Blocked';
}

/**
 * Format estimated minutes consistently as "1h30m", "45m", etc.
 */
export function formatEstimate(minutes: number): string {
  if (minutes <= 0) return '0m';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0 && mins > 0) return `${hours}h${mins}m`;
  if (hours > 0) return `${hours}h`;
  return `${mins}m`;
}

/**
 * Format an ISO date string for display.
 * compact=true  → "M/D"           (e.g. "2/24")
 * compact=false → "YYYY-MM-DD"    (e.g. "2026-02-24")
 *
 * Standard mode uses ISO format for unambiguous LLM consumption
 * (no locale dependency, matches the ISO input format used in tool schemas).
 */
export function formatDisplayDate(isoDate: string, compact?: boolean): string {
  const date = new Date(isoDate);
  if (isNaN(date.getTime())) return isoDate;
  if (compact) return `${date.getMonth() + 1}/${date.getDate()}`;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// === Main formatting function ===

/**
 * Format a task as a text string for tool output.
 *
 * Standard mode (default):
 *   - [flagged] Task Name [DUE: 2026-03-01, DEFER: 2026-02-25] (Deferred) (est:1h30m)
 *     Note: some note
 *     Tags: "Deep Work", "Admin"
 *
 * Compact mode (dumpDatabase):
 *   • [flagged] Task Name [DUE:3/1] [defer:2/25] [PLAN:3/5] (1h30m) <"Deep Work","Admin"> #defer
 */
export function formatTask(task: TaskData, options: FormatTaskOptions = {}): string {
  const {
    compact = false,
    bullet = '- ',
    showProject = false,
    typeIndicator,
    showCompletionTime = false,
    highlightTags,
    showNote = true,
    showTags = true,
  } = options;

  const displayStatus = resolveDisplayStatus(task.taskStatus, task.deferDate);

  if (compact) {
    return formatTaskCompact(task, bullet, displayStatus);
  }

  return formatTaskStandard(task, {
    bullet,
    displayStatus,
    showProject,
    typeIndicator,
    showCompletionTime,
    highlightTags,
    showNote,
    showTags,
  });
}

// === Standard mode ===

function formatTaskStandard(
  task: TaskData,
  opts: {
    bullet: string;
    displayStatus: string;
    showProject: boolean;
    typeIndicator?: string;
    showCompletionTime: boolean;
    highlightTags?: string[];
    showNote: boolean;
    showTags: boolean;
  }
): string {
  let output = opts.bullet;

  if (task.flagged) output += '[flagged] ';

  output += task.name;

  // Project name inline
  if (opts.showProject) {
    const proj = task.projectName || (task.inInbox ? 'Inbox' : null);
    if (proj) output += ` (${proj})`;
  }

  // Completion time for completed-task views
  if (opts.showCompletionTime && task.completedDate) {
    const time = new Date(task.completedDate).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
    output += ` *(completed ${time})*`;
  }

  // Date info — combined in one bracket
  const dateInfo: string[] = [];
  if (task.dueDate) {
    const str = formatDisplayDate(task.dueDate);
    const isOverdue = new Date(task.dueDate) < new Date();
    dateInfo.push(isOverdue ? `OVERDUE: ${str}` : `DUE: ${str}`);
  }
  if (task.deferDate) {
    dateInfo.push(`DEFER: ${formatDisplayDate(task.deferDate)}`);
  }
  if (task.plannedDate) {
    dateInfo.push(`PLAN: ${formatDisplayDate(task.plannedDate)}`);
  }
  if (!opts.showCompletionTime && task.completedDate) {
    dateInfo.push(`DONE: ${formatDisplayDate(task.completedDate)}`);
  }
  if (dateInfo.length > 0) {
    output += ` [${dateInfo.join(', ')}]`;
  }

  // Status and estimate as separate parentheticals for unambiguous parsing
  if (opts.displayStatus && opts.displayStatus !== 'Available') {
    output += ` (${opts.displayStatus})`;
  }
  if (task.estimatedMinutes) {
    output += ` (est:${formatEstimate(task.estimatedMinutes)})`;
  }

  // Type indicator (forecast view)
  if (opts.typeIndicator) {
    output += ` [${opts.typeIndicator}]`;
  }

  output += '\n';

  // Detail lines
  if (opts.showNote && task.note && task.note.trim()) {
    output += `  Note: ${task.note.trim()}\n`;
  }

  if (opts.showTags && task.tags && task.tags.length > 0) {
    const tagNames = task.tags.map(tag => {
      const name = normalizeTagName(tag);
      if (opts.highlightTags && opts.highlightTags.includes(name)) {
        return `**"${name}"**`;
      }
      return `"${name}"`;
    });
    output += `  Tags: ${tagNames.join(', ')}\n`;
  }

  return output;
}

// === Compact mode (dumpDatabase) ===

function formatTaskCompact(task: TaskData, bullet: string, displayStatus: string): string {
  let output = bullet;

  if (task.flagged) output += '[flagged] ';

  output += task.name;

  // Dates — separate brackets, compact M/D format
  if (task.dueDate) {
    output += ` [DUE:${formatDisplayDate(task.dueDate, true)}]`;
  }
  if (task.deferDate) {
    output += ` [defer:${formatDisplayDate(task.deferDate, true)}]`;
  }
  if (task.plannedDate) {
    output += ` [PLAN:${formatDisplayDate(task.plannedDate, true)}]`;
  }

  // Estimate
  if (task.estimatedMinutes) {
    output += ` (${formatEstimate(task.estimatedMinutes)})`;
  }

  // Tags inline (quoted to avoid ambiguity with multi-word tag names)
  if (task.tags && task.tags.length > 0) {
    const tagNames = task.tags.map(t => `"${normalizeTagName(t)}"`);
    output += ` <${tagNames.join(',')}>`;
  }

  // Status hashtag
  if (displayStatus) {
    const abbrev = COMPACT_STATUS[displayStatus] || `#${displayStatus.toLowerCase()}`;
    output += ` ${abbrev}`;
  }

  output += '\n';
  return output;
}

// === Grouping helper ===

/**
 * Group tasks by project name. Returns a Map preserving insertion order.
 */
export function groupTasksByProject(tasks: TaskData[]): Map<string, TaskData[]> {
  const grouped = new Map<string, TaskData[]>();

  tasks.forEach(task => {
    const projectName = task.projectName || (task.inInbox ? 'Inbox' : 'No Project');
    if (!grouped.has(projectName)) {
      grouped.set(projectName, []);
    }
    grouped.get(projectName)!.push(task);
  });

  return grouped;
}

// === Internal helpers ===

function normalizeTagName(tag: { name: string } | string): string {
  if (typeof tag === 'string') return tag;
  return tag.name;
}
