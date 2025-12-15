/**
 * Tool-specific color utilities for consistent coloring across views
 *
 * Color Philosophy (Relational Color System):
 * - User Interaction (sky): Tools that bridge toward user (AskUserQuestion, EnterPlanMode, ExitPlanMode)
 * - Sub-agent (indigo): Tools that go "deeper" into agent work (Task)
 * - Web Operations (cyan): Tools that reach external world (WebFetch, WebSearch)
 * - Standard Tools (emerald): Normal agent operations (Read, Edit, Bash, etc.)
 */

export type ToolColorCategory = 'user_interaction' | 'sub_agent' | 'web_operation' | 'self_organization' | 'standard';

/**
 * Categorize a tool by its semantic meaning in the user<->agent spectrum
 */
export function getToolCategory(toolName?: string): ToolColorCategory {
  if (!toolName) return 'standard';

  const normalized = toolName.toLowerCase();

  // User interaction tools - bridge toward user
  if (['askuserquestion', 'enterplanmode', 'exitplanmode'].includes(normalized)) {
    return 'user_interaction';
  }

  // Sub-agent tools - go deeper into agent work
  if (['task', 'taskoutput', 'agentoutputtool'].includes(normalized)) {
    return 'sub_agent';
  }

  // Web operation tools - external world
  if (['webfetch', 'websearch'].includes(normalized)) {
    return 'web_operation';
  }

  return 'standard';
}

/**
 * Tailwind color classes for each tool category
 */
export const toolCategoryColors: Record<
  ToolColorCategory,
  {
    bg: string;
    border: string;
    text: string;
    headerBg: string;
    icon: string;
    handle: string;
  }
> = {
  user_interaction: {
    bg: 'bg-sky-50',
    border: 'border-sky-400',
    text: 'text-sky-700',
    headerBg: 'bg-sky-100',
    icon: 'text-sky-600',
    handle: '!bg-sky-500',
  },
  sub_agent: {
    bg: 'bg-purple-100',
    border: 'border-purple-500',
    text: 'text-purple-800',
    headerBg: 'bg-purple-200',
    icon: 'text-purple-700',
    handle: '!bg-purple-600',
  },
  web_operation: {
    bg: 'bg-cyan-50',
    border: 'border-cyan-400',
    text: 'text-cyan-700',
    headerBg: 'bg-cyan-100',
    icon: 'text-cyan-600',
    handle: '!bg-cyan-500',
  },
  self_organization: {
    bg: 'bg-amber-50',
    border: 'border-amber-400',
    text: 'text-amber-700',
    headerBg: 'bg-amber-100',
    icon: 'text-amber-600',
    handle: '!bg-amber-500',
  },
  standard: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-400',
    text: 'text-emerald-700',
    headerBg: 'bg-emerald-100',
    icon: 'text-emerald-600',
    handle: '!bg-emerald-500',
  },
};

/**
 * Get color classes for a specific tool
 */
export function getToolColors(toolName?: string) {
  const category = getToolCategory(toolName);
  return toolCategoryColors[category];
}

/**
 * Check if a tool is a special category (non-standard)
 */
export function isSpecialTool(toolName?: string): boolean {
  return getToolCategory(toolName) !== 'standard';
}
