
import { toast } from "@/hooks/use-toast";
import { Video, Transcript } from "./types";

// Mock Azure storage account connection string - would be stored in env variables in production
const MOCK_AZURE_STORAGE = {
  accountName: 'mockblobstorage',
  containerName: 'videos'
};

// Mock Azure AI Content Understanding API endpoint - would be stored in env variables in production
const MOCK_AZURE_AI = {
  endpoint: 'https://api.cognitive.microsoft.com/contentunderstanding/v1.0',
  apiKey: 'mock-api-key'
};

// Mock database for our app until we integrate a real database
let mockVideos: Video[] = [];
let mockTranscripts: Transcript[] = [];

// Upload a video to Azure Blob Storage (mock implementation)
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

    // Create a mock video object
    const videoId = `video-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const video: Video = {
      id: videoId,
      name: file.name,
      uploadDate: new Date(),
      blobUrl: URL.createObjectURL(file),
      status: 'uploading',
      uploadProgress: 0
    };

    // Add to our mock database
    mockVideos.push(video);

    // Simulate upload progress
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 15;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        
        // Update video status after upload
        const updatedVideo = { ...video, status: 'processing', uploadProgress: 100 };
        mockVideos = mockVideos.map(v => v.id === videoId ? updatedVideo : v);
        
        // Begin processing
        processVideo(updatedVideo)
          .then(processedVideo => {
            resolve(processedVideo);
          })
          .catch(error => {
            reject(error);
          });
      }
      
      // Update progress in our mock database
      const updatedVideo = { ...video, uploadProgress: Math.min(Math.round(progress), 100) };
      mockVideos = mockVideos.map(v => v.id === videoId ? updatedVideo : v);
      
      // Report progress
      onProgress(Math.min(Math.round(progress), 100));
    }, 500);
  });
};

// Process the video with Azure AI Content Understanding (mock implementation)
export const processVideo = async (video: Video): Promise<Video> => {
  return new Promise((resolve, reject) => {
    // Start with 0% processing
    let processingProgress = 0;
    const interval = setInterval(() => {
      processingProgress += Math.random() * 10;
      
      if (processingProgress >= 100) {
        processingProgress = 100;
        clearInterval(interval);
        
        // Generate a mock transcript
        const transcript: Transcript = {
          videoId: video.id,
          content: generateMockTranscript(video.name),
          language: 'en',
          createdAt: new Date()
        };
        
        // Save transcript to our mock database
        mockTranscripts.push(transcript);
        
        // Update video status
        const completedVideo = { 
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
      }
      
      // Update processing progress
      const updatedVideo = { 
        ...video, 
        processingProgress: Math.min(Math.round(processingProgress), 100) 
      };
      
      mockVideos = mockVideos.map(v => 
        v.id === video.id ? updatedVideo : v
      );
    }, 700);
  });
};

// Get all videos from our mock database
export const getAllVideos = (): Video[] => {
  return [...mockVideos].sort((a, b) => 
    b.uploadDate.getTime() - a.uploadDate.getTime()
  );
};

// Get transcript for a video
export const getTranscript = (videoId: string): Transcript | undefined => {
  return mockTranscripts.find(t => t.videoId === videoId);
};

// Helper function to generate mock transcript text based on the video name
function generateMockTranscript(videoName: string): string {
  return `This is a simulated transcript for the video titled "${videoName}".
  
In a real application, this text would be generated by Azure AI Content Understanding API.

The transcript would contain time-coded text of all spoken content in the video.

00:00:05 - Introduction to the topic
00:01:15 - Key points discussed by the speaker
00:03:22 - Detailed explanation of the subject matter
00:05:47 - Summary of main ideas
00:07:30 - Conclusion and next steps

This mock transcript is provided for demonstration purposes only.`;
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
