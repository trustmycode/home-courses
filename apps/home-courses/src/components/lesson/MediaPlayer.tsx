"use client";

import { useState } from "react";
import { AlertCircle, RefreshCw, Headphones } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AssetMeta } from "@/lib/content";
import { mediaUrl } from "@/lib/media";

interface MediaPlayerProps {
  videoAsset?: AssetMeta;
  audioAsset?: AssetMeta;
  savedPosition?: number;
}

export function MediaPlayer({ videoAsset, audioAsset, savedPosition }: MediaPlayerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [activeTab, setActiveTab] = useState<string>(videoAsset ? "video" : "audio");

  const handleVideoLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleVideoError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  const handleRetry = () => {
    setHasError(false);
    setIsLoading(true);
  };

  if (!videoAsset && !audioAsset) {
    return null;
  }

  const showTabs = videoAsset && audioAsset;

  return (
    <Card className="overflow-hidden bg-card border-border shadow-lg">
      {showTabs ? (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex items-center justify-between px-4 pt-3">
            <TabsList className="h-9">
              <TabsTrigger value="video" className="text-sm">Video</TabsTrigger>
              <TabsTrigger value="audio" className="text-sm">Audio Only</TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="video" className="mt-0">
            <VideoContent 
              videoAsset={videoAsset}
              isLoading={isLoading}
              hasError={hasError}
              savedPosition={savedPosition}
              onLoad={handleVideoLoad}
              onError={handleVideoError}
              onRetry={handleRetry}
            />
          </TabsContent>
          
          <TabsContent value="audio" className="mt-0">
            <AudioContent audioAsset={audioAsset} />
          </TabsContent>
        </Tabs>
      ) : videoAsset ? (
        <VideoContent 
          videoAsset={videoAsset}
          isLoading={isLoading}
          hasError={hasError}
          savedPosition={savedPosition}
          onLoad={handleVideoLoad}
          onError={handleVideoError}
          onRetry={handleRetry}
        />
      ) : (
        <AudioContent audioAsset={audioAsset} />
      )}
    </Card>
  );
}

interface VideoContentProps {
  videoAsset?: AssetMeta;
  isLoading: boolean;
  hasError: boolean;
  savedPosition?: number;
  onLoad: () => void;
  onError: () => void;
  onRetry: () => void;
}

function VideoContent({ videoAsset, isLoading, hasError, savedPosition, onLoad, onError, onRetry }: VideoContentProps) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!videoAsset) return null;

  const videoSrc = mediaUrl(videoAsset.r2Key);

  return (
    <div className="relative aspect-video bg-foreground/5">
      {isLoading && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-foreground/5">
          <div className="animate-pulse flex flex-col items-center gap-2">
            <div className="h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
            <span className="text-sm text-muted-foreground">Loading video...</span>
          </div>
        </div>
      )}
      
      {hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-foreground/5 gap-4">
          <AlertCircle className="h-12 w-12 text-destructive" />
          <p className="text-sm text-muted-foreground text-center max-w-xs">
            Unable to load video. Please check your connection and try again.
          </p>
          <Button variant="outline" onClick={onRetry}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      )}

      <video
        className="w-full h-full"
        controls
        onLoadedData={onLoad}
        onError={onError}
      >
        <source src={videoSrc} type={videoAsset.mime} />
        Your browser does not support the video tag.
      </video>

      {savedPosition && savedPosition > 0 && (
        <div className="absolute bottom-16 left-4 bg-card/90 backdrop-blur-sm px-3 py-1.5 rounded-lg text-sm text-foreground shadow-md">
          Continue from {formatTime(savedPosition)}
        </div>
      )}
    </div>
  );
}

function AudioContent({ audioAsset }: { audioAsset?: AssetMeta }) {
  if (!audioAsset) return null;

  const audioSrc = mediaUrl(audioAsset.r2Key);

  return (
    <div className="p-6 flex flex-col items-center justify-center min-h-[200px] bg-gradient-to-br from-accent/30 to-accent/10">
      <div className="mb-4 p-4 rounded-full bg-primary/10">
        <Headphones className="h-10 w-10 text-primary" />
      </div>
      <p className="text-sm text-muted-foreground mb-4">Listen to the audio version</p>
      <audio controls className="w-full max-w-md">
        <source src={audioSrc} type={audioAsset.mime} />
        Your browser does not support the audio element.
      </audio>
    </div>
  );
}
