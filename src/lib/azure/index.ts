
import { mockVideos, mockTranscripts } from "./config";
import { uploadVideoToAzure } from "./storage";
import { processVideo } from "./ai";
import { convertToSrt } from "./transcript";
import { Video, Transcript } from "../types";
import { toast } from "@/hooks/use-toast";

// Re-export the main functions that are used by components
export { uploadVideoToAzure, processVideo, convertToSrt };

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
