
import { useState, useEffect } from "react";
import UploadArea from "@/components/UploadArea";
import VideoSidebar from "@/components/VideoSidebar";
import TranscriptViewer from "@/components/TranscriptViewer";
import { Video } from "@/lib/types";
import { getAllVideos } from "@/lib/azure";

const Index = () => {
  const [selectedVideo, setSelectedVideo] = useState<Video | undefined>();
  const [videos, setVideos] = useState<Video[]>([]);

  useEffect(() => {
    // Get initial videos
    const initialVideos = getAllVideos();
    setVideos(initialVideos);
    
    // Select the first video if available
    if (initialVideos.length > 0) {
      setSelectedVideo(initialVideos[0]);
    }
  }, []);

  const handleVideoSelected = (video: Video) => {
    setSelectedVideo(video);
  };

  const handleVideoUploaded = () => {
    // Refresh video list
    const updatedVideos = getAllVideos();
    setVideos(updatedVideos);
    
    // Select the newest video (first in the sorted list)
    if (updatedVideos.length > 0) {
      setSelectedVideo(updatedVideos[0]);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="glass-panel z-10 py-4 px-6 border-b">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-medium flex items-center space-x-2">
            <span className="bg-azure text-white p-1 rounded">AI</span>
            <span>Video Transcript Explorer</span>
          </h1>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col md:flex-row p-4 md:p-6 gap-6 overflow-hidden">
        {/* No videos state */}
        {videos.length === 0 ? (
          <div className="w-full flex-1 flex flex-col items-center justify-center p-6">
            <div className="max-w-2xl w-full mx-auto space-y-8">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-medium mb-2">Welcome to Video Transcript Explorer</h2>
                <p className="text-muted-foreground">
                  Upload a video to get started. We'll analyze it with Azure AI and generate a transcript.
                </p>
              </div>
              
              <UploadArea onVideoUploaded={handleVideoUploaded} />
            </div>
          </div>
        ) : (
          /* Videos exist state */
          <div className="w-full flex-1 flex flex-col md:flex-row space-y-6 md:space-y-0 md:space-x-6">
            {/* Left content (transcript and upload) */}
            <div className="flex-1 flex flex-col space-y-6 min-w-0">
              {/* Transcript viewer */}
              <div className="flex-1">
                <TranscriptViewer video={selectedVideo} />
              </div>
              
              {/* Upload new video */}
              <div className="hidden md:block">
                <UploadArea onVideoUploaded={handleVideoUploaded} />
              </div>
            </div>
            
            {/* Right sidebar (video list) */}
            <div className="order-first md:order-last">
              <VideoSidebar 
                onSelectVideo={handleVideoSelected} 
                selectedVideoId={selectedVideo?.id}
              />
            </div>
          </div>
        )}
      </main>
      
      {/* Mobile upload button when videos exist */}
      {videos.length > 0 && (
        <div className="md:hidden p-4 border-t glass-panel">
          <UploadArea onVideoUploaded={handleVideoUploaded} />
        </div>
      )}
    </div>
  );
};

export default Index;
