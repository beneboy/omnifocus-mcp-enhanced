import { executeOmniFocusScript } from '../../utils/scriptExecution.js';
import { formatTask, groupTasksByProject } from '../../utils/formatTask.js';

export interface GetTodayCompletedTasksOptions {
  limit?: number;
}

export async function getTodayCompletedTasks(options: GetTodayCompletedTasksOptions = {}): Promise<string> {
  try {
    const { limit = 20 } = options;

    const result = await executeOmniFocusScript('@todayCompletedTasks.js', { limit });

    if (typeof result === 'string') {
      return result;
    }

    // If result is an object, format it
    if (result && typeof result === 'object') {
      const data = result as any;

      if (data.error) {
        throw new Error(data.error);
      }

      // Format completed tasks result
      let output = `# Tasks completed today\n\n`;

      if (data.tasks && Array.isArray(data.tasks)) {
        if (data.tasks.length === 0) {
          output += "No tasks completed today.\n";
        } else {
          const taskCount = data.tasks.length;
          const totalCount = data.filteredCount || taskCount;

          output += `Completed **${totalCount}** tasks today`;
          if (taskCount < totalCount) {
            output += ` (showing ${taskCount})`;
          }
          output += `:\n\n`;

          // Group tasks by project
          const tasksByProject = groupTasksByProject(data.tasks);

          tasksByProject.forEach((tasks, projectName) => {
            if (tasksByProject.size > 1) {
              output += `## ${projectName}\n`;
            }

            tasks.forEach((task: any) => {
              output += formatTask(task, { showCompletionTime: true });
              output += '\n';
            });

            if (tasksByProject.size > 1) {
              output += '\n';
            }
          });

          // Summary
          output += `\n---\n**Today**: ${totalCount} tasks completed\n`;
        }
      } else {
        output += "Unable to retrieve task data\n";
      }

      return output;
    }

    return "Unable to parse OmniFocus result";

  } catch (error) {
    console.error("Error in getTodayCompletedTasks:", error);
    throw new Error(`Failed to get completed tasks: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

