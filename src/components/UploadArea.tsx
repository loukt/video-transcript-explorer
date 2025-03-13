
import { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { uploadVideoToAzure } from "@/lib/azure";
import { Upload, FileVideo, AlertCircle, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface UploadAreaProps {
  onVideoUploaded: () => void;
}

export const UploadArea = ({ onVideoUploaded }: UploadAreaProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileUpload(e.target.files[0]);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!file.type.includes('video/')) {
      toast({
        title: "Invalid file type",
        description: "Please upload a video file",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setErrorMsg(null);
    setIsOfflineMode(false);

    try {
      const video = await uploadVideoToAzure(file, (progress) => {
        setUploadProgress(progress);
      });
      
      if (video.status === 'error') {
        setIsOfflineMode(true);
        setErrorMsg("Could not connect to Azure services. Operating in offline mode.");
        
        toast({
          title: "Upload processed locally",
          description: "Azure services unavailable - using local processing",
          variant: "default"
        });
      } else {
        toast({
          title: "Upload successful",
          description: "Your video is now being processed"
        });
      }
      
      onVideoUploaded();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      setErrorMsg(errorMessage);
      setIsOfflineMode(true);
      
      toast({
        title: "Upload failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const resetUpload = () => {
    setErrorMsg(null);
    setUploadProgress(0);
    setIsOfflineMode(false);
  };

  return (
    <Card className={`glass-panel w-full max-w-2xl mx-auto transition-all duration-300 transform ${isDragging ? 'scale-[1.02] shadow-lg' : ''}`}>
      <CardContent className="p-6">
        {errorMsg ? (
          <div className="space-y-4">
            <Alert variant={isOfflineMode ? "default" : "destructive"}>
              {isOfflineMode ? <Info className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              <AlertTitle>{isOfflineMode ? "Offline Mode" : "Upload Error"}</AlertTitle>
              <AlertDescription>
                {errorMsg}
              </AlertDescription>
            </Alert>
            <p className="text-sm text-muted-foreground">
              {isOfflineMode 
                ? "We're currently processing your video locally. Some features may be limited."
                : "We couldn't process your video. Please try again later."
              }
            </p>
            <div className="flex justify-end">
              <Button variant="outline" onClick={resetUpload}>
                OK
              </Button>
            </div>
          </div>
        ) : (
          <div
            className={`relative rounded-lg border-2 border-dashed p-10 transition-all duration-300 ${
              isDragging ? 'border-primary bg-primary/5' : 'border-muted'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <div className={`rounded-full p-4 bg-secondary transition-all duration-300 ${isDragging ? 'bg-primary/10' : ''}`}>
                {isUploading ? (
                  <FileVideo className="h-10 w-10 text-primary animate-pulse-subtle" />
                ) : (
                  <Upload className={`h-10 w-10 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
                )}
              </div>
              
              <div className="space-y-2">
                <h3 className="text-lg font-medium">
                  {isUploading ? "Uploading video..." : "Upload a video for analysis"}
                </h3>
                
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                  {isUploading 
                    ? "Please wait while we process your video" 
                    : "Drag and drop a video file here, or click browse to select one"}
                </p>
              </div>

              {isUploading ? (
                <div className="w-full space-y-2">
                  <Progress value={uploadProgress} className="h-2 w-full" />
                  <p className="text-xs text-muted-foreground">{uploadProgress}% uploaded</p>
                </div>
              ) : (
                <Button 
                  variant="secondary" 
                  onClick={handleBrowseClick}
                  className="relative overflow-hidden group"
                >
                  <span className="relative z-10">Browse files</span>
                </Button>
              )}
              
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={handleFileChange}
                disabled={isUploading}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default UploadArea;
