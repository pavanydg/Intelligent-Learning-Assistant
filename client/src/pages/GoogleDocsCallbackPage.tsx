/**
 * Google Docs OAuth Callback Page
 * Handles OAuth redirect from Google and sends code back to parent window
 */

import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

const GoogleDocsCallbackPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const state = searchParams.get('state');

  useEffect(() => {
    // If there's an error, send it to parent and close
    if (error) {
      if (window.opener) {
        window.opener.postMessage(
          {
            type: 'oauth-callback',
            provider: 'googledocs',
            error: error,
            errorDescription: searchParams.get('error_description') || 'OAuth authorization failed'
          },
          window.location.origin
        );
      }
      // Close window after a delay
      setTimeout(() => {
        window.close();
      }, 2000);
      return;
    }

    // If we have a code, send it to parent window
    if (code && window.opener) {
      window.opener.postMessage(
        {
          type: 'oauth-callback',
          provider: 'googledocs',
          code: code,
          state: state
        },
        window.location.origin
      );
      
      // Close window after a short delay
      setTimeout(() => {
        window.close();
      }, 1000);
    } else if (!code && !error) {
      // No code and no error - something went wrong
      if (window.opener) {
        window.opener.postMessage(
          {
            type: 'oauth-callback',
            provider: 'googledocs',
            error: 'no_code',
            errorDescription: 'No authorization code received'
          },
          window.location.origin
        );
      }
      setTimeout(() => {
        window.close();
      }, 2000);
    }
  }, [code, error, state, searchParams]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Authorization Failed</h2>
          <p className="text-gray-600 mb-4">
            {searchParams.get('error_description') || 'An error occurred during authorization'}
          </p>
          <p className="text-sm text-gray-500">This window will close automatically...</p>
        </div>
      </div>
    );
  }

  if (code) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Authorization Successful</h2>
          <p className="text-gray-600 mb-4">Connecting your Google Docs account...</p>
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
          <p className="text-sm text-gray-500 mt-4">This window will close automatically...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <Loader2 className="w-16 h-16 animate-spin text-blue-600 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Processing Authorization</h2>
        <p className="text-gray-600">Please wait...</p>
      </div>
    </div>
  );
};

export default GoogleDocsCallbackPage;

