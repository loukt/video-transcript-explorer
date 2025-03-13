
import { BlobServiceClient, ContainerClient } from "@azure/storage-blob";
import { CosmosClient } from "@azure/cosmos";
import { AZURE_STORAGE, AZURE_SAS_TOKEN, AZURE_COSMOS, mockVideos } from "./config";
import { Video, Transcript } from "../types";
import { toast } from "@/hooks/use-toast";
import { processVideo } from "./ai";

// Get blob container client
export const getBlobContainerClient = (): ContainerClient => {
  try {
    const blobServiceClient = new BlobServiceClient(
      `https://${AZURE_STORAGE.accountName}.blob.core.windows.net?${AZURE_SAS_TOKEN}`
    );
    return blobServiceClient.getContainerClient(AZURE_STORAGE.containerName);
  } catch (error) {
    console.error("Error getting blob container client:", error);
    throw new Error("Failed to connect to Azure Storage");
  }
};

// Get Cosmos container client
export const getCosmosContainer = async () => {
  const client = new CosmosClient({ 
    endpoint: AZURE_COSMOS.endpoint, 
    key: AZURE_COSMOS.key 
  });
  
  const database = client.database(AZURE_COSMOS.databaseName);
  return database.container(AZURE_COSMOS.containerName);
};

// Upload a video to Azure Blob Storage
export const uploadVideoToAzure = async (
  file: File, 
  onProgress: (progress: number) => void
): Promise<Video> => {
  return new Promise((resolve, reject) => {
    // Validate file type
    if (!file.type.includes('video/')) {
      toast({
        title: "Invalid file type",
        description: "Please upload a video file",
        variant: "destructive"
      });
      reject(new Error("Invalid file type"));
      return;
    }

    try {
      // Create a video object
      const videoId = `video-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const video: Video = {
        id: videoId,
        name: file.name,
        uploadDate: new Date(),
        blobUrl: URL.createObjectURL(file),
        status: 'uploading',
        uploadProgress: 0
      };

      // Add to our local cache
      mockVideos.push(video);

      // For development/demo purposes, we'll use a fallback approach
      // If Azure blob storage is not available, we'll just simulate uploads
      const simulateUpload = () => {
        let progress = 0;
        const interval = setInterval(() => {
          progress += 10;
          if (progress <= 100) {
            onProgress(progress);
            
            // Update progress in local cache
            const index = mockVideos.findIndex(v => v.id === videoId);
            if (index !== -1) {
              mockVideos[index] = { 
                ...mockVideos[index], 
                uploadProgress: progress,
                status: 'uploading'
              };
            }
          } else {
            clearInterval(interval);
            const updatedVideo: Video = { 
              ...video, 
              status: 'processing', 
              uploadProgress: 100 
            };
            
            const index = mockVideos.findIndex(v => v.id === videoId);
            if (index !== -1) {
              mockVideos[index] = updatedVideo;
            }
            
            processVideo(updatedVideo)
              .then(processedVideo => {
                resolve(processedVideo);
              })
              .catch(error => {
                console.error("Error in processing:", error);
                reject(error);
              });
          }
        }, 300);
      };

      try {
        // Try to get container client
        const containerClient = getBlobContainerClient();
        const blobClient = containerClient.getBlockBlobClient(videoId);

        // Upload the file
        const uploadTask = blobClient.uploadData(file, {
          onProgress: (progressEvent) => {
            const progress = Math.round((progressEvent.loadedBytes / file.size) * 100);
            onProgress(progress);
            
            // Update progress in local cache
            const index = mockVideos.findIndex(v => v.id === videoId);
            if (index !== -1) {
              mockVideos[index] = { 
                ...mockVideos[index], 
                uploadProgress: progress,
                status: 'uploading'
              };
            }
          },
        });

        uploadTask.then(() => {
          // Update video with blob URL
          const blobUrl = blobClient.url;
          const updatedVideo: Video = { 
            ...video, 
            blobUrl,
            status: 'processing', 
            uploadProgress: 100 
          };
          
          // Update in mock videos
          const index = mockVideos.findIndex(v => v.id === videoId);
          if (index !== -1) {
            mockVideos[index] = updatedVideo;
          }
          
          // Begin processing
          processVideo(updatedVideo)
            .then(processedVideo => {
              resolve(processedVideo);
            })
            .catch(error => {
              reject(error);
            });
        }).catch(error => {
          console.error("Error uploading to Azure Blob Storage:", error);
          console.log("Falling back to simulated upload...");
          
          // Fallback to simulated upload
          simulateUpload();
        });
      } catch (error) {
        console.error("Error initializing Azure Blob Storage:", error);
        console.log("Falling back to simulated upload...");
        
        // Fallback to simulated upload
        simulateUpload();
      }
    } catch (error) {
      console.error("Error in upload process:", error);
      reject(error);
    }
  });
};

// Save transcript to CosmosDB
export const saveTranscriptToCosmosDB = async (transcript: Transcript): Promise<void> => {
  try {
    const container = await getCosmosContainer();
    await container.items.create(transcript);
    console.log("Transcript saved to CosmosDB successfully");
  } catch (error) {
    console.error("Error saving to CosmosDB:", error);
    // Still keep in local cache even if CosmosDB fails
  }
};
