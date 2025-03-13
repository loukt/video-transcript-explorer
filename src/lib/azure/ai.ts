
import { Video, Transcript } from "../types";
import { AZURE_AI, ANALYZER_ID, API_VERSION, mockVideos, mockTranscripts } from "./config";
import { saveTranscriptToCosmosDB } from "./storage";
import { processTranscriptFromResponse } from "./transcript";
import { toast } from "@/hooks/use-toast";

// Process the video with Azure AI Content Understanding
export const processVideo = async (video: Video): Promise<Video> => {
  try {
    // Update to processing status
    let updatedVideo: Video = { 
      ...video, 
      status: 'processing', 
      processingProgress: 0 
    };
    
    // Update in mock videos
    const index = mockVideos.findIndex(v => v.id === video.id);
    if (index !== -1) {
      mockVideos[index] = updatedVideo;
    }
    
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
      
      // Update in mock videos
      const videoIndex = mockVideos.findIndex(v => v.id === video.id);
      if (videoIndex !== -1) {
        mockVideos[videoIndex] = updatedVideo;
      }

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
        
        // Update in mock videos
        const finalIndex = mockVideos.findIndex(v => v.id === video.id);
        if (finalIndex !== -1) {
          mockVideos[finalIndex] = completedVideo;
        }
        
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
    
    // Update in mock videos
    const errorIndex = mockVideos.findIndex(v => v.id === video.id);
    if (errorIndex !== -1) {
      mockVideos[errorIndex] = errorVideo;
    }
    
    toast({
      title: "Processing failed",
      description: `Failed to process "${video.name}". ${error instanceof Error ? error.message : 'Unknown error'}`,
      variant: "destructive"
    });
    
    throw error;
  }
};

// Start an analysis job with Azure AI Content Understanding
export const startAnalysisJob = async (videoUrl: string): Promise<any> => {
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
export const getAnalysisJobResult = async (jobId: string): Promise<any> => {
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
