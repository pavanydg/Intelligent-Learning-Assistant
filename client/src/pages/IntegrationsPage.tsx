/**
 * Integrations Page
 * Manage connections to external platforms (Notion, Google Docs, Moodle)
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import integrationService, { IntegrationStatus } from '../services/integrationService';

const IntegrationsPage: React.FC = () => {
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [moodleConfig, setMoodleConfig] = useState({ baseUrl: '', token: '' });
  const [showMoodleForm, setShowMoodleForm] = useState(false);
  const [notionConfig, setNotionConfig] = useState({ accessToken: '', databaseId: '' });
  const [showNotionForm, setShowNotionForm] = useState(false);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const data = await integrationService.getStatus();
      setStatus(data);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load integration status');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (provider: string) => {
    try {
      setConnecting(provider);
      
      if (provider === 'moodle') {
        // Moodle requires manual configuration
        setShowMoodleForm(true);
        setConnecting(null);
        return;
      }

      if (provider === 'notion') {
        // Notion requires manual API key entry
        setShowNotionForm(true);
        setConnecting(null);
        return;
      }

      // Get OAuth URL for other providers (Google Docs)
      const authUrl = await integrationService.getAuthUrl(provider);
      
      // Open OAuth window
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      const popup = window.open(
        authUrl,
        `${provider} OAuth`,
        `width=${width},height=${height},left=${left},top=${top}`
      );

      if (!popup) {
        toast.error('Popup blocked. Please allow popups for this site and try again.');
        setConnecting(null);
        return;
      }

      // Declare timeout variable before messageHandler so it can be cleared
      let timeout: ReturnType<typeof setTimeout> | null = null;

      // Handle OAuth callback (if redirected back)
      const messageHandler = async (event: MessageEvent) => {
        // Verify origin for security
        if (event.origin !== window.location.origin) {
          return;
        }

        if (event.data.type === 'oauth-callback' && event.data.provider === provider) {
          // Remove event listener and timeout after handling
          window.removeEventListener('message', messageHandler);
          if (timeout) clearTimeout(timeout);

          // Handle errors from OAuth callback
          if (event.data.error) {
            toast.error(event.data.errorDescription || event.data.error || 'OAuth authorization failed');
            setConnecting(null);
            try {
              if (popup && !popup.closed) {
                popup.close();
              }
            } catch (e) {
              // Ignore errors when closing popup
            }
            return;
          }

          // Handle successful OAuth callback
          if (event.data.code) {
            try {
              await integrationService.connectWithCode(provider, event.data.code);
              toast.success(`Successfully connected to ${status?.[provider]?.name || provider}`);
              fetchStatus();
            } catch (error: any) {
              toast.error(error.response?.data?.message || error.message || 'Failed to connect');
            } finally {
              setConnecting(null);
              try {
                if (popup && !popup.closed) {
                  popup.close();
                }
              } catch (e) {
                // Ignore errors when closing popup
              }
            }
          } else {
            toast.error('No authorization code received');
            setConnecting(null);
            try {
              if (popup && !popup.closed) {
                popup.close();
              }
            } catch (e) {
              // Ignore errors when closing popup
            }
          }
        }
      };

      window.addEventListener('message', messageHandler);

      // Timeout to detect if popup was closed manually (after 5 minutes)
      timeout = setTimeout(() => {
        window.removeEventListener('message', messageHandler);
        try {
          if (popup && !popup.closed) {
            popup.close();
          }
        } catch (e) {
          // Ignore errors when closing popup
        }
        if (connecting === provider) {
          setConnecting(null);
          toast.error('OAuth authorization timed out. Please try again.');
        }
      }, 5 * 60 * 1000); // 5 minutes
    } catch (error: any) {
      toast.error(error.message || 'Failed to initiate connection');
      setConnecting(null);
    }
  };

  const handleMoodleConnect = async () => {
    try {
      setConnecting('moodle');
      await integrationService.connectWithConfig('moodle', moodleConfig);
      toast.success('Successfully connected to Moodle');
      setShowMoodleForm(false);
      setMoodleConfig({ baseUrl: '', token: '' });
      fetchStatus();
    } catch (error: any) {
      toast.error(error.message || 'Failed to connect to Moodle');
    } finally {
      setConnecting(null);
    }
  };

  const handleNotionConnect = async () => {
    if (!notionConfig.accessToken) {
      toast.error('Notion API key is required');
      return;
    }

    // Notion API keys can have different prefixes (secret_, ntn-, etc.)
    // Just check that it's not empty
    if (!notionConfig.accessToken || notionConfig.accessToken.trim().length < 20) {
      toast.error('Invalid Notion API key. Please check that you copied the complete API key.');
      return;
    }

    if (!notionConfig.databaseId || notionConfig.databaseId.trim() === '') {
      toast.error('Database ID is required. Please create a database in Notion and share it with your integration.');
      return;
    }

    try {
      setConnecting('notion');
      const config = {
        accessToken: notionConfig.accessToken.trim(),
        workspace: {
          databaseId: notionConfig.databaseId.trim() || null
        }
      };
      await integrationService.connectWithConfig('notion', config);
      toast.success('Successfully connected to Notion');
      setShowNotionForm(false);
      setNotionConfig({ accessToken: '', databaseId: '' });
      await fetchStatus();
    } catch (error: any) {
      // Extract error message from response if available
      let errorMessage = error.response?.data?.message || error.message || 'Failed to connect to Notion';
      
      // Clean up error message - replace newlines with spaces for better display
      errorMessage = errorMessage.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
      
      // Show error with longer duration so user can read it
      toast.error(errorMessage, { duration: 8000 });
      
      console.error('Notion connection error:', error);
    } finally {
      setConnecting(null);
    }
  };

  const handleDisconnect = async (provider: string) => {
    if (!confirm(`Are you sure you want to disconnect from ${status?.[provider]?.name || provider}?`)) {
      return;
    }

    try {
      setDisconnecting(provider);
      await integrationService.disconnect(provider);
      
      // Immediately update local state to reflect disconnection
      if (status) {
        setStatus({
          ...status,
          [provider]: {
            ...status[provider],
            connected: false,
            connectedAt: null
          }
        });
      }
      
      toast.success(`Disconnected from ${status?.[provider]?.name || provider}`);
      
      // Also refresh from server to ensure consistency
      setTimeout(async () => {
        await fetchStatus();
      }, 300);
    } catch (error: any) {
      toast.error(error.message || 'Failed to disconnect');
      // Refresh status even on error to ensure UI is correct
      await fetchStatus();
    } finally {
      setDisconnecting(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const providers = [
    { key: 'notion', name: 'Notion', description: 'Export notes and feedback to Notion pages' },
    { key: 'googledocs', name: 'Google Docs', description: 'Export notes and feedback to Google Docs' },
    { key: 'moodle', name: 'Moodle', description: 'Export content to Moodle courses' }
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <Link
          to="/profile"
          className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Profile
        </Link>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Integrations</h1>
          <p className="text-gray-600 mb-6">
            Connect your ILA account to external platforms to export notes and feedback
          </p>

          <div className="space-y-4">
            {providers.map((provider) => {
              const isConnected = status?.[provider.key]?.connected || false;
              const isConnecting = connecting === provider.key;

              return (
                <div
                  key={provider.key}
                  className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {provider.name}
                        </h3>
                        {isConnected ? (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        ) : (
                          <XCircle className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                      <p className="text-gray-600 text-sm mb-3">{provider.description}</p>
                      {isConnected && status?.[provider.key]?.connectedAt && (
                        <p className="text-xs text-gray-500">
                          Connected on {new Date(status[provider.key].connectedAt!).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <div className="ml-4">
                      {isConnected ? (
                        <button
                          onClick={() => handleDisconnect(provider.key)}
                          disabled={disconnecting === provider.key}
                          className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 border border-red-300 rounded-md hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          {disconnecting === provider.key ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Disconnecting...
                            </>
                          ) : (
                            'Disconnect'
                          )}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleConnect(provider.key)}
                          disabled={isConnecting}
                          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                        >
                          {isConnecting ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Connecting...
                            </>
                          ) : (
                            'Connect'
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {showNotionForm && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h3 className="text-lg font-semibold mb-4">Configure Notion Connection</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notion API Key <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={notionConfig.accessToken}
                    onChange={(e) => setNotionConfig({ ...notionConfig, accessToken: e.target.value })}
                    placeholder="ntn-... or secret_..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Get your API key from{' '}
                    <a 
                      href="https://www.notion.so/my-integrations" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      Notion Integrations
                    </a>
                    . Create an internal integration and copy the API key (may start with "ntn-", "secret_", or other prefixes)
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Database ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={notionConfig.databaseId}
                    onChange={(e) => setNotionConfig({ ...notionConfig, databaseId: e.target.value })}
                    placeholder="a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <p className="text-xs font-medium text-blue-900 mb-2">How to get Database ID:</p>
                    <ol className="text-xs text-blue-800 space-y-1 list-decimal list-inside">
                      <li>Create a database in Notion (or use an existing one)</li>
                      <li><strong>IMPORTANT:</strong> Click the "..." menu (three dots) in the top right of the database</li>
                      <li>Click "Connections" or "Add connections"</li>
                      <li><strong>Select your integration</strong> (the one you created at notion.so/my-integrations)</li>
                      <li>Make sure it shows "Read" and "Update" capabilities</li>
                      <li>Copy the Database ID from the URL:
                        <br />
                        <code className="bg-blue-100 px-1 rounded text-xs">
                          https://notion.so/workspace/<span className="font-bold text-blue-900">DATABASE_ID_HERE</span>?v=...
                        </code>
                        <br />
                        <span className="text-red-600 font-semibold">⚠️ The database MUST be shared with your integration first!</span>
                      </li>
                    </ol>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleNotionConnect}
                    disabled={connecting === 'notion' || !notionConfig.accessToken || !notionConfig.databaseId}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {connecting === 'notion' ? 'Connecting...' : 'Connect'}
                  </button>
                  <button
                    onClick={() => {
                      setShowNotionForm(false);
                      setNotionConfig({ accessToken: '', databaseId: '' });
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {showMoodleForm && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h3 className="text-lg font-semibold mb-4">Configure Moodle Connection</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Moodle Base URL
                  </label>
                  <input
                    type="url"
                    value={moodleConfig.baseUrl}
                    onChange={(e) => setMoodleConfig({ ...moodleConfig, baseUrl: e.target.value })}
                    placeholder="https://your-moodle-site.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Web Service Token
                  </label>
                  <input
                    type="password"
                    value={moodleConfig.token}
                    onChange={(e) => setMoodleConfig({ ...moodleConfig, token: e.target.value })}
                    placeholder="Your Moodle web service token"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Get your token from Moodle: Site administration → Server → Web services → Manage tokens
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleMoodleConnect}
                    disabled={connecting === 'moodle' || !moodleConfig.baseUrl || !moodleConfig.token}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {connecting === 'moodle' ? 'Connecting...' : 'Connect'}
                  </button>
                  <button
                    onClick={() => {
                      setShowMoodleForm(false);
                      setMoodleConfig({ baseUrl: '', token: '' });
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default IntegrationsPage;

