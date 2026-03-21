import { useState } from 'react'
import { Play, Settings, Bookmark, Save } from 'lucide-react'

interface VideoPlayerProps {
  videoId: string
  title: string
  description?: string
  autoplay?: boolean
  className?: string
  onSavePlaylist?: () => void
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoId,
  title,
  description,
  autoplay = false,
  className = '',
  onSavePlaylist
}) => {
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const [quality, setQuality] = useState('auto')
  const [showSettings, setShowSettings] = useState(false)
  const [isPlaylistSaved, setIsPlaylistSaved] = useState(false)

  const handleSavePlaylist = () => {
    if (onSavePlaylist) {
      onSavePlaylist()
      setIsPlaylistSaved(true)
      setTimeout(() => setIsPlaylistSaved(false), 2000)
    }
  }

  const openInYouTube = () => {
    window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank')
  }

  return (
    <div className={`relative group ${className}`}>
      <div className="aspect-video bg-black rounded-lg overflow-hidden relative video-container">
        <iframe
          src={`https://www.youtube.com/embed/${videoId}?autoplay=${autoplay ? 1 : 0}&controls=1&modestbranding=1&rel=0&showinfo=0`}
          title={title}
          className="w-full h-full border-0"
          allowFullScreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          style={{ pointerEvents: 'auto' }}
        />
      </div>
      
      {/* Removed overlay to prevent interference with YouTube controls */}

      {/* Settings Panel */}
      {showSettings && (
        <div className="absolute top-4 right-4 bg-black bg-opacity-90 text-white p-4 rounded-lg min-w-64 z-10">
          <h3 className="text-sm font-medium mb-3">Video Settings</h3>
          
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-300 block mb-1">Playback Speed</label>
              <select
                value={playbackSpeed}
                onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                className="w-full bg-gray-800 text-white text-sm rounded px-2 py-1"
              >
                <option value={0.5}>0.5x</option>
                <option value={0.75}>0.75x</option>
                <option value={1}>1x</option>
                <option value={1.25}>1.25x</option>
                <option value={1.5}>1.5x</option>
                <option value={2}>2x</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-300 block mb-1">Quality</label>
              <select
                value={quality}
                onChange={(e) => setQuality(e.target.value)}
                className="w-full bg-gray-800 text-white text-sm rounded px-2 py-1"
              >
                <option value="auto">Auto</option>
                <option value="small">240p</option>
                <option value="medium">360p</option>
                <option value="large">480p</option>
                <option value="hd720">720p</option>
                <option value="hd1080">1080p</option>
              </select>
            </div>

            {onSavePlaylist && (
              <div>
                <button
                  onClick={handleSavePlaylist}
                  className={`w-full flex items-center justify-center space-x-2 px-3 py-2 rounded text-sm transition-colors ${
                    isPlaylistSaved 
                      ? 'bg-green-600 text-white' 
                      : 'bg-gray-700 hover:bg-gray-600 text-white'
                  }`}
                >
                  {isPlaylistSaved ? (
                    <>
                      <Bookmark className="h-4 w-4" />
                      <span>Saved!</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      <span>Save Playlist</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* External Controls */}
      <div className="mt-4 bg-gray-50 p-4 rounded-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">{title}</h3>
          <div className="flex items-center space-x-2">
            <button
              onClick={openInYouTube}
              className="btn btn-primary btn-sm"
            >
              <Play className="h-4 w-4 mr-1" />
              Open in YouTube
            </button>
            
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="btn btn-outline btn-sm"
            >
              <Settings className="h-4 w-4 mr-1" />
              Settings
            </button>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <label className="text-sm text-gray-600">Playback Speed:</label>
            <select
              value={playbackSpeed}
              onChange={(e) => {
                const speed = parseFloat(e.target.value)
                setPlaybackSpeed(speed)
                console.log('Speed changed to:', speed)
              }}
              className="text-sm border border-gray-300 rounded px-2 py-1"
            >
              <option value={0.5}>0.5x</option>
              <option value={0.75}>0.75x</option>
              <option value={1}>1x</option>
              <option value={1.25}>1.25x</option>
              <option value={1.5}>1.5x</option>
              <option value={2}>2x</option>
            </select>
          </div>
          
          <div className="flex items-center space-x-2">
            <label className="text-sm text-gray-600">Quality:</label>
            <select
              value={quality}
              onChange={(e) => {
                const newQuality = e.target.value
                setQuality(newQuality)
                console.log('Quality changed to:', newQuality)
              }}
              className="text-sm border border-gray-300 rounded px-2 py-1"
            >
              <option value="auto">Auto</option>
              <option value="small">240p</option>
              <option value="medium">360p</option>
              <option value="large">480p</option>
              <option value="hd720">720p</option>
              <option value="hd1080">1080p</option>
            </select>
          </div>
        </div>
        
        <div className="mt-3 p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Tip:</strong> Use the embedded player for basic viewing, or click "Open in YouTube" 
            for full control over playback speed, quality, and other advanced features.
          </p>
        </div>
        
        {description && (
          <p className="text-sm text-gray-600 mt-3 line-clamp-2">
            {description}
          </p>
        )}
      </div>
    </div>
  )
}

export default VideoPlayer