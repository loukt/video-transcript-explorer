
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Video, Transcript } from "@/lib/types";
import { getTranscript, downloadTranscript } from "@/lib/azure";
import { Loader, FileText, Download, Copy, CheckCheck, FileDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface TranscriptViewerProps {
  video?: Video;
}

export const TranscriptViewer = ({ video }: TranscriptViewerProps) => {
  const [transcript, setTranscript] = useState<Transcript | undefined>();
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (video?.id && video.status === 'completed') {
      const videoTranscript = getTranscript(video.id);
      setTranscript(videoTranscript);
    } else {
      setTranscript(undefined);
    }
  }, [video]);

  const handleDownload = (format: 'txt' | 'srt' = 'txt') => {
    if (video?.id) {
      downloadTranscript(video.id, video.name, format);
    }
  };

  const handleCopy = () => {
    if (transcript) {
      navigator.clipboard.writeText(transcript.content)
        .then(() => {
          setCopied(true);
          toast({
            title: "Copied to clipboard",
            description: "Transcript content has been copied"
          });
          setTimeout(() => setCopied(false), 2000);
        })
        .catch(() => {
          toast({
            title: "Copy failed",
            description: "Could not copy transcript to clipboard",
            variant: "destructive"
          });
        });
    }
  };

  if (!video) {
    return (
      <Card className="glass-panel h-full flex items-center justify-center">
        <CardContent className="text-center p-8">
          <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
          <h3 className="text-lg font-medium mb-2">No Video Selected</h3>
          <p className="text-muted-foreground text-sm max-w-md">
            Select a video from the library or upload a new video to view its transcript.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (video.status === 'uploading') {
    return (
      <Card className="glass-panel h-full">
        <CardHeader>
          <CardTitle className="flex items-center">
            <FileText className="h-5 w-5 mr-2" />
            {video.name}
          </CardTitle>
          <CardDescription>
            Uploading video to Azure Blob Storage...
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center p-8 space-y-4">
          <Loader className="h-12 w-12 text-primary animate-spin-slow" />
          <Progress value={video.uploadProgress} className="w-full max-w-md h-2" />
          <p className="text-muted-foreground text-sm">
            {video.uploadProgress}% uploaded
          </p>
        </CardContent>
      </Card>
    );
  }

  if (video.status === 'processing') {
    return (
      <Card className="glass-panel h-full">
        <CardHeader>
          <CardTitle className="flex items-center">
            <FileText className="h-5 w-5 mr-2" />
            {video.name}
          </CardTitle>
          <CardDescription>
            Generating transcript with Azure AI Content Understanding...
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center p-8 space-y-4">
          <div className="relative">
            <Loader className="h-12 w-12 text-primary animate-spin-slow" />
            <FileText className="h-6 w-6 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-primary/70" />
          </div>
          <Progress value={video.processingProgress} className="w-full max-w-md h-2" />
          <p className="text-muted-foreground text-sm">
            {video.processingProgress}% processed
          </p>
        </CardContent>
      </Card>
    );
  }

  if (video.status === 'error') {
    return (
      <Card className="glass-panel h-full">
        <CardHeader>
          <CardTitle className="flex items-center text-destructive">
            <FileText className="h-5 w-5 mr-2" />
            {video.name}
          </CardTitle>
          <CardDescription>
            Error processing this video
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center p-8">
          <p className="text-muted-foreground text-center">
            There was an error processing this video. Please try uploading it again.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!transcript) {
    return (
      <Card className="glass-panel h-full">
        <CardHeader>
          <CardTitle className="flex items-center">
            <FileText className="h-5 w-5 mr-2" />
            {video.name}
          </CardTitle>
          <CardDescription>
            Transcript not found
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center p-8">
          <p className="text-muted-foreground text-center">
            The transcript for this video could not be found.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-panel h-full flex flex-col animate-scale-in">
      <CardHeader>
        <CardTitle className="flex items-center">
          <FileText className="h-5 w-5 mr-2" />
          {video.name}
        </CardTitle>
        <CardDescription>
          Transcript generated by Azure AI Content Understanding
        </CardDescription>
      </CardHeader>
      
      <Separator />
      
      <ScrollArea className="flex-1 p-4">
        <div className="whitespace-pre-line font-mono text-sm bg-muted/30 p-4 rounded-lg">
          {transcript.content}
        </div>
      </ScrollArea>
      
      <Separator className="my-2" />
      
      <CardFooter className="flex justify-between p-4">
        <Button variant="outline" size="sm" onClick={handleCopy}>
          {copied ? <CheckCheck className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
          {copied ? "Copied" : "Copy Text"}
        </Button>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="smooth-transition">
              <Download className="h-4 w-4 mr-2" />
              Download Transcript
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleDownload('txt')}>
              <FileText className="h-4 w-4 mr-2" />
              Text Format (.txt)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleDownload('srt')}>
              <FileDown className="h-4 w-4 mr-2" />
              Subtitle Format (.srt)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardFooter>
    </Card>
  );
};

export default TranscriptViewer;
