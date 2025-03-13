import { Transcript } from "../types";
import { mockTranscripts } from "./config";

// Process transcript from API response
export const processTranscriptFromResponse = (videoId: string, apiResponse: any): Transcript => {
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
export const formatVttTime = (ms: number): string => {
  if (!ms && ms !== 0) return "00:00:00.000";
  
  const totalSeconds = ms / 1000;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const milliseconds = Math.floor(ms % 1000);
  
  return `${padZero(hours)}:${padZero(minutes)}:${padZero(seconds)}.${padZero(milliseconds, 3)}`;
};

// Format milliseconds to SRT time format (HH:MM:SS,mmm)
export const formatSrtTime = (ms: number): string => {
  if (!ms && ms !== 0) return "00:00:00,000";
  
  const totalSeconds = ms / 1000;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const milliseconds = Math.floor(ms % 1000);
  
  return `${padZero(hours)}:${padZero(minutes)}:${padZero(seconds)},${padZero(milliseconds, 3)}`;
};

// Pad numbers with leading zeros
export const padZero = (num: number, length = 2): string => {
  return num.toString().padStart(length, '0');
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
export const convertVttToSrt = (vttContent: string): string => {
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
