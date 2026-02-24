import { executeOmniFocusScript } from '../../utils/scriptExecution.js';
import { formatTask } from '../../utils/formatTask.js';

export interface GetInboxTasksOptions {
  hideCompleted?: boolean;
}

export async function getInboxTasks(options: GetInboxTasksOptions = {}): Promise<string> {
  const { hideCompleted = true } = options;

  try {
    // Execute the inbox script
    const result = await executeOmniFocusScript('@inboxTasks.js', {
      hideCompleted: hideCompleted
    });

    if (typeof result === 'string') {
      return result;
    }

    // If result is an object, format it
    if (result && typeof result === 'object') {
      const data = result as any;

      if (data.error) {
        throw new Error(data.error);
      }

      // Format the inbox tasks
      let output = `# INBOX TASKS\n\n`;

      if (data.tasks && Array.isArray(data.tasks)) {
        if (data.tasks.length === 0) {
          output += 'Inbox is empty.\n';
        } else {
          output += `Found ${data.tasks.length} task${data.tasks.length === 1 ? '' : 's'} in inbox:\n\n`;

          data.tasks.forEach((task: any, index: number) => {
            output += formatTask(task, { bullet: `${index + 1}. ` });
          });
        }
      } else {
        output += 'No inbox data available\n';
      }

      return output;
    }

    return 'Unexpected result format from OmniFocus';
  } catch (error) {
    console.error('Error in getInboxTasks:', error);
    throw new Error(`Failed to get inbox tasks: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
