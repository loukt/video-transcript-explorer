
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
  language?: string;
  createdAt: Date;
}
