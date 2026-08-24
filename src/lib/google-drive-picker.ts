/**
 * Google Drive Picker helper functions
 * Handles Google Identity Services token client and Google Picker API
 * Tokens are kept in memory only, never stored in Firestore
 */

/**
 * Minimal type declarations for the subset of Google Identity Services (GIS)
 * and Google Picker API this file actually calls. Google doesn't publish
 * official TypeScript types for these — this covers only what's used here,
 * not the full API surface.
 */
interface GoogleOAuthTokenResponse {
  access_token?: string;
  error?: string;
}

interface GoogleOAuthErrorResponse {
  error?: string;
}

interface GoogleOAuthTokenClient {
  requestAccessToken: () => void;
}

interface GoogleOAuthAccounts {
  oauth2: {
    initTokenClient: (config: {
      client_id: string;
      scope: string;
      callback: (response: GoogleOAuthTokenResponse) => void;
      error_callback: (error: GoogleOAuthErrorResponse) => void;
    }) => GoogleOAuthTokenClient;
  };
}

interface GooglePickerDoc {
  id: string;
  name: string;
  url: string;
  mimeType: string;
}

interface GooglePickerCallbackData {
  action: string;
  docs?: GooglePickerDoc[];
}

interface GooglePickerInstance {
  setVisible: (visible: boolean) => void;
}

interface GooglePickerBuilder {
  addView: (viewId: string) => GooglePickerBuilder;
  setOAuthToken: (token: string) => GooglePickerBuilder;
  setDeveloperKey: (key: string) => GooglePickerBuilder;
  setCallback: (callback: (data: GooglePickerCallbackData) => void) => GooglePickerBuilder;
  build: () => GooglePickerInstance;
}

interface GooglePickerNamespace {
  PickerBuilder: new () => GooglePickerBuilder;
  ViewId: {
    DOCS: string;
    SPREADSHEETS: string;
    PRESENTATIONS: string;
    FOLDERS: string;
  };
  Action: {
    PICKED: string;
    CANCEL: string;
  };
}

interface GoogleNamespace {
  accounts: GoogleOAuthAccounts;
  picker: GooglePickerNamespace;
}

declare global {
  interface Window {
    // Both are optional: they genuinely don't exist until their respective
    // scripts finish loading (that's what loadGIScript/loadPickerScript
    // wait for). Everywhere this file accesses them without a further
    // check, it's after one of those load functions has already resolved.
    google?: GoogleNamespace;
    gapi?: {
      load: (api: string, callback: () => void) => void;
    };
  }
}

export interface DriveFileMetadata {
  id: string;
  name: string;
  url: string;
  mimeType: string;
}

export interface PickerResult {
  action: 'picked' | 'cancelled';
  metadata?: DriveFileMetadata;
  error?: string;
}

/**
 * Load Google Identity Services script dynamically
 */
export function loadGIScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log('[GoogleDrivePicker] Loading GIS script...');
    if (typeof window !== 'undefined' && window.google) {
      console.log('[GoogleDrivePicker] GIS already loaded');
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      console.log('[GoogleDrivePicker] GIS script loaded successfully');
      resolve();
    };
    script.onerror = () => {
      console.error('[GoogleDrivePicker] Failed to load GIS script');
      reject(new Error('Failed to load Google Identity Services'));
    };
    document.head.appendChild(script);
  });
}

/**
 * Load Google Picker API script dynamically
 */
export function loadPickerScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log('[GoogleDrivePicker] Loading Picker script...');
    if (typeof window !== 'undefined' && window.google?.picker) {
      console.log('[GoogleDrivePicker] Picker already loaded');
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      console.log('[GoogleDrivePicker] gapi script loaded, loading picker API...');
      // Need to explicitly load the picker API using gapi.load()
      window.gapi!.load('picker', () => {
        console.log('[GoogleDrivePicker] Picker API loaded successfully');
        if (window.google?.picker) {
          resolve();
        } else {
          console.error('[GoogleDrivePicker] Picker API not available after load');
          reject(new Error('Google Picker API failed to initialize'));
        }
      });
    };
    script.onerror = () => {
      console.error('[GoogleDrivePicker] Failed to load Picker script');
      reject(new Error('Failed to load Google Picker API'));
    };
    document.head.appendChild(script);
  });
}

/**
 * Get OAuth token using Google Identity Services
 * Scopes: drive.readonly for selecting files, drive.file for creating files
 */
export function getOAuthToken(clientId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    console.log('[GoogleDrivePicker] Requesting OAuth token...');
    const tokenClient = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file',
      callback: (response) => {
        console.log('[GoogleDrivePicker] OAuth callback received:', response);
        if (response.access_token) {
          console.log('[GoogleDrivePicker] OAuth token received successfully');
          resolve(response.access_token);
        } else {
          console.error('[GoogleDrivePicker] OAuth token request failed:', response);
          reject(new Error(response.error || 'Failed to get OAuth token'));
        }
      },
      error_callback: (error) => {
        console.error('[GoogleDrivePicker] OAuth error callback:', error);
        reject(new Error(error.error || 'OAuth token request failed'));
      },
    });

    tokenClient.requestAccessToken();
  });
}

/**
 * Open Google Picker and return selected file metadata
 * @param viewType - 'docs', 'sheets', or 'all' to filter picker view
 */
export function openGooglePicker(
  accessToken: string,
  apiKey: string,
  viewType: 'docs' | 'sheets' | 'all' = 'all'
): Promise<PickerResult> {
  return new Promise((resolve, reject) => {
    console.log('[GoogleDrivePicker] Opening Google Picker with view:', viewType);
    const picker = window.google!.picker;
    const pickerBuilder = new picker.PickerBuilder();
    
    // Add views based on viewType
    if (viewType === 'docs') {
      pickerBuilder.addView(picker.ViewId.DOCS);
    } else if (viewType === 'sheets') {
      pickerBuilder.addView(picker.ViewId.SPREADSHEETS);
    } else {
      // 'all' - add multiple views
      pickerBuilder
        .addView(picker.ViewId.DOCS)
        .addView(picker.ViewId.SPREADSHEETS)
        .addView(picker.ViewId.PRESENTATIONS)
        .addView(picker.ViewId.FOLDERS);
    }
    
    const builtPicker = pickerBuilder
      .setOAuthToken(accessToken)
      .setDeveloperKey(apiKey)
      .setCallback((data) => {
        console.log('[GoogleDrivePicker] Picker callback received:', data);
        if (data.action === picker.Action.PICKED) {
          const doc = data.docs![0];
          const metadata: DriveFileMetadata = {
            id: doc.id,
            name: doc.name,
            url: doc.url,
            mimeType: doc.mimeType,
          };
          console.log('[GoogleDrivePicker] File picked:', metadata);
          resolve({ action: 'picked', metadata });
        } else if (data.action === picker.Action.CANCEL) {
          console.log('[GoogleDrivePicker] Picker cancelled');
          resolve({ action: 'cancelled' });
        } else {
          console.warn('[GoogleDrivePicker] Unrecognized picker action:', data.action);
          reject(new Error(`Unrecognized Google Picker action: ${data.action}`));
        }
      })
      .build();

    builtPicker.setVisible(true);
  });
}

/**
 * Complete flow: Load scripts, get token, open picker
 * @param viewType - 'docs', 'sheets', or 'all' to filter picker view
 */
export async function pickDriveFile(
  clientId: string,
  apiKey: string,
  viewType: 'docs' | 'sheets' | 'all' = 'all'
): Promise<PickerResult> {
  try {
    console.log('[GoogleDrivePicker] Starting pickDriveFile flow with view:', viewType);
    // Load required scripts
    await Promise.all([loadGIScript(), loadPickerScript()]);
    console.log('[GoogleDrivePicker] Scripts loaded');

    // Get OAuth token
    const accessToken = await getOAuthToken(clientId);
    console.log('[GoogleDrivePicker] Got access token');

    // Open picker
    const result = await openGooglePicker(accessToken, apiKey, viewType);
    return result;
  } catch (error) {
    console.error('[GoogleDrivePicker] Error in pickDriveFile:', error);
    return {
      action: 'cancelled',
      error: error instanceof Error ? error.message : 'Failed to open Google Drive Picker',
    };
  }
}

/**
 * Create a new Google file (Doc or Sheet) via Drive API
 * @param accessToken - OAuth access token
 * @param fileType - 'document' or 'spreadsheet'
 * @param title - Title for the new file
 */
export async function createGoogleFile(
  accessToken: string,
  fileType: 'document' | 'spreadsheet',
  title: string
): Promise<DriveFileMetadata> {
  console.log('[GoogleDrivePicker] Creating Google file:', fileType, title);
  
  const mimeType = fileType === 'document' 
    ? 'application/vnd.google-apps.document'
    : 'application/vnd.google-apps.spreadsheet';
  
  const response = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: title,
      mimeType: mimeType,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to create Google file');
  }

  const data = await response.json();
  console.log('[GoogleDrivePicker] File created:', data);
  
  // Construct the webViewLink URL
  const url = `https://docs.google.com/${fileType === 'document' ? 'document' : 'spreadsheets'}/d/${data.id}/edit`;
  
  return {
    id: data.id,
    name: data.name,
    url: url,
    mimeType: data.mimeType,
  };
}
