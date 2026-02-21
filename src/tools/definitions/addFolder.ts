import { z } from 'zod';
import { addFolder, AddFolderParams } from '../primitives/addFolder.js';
import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';

export const schema = z.object({
  name: z.string().describe("The name of the folder"),
  note: z.string().optional().describe("Additional notes for the folder"),
  parentFolderName: z.string().optional().describe("The name of the parent folder to nest this folder inside (creates at root level if not specified)")
});

export async function handler(args: z.infer<typeof schema>, extra: RequestHandlerExtra) {
  try {
    const result = await addFolder(args as AddFolderParams);

    if (result.success) {
      let locationText = args.parentFolderName
        ? `inside folder "${args.parentFolderName}"`
        : "at the root level";

      return {
        content: [{
          type: "text" as const,
          text: `Folder "${args.name}" created successfully ${locationText}.`
        }]
      };
    } else {
      return {
        content: [{
          type: "text" as const,
          text: `Failed to create folder: ${result.error}`
        }],
        isError: true
      };
    }
  } catch (err: unknown) {
    const error = err as Error;
    return {
      content: [{
        type: "text" as const,
        text: `Error creating folder: ${error.message}`
      }],
      isError: true
    };
  }
}
