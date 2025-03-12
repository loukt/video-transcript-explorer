
import { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { uploadVideoToAzure } from "@/lib/azure";
import { Upload, FileVideo } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface UploadAreaProps {
  onVideoUploaded: () => void;
}

export const UploadArea = ({ onVideoUploaded }: UploadAreaProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
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

    try {
      await uploadVideoToAzure(file, (progress) => {
        setUploadProgress(progress);
      });
      
      toast({
        title: "Upload successful",
        description: "Your video is now being processed"
      });
      
      onVideoUploaded();
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <Card className={`glass-panel w-full max-w-2xl mx-auto transition-all duration-300 transform ${isDragging ? 'scale-[1.02] shadow-lg' : ''}`}>
      <CardContent className="p-6">
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
                  ? "Please wait while we upload your video to Azure" 
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
      </CardContent>
    </Card>
  );
};

export default UploadArea;
