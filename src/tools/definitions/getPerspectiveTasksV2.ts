import { z } from 'zod';
import { getPerspectiveTasksV2 } from '../primitives/getPerspectiveTasksV2.js';

// Perspective access using OmniFocus 4.2+ archivedFilterRules API
// Supports all 27 filter rule types and 3 aggregation modes.

export const schema = z.object({
  perspectiveName: z.string().describe("Name of the OmniFocus custom perspective"),

  hideCompleted: z.boolean().optional().default(true).describe("Hide completed and dropped tasks (default: true)"),

  limit: z.number().optional().default(100).describe("Maximum number of tasks to return (default: 100, 0 for unlimited)"),

  displayMode: z.enum(['project_tree', 'task_tree', 'flat']).optional().default('project_tree')
    .describe("Display mode: project_tree (by project + subtask tree), task_tree (global task tree), flat (simple list)")
});

export type GetPerspectiveTasksV2Params = z.infer<typeof schema>;

export async function handler(params: GetPerspectiveTasksV2Params) {
  try {
    const result = await getPerspectiveTasksV2(params);

    if (!result.success) {
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            success: false,
            error: result.error
          }, null, 2)
        }]
      };
    }

    // Format response
    const response: any = {
      success: true,
      perspective: result.perspectiveInfo,
      tasks: result.tasks || [],
      totalTasks: result.tasks?.length || 0,
      options: {
        hideCompleted: params.hideCompleted,
        limit: params.limit,
        displayMode: result.displayMode || params.displayMode
      },
      metadata: {
        timestamp: new Date().toISOString(),
        apiVersion: "v2",
        engine: "OmniFocus 4.2+ archivedFilterRules"
      }
    };

    if (result.projectTree) {
      response.projectTree = result.projectTree;
    }

    if (result.taskTree) {
      response.taskTree = result.taskTree;
    }

    // Add summary if tasks exist
    if (result.tasks && result.tasks.length > 0) {
      const summary = {
        flaggedTasks: result.tasks.filter(t => t.flagged).length,
        tasksWithDueDate: result.tasks.filter(t => t.dueDate).length,
        tasksWithDeferDate: result.tasks.filter(t => t.deferDate).length,
        tasksWithPlannedDate: result.tasks.filter(t => t.plannedDate).length,
        projectTasks: result.tasks.filter(t => t.projectName).length,
        inboxTasks: result.tasks.filter(t => !t.projectName).length,
        projectGroupCount: result.summary?.projectGroupCount ?? 0,
        rootTaskCount: result.summary?.rootTaskCount ?? 0,
        nestedTaskCount: result.summary?.nestedTaskCount ?? 0
      };

      response.summary = summary;
    }

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify(response, null, 2)
      }]
    };

  } catch (error: any) {
    console.error('getPerspectiveTasksV2 handler error:', error);
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          success: false,
          error: error.message || 'Unknown error in getPerspectiveTasksV2',
          metadata: {
            timestamp: new Date().toISOString(),
            apiVersion: "v2",
            engine: "OmniFocus 4.2+ archivedFilterRules"
          }
        }, null, 2)
      }]
    };
  }
}
