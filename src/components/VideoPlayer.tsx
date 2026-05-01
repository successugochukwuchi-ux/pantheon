import React, { useState, useRef, useEffect } from 'react';
import ReactPlayer from 'react-player';
import { Play, Pause, Volume2, VolumeX, Maximize, RotateCcw, RotateCw } from 'lucide-react';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { cn } from '../lib/utils';

interface VideoPlayerProps {
  url: string;
  title: string;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ url, title }) => {
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [played, setPlayed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [seeking, setSeeking] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const playerRef = useRef<ReactPlayer>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handlePlayPause = () => setPlaying(!playing);
  const handleToggleMute = () => setMuted(!muted);
  const handleVolumeChange = (value: number[]) => setVolume(value[0]);
  
  const handleProgress = (state: { played: number }) => {
    if (!seeking) {
      setPlayed(state.played);
    }
  };

  const handleDuration = (duration: number) => {
    setDuration(duration);
  };

  const formatTime = (seconds: number) => {
    const date = new Date(seconds * 1000);
    const hh = date.getUTCHours();
    const mm = date.getUTCMinutes();
    const ss = date.getUTCSeconds().toString().padStart(2, '0');
    if (hh) {
      return `${hh}:${mm.toString().padStart(2, '0')}:${ss}`;
    }
    return `${mm}:${ss}`;
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (playing) {
        setShowControls(false);
      }
    }, 3000);
  };

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  const getProcessedUrl = (url: string) => {
    // Handle Google Drive links
    if (url.includes('drive.google.com')) {
      const fileId = url.split('/d/')[1]?.split('/')[0] || url.split('id=')[1]?.split('&')[0];
      if (fileId) {
        return `https://drive.google.com/uc?id=${fileId}&export=download`;
      }
    }
    return url;
  };

  // Security: Prevent right-click context menu
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');

  return (
    <div 
      id="video-player-container"
      className="relative aspect-video bg-black rounded-lg overflow-hidden group select-none"
      onMouseMove={handleMouseMove}
      onContextMenu={handleContextMenu}
    >
      <ReactPlayer
        ref={playerRef}
        url={getProcessedUrl(url)}
        width="100%"
        height="100%"
        playing={playing}
        volume={volume}
        muted={muted}
        onProgress={handleProgress}
        onDuration={handleDuration}
        config={{
          youtube: {
            playerVars: {
              modestbranding: 1,
              rel: 0,
              showinfo: 0,
              controls: 0,
              iv_load_policy: 3,
              disablekb: 1,
              fs: 0,
            }
          },
          file: {
            attributes: {
              controlsList: 'nodownload',
              disablePictureInPicture: true,
            }
          }
        }}
        className={cn(isYouTube && "pointer-events-none")} 
      />

      {/* Transparent Overlay to capture clicks and prevent YouTube interactions */}
      <div 
        id="video-overlay"
        className="absolute inset-0 z-10 cursor-pointer"
        onClick={handlePlayPause}
      />

      {/* Custom Controls */}
      <div 
        id="video-controls"
        className={cn(
          "absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 transition-opacity duration-300",
          showControls || !playing ? "opacity-100" : "opacity-0"
        )}
      >
        <div id="video-progress-slider" className="mb-4">
          <Slider
            value={[played]}
            max={1}
            step={0.001}
            onPointerDown={() => setSeeking(true)}
            onValueChange={(value) => setPlayed(value[0])}
            onPointerUp={() => {
              setSeeking(false);
              playerRef.current?.seekTo(played);
            }}
            className="cursor-pointer"
          />
        </div>

        <div id="video-controls-bar" className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Button
              id="video-play-pause"
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20 h-8 w-8"
              onClick={handlePlayPause}
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>

            <div id="video-volume-controls" className="flex items-center gap-2 group/volume w-32">
              <Button
                id="video-mute-toggle"
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20 h-8 w-8"
                onClick={handleToggleMute}
              >
                {muted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </Button>
              <Slider
                id="video-volume-slider"
                value={[muted ? 0 : volume]}
                max={1}
                step={0.01}
                onValueChange={handleVolumeChange}
                className="w-20 cursor-pointer"
              />
            </div>

            <span id="video-time-display" className="text-white text-xs font-mono">
              {formatTime(played * duration)} / {formatTime(duration)}
            </span>
          </div>

          <div id="video-action-buttons" className="flex items-center gap-2">
             <Button
              id="video-rewind"
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20 h-8 w-8"
              onClick={() => playerRef.current?.seekTo(Math.max(0, (played * duration) - 10))}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button
              id="video-fast-forward"
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20 h-8 w-8"
              onClick={() => playerRef.current?.seekTo(Math.min(duration, (played * duration) + 10))}
            >
              <RotateCw className="h-4 w-4" />
            </Button>
            <Button
              id="video-fullscreen"
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20 h-8 w-8"
              onClick={() => {
                const element = playerRef.current?.getInternalPlayer() as any;
                const iframe = element?.getIframe?.();
                if (iframe?.requestFullscreen) {
                  iframe.requestFullscreen();
                } else {
                   const wrapper = (playerRef.current as any)?.wrapper;
                   if (wrapper?.requestFullscreen) {
                     wrapper.requestFullscreen();
                   }
                }
              }}
            >
              <Maximize className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Center Play Button Overlay */}
      {!playing && (
        <div 
          id="video-play-overlay"
          className="absolute inset-0 flex items-center justify-center z-15 pointer-events-none"
        >
          <div className="bg-primary/90 text-primary-foreground p-5 rounded-full shadow-2xl scale-110 group-hover:scale-125 transition-transform">
            <Play className="h-8 w-8 ml-1" />
          </div>
        </div>
      )}
    </div>
  );
};
