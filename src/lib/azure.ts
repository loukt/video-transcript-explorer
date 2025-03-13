import { BlobServiceClient, ContainerClient } from "@azure/storage-blob";
import { toast } from "@/hooks/use-toast";
import { Video, Transcript, AzureStorageConfig, AzureAIConfig, AzureCosmosConfig } from "./types";
import { CosmosClient } from "@azure/cosmos";

// Azure configuration
const AZURE_STORAGE: AzureStorageConfig = {
  accountName: "yscuvideostorage",
  accountKey: "",
  containerName: "videos"
};

// SAS token for Azure Blob Storage
const AZURE_SAS_TOKEN = "sp=racwdli&st=2025-03-13T03:27:16Z&se=2025-12-30T11:27:16Z&spr=https&sv=2022-11-02&sr=c&sig=JrIXtTQa8m%2FSAKu4itjchssjJ01w5EownB37xx2NVos%3D";

// Azure AI Content Understanding configuration
const AZURE_AI: AzureAIConfig = {
  endpoint: "https://ai-yshubaicontentintel279307737903.cognitiveservices.azure.com/",
  apiKey: "cca7a02484284215a9daffab8cf0e701",
  region: "eastus" // Assumed region, update if different
};

const ANALYZER_ID = "TanscriptAnalyzer";
const API_VERSION = "2024-12-01-preview";

// Azure Cosmos DB configuration
const AZURE_COSMOS: AzureCosmosConfig = {
  endpoint: "https://videocucosmosdb.documents.azure.com:443/",
  key: "unakRlhfk1vecTKrVJ2ZBQH0OLWHlQe0DKQbfacp7dUZrv810lYI9TT14zWkyA7yPpKUHfuhBM0lACDbFk94aQ==",
  databaseName: "Videos",
  containerName: "Transcripts"
};

// In-memory cache for videos and transcripts until they're saved to CosmosDB
let mockVideos: Video[] = [];
let mockTranscripts: Transcript[] = [];

// Get blob container client
const getBlobContainerClient = (): ContainerClient => {
  const blobServiceClient = new BlobServiceClient(
    `https://${AZURE_STORAGE.accountName}.blob.core.windows.net?${AZURE_SAS_TOKEN}`
  );
  return blobServiceClient.getContainerClient(AZURE_STORAGE.containerName);
};

// Get Cosmos container client
const getCosmosContainer = async () => {
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

      // Get container client
      const containerClient = getBlobContainerClient();
      const blobClient = containerClient.getBlockBlobClient(videoId);

      // Upload the file
      const uploadTask = blobClient.uploadData(file, {
        onProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loadedBytes / file.size) * 100);
          onProgress(progress);
          
          // Update progress in local cache
          const updatedVideo: Video = { 
            ...video, 
            uploadProgress: progress,
            status: 'uploading'
          };
          mockVideos = mockVideos.map(v => v.id === videoId ? updatedVideo : v);
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
        
        mockVideos = mockVideos.map(v => v.id === videoId ? updatedVideo : v);
        
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
        reject(error);
      });
    } catch (error) {
      console.error("Error in upload process:", error);
      reject(error);
    }
  });
};

// Process the video with Azure AI Content Understanding
export const processVideo = async (video: Video): Promise<Video> => {
  return new Promise((resolve, reject) => {
    try {
      // Start with 0% processing
      let processingProgress = 0;
      const interval = setInterval(() => {
        processingProgress += Math.random() * 10;
        
        if (processingProgress >= 100) {
          processingProgress = 100;
          clearInterval(interval);
          
          // Call Azure AI Content Understanding API
          callAzureAIContentUnderstanding(video)
            .then(transcript => {
              // Save transcript to CosmosDB
              saveTranscriptToCosmosDB(transcript)
                .then(() => {
                  // Update video status
                  const completedVideo: Video = { 
                    ...video, 
                    status: 'completed', 
                    processingProgress: 100 
                  };
                  
                  mockVideos = mockVideos.map(v => 
                    v.id === video.id ? completedVideo : v
                  );
                  
                  toast({
                    title: "Processing complete",
                    description: `Transcript for "${video.name}" is ready.`
                  });
                  
                  resolve(completedVideo);
                })
                .catch(error => {
                  console.error("Error saving transcript to CosmosDB:", error);
                  reject(error);
                });
            })
            .catch(error => {
              console.error("Error calling Azure AI Content Understanding:", error);
              reject(error);
            });
        }
        
        // Update processing progress
        const updatedVideo: Video = { 
          ...video, 
          processingProgress: Math.min(Math.round(processingProgress), 100),
          status: 'processing'
        };
        
        mockVideos = mockVideos.map(v => 
          v.id === video.id ? updatedVideo : v
        );
      }, 700);
    } catch (error) {
      console.error("Error in video processing:", error);
      reject(error);
    }
  });
};

// Call Azure AI Content Understanding API
const callAzureAIContentUnderstanding = async (video: Video): Promise<Transcript> => {
  // In a real implementation, you would:
  // 1. Get the video blob from Azure Blob Storage
  // 2. Send it to Azure AI Content Understanding API
  // 3. Process the response to extract the transcript
  
  // For now, simulate this with a mock transcript
  console.log("Would call Azure AI Content Understanding API with:", {
    endpoint: AZURE_AI.endpoint,
    apiKey: AZURE_AI.apiKey,
    analyzerId: ANALYZER_ID,
    apiVersion: API_VERSION,
    videoUrl: video.blobUrl
  });
  
  // Create mock transcript
  const transcript: Transcript = {
    videoId: video.id,
    content: generateMockTranscript(video.name),
    language: 'en',
    createdAt: new Date()
  };
  
  // Save to local cache
  mockTranscripts.push(transcript);
  
  return transcript;
};

// Save transcript to CosmosDB
const saveTranscriptToCosmosDB = async (transcript: Transcript): Promise<void> => {
  try {
    const container = await getCosmosContainer();
    await container.items.create(transcript);
    console.log("Transcript saved to CosmosDB successfully");
  } catch (error) {
    console.error("Error saving to CosmosDB:", error);
    // Still keep in local cache even if CosmosDB fails
  }
};

// Get all videos from our local cache
export const getAllVideos = (): Video[] => {
  return [...mockVideos].sort((a, b) => 
    b.uploadDate.getTime() - a.uploadDate.getTime()
  );
};

// Get transcript for a video
export const getTranscript = (videoId: string): Transcript | undefined => {
  return mockTranscripts.find(t => t.videoId === videoId);
};

// Helper function to generate mock transcript text
function generateMockTranscript(videoName: string): string {
  return `This is a simulated transcript for the video titled "${videoName}".
  
In a real application, this would be generated by Azure AI Content Understanding API.

The transcript would contain time-coded text of all spoken content in the video.

00:00:05 - Introduction to the topic
00:01:15 - Key points discussed by the speaker
00:03:22 - Detailed explanation of the subject matter
00:05:47 - Summary of main ideas
00:07:30 - Conclusion and next steps`;
}

// Download the transcript as a text file
export const downloadTranscript = (videoId: string, videoName: string): void => {
  const transcript = getTranscript(videoId);
  
  if (!transcript) {
    toast({
      title: "Transcript not found",
      description: "The transcript for this video is not available",
      variant: "destructive"
    });
    return;
  }
  
  // Create a blob from the transcript text
  const blob = new Blob([transcript.content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  
  // Create a link element and trigger download
  const a = document.createElement('a');
  a.href = url;
  a.download = `${videoName.replace(/\.[^/.]+$/, '')}_transcript.txt`;
  document.body.appendChild(a);
  a.click();
  
  // Clean up
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
