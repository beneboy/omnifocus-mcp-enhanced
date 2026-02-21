import { PerspectiveEngine, TaskItem } from '../../utils/perspectiveEngine.js';
import {
  buildPerspectiveTaskTree,
  PerspectiveDisplayMode,
  PerspectiveProjectGroup,
  PerspectiveTaskNode
} from './perspectiveTaskTree.js';

// Perspective access using OmniFocus 4.2+ archivedFilterRules API

export interface GetPerspectiveTasksV2Params {
  perspectiveName: string;
  hideCompleted?: boolean;
  limit?: number;
  displayMode?: PerspectiveDisplayMode;
}

export interface GetPerspectiveTasksV2Result {
  success: boolean;
  tasks?: TaskItem[];
  displayMode?: PerspectiveDisplayMode;
  projectTree?: PerspectiveProjectGroup[];
  taskTree?: PerspectiveTaskNode[];
  summary?: {
    projectGroupCount: number;
    rootTaskCount: number;
    nestedTaskCount: number;
  };
  perspectiveInfo?: {
    name: string;
    rulesCount: number;
    aggregation: string;
  };
  error?: string;
}

/**
 * Get perspective-filtered tasks - V2
 * Uses OmniFocus 4.2+ archivedFilterRules API for accurate perspective filtering.
 */
export async function getPerspectiveTasksV2(
  params: GetPerspectiveTasksV2Params
): Promise<GetPerspectiveTasksV2Result> {
  const displayMode = params.displayMode || 'project_tree';

  console.log(`[PerspectiveV2] Fetching tasks for perspective "${params.perspectiveName}"`);
  console.log(`[PerspectiveV2] Params:`, {
    hideCompleted: params.hideCompleted,
    limit: params.limit,
    displayMode
  });

  try {
    const engine = new PerspectiveEngine();

    const result = await engine.getFilteredTasks(params.perspectiveName, {
      hideCompleted: params.hideCompleted,
      limit: params.limit
    });

    if (!result.success) {
      console.error(`[PerspectiveV2] Failed:`, result.error);
      return {
        success: false,
        error: result.error
      };
    }

    console.log(`[PerspectiveV2] Success`);
    console.log(`[PerspectiveV2] Perspective info:`, result.perspectiveInfo);
    console.log(`[PerspectiveV2] Filtered ${result.tasks?.length || 0} tasks`);

    if (result.tasks && result.tasks.length > 0) {
      console.log(`[PerspectiveV2] Sample task:`, {
        first: {
          name: result.tasks[0].name,
          flagged: result.tasks[0].flagged,
          dueDate: result.tasks[0].dueDate,
          projectName: result.tasks[0].projectName,
          tags: result.tasks[0].tags?.length || 0
        }
      });
    }

    const displayTree = buildPerspectiveTaskTree((result.tasks || []) as any[], {
      hideCompleted: params.hideCompleted !== false,
      inboxLabel: 'Inbox'
    });

    return {
      success: true,
      tasks: result.tasks,
      perspectiveInfo: result.perspectiveInfo,
      displayMode,
      projectTree: displayMode === 'project_tree' ? displayTree.projectGroups : undefined,
      taskTree: displayMode === 'task_tree' ? displayTree.rootTasks : undefined,
      summary: {
        projectGroupCount: displayTree.projectGroups.length,
        rootTaskCount: displayTree.rootTasks.length,
        nestedTaskCount: Math.max(displayTree.flatTasks.length - displayTree.rootTasks.length, 0)
      }
    };

  } catch (error: any) {
    console.error(`[PerspectiveV2] Engine error:`, error);

    return {
      success: false,
      error: `Perspective engine error: ${error.message || 'Unknown error'}`
    };
  }
}
