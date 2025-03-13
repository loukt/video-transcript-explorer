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
  try {
    // Update to processing status
    let updatedVideo: Video = { 
      ...video, 
      status: 'processing', 
      processingProgress: 0 
    };
    
    mockVideos = mockVideos.map(v => v.id === video.id ? updatedVideo : v);
    
    // Start the Analysis Job
    const analysisJobResponse = await startAnalysisJob(video.blobUrl);
    
    if (!analysisJobResponse || !analysisJobResponse.id) {
      throw new Error("Failed to start analysis job");
    }

    const jobId = analysisJobResponse.id;
    
    // Poll for job completion
    let isCompleted = false;
    let processingProgress = 0;
    
    while (!isCompleted) {
      // Increment progress estimation
      processingProgress += Math.min(5, 100 - processingProgress); 
      
      // Update video processing status
      updatedVideo = { 
        ...updatedVideo, 
        processingProgress: Math.min(Math.round(processingProgress), 95) // max 95% until confirmed completion
      };
      
      mockVideos = mockVideos.map(v => v.id === video.id ? updatedVideo : v);

      // Check job status
      const analysisResult = await getAnalysisJobResult(jobId);
      
      if (analysisResult?.status === "Succeeded") {
        isCompleted = true;
        
        // Process and save the transcript
        const transcript = processTranscriptFromResponse(video.id, analysisResult);
        
        // Save transcript to CosmosDB
        await saveTranscriptToCosmosDB(transcript);
        
        // Update video to completed status
        const completedVideo: Video = { 
          ...updatedVideo, 
          status: 'completed', 
          processingProgress: 100 
        };
        
        mockVideos = mockVideos.map(v => v.id === video.id ? completedVideo : v);
        
        toast({
          title: "Processing complete",
          description: `Transcript for "${video.name}" is ready.`
        });
        
        return completedVideo;
      } else if (analysisResult?.status === "Failed") {
        throw new Error("Azure AI analysis job failed");
      }
      
      // Wait before polling again
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    throw new Error("Analysis job didn't complete as expected");
  } catch (error) {
    console.error("Error in video processing:", error);
    
    // Update video to error status
    const errorVideo: Video = { 
      ...video, 
      status: 'error', 
      processingProgress: 0 
    };
    
    mockVideos = mockVideos.map(v => v.id === video.id ? errorVideo : v);
    
    toast({
      title: "Processing failed",
      description: `Failed to process "${video.name}". ${error instanceof Error ? error.message : 'Unknown error'}`,
      variant: "destructive"
    });
    
    throw error;
  }
};

// Start an analysis job with Azure AI Content Understanding
const startAnalysisJob = async (videoUrl: string): Promise<any> => {
  try {
    const response = await fetch(`${AZURE_AI.endpoint}/content-understanding/analyzers/${ANALYZER_ID}:analyze?api-version=${API_VERSION}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Ocp-Apim-Subscription-Key': AZURE_AI.apiKey
      },
      body: JSON.stringify({
        analysisInput: {
          sources: [{
            uri: videoUrl
          }]
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Azure API error: ${response.status} ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error starting Azure AI analysis job:", error);
    throw error;
  }
};

// Get analysis job result
const getAnalysisJobResult = async (jobId: string): Promise<any> => {
  try {
    const response = await fetch(`${AZURE_AI.endpoint}/content-understanding/analyzers/${ANALYZER_ID}/analyzes/${jobId}?api-version=${API_VERSION}`, {
      method: 'GET',
      headers: {
        'Ocp-Apim-Subscription-Key': AZURE_AI.apiKey
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Azure API error: ${response.status} ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error getting Azure AI analysis result:", error);
    throw error;
  }
};

// Process transcript from API response
const processTranscriptFromResponse = (videoId: string, apiResponse: any): Transcript => {
  // Extract transcript content from the API response
  const contents = apiResponse.result?.contents || [];
  
  // Process the transcript phrases from all content sections
  const allPhrases: any[] = [];
  
  contents.forEach((content: any) => {
    if (content.transcriptPhrases && content.transcriptPhrases.length > 0) {
      content.transcriptPhrases.forEach((phrase: any) => {
        if (phrase.text && phrase.text.trim() && phrase.startTimeMs !== undefined) {
          allPhrases.push(phrase);
        }
      });
    }
  });
  
  // Sort phrases by start time
  allPhrases.sort((a, b) => a.startTimeMs - b.startTimeMs);
  
  // Create formatted text content
  let textContent = "WEBVTT\n\n";
  allPhrases.forEach((phrase, index) => {
    if (phrase.startTimeMs !== undefined && phrase.endTimeMs !== undefined) {
      const startTime = formatVttTime(phrase.startTimeMs);
      const endTime = formatVttTime(phrase.endTimeMs);
      
      textContent += `${startTime} --> ${endTime}\n`;
      if (phrase.speaker) {
        textContent += `<v ${phrase.speaker}>\n`;
      }
      textContent += `${phrase.text}\n\n`;
    }
  });
  
  // Create raw data for SRT conversion
  const rawData = {
    phrases: allPhrases,
    apiResponse: apiResponse
  };
  
  // Create transcript object
  const transcript: Transcript = {
    videoId: videoId,
    content: textContent,
    rawData: JSON.stringify(rawData),
    language: allPhrases.length > 0 ? (allPhrases[0].locale || 'en') : 'en',
    createdAt: new Date()
  };
  
  // Save to local cache
  mockTranscripts.push(transcript);
  
  return transcript;
};

// Format milliseconds to VTT time format (HH:MM:SS.mmm)
const formatVttTime = (ms: number): string => {
  if (!ms && ms !== 0) return "00:00:00.000";
  
  const totalSeconds = ms / 1000;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const milliseconds = Math.floor(ms % 1000);
  
  return `${padZero(hours)}:${padZero(minutes)}:${padZero(seconds)}.${padZero(milliseconds, 3)}`;
};

// Format milliseconds to SRT time format (HH:MM:SS,mmm)
const formatSrtTime = (ms: number): string => {
  if (!ms && ms !== 0) return "00:00:00,000";
  
  const totalSeconds = ms / 1000;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const milliseconds = Math.floor(ms % 1000);
  
  return `${padZero(hours)}:${padZero(minutes)}:${padZero(seconds)},${padZero(milliseconds, 3)}`;
};

// Pad numbers with leading zeros
const padZero = (num: number, length = 2): string => {
  return num.toString().padStart(length, '0');
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

// Convert transcript to SRT format
export const convertToSrt = (transcript: Transcript): string => {
  try {
    // Try to parse the raw data
    if (!transcript.rawData) {
      // If no raw data, convert from VTT format
      return convertVttToSrt(transcript.content);
    }
    
    const rawData = JSON.parse(transcript.rawData);
    const phrases = rawData.phrases || [];
    
    let srtContent = '';
    phrases.sort((a: any, b: any) => a.startTimeMs - b.startTimeMs);
    
    phrases.forEach((phrase: any, index: number) => {
      if (phrase.startTimeMs !== undefined && phrase.endTimeMs !== undefined && phrase.text) {
        // Add index
        srtContent += `${index + 1}\n`;
        
        // Add timecode
        const startTime = formatSrtTime(phrase.startTimeMs);
        const endTime = formatSrtTime(phrase.endTimeMs);
        srtContent += `${startTime} --> ${endTime}\n`;
        
        // Add text with speaker if available
        if (phrase.speaker) {
          srtContent += `[${phrase.speaker}] ${phrase.text}\n\n`;
        } else {
          srtContent += `${phrase.text}\n\n`;
        }
      }
    });
    
    return srtContent || convertVttToSrt(transcript.content);
  } catch (error) {
    console.error("Error converting to SRT:", error);
    return convertVttToSrt(transcript.content);
  }
};

// Convert VTT format to SRT as fallback
const convertVttToSrt = (vttContent: string): string => {
  if (!vttContent) return '';
  
  // Remove VTT header
  let content = vttContent.replace(/^WEBVTT\n/, '');
  
  // Split into cues
  const cues = content.trim().split(/\n\n+/);
  
  let srtContent = '';
  let index = 1;
  
  cues.forEach(cue => {
    // Skip empty cues
    if (!cue.trim()) return;
    
    const lines = cue.trim().split('\n');
    
    // Check if this looks like a cue with timing
    const timingLine = lines.find(line => line.includes(' --> '));
    if (!timingLine) return;
    
    // Convert timing from VTT to SRT format
    const srtTiming = timingLine.replace(/\./g, ',');
    
    // Remove <v Speaker> tags but keep speaker info in brackets
    let textContent = '';
    for (let i = 0; i < lines.length; i++) {
      if (lines[i] === timingLine) continue;
      
      let line = lines[i];
      const speakerMatch = line.match(/<v\s+([^>]+)>/);
      
      if (speakerMatch) {
        // Extract speaker and add as prefix in brackets
        const speaker = speakerMatch[1].trim();
        line = line.replace(/<v\s+[^>]+>/, `[${speaker}] `);
      }
      
      textContent += line + '\n';
    }
    
    // Add to SRT content
    srtContent += `${index}\n${srtTiming}\n${textContent.trim()}\n\n`;
    index++;
  });
  
  return srtContent;
};

// Download the transcript as a text file
export const downloadTranscript = (videoId: string, videoName: string, format = 'txt'): void => {
  const transcript = getTranscript(videoId);
  
  if (!transcript) {
    toast({
      title: "Transcript not found",
      description: "The transcript for this video is not available",
      variant: "destructive"
    });
    return;
  }
  
  let content = transcript.content;
  let extension = 'txt';
  let mimeType = 'text/plain';
  
  // Convert to SRT format if requested
  if (format === 'srt') {
    content = convertToSrt(transcript);
    extension = 'srt';
  }
  
  // Create a blob from the transcript text
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  
  // Create a link element and trigger download
  const a = document.createElement('a');
  a.href = url;
  a.download = `${videoName.replace(/\.[^/.]+$/, '')}_transcript.${extension}`;
  document.body.appendChild(a);
  a.click();
  
  // Clean up
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
