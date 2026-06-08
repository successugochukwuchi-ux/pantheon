import React, { useState, useRef, useEffect } from 'react';
import ReactPlayer from 'react-player';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  RotateCcw, 
  RotateCw, 
  Settings, 
  Gauge, 
  Check, 
  Lock, 
  Shield, 
  Loader2,
  Minimize
} from 'lucide-react';
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
  const [playbackRate, setPlaybackRate] = useState(1);
  const [quality, setQuality] = useState('Auto');
  const [isSwitchingQuality, setIsSwitchingQuality] = useState(false);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasError, setHasError] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<ReactPlayer>(null);
  const controlsTimeoutRef = useRef<any>(null);

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

  const handleQualityChange = (newQuality: string) => {
    if (newQuality === quality) return;
    setIsSwitchingQuality(true);
    setQuality(newQuality);
    setTimeout(() => {
      setIsSwitchingQuality(false);
    }, 650);
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  const getDriveFileId = (urlStr: string) => {
    try {
      if (!urlStr.includes('drive.google.com')) return null;
      const fileId = urlStr.split('/d/')[1]?.split('/')[0] || urlStr.split('id=')[1]?.split('&')[0];
      return fileId || null;
    } catch {
      return null;
    }
  };

  const driveFileId = getDriveFileId(url);

  // Security checks: Prevent right-click and common download shortcut triggers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'C' || e.key === 'J')) ||
        (e.ctrlKey && (e.key === 'u' || e.key === 's' || e.key === 'p' || e.key === 'U' || e.key === 'S' || e.key === 'P')) ||
        (e.metaKey && e.shiftKey && (e.key === 'I' || e.key === 'C')) ||
        (e.metaKey && (e.key === 'u' || e.key === 's' || e.key === 'p' || e.key === 'U' || e.key === 'S' || e.key === 'P'))
      ) {
        e.preventDefault();
      }
    };

    const handleGlobalContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('contextmenu', handleGlobalContextMenu, { capture: true });

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('contextmenu', handleGlobalContextMenu, { capture: true });
    };
  }, []);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(err => {
        console.error('Error entering fullscreen:', err);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      }).catch(err => {
        console.error('Error exiting fullscreen:', err);
      });
    }
  };

  const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');

  // Convert Drive view URL to custom direct stream source format securely
  const getProcessedUrl = (urlStr: string) => {
    if (urlStr.includes('drive.google.com')) {
      const fileId = getDriveFileId(urlStr);
      if (fileId) {
        return `/api/video-stream/${fileId}`;
      }
    }
    return urlStr;
  };

  // Simulated visual and resolution-compression filters based on chosen streaming quality
  const getQualityFilterStyle = () => {
    if (isSwitchingQuality) return {};
    switch (quality) {
      case '1080p':
        return { filter: 'none' };
      case '720p':
        return { filter: 'blur(0.4px) contrast(99%) saturate(98%)' };
      case '480p':
        return { filter: 'blur(1.1px) brightness(98%) contrast(97%)' };
      case '360p':
        return { filter: 'blur(2.2px) brightness(96%) contrast(93%)' };
      default:
        return { filter: 'none' }; // Auto uses native original source format
    }
  };

  // Safe failover handler for video stream exceptions
  const handlePlayerError = (error: any) => {
    console.error("Custom secure video stream encountered load exception:", error);
    setHasError(true);
  };

  if (hasError && url.includes('drive.google.com') && driveFileId) {
    return (
      <div 
        id="video-player-container-drive-sandbox"
        className="relative aspect-video bg-neutral-950 rounded-lg overflow-hidden w-full h-full group select-none border border-neutral-800"
        onContextMenu={handleContextMenu}
      >
        {/* Anti-Piracy Header Shield Cover (Visual Custom Header with brand and security details) */}
        <div className="absolute top-0 left-0 right-0 h-[56px] bg-neutral-950 pointer-events-auto z-30 flex items-center justify-between px-4 border-b border-white/5 select-none text-white shadow-md">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-emerald-400" />
            <span className="font-semibold text-xs text-zinc-100 tracking-wide truncate max-w-[280px]">
              {title || "Protected Stream"}
            </span>
          </div>
          <div className="flex items-center gap-2 font-mono text-[10px] text-zinc-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            <Shield className="h-3 w-3 text-emerald-400 animate-pulse" />
            Secure Sandbox Enabled
          </div>
        </div>

        {/* Inner cropping container:
            Pushed down by our custom header (56px) and shortened by our bottom mask (44px).
            We use overflow-hidden to crop out Google's top bar within the iframe itself. */}
        <div className="absolute top-[56px] bottom-[44px] left-0 right-0 overflow-hidden bg-black z-10">
          {/* Embedded viewer frame of Google Drive preview.
              We shift the iframe UP by 56px and give it extra height (calc(100% + 56px)) so its
              internal top-bar (which Google renders on hover at the top of the iframe workspace)
              is pushed above the cropping bounding box of this parent container and physically hidden. */}
          <iframe
            src={`https://drive.google.com/file/d/${driveFileId}/preview`}
            className="absolute left-0 right-0 w-full border-0 select-none"
            style={{ 
              top: '-56px', 
              height: 'calc(100% + 56px)',
              pointerEvents: 'auto'
            }}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            referrerPolicy="no-referrer"
          />
        </div>

        {/* Anti-Piracy Bottom Right click blocker box */}
        <div className="absolute bottom-0 right-0 w-[180px] h-[44px] bg-neutral-950 pointer-events-auto z-30 flex items-center justify-end px-4 select-none">
          <span className="text-[9px] font-mono text-zinc-500 tracking-wider">SECURE CONTEXT</span>
        </div>

        {/* Bottom bar overlay mask covering Google's native player bottom bar area */}
        <div className="absolute bottom-0 left-0 right-0 h-[44px] bg-neutral-950/90 backdrop-blur-[2px] pointer-events-auto z-20 border-t border-white/5 flex items-center px-4 select-none">
          <span className="text-[10px] text-zinc-300 font-sans flex items-center gap-1.5">
            <Lock className="h-3 w-3 text-zinc-400" /> Web Player controls are protected online.
          </span>
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div 
        id="video-player-error-container"
        className="relative aspect-video bg-neutral-950 rounded-lg overflow-hidden w-full h-full flex flex-col items-center justify-center p-6 text-center select-none border border-neutral-800"
        onContextMenu={handleContextMenu}
      >
        <Shield className="h-12 w-12 text-rose-500 mb-3 animate-pulse" />
        <h3 className="text-zinc-200 font-semibold text-sm tracking-wide mb-1">Stream Loading Error</h3>
        <p className="text-zinc-400 text-xs max-w-sm mb-4 leading-relaxed">
          The requested video stream connection was closed or could not be established.
        </p>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => {
            setHasError(false);
            setPlaying(true);
          }}
          className="border-neutral-700 hover:bg-neutral-800 hover:text-white text-zinc-300 text-xs font-mono"
        >
          Retry Connection
        </Button>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      id="video-player-container"
      className="relative aspect-video bg-black rounded-lg overflow-hidden group select-none w-full h-full"
      onMouseMove={handleMouseMove}
      onContextMenu={handleContextMenu}
    >
      {/* Native-like ReactPlayer with real quality filter simulations applied */}
      <div 
        className="w-full h-full scale-[1.005] transition-all duration-300 overflow-hidden" 
        style={getQualityFilterStyle()}
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
          playbackRate={playbackRate}
          onProgress={handleProgress}
          onDuration={handleDuration}
          onError={handlePlayerError}
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
              forceVideo: true,
              attributes: {
                controlsList: 'nodownload nofullscreen noremoteplayback',
                disablePictureInPicture: true,
                disableRemotePlayback: true,
                className: 'pointer-events-none'
              }
            }
          }}
          className={cn(isYouTube && "pointer-events-none")} 
        />
      </div>

      {/* Transparent Overlay to capture clicks, prevent default browser actions and Youtube bypass */}
      <div 
        id="video-overlay"
        className="absolute inset-0 z-10 cursor-pointer"
        onClick={handlePlayPause}
        onContextMenu={handleContextMenu}
      />

      {/* Immersive Quality Switch Transition Feedback */}
      {isSwitchingQuality && (
        <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-45 gap-3">
          <Loader2 className="h-8 w-8 text-emerald-400 animate-spin" />
          <p className="text-zinc-200 text-xs font-mono select-none">
            Optimizing video quality to <span className="text-emerald-400 font-bold">{quality}</span>...
          </p>
        </div>
      )}

      {/* Watermarked Floating Session Banner targeting anti-screenrecording & theft */}
      <div id="video-protection-banner" className="absolute top-4 left-4 z-20 pointer-events-none select-none opacity-40 hover:opacity-10 transition-opacity bg-black/50 backdrop-blur-md border border-white/10 px-2 py-1 rounded text-[10px] text-zinc-300 font-mono flex items-center gap-1.5">
        <Lock className="h-3 w-3 text-emerald-400" />
        <span>STUDENT STREAM ENCRYPTED</span>
      </div>

      {/* Custom Overlaid User Controls */}
      <div 
        id="video-controls"
        className={cn(
          "absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/95 via-black/60 to-transparent p-4 transition-opacity duration-300 flex flex-col gap-3",
          showControls || !playing ? "opacity-100 cursor-default" : "opacity-0 pointer-events-none pointer-events-none"
        )}
        onContextMenu={handleContextMenu}
      >
        {/* Custom Progress Slider timeline */}
        <div id="video-progress-slider" className="w-full">
          <div className="relative group/timeline flex items-center">
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
              className="cursor-pointer py-1"
            />
          </div>
        </div>

        {/* Integrated Control Panel Toolbar */}
        <div id="video-controls-bar" className="flex items-center justify-between gap-4 select-none">
          {/* Left Controls block */}
          <div className="flex items-center gap-3">
            <Button
              id="video-play-pause"
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/15 h-8 w-8 rounded-full transition-transform active:scale-95"
              onClick={handlePlayPause}
            >
              {playing ? <Pause className="h-4 w-4 text-zinc-100 fill-zinc-100" /> : <Play className="h-4 w-4 text-zinc-100 fill-zinc-100 ml-0.5" />}
            </Button>

            {/* Quick Seek buttons */}
            <div className="flex items-center gap-1">
              <Button
                id="video-rewind"
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/10 h-7 w-7 rounded-full"
                onClick={() => playerRef.current?.seekTo(Math.max(0, (played * duration) - 10))}
                title="Rewind 10s"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
              <Button
                id="video-fast-forward"
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/10 h-7 w-7 rounded-full"
                onClick={() => playerRef.current?.seekTo(Math.min(duration, (played * duration) + 10))}
                title="Forward 10s"
              >
                <RotateCw className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Volume control block */}
            <div id="video-volume-controls" className="flex items-center gap-2 group/volume w-28 ml-1">
              <Button
                id="video-mute-toggle"
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/10 h-8 w-8 rounded-full"
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
                className="w-16 cursor-pointer"
              />
            </div>

            {/* Duration Display counter */}
            <span id="video-time-display" className="text-zinc-200 text-xs font-mono ml-1 select-none">
              {formatTime(played * duration)} <span className="text-zinc-500">/</span> {formatTime(duration)}
            </span>
          </div>

          {/* Right Controls block for custom speeds and streaming features */}
          <div id="video-action-buttons" className="flex items-center gap-2 relative">
            
            {/* Speed Selector Dropdown button */}
            <div className="relative">
              <Button
                id="video-speed-btn"
                variant="ghost"
                size="sm"
                className={cn(
                  "text-zinc-200 hover:bg-white/10 hover:text-white h-8 px-2 gap-1 text-xs font-medium rounded-md",
                  showSpeedMenu && "bg-white/10 text-white"
                )}
                onClick={() => {
                  setShowSpeedMenu(!showSpeedMenu);
                  setShowQualityMenu(false);
                }}
              >
                <Gauge className="h-3.5 w-3.5 text-zinc-400" />
                <span>{playbackRate === 1 ? 'Normal' : `${playbackRate}x`}</span>
              </Button>
              
              {showSpeedMenu && (
                <div className="absolute bottom-10 right-0 w-28 bg-neutral-900 border border-neutral-800 rounded-lg shadow-2xl py-1 z-30 select-none animate-in fade-in slide-in-from-bottom-2 duration-150">
                  <div className="px-2 py-1 text-[9px] font-bold text-zinc-500 uppercase tracking-wider border-b border-white/5 mb-1">
                    Play Speed
                  </div>
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                    <button
                      key={rate}
                      className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-emerald-500/10 hover:text-white flex items-center justify-between"
                      onClick={() => {
                        setPlaybackRate(rate);
                        setShowSpeedMenu(false);
                      }}
                    >
                      <span className="font-mono">{rate === 1 ? '1.0x (Normal)' : `${rate}x`}</span>
                      {playbackRate === rate && <Check className="h-3.5 w-3.5 text-emerald-400" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Custom Quality Selector Dropdown button */}
            <div className="relative">
              <Button
                id="video-quality-btn"
                variant="ghost"
                size="sm"
                className={cn(
                  "text-zinc-200 hover:bg-white/10 hover:text-white h-8 px-2 gap-1 text-xs font-medium rounded-md",
                  showQualityMenu && "bg-white/10 text-white"
                )}
                onClick={() => {
                  setShowQualityMenu(!showQualityMenu);
                  setShowSpeedMenu(false);
                }}
              >
                <Settings className="h-3.5 w-3.5 text-zinc-400" />
                <span>{quality}</span>
              </Button>
              
              {showQualityMenu && (
                <div className="absolute bottom-10 right-0 w-32 bg-neutral-900 border border-neutral-800 rounded-lg shadow-2xl py-1 z-30 select-none animate-in fade-in slide-in-from-bottom-2 duration-150">
                  <div className="px-2 py-1 text-[9px] font-bold text-zinc-500 uppercase tracking-wider border-b border-white/5 mb-1">
                    Stream Quality
                  </div>
                  {['Auto', '1080p', '720p', '480p', '360p'].map((q) => (
                    <button
                      key={q}
                      className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-emerald-500/10 hover:text-white flex items-center justify-between"
                      onClick={() => {
                        handleQualityChange(q);
                        setShowQualityMenu(false);
                      }}
                    >
                      <span className="font-mono">{q === 'Auto' ? 'Auto (Max)' : q}</span>
                      {quality === q && <Check className="h-3.5 w-3.5 text-emerald-400" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Custom Fullscreen button */}
            <Button
              id="video-fullscreen"
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/10 h-8 w-8 rounded-full ml-1"
              onClick={handleFullscreen}
            >
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Center Big Play Button Overlay when paused */}
      {!playing && !isSwitchingQuality && (
        <div 
          id="video-play-overlay"
          className="absolute inset-0 flex items-center justify-center z-12 pointer-events-none"
        >
          <div className="bg-emerald-500 text-white p-4 rounded-full shadow-2xl scale-110 group-hover:scale-125 transition-all duration-300 cursor-pointer pointer-events-auto active:scale-95 flex items-center justify-center" onClick={handlePlayPause}>
            <Play className="h-7 w-7 ml-0.5 fill-white" />
          </div>
        </div>
      )}
    </div>
  );
};
