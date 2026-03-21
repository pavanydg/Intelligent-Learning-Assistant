import React, { useState, useEffect } from 'react';
import { X, Download, Copy, Check, ExternalLink, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import integrationService, { IntegrationStatus } from '../services/integrationService';
import { useNavigate } from 'react-router-dom';

// Function to format markdown-like text to proper HTML/JSX
const formatNotes = (text: string): JSX.Element[] => {
  if (!text) return [];

  const lines = text.split('\n');
  const formattedElements: JSX.Element[] = [];
  let currentListItems: string[] = [];
  let listKey = 0;

  const processList = () => {
    if (currentListItems.length > 0) {
      formattedElements.push(
        <ul key={`list-${listKey++}`} className="list-disc list-inside mb-6 space-y-3 ml-4">
          {currentListItems.map((item, idx) => (
            <li key={idx} className="text-gray-700 leading-relaxed">
              {formatInlineMarkdown(item)}
            </li>
          ))}
        </ul>
      );
      currentListItems = [];
    }
  };

  const formatInlineMarkdown = (line: string): JSX.Element => {
    if (!line) return <></>;
    
    const parts: (string | JSX.Element)[] = [];
    let key = 0;
    let lastIndex = 0;

    // Match **bold** text (non-greedy to handle multiple bold sections)
    const boldRegex = /\*\*([^*]+?)\*\*/g;
    let match;

    while ((match = boldRegex.exec(line)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        const textBefore = line.substring(lastIndex, match.index);
        if (textBefore) {
          parts.push(textBefore);
        }
      }
      // Add bold text
      parts.push(
        <strong key={`bold-${key++}`} className="font-semibold text-gray-900">
          {match[1]}
        </strong>
      );
      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < line.length) {
      const remainingText = line.substring(lastIndex);
      if (remainingText) {
        parts.push(remainingText);
      }
    }

    return <>{parts.length > 0 ? parts : line}</>;
  };

  lines.forEach((line, index) => {
    const trimmedLine = line.trim();

    // Check if it's a bullet point (starts with * or - or •)
    if (trimmedLine.match(/^[\*\-\•]\s+/)) {
      // Remove the bullet marker and any extra spaces
      const listItem = trimmedLine.replace(/^[\*\-\•]\s+/, '').trim();
      if (listItem) {
        currentListItems.push(listItem);
      }
    } else {
      // Process any pending list first
      processList();

      // Check if it's a header (starts with #)
      if (trimmedLine.startsWith('#')) {
        const headerMatch = trimmedLine.match(/^(#{1,6})\s+(.+)$/);
        if (headerMatch) {
          const level = headerMatch[1].length;
          const text = headerMatch[2];
          const HeaderTag = `h${Math.min(level, 6)}` as keyof JSX.IntrinsicElements;
          formattedElements.push(
            <HeaderTag
              key={`header-${index}`}
              className={`font-bold text-gray-900 mb-3 mt-6 ${
                level === 1 ? 'text-2xl' :
                level === 2 ? 'text-xl' :
                level === 3 ? 'text-lg' :
                'text-base'
              }`}
            >
              {formatInlineMarkdown(text)}
            </HeaderTag>
          );
          return;
        }
      }

      // Regular paragraph (non-empty line)
      if (trimmedLine) {
        formattedElements.push(
          <p key={`para-${index}`} className="mb-4 text-gray-700 leading-relaxed">
            {formatInlineMarkdown(trimmedLine)}
          </p>
        );
      } else if (index < lines.length - 1) {
        // Empty line for spacing (but not at the end)
        formattedElements.push(<div key={`space-${index}`} className="mb-2" />);
      }
    }
  });

  // Process any remaining list
  processList();

  return formattedElements.length > 0 ? formattedElements : [<p key="empty" className="text-gray-500">No content</p>];
};

interface NotesPopupProps {
  isOpen: boolean;
  onClose: () => void;
  notes: {
    shortNotes: string;
    detailedNotes: string;
    videoTitle: string;
    videoId?: string;
    estimatedReadTime?: {
      shortNotes: number;
      detailedNotes: number;
    };
  };
  type: 'short' | 'detailed';
}

const NotesPopup: React.FC<NotesPopupProps> = ({ isOpen, onClose, notes, type }) => {
  const [copied, setCopied] = useState(false);
  const [integrationStatus, setIntegrationStatus] = useState<IntegrationStatus | null>(null);
  const [isExporting, setIsExporting] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      fetchIntegrationStatus();
    }
  }, [isOpen]);

  const fetchIntegrationStatus = async () => {
    try {
      const status = await integrationService.getStatus();
      setIntegrationStatus(status);
    } catch (error) {
      console.error('Failed to fetch integration status:', error);
    }
  };

  const handleExportToNotion = async () => {
    if (!notes.videoId) {
      toast.error('Video ID is required for export');
      return;
    }

    if (!integrationStatus?.notion?.connected) {
      toast.error('Please connect Notion first in Settings → Integrations', {
        duration: 4000
      });
      navigate('/integrations');
      return;
    }

    try {
      setIsExporting('notion');
      const result = await integrationService.exportNotes(notes.videoId, 'notion');
      
      toast.success('Notes exported to Notion successfully!', {
        duration: 3000,
        style: {
          background: '#10B981',
          color: 'white',
          fontSize: '14px',
          fontWeight: 'bold',
          padding: '12px 20px',
          borderRadius: '8px'
        }
      });

      // Open Notion page if URL is available
      if (result.pageUrl) {
        window.open(result.pageUrl, '_blank');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to export to Notion', {
        duration: 3000,
        style: {
          background: '#EF4444',
          color: 'white',
          fontSize: '14px',
          fontWeight: 'bold',
          padding: '12px 20px',
          borderRadius: '8px'
        }
      });
    } finally {
      setIsExporting(null);
    }
  };

  const handleExportToGoogleDocs = async () => {
    if (!notes.videoId) {
      toast.error('Video ID is required for export');
      return;
    }

    if (!integrationStatus?.googledocs?.connected) {
      toast.error('Please connect Google Docs first in Settings → Integrations', {
        duration: 4000
      });
      navigate('/integrations');
      return;
    }

    try {
      setIsExporting('googledocs');
      const result = await integrationService.exportNotes(notes.videoId, 'googledocs');
      
      toast.success('Notes exported to Google Docs successfully!', {
        duration: 3000,
        style: {
          background: '#10B981',
          color: 'white',
          fontSize: '14px',
          fontWeight: 'bold',
          padding: '12px 20px',
          borderRadius: '8px'
        }
      });

      // Open Google Doc if URL is available
      if (result.documentUrl) {
        window.open(result.documentUrl, '_blank');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to export to Google Docs', {
        duration: 3000,
        style: {
          background: '#EF4444',
          color: 'white',
          fontSize: '14px',
          fontWeight: 'bold',
          padding: '12px 20px',
          borderRadius: '8px'
        }
      });
    } finally {
      setIsExporting(null);
    }
  };

  if (!isOpen) return null;

  const currentNotes = type === 'short' ? notes.shortNotes : notes.detailedNotes;
  const readTime = type === 'short' 
    ? notes.estimatedReadTime?.shortNotes || 5
    : notes.estimatedReadTime?.detailedNotes || 15;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentNotes);
      setCopied(true);
      toast.success('Notes copied to clipboard!', {
        duration: 2000,
        style: {
          background: '#10B981',
          color: 'white',
          fontSize: '14px',
          fontWeight: 'bold',
          padding: '12px 20px',
          borderRadius: '8px'
        }
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy notes', {
        duration: 2000,
        style: {
          background: '#EF4444',
          color: 'white',
          fontSize: '14px',
          fontWeight: 'bold',
          padding: '12px 20px',
          borderRadius: '8px'
        }
      });
    }
  };

  const handleDownload = () => {
    const element = document.createElement('a');
    const file = new Blob([currentNotes], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `${notes.videoTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${type}_notes.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    
    toast.success(`${type === 'short' ? 'Short' : 'Detailed'} notes downloaded!`, {
      duration: 2000,
      style: {
        background: '#10B981',
        color: 'white',
        fontSize: '14px',
        fontWeight: 'bold',
        padding: '12px 20px',
        borderRadius: '8px'
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              {type === 'short' ? (
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {type === 'short' ? 'Short Notes' : 'Detailed Notes'}
              </h2>
              <p className="text-sm text-gray-600">{notes.videoTitle}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-4 text-sm text-gray-500">
              <span className="flex items-center">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                ~{readTime} min read
              </span>
              <span className="flex items-center">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {currentNotes ? currentNotes.split(' ').length : 0} words
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="prose prose-lg max-w-none">
            <div className="text-gray-700 leading-relaxed">
              {formatNotes(currentNotes)}
            </div>
          </div>
        </div>

        {/* Footer - Always visible at bottom with Copy, Download, and Export buttons */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          <div className="flex items-center space-x-3 flex-wrap gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 mr-2 text-green-600" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy
                </>
              )}
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            >
              <Download className="w-4 h-4 mr-2" />
              Download
            </button>
            
            {/* Export to Notion */}
            <button
              onClick={handleExportToNotion}
              disabled={isExporting === 'notion' || !notes.videoId}
              className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${
                integrationStatus?.notion?.connected
                  ? 'text-white bg-black border border-gray-700 hover:bg-gray-800 focus:ring-gray-500'
                  : 'text-gray-500 bg-gray-100 border border-gray-300 cursor-not-allowed opacity-60'
              } ${isExporting === 'notion' ? 'opacity-50 cursor-not-allowed' : ''}`}
              title={integrationStatus?.notion?.connected ? 'Export to Notion' : 'Connect Notion in Settings → Integrations'}
            >
              {isExporting === 'notion' ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <ExternalLink className="w-4 h-4 mr-2" />
                  {integrationStatus?.notion?.connected ? 'Notion' : 'Notion (Connect)'}
                </>
              )}
            </button>

            {/* Export to Google Docs */}
            <button
              onClick={handleExportToGoogleDocs}
              disabled={isExporting === 'googledocs' || !notes.videoId}
              className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${
                integrationStatus?.googledocs?.connected
                  ? 'text-white bg-blue-600 border border-blue-700 hover:bg-blue-700 focus:ring-blue-500'
                  : 'text-gray-500 bg-gray-100 border border-gray-300 cursor-not-allowed opacity-60'
              } ${isExporting === 'googledocs' ? 'opacity-50 cursor-not-allowed' : ''}`}
              title={integrationStatus?.googledocs?.connected ? 'Export to Google Docs' : 'Connect Google Docs in Settings → Integrations'}
            >
              {isExporting === 'googledocs' ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <ExternalLink className="w-4 h-4 mr-2" />
                  {integrationStatus?.googledocs?.connected ? 'Google Docs' : 'Google Docs (Connect)'}
                </>
              )}
            </button>
          </div>
          <div className="text-xs text-gray-500 hidden md:block">
            Generated by Intelligent Learning Assistant (ILA)
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotesPopup;
