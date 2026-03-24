/**
 * Types for Pocketz Worker
 */

export interface DownloadJob {
  type: 'download_job';
  id: string;
  url: string;
  timestamp: string;
}

export interface DownloadStartedMessage {
  type: 'download_started';
  jobId: string;
  timestamp: string;
}

export interface DownloadCompletedMessage {
  type: 'download_completed';
  jobId: string;
  timestamp: string;
  success: boolean;
  error?: string;
  pocketzDirectoryName?: string;
}

export type ServerMessage = DownloadJob;
export type WorkerMessage = DownloadStartedMessage | DownloadCompletedMessage;

export interface ProcessJobResult {
  success: boolean;
  error?: string;
  pocketzDirectoryName?: string;
}
