// Google Drive API v3 utility — uses OAuth2 refresh token flow

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
}

/** Exchange refresh token for a fresh access token */
async function getAccessToken(): Promise<string> {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Google Drive credentials not configured");
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token refresh failed: ${err}`);
  }

  const data = await res.json();
  return data.access_token;
}

/** Create a Drive folder named "Jarvis — [projectTitle]" and return its ID */
export async function createProjectFolder(projectTitle: string): Promise<string> {
  const token = await getAccessToken();

  const res = await fetch(`${DRIVE_API}/files`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: `Jarvis — ${projectTitle}`,
      mimeType: "application/vnd.google-apps.folder",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to create folder: ${err}`);
  }

  const data = await res.json();
  return data.id;
}

/** List files inside a Drive folder */
export async function listFolderFiles(folderId: string): Promise<DriveFile[]> {
  const token = await getAccessToken();

  const query = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
  const fields = encodeURIComponent("files(id,name,mimeType,webViewLink)");

  const res = await fetch(
    `${DRIVE_API}/files?q=${query}&fields=${fields}&orderBy=modifiedTime desc&pageSize=50`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to list files: ${err}`);
  }

  const data = await res.json();
  return data.files || [];
}

/** Get the web URL for a Drive folder */
export function getFolderLink(folderId: string): string {
  return `https://drive.google.com/drive/folders/${folderId}`;
}
