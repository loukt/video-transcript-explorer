
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { 
  Video as VideoIcon, 
  Clock, 
  Calendar, 
  Loader, 
  CheckCircle, 
  AlertCircle,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { Video } from "@/lib/types";
import { getAllVideos } from "@/lib/azure";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

interface VideoSidebarProps {
  onSelectVideo: (video: Video) => void;
  selectedVideoId?: string;
}

export const VideoSidebar = ({ onSelectVideo, selectedVideoId }: VideoSidebarProps) => {
  const [videos, setVideos] = useState<Video[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const isMobile = useIsMobile();
  const mobileCollapsed = isMobile && !collapsed;

  useEffect(() => {
    // Get initial videos
    setVideos(getAllVideos());

    // Poll for updates every 2 seconds (in a real app this would be a subscription or websocket)
    const interval = setInterval(() => {
      setVideos(getAllVideos());
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: Video['status'], progress?: number) => {
    switch (status) {
      case 'uploading':
        return (
          <div className="flex flex-col items-center">
            <Loader className="h-4 w-4 text-blue-500 animate-spin" />
            {progress !== undefined && <span className="text-xs mt-1">{progress}%</span>}
          </div>
        );
      case 'processing':
        return (
          <div className="flex flex-col items-center">
            <Loader className="h-4 w-4 text-amber-500 animate-spin" />
            {progress !== undefined && <span className="text-xs mt-1">{progress}%</span>}
          </div>
        );
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const toggleSidebar = () => setCollapsed(!collapsed);

  // If no videos, show empty state
  if (videos.length === 0 && !collapsed) {
    return (
      <div 
        className={cn(
          "h-full transition-all duration-300 ease-in-out glass-panel",
          collapsed ? "w-12" : "w-80",
          mobileCollapsed && "w-12"
        )}
      >
        <div className="flex h-full">
          <div className="flex-1 flex flex-col h-full">
            {!mobileCollapsed && (
              <div className="p-4 border-b">
                <h2 className="font-medium flex items-center">
                  <VideoIcon className="h-4 w-4 mr-2" />
                  Video Library
                </h2>
              </div>
            )}
            
            <div className="flex-1 flex items-center justify-center p-4 text-center">
              {!mobileCollapsed && (
                <div className="text-muted-foreground text-sm">
                  <VideoIcon className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p>Upload your first video to get started</p>
                </div>
              )}
            </div>
          </div>
          
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-full rounded-none border-l" 
            onClick={toggleSidebar}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={cn(
        "h-full transition-all duration-300 ease-in-out glass-panel",
        collapsed ? "w-12" : "w-80",
        mobileCollapsed && "w-12"
      )}
    >
      <div className="flex h-full">
        <div className="flex-1 flex flex-col h-full">
          {!mobileCollapsed && (
            <div className="p-4 border-b">
              <h2 className="font-medium flex items-center">
                <VideoIcon className="h-4 w-4 mr-2" />
                Video Library
              </h2>
            </div>
          )}
          
          {!mobileCollapsed && (
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-2">
                {videos.map((video) => (
                  <Card 
                    key={video.id}
                    className={cn(
                      "overflow-hidden cursor-pointer hover:shadow-md transition-all duration-200 border",
                      selectedVideoId === video.id ? "border-primary/50 bg-primary/5" : "border-transparent"
                    )}
                    onClick={() => onSelectVideo(video)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start space-x-3">
                        <div className="rounded bg-secondary/80 p-2 flex items-center justify-center">
                          <VideoIcon className="h-4 w-4 text-muted-foreground" />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className="font-medium text-sm truncate">{video.name}</p>
                            <div className="ml-2 flex-shrink-0">
                              {getStatusIcon(
                                video.status, 
                                video.status === 'uploading' 
                                  ? video.uploadProgress 
                                  : video.status === 'processing' 
                                    ? video.processingProgress 
                                    : undefined
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center text-xs text-muted-foreground space-x-2">
                            <span className="flex items-center">
                              <Calendar className="h-3 w-3 mr-1" />
                              {formatDistanceToNow(video.uploadDate, { addSuffix: true })}
                            </span>
                          </div>
                          
                          {(video.status === 'uploading' || video.status === 'processing') && (
                            <Progress 
                              value={video.status === 'uploading' ? video.uploadProgress : video.processingProgress} 
                              className="h-1 mt-2"
                            />
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
        
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-full rounded-none border-l" 
          onClick={toggleSidebar}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
};

export default VideoSidebar;
