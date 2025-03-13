
export interface Video {
  id: string;
  name: string;
  uploadDate: Date;
  blobUrl: string;
  thumbnailUrl?: string;
  duration?: number;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  uploadProgress?: number;
  processingProgress?: number;
}

export interface Transcript {
  videoId: string;
  content: string;
  rawData?: string; // Raw API response data for advanced processing
  language?: string;
  createdAt: Date;
}

// Azure Configuration Interfaces
export interface AzureStorageConfig {
  accountName: string;
  accountKey: string;
  containerName: string;
}

export interface AzureAIConfig {
  endpoint: string;
  apiKey: string;
  region: string;
}

export interface AzureCosmosConfig {
  endpoint: string;
  key: string;
  databaseName: string;
  containerName: string;
}
