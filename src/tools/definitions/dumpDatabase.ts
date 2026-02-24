import { z } from 'zod';
import { dumpDatabase } from '../dumpDatabase.js';
import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import { formatTask, formatDisplayDate } from '../../utils/formatTask.js';

export const schema = z.object({
  hideCompleted: z.boolean().optional().describe("Set to false to show completed and dropped tasks (default: true)"),
  hideRecurringDuplicates: z.boolean().optional().describe("Set to true to hide duplicate instances of recurring tasks (default: true)")
});

export async function handler(args: z.infer<typeof schema>, extra: RequestHandlerExtra) {
  try {
    // Get raw database
    const database = await dumpDatabase();
    
    // Format as compact report
    const formattedReport = formatCompactReport(database, {
      hideCompleted: args.hideCompleted !== false, // Default to true
      hideRecurringDuplicates: args.hideRecurringDuplicates !== false // Default to true
    });
    
    return {
      content: [{
        type: "text" as const,
        text: formattedReport
      }]
    };
  } catch (err: unknown) {
    return {
      content: [{
        type: "text" as const,
        text: `Error generating report. Please ensure OmniFocus is running and try again.`
      }],
      isError: true
    };
  }
}

// Compact date formatting delegated to shared formatDisplayDate(date, true)

// Function to format the database in the compact report format
export function formatCompactReport(database: any, options: { hideCompleted: boolean, hideRecurringDuplicates: boolean }): string {
  const { hideCompleted, hideRecurringDuplicates } = options;
  
  // Get current date for the header
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];
  
  let output = `# OMNIFOCUS [${dateStr}]\n\n`;
  
  // Add legend
  output += `FORMAT LEGEND:
F: Folder | P: Project | •: Task | [flagged]: Flagged
Dates: [M/D] | [DUE:M/D] [PLAN:M/D] [defer:M/D] | Duration: (30m) or (2h) | Tags: <"tag1","tag2">
Status: #next #avail #block #defer #due #over #compl #drop\n\n`;
  
  // Map of folder IDs to folder objects for quick lookup
  const folderMap = new Map();
  Object.values(database.folders).forEach((folder: any) => {
    folderMap.set(folder.id, folder);
  });
  
  
  // Function to get folder hierarchy path 
  function getFolderPath(folderId: string): string[] {
    const path = [];
    let currentId = folderId;
    
    while (currentId) {
      const folder = folderMap.get(currentId);
      if (!folder) break;
      
      path.unshift(folder.name);
      currentId = folder.parentFolderID;
    }
    
    return path;
  }
  
  // Get root folders (no parent)
  const rootFolders = Object.values(database.folders).filter((folder: any) => !folder.parentFolderID);
  
  // Process folders recursively
  function processFolder(folder: any, level: number): string {
    const indent = '   '.repeat(level);
    let folderOutput = `${indent}F: ${folder.name}\n`;
    
    // Process subfolders
    if (folder.subfolders && folder.subfolders.length > 0) {
      for (const subfolderId of folder.subfolders) {
        const subfolder = database.folders[subfolderId];
        if (subfolder) {
          folderOutput += `${processFolder(subfolder, level + 1)}`;
        }
      }
    }
    
    // Process projects in this folder
    if (folder.projects && folder.projects.length > 0) {
      for (const projectId of folder.projects) {
        const project = database.projects[projectId];
        if (project) {
          folderOutput += processProject(project, level + 1);
        }
      }
    }
    
    return folderOutput;
  }
  
  // Process a project
  function processProject(project: any, level: number): string {
    const indent = '   '.repeat(level);
    
    // Skip if it's completed or dropped and we're hiding completed items
    if (hideCompleted && (project.status === 'Done' || project.status === 'Dropped')) {
      return '';
    }
    
    // Format project status info
    let statusInfo = '';
    if (project.status === 'OnHold') {
      statusInfo = ' [OnHold]';
    } else if (project.status === 'Dropped') {
      statusInfo = ' [Dropped]';
    }
    
    // Add due date if present
    if (project.dueDate) {
      statusInfo += ` [DUE:${formatDisplayDate(project.dueDate, true)}]`;
    }

    // Add planned date if present
    if (project.plannedDate) {
      statusInfo += ` [PLAN:${formatDisplayDate(project.plannedDate, true)}]`;
    }
    
    // Add flag if present
    const flaggedSymbol = project.flagged ? ' [flagged]' : '';
    
    let projectOutput = `${indent}P: ${project.name}${flaggedSymbol}${statusInfo}\n`;
    
    // Process tasks in this project
    const projectTasks = database.tasks.filter((task: any) => 
      task.projectId === project.id && !task.parentId
    );
    
    if (projectTasks.length > 0) {
      for (const task of projectTasks) {
        projectOutput += processTask(task, level + 1);
      }
    }
    
    return projectOutput;
  }
  
  // Process a task
  function processTask(task: any, level: number): string {
    const indent = '   '.repeat(level);

    // Skip if it's completed or dropped and we're hiding completed items
    if (hideCompleted && (task.completed || task.taskStatus === 'Completed' || task.taskStatus === 'Dropped')) {
      return '';
    }

    // Map tagNames array to tag objects for formatTask
    const tags = (task.tagNames || []).map((name: string) => ({ name }));

    let taskOutput = indent + formatTask(
      { ...task, tags },
      { compact: true, bullet: '• ' }
    );

    // Process subtasks
    if (task.childIds && task.childIds.length > 0) {
      const childTasks = database.tasks.filter((t: any) => task.childIds.includes(t.id));

      for (const childTask of childTasks) {
        taskOutput += processTask(childTask, level + 1);
      }
    }

    return taskOutput;
  }
  
  // Process all root folders
  for (const folder of rootFolders) {
    output += processFolder(folder, 0);
  }
  
  // Process projects not in any folder (if any)
  const rootProjects = Object.values(database.projects).filter((project: any) => !project.folderID);
  
  for (const project of rootProjects) {
    output += processProject(project, 0);
  }

  // Process inbox tasks (tasks not assigned to any project)
  const inboxTasks = database.tasks.filter((task: any) =>
    !task.projectId &&
    !task.parentId &&
    !(hideCompleted && (task.completed || task.taskStatus === 'Completed' || task.taskStatus === 'Dropped'))
  );

  if (inboxTasks.length > 0) {
    output += 'INBOX:\n';
    for (const task of inboxTasks) {
      output += processTask(task, 1);
    }
  }
  
  return output;
}

