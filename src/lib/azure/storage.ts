import { BlobServiceClient } from "@azure/storage-blob";
import { AZURE_STORAGE, AZURE_SAS_TOKEN, mockVideos } from "./config";
import { Video } from "../types";
import { v4 as generateUUID } from 'uuid';

// Get BlobServiceClient instance
const blobServiceClient = new BlobServiceClient(
  `https://${AZURE_STORAGE.accountName}.blob.core.windows.net${AZURE_SAS_TOKEN}`
);

// Get BlobContainerClient instance
const containerClient = blobServiceClient.getContainerClient(AZURE_STORAGE.containerName);

// Get BlockBlobClient instance
const getBlobClient = (blobName: string) => {
  return containerClient.getBlockBlobClient(blobName);
};

// Upload a video to Azure Blob Storage
export const uploadVideoToAzure = async (
  file: File,
  onProgress?: (progress: number) => void
): Promise<Video> => {
  try {
    // Generate a unique ID for the video
    const videoId = generateUUID();
    
    // Create a reference to the blob
    const blobName = `${videoId}-${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
    const blobUrl = `https://${AZURE_STORAGE.accountName}.blob.core.windows.net/${AZURE_STORAGE.containerName}/${blobName}`;
    
    // Show initial progress
    if (onProgress) onProgress(0);
    
    const blockBlobClient = getBlobClient(blobName);
    
    // Upload the file to Azure Blob Storage
    await blockBlobClient.uploadData(await file.arrayBuffer(), {
      onProgress: ({ loadedBytes }) => {
        const progress = Math.round((loadedBytes / file.size) * 100);
        if (onProgress) onProgress(progress);
      },
    });
    
    // Create the video object
    const video: Video = {
      id: videoId,
      name: file.name,
      uploadDate: new Date(),
      blobUrl,
      status: 'uploading',
      uploadProgress: 100,
      processingProgress: 0
    };
    
    // Update in-memory videos
    mockVideos.unshift(video);
    
    return video;
  } catch (error) {
    console.error("Error uploading to Azure:", error);
    return simulateUpload(file, onProgress);
  }
};

// Fallback function to simulate upload when Azure is unavailable
const simulateUpload = async (
  file: File, 
  onProgress?: (progress: number) => void
): Promise<Video> => {
  // Show initial progress
  if (onProgress) onProgress(0);
  
  // Generate a unique ID for the video
  const videoId = generateUUID();
  
  // Simulate upload progress
  let progress = 0;
  const interval = setInterval(() => {
    progress += 10;
    if (onProgress) onProgress(Math.min(progress, 100));
    if (progress >= 100) clearInterval(interval);
  }, 300);
  
  // Wait for "upload" to complete
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Create a local URL for the file
  const blobUrl = URL.createObjectURL(file);
  
  // Create the video object with local URL
  const video: Video = {
    id: videoId,
    name: file.name,
    uploadDate: new Date(),
    blobUrl,
    status: 'error', // Mark status as error since we couldn't upload to Azure
    uploadProgress: 100,
    processingProgress: 0
  };
  
  // Update in-memory videos
  mockVideos.unshift(video);
  
  return video;
};

// Save transcript to CosmosDB (currently a mock implementation)
export const saveTranscriptToCosmosDB = async (transcript: any): Promise<void> => {
  console.log("Transcript saved to CosmosDB (mock):", transcript);
};
