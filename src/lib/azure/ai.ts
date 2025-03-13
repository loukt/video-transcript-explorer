import { Video, Transcript } from "../types";
import { AZURE_AI, ANALYZER_ID, API_VERSION, mockVideos, mockTranscripts } from "./config";
import { saveTranscriptToCosmosDB } from "./storage";
import { processTranscriptFromResponse } from "./transcript";
import { toast } from "@/hooks/use-toast";

// Process the video with Azure AI Content Understanding
export const processVideo = async (video: Video): Promise<Video> => {
  try {
    // If the video was uploaded in error state (offline mode),
    // skip Azure processing and create a mock transcript
    if (video.status === 'error') {
      const mockTranscript: Transcript = {
        videoId: video.id,
        content: "This is a placeholder transcript for local processing mode.",
        rawData: JSON.stringify({
          id: video.id,
          status: "Succeeded",
          result: {
            contents: []
          }
        }),
        createdAt: new Date()
      };
      
      // Save mock transcript
      mockTranscripts.push(mockTranscript);
      
      // Update video to completed status
      const completedVideo: Video = { 
        ...video, 
        status: 'completed', 
        processingProgress: 100 
      };
      
      // Update in mock videos
      const finalIndex = mockVideos.findIndex(v => v.id === video.id);
      if (finalIndex !== -1) {
        mockVideos[finalIndex] = completedVideo;
      }
      
      toast({
        title: "Local processing complete",
        description: `Local placeholder transcript for "${video.name}" is ready.`
      });
      
      return completedVideo;
    }
    
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
    
    // Create a mock transcript for error cases
    const mockTranscript: Transcript = {
      videoId: video.id,
      content: "This transcript could not be generated due to an error in processing.",
      rawData: JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      createdAt: new Date()
    };
    
    // Save mock transcript
    mockTranscripts.push(mockTranscript);
    
    // Update video to error status but mark as completed so the user can still view the error transcript
    const errorVideo: Video = { 
      ...video, 
      status: 'completed', 
      processingProgress: 100 
    };
    
    // Update in mock videos
    const errorIndex = mockVideos.findIndex(v => v.id === video.id);
    if (errorIndex !== -1) {
      mockVideos[errorIndex] = errorVideo;
    }
    
    toast({
      title: "Processing completed with errors",
      description: `Processed "${video.name}" with limited functionality.`,
      variant: "destructive"
    });
    
    return errorVideo;
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
