"use client";

import { useState, useEffect, useRef } from "react";
import { AlertCircle, RefreshCw, Headphones } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AssetMeta } from "@/lib/content";

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
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [urlLoading, setUrlLoading] = useState(true);
  const [urlError, setUrlError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Загружаем подписанный URL
  useEffect(() => {
    if (!videoAsset) return;

    const loadSignedUrl = async () => {
      try {
        setUrlLoading(true);
        setUrlError(false);
        const response = await fetch(`/api/media-url?key=${encodeURIComponent(videoAsset.r2Key)}`);
        
        if (!response.ok) {
          throw new Error(`Failed to get signed URL: ${response.statusText}`);
        }
        
        const data = await response.json() as { url: string };
        setSignedUrl(data.url);
      } catch (error) {
        console.error("Failed to load signed media URL:", error);
        setUrlError(true);
      } finally {
        setUrlLoading(false);
      }
    };

    loadSignedUrl();
  }, [videoAsset]);

  // Восстанавливаем позицию после загрузки
  useEffect(() => {
    if (signedUrl && videoRef.current && savedPosition && savedPosition > 0) {
      const video = videoRef.current;
      const handleLoadedMetadata = () => {
        video.currentTime = savedPosition;
      };
      video.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true });
      return () => video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    }
  }, [signedUrl, savedPosition]);

  if (!videoAsset) return null;

  const showLoading = isLoading || urlLoading;
  const showError = hasError || urlError;

  return (
    <div className="relative aspect-video bg-foreground/5">
      {showLoading && !showError && (
        <div className="absolute inset-0 flex items-center justify-center bg-foreground/5">
          <div className="animate-pulse flex flex-col items-center gap-2">
            <div className="h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
            <span className="text-sm text-muted-foreground">Loading video...</span>
          </div>
        </div>
      )}
      
      {showError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-foreground/5 gap-4">
          <AlertCircle className="h-12 w-12 text-destructive" />
          <p className="text-sm text-muted-foreground text-center max-w-xs">
            Unable to load video. Please check your connection and try again.
          </p>
          <Button variant="outline" onClick={() => {
            onRetry();
            setUrlError(false);
            if (videoAsset) {
              // Перезагружаем URL
              fetch(`/api/media-url?key=${encodeURIComponent(videoAsset.r2Key)}`)
                .then(res => res.json() as Promise<{ url: string }>)
                .then(data => setSignedUrl(data.url))
                .catch(() => setUrlError(true));
            }
          }}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      )}

      {signedUrl && (
        <video
          ref={videoRef}
          className="w-full h-full"
          controls
          preload="metadata"
          onLoadedData={onLoad}
          onError={onError}
        >
          <source src={signedUrl} type={videoAsset.mime} />
          Your browser does not support the video tag.
        </video>
      )}

      {savedPosition && savedPosition > 0 && (
        <div className="absolute bottom-16 left-4 bg-card/90 backdrop-blur-sm px-3 py-1.5 rounded-lg text-sm text-foreground shadow-md">
          Continue from {formatTime(savedPosition)}
        </div>
      )}
    </div>
  );
}

function AudioContent({ audioAsset }: { audioAsset?: AssetMeta }) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [urlLoading, setUrlLoading] = useState(true);

  useEffect(() => {
    if (!audioAsset) return;

    const loadSignedUrl = async () => {
      try {
        setUrlLoading(true);
        const response = await fetch(`/api/media-url?key=${encodeURIComponent(audioAsset.r2Key)}`);
        
        if (!response.ok) {
          throw new Error(`Failed to get signed URL: ${response.statusText}`);
        }
        
        const data = await response.json() as { url: string };
        setSignedUrl(data.url);
      } catch (error) {
        console.error("Failed to load signed media URL:", error);
      } finally {
        setUrlLoading(false);
      }
    };

    loadSignedUrl();
  }, [audioAsset]);

  if (!audioAsset) return null;

  return (
    <div className="p-6 flex flex-col items-center justify-center min-h-[200px] bg-gradient-to-br from-accent/30 to-accent/10">
      <div className="mb-4 p-4 rounded-full bg-primary/10">
        <Headphones className="h-10 w-10 text-primary" />
      </div>
      <p className="text-sm text-muted-foreground mb-4">Listen to the audio version</p>
      {urlLoading ? (
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span className="text-sm text-muted-foreground">Loading audio...</span>
        </div>
      ) : signedUrl ? (
        <audio controls preload="metadata" className="w-full max-w-md">
          <source src={signedUrl} type={audioAsset.mime} />
          Your browser does not support the audio element.
        </audio>
      ) : (
        <p className="text-sm text-destructive">Failed to load audio</p>
      )}
    </div>
  );
}
