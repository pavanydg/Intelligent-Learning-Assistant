import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, handleApiError } from '../services/api'
import { Search, BookOpen, Loader2, Key } from 'lucide-react'
import toast from 'react-hot-toast'

interface Playlist {
  playlistId: string
  title: string
  description: string
  thumbnail: string
  channelTitle: string
  publishedAt: string
}

const SearchPage: React.FC = () => {
  const [query, setQuery] = useState('')
  const [courseKey, setCourseKey] = useState('')
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingKey, setIsLoadingKey] = useState(false)
  const [activeTab, setActiveTab] = useState<'playlists' | 'key'>('playlists')
  const navigate = useNavigate()

  const searchPlaylists = async (searchQuery: string) => {
    if (!searchQuery.trim()) return

    setIsLoading(true)
    try {
      const response = await api.get('/youtube/search', {
        params: { query: searchQuery, maxResults: 10 }
      })
      setPlaylists(response.data.data.playlists)
    } catch (error) {
      handleApiError(error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    searchPlaylists(query)
  }

  const handlePlaylistSelect = async (playlistId: string) => {
    try {
      const response = await api.get(`/youtube/playlist/${playlistId}`)
      const courseId = response.data.data.course.id
      navigate(`/playlist/${playlistId}`)
    } catch (error) {
      handleApiError(error)
    }
  }

  const handleSearchByKey = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!courseKey.trim()) {
      toast.error('Please enter a course key')
      return
    }

    setIsLoadingKey(true)
    try {
      const response = await api.get(`/youtube/course-by-key/${courseKey.trim().toUpperCase()}`)
      const course = response.data.data.course
      toast.success('Course found! Redirecting...')
      navigate(`/playlist/${course.playlistId}`)
    } catch (error: any) {
      console.error('Error searching by key:', error)
      const errorMessage = error.response?.data?.message || 'Invalid or expired course key'
      toast.error(errorMessage)
    } finally {
      setIsLoadingKey(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold text-gray-900 mb-4 bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
          Discover Learning Content
        </h1>
        <p className="text-lg text-gray-600">
          Search for educational playlists and courses to enhance your learning
        </p>
      </div>

      {/* Tabs */}
      <div className="flex justify-center mb-8">
        <div className="bg-gray-100 rounded-xl p-1.5 inline-flex shadow-sm">
          <button
            onClick={() => setActiveTab('playlists')}
            className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
              activeTab === 'playlists'
                ? 'bg-white text-primary-600 shadow-md'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            YouTube Playlists
          </button>
          <button
            onClick={() => setActiveTab('key')}
            className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center gap-2 ${
              activeTab === 'key'
                ? 'bg-white text-primary-600 shadow-md'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Key className="w-4 h-4" />
            Search by Key
          </button>
        </div>
      </div>

      {/* Search Form */}
      {activeTab === 'key' ? (
        <div className="max-w-2xl mx-auto mb-10">
          <form onSubmit={handleSearchByKey} className="relative">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Key className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={courseKey}
                  onChange={(e) => setCourseKey(e.target.value.toUpperCase())}
                  placeholder="Enter course key (e.g., ABC12345)"
                  className="input w-full pl-12 uppercase font-mono"
                  maxLength={8}
                />
              </div>
              <button
                type="submit"
                disabled={isLoadingKey || !courseKey.trim()}
                className="btn btn-primary px-8"
              >
                {isLoadingKey ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Key className="h-5 w-5 mr-2" />
                    Search
                  </>
                )}
              </button>
            </div>
          </form>
          <p className="text-sm text-gray-500 mt-3 text-center">
            Enter the course key provided by your teacher to access the course
          </p>
        </div>
      ) : (
        <div className="max-w-2xl mx-auto mb-10">
          <form onSubmit={handleSearch} className="relative">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search for topics, subjects, or courses..."
                  className="input w-full pl-12"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading || !query.trim()}
                className="btn btn-primary px-8"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Search className="h-5 w-5 mr-2" />
                    Search
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Results */}
      <div className="space-y-6">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="text-center">
              <Loader2 className="h-10 w-10 animate-spin text-primary-600 mx-auto mb-4" />
              <p className="text-gray-600">Searching for courses...</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {playlists.map((playlist, index) => (
              <div
                key={playlist.playlistId}
                className="card-interactive group"
                onClick={() => handlePlaylistSelect(playlist.playlistId)}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="aspect-video bg-gray-200 rounded-t-xl overflow-hidden relative">
                  <img
                    src={playlist.thumbnail}
                    alt={playlist.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </div>
                <div className="card-content">
                  <h3 className="font-bold text-lg text-gray-900 line-clamp-2 mb-2 group-hover:text-primary-600 transition-colors">
                    {playlist.title}
                  </h3>
                  <p className="text-sm font-medium text-gray-600 mb-3">
                    by {playlist.channelTitle}
                  </p>
                  <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed">
                    {playlist.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && activeTab === 'playlists' && playlists.length === 0 && query && (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mb-6">
              <BookOpen className="h-10 w-10 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No playlists found
            </h3>
            <p className="text-gray-600">
              Try searching with different keywords
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default SearchPage
