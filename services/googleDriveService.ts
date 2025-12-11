
declare const gapi: any;

/* global gapi */

interface DriveFile {
    id: string;
    name: string;
    mimeType: string;
}

/**
 * Searches for a file in Google Drive by name.
 * @param fileName The name of the file to search for.
 * @returns A DriveFile object if found, otherwise null.
 */
export async function findFileByName(fileName: string): Promise<DriveFile | null> {
    try {
        const response = await gapi.client.drive.files.list({
            q: `name = '${fileName.replace(/'/g, "\\'")}' and trashed = false`,
            fields: 'files(id, name, mimeType)',
            pageSize: 1
        });
        const file = response.result.files?.[0];
        if (file) {
            return { id: file.id, name: file.name, mimeType: file.mimeType };
        }
        return null;
    } catch (err: any) {
        console.error("Google Drive API error (findFileByName):", err);
        throw new Error(err.result?.error?.message || 'Failed to search for files in Google Drive.');
    }
}

/**
 * Retrieves the content of a file from Google Drive.
 * Supports Google Docs (by exporting as text) and other plain text files.
 * @param fileId The ID of the file.
 * @param mimeType The MIME type of the file.
 * @returns The text content of the file.
 */
export async function getFileContent(fileId: string, mimeType: string): Promise<string> {
    try {
        // For Google Docs, we need to export them as plain text.
        if (mimeType === 'application/vnd.google-apps.document') {
            const response = await gapi.client.drive.files.export({
                fileId: fileId,
                mimeType: 'text/plain'
            });
            return response.body;
        }
        // For plain text files, we can download them directly.
        if (mimeType.startsWith('text/')) {
            const response = await gapi.client.drive.files.get({
                fileId: fileId,
                alt: 'media'
            });
            return response.body;
        }
        // For now, other file types are not supported for content analysis.
        throw new Error(`File type (${mimeType}) is not supported for analysis. Currently, only Google Docs and plain text files are supported.`);

    } catch (err: any) {
        console.error("Google Drive API error (getFileContent):", err);
        if (err.body) { // GAPI often wraps errors in a `body` property
             const errorDetails = JSON.parse(err.body);
             throw new Error(errorDetails.error?.message || 'Failed to get file content from Google Drive.');
        }
        throw new Error(err.message || 'An unknown error occurred while fetching file content.');
    }
}


/**
 * Lists the user's files from Google Drive.
 * @returns A formatted string listing the recent files.
 */
export async function listFiles(): Promise<string> {
  try {
    const response = await gapi.client.drive.files.list({
      'pageSize': 15,
      'fields': "nextPageToken, files(id, name, mimeType, modifiedTime)",
      'orderBy': 'modifiedTime desc'
    });

    const files = response.result.files;
    if (!files || files.length === 0) {
      return 'No files found in your Google Drive.';
    }

    const fileList = files.map(file => {
      const icon = getIconForMimeType(file.mimeType);
      const modifiedDate = new Date(file.modifiedTime!).toLocaleDateString();
      return `${icon} ${file.name} (Modified: ${modifiedDate})`;
    }).join('\n');
    
    return `Here are your 15 most recently modified Google Drive files:\n\n${fileList}`;

  } catch (err: any) {
    console.error("Google Drive API error:", err);
    throw new Error(err.result?.error?.message || 'Failed to fetch files from Google Drive.');
  }
}

function getIconForMimeType(mimeType: string | undefined): string {
    if (!mimeType) return '📄'; // Generic file
    if (mimeType.includes('google-apps.document')) return '📘'; // Google Doc
    if (mimeType.includes('google-apps.spreadsheet')) return '📊'; // Google Sheet
    if (mimeType.includes('google-apps.presentation')) return '📽️'; // Google Slides
    if (mimeType.includes('google-apps.folder')) return '📁'; // Folder
    if (mimeType.startsWith('image/')) return '🖼️'; // Image
    if (mimeType.startsWith('video/')) return '🎞️'; // Video
    if (mimeType.startsWith('audio/')) return '🎵'; // Audio
    if (mimeType === 'application/pdf') return '📕'; // PDF
    return '📄';
}
