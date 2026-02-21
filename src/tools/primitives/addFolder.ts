import { executeAppleScript, escapeForAppleScript } from '../../utils/scriptExecution.js';

export interface AddFolderParams {
  name: string;
  note?: string;
  parentFolderName?: string;
}

function generateAppleScript(params: AddFolderParams): string {
  const name = escapeForAppleScript(params.name);
  const note = params.note ? escapeForAppleScript(params.note) : '';
  const parentFolderName = params.parentFolderName ? escapeForAppleScript(params.parentFolderName) : '';

  const script = `
  try
    tell application "OmniFocus"
      tell front document
        if "${parentFolderName}" is "" then
          set newFolder to make new folder with properties {name:"${name}"}
        else
          try
            set parentFolder to first flattened folder where name = "${parentFolderName}"
            set newFolder to make new folder with properties {name:"${name}"} at end of folders of parentFolder
          on error
            return "{\\"success\\":false,\\"error\\":\\"Parent folder not found: ${parentFolderName}\\"}"
          end try
        end if

        ${note ? `set note of newFolder to "${note}"` : ''}

        set folderId to id of newFolder as string

        return "{\\"success\\":true,\\"folderId\\":\\"" & folderId & "\\",\\"name\\":\\"${name}\\"}"
      end tell
    end tell
  on error errorMessage
    return "{\\"success\\":false,\\"error\\":\\"" & errorMessage & "\\"}"
  end try
  `;

  return script;
}

export async function addFolder(params: AddFolderParams): Promise<{ success: boolean; folderId?: string; error?: string }> {
  try {
    const script = generateAppleScript(params);
    const stdout = await executeAppleScript(script);

    try {
      const result = JSON.parse(stdout);
      return {
        success: result.success,
        folderId: result.folderId,
        error: result.error
      };
    } catch (parseError) {
      return {
        success: false,
        error: `Failed to parse result: ${stdout}`
      };
    }
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || "Unknown error in addFolder"
    };
  }
}
