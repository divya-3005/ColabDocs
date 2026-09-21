import { useState, useEffect, useMemo } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';

import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Undo,
  Redo,
  Lock,
  Check,
  Eye,
  Cloud,
  Star,
} from 'lucide-react';

import './DocumentEditor.css';

export const DocumentEditor = () => {
  // 1. Pick a single, stable name and color for this user
  const currentUser = useMemo(
    () => ({
      name: 'User ' + Math.floor(Math.random() * 100),
      color: '#' + Math.floor(Math.random() * 16777215).toString(16),
    }),
    []
  );

  // 2. Persistent document and provider
  const [ydoc] = useState(() => new Y.Doc());

  // 3. Get or generate a unique document room ID from the URL
  const roomId = useMemo(() => {
    let hash = window.location.hash.replace('#', '');
    if (!hash) {
      hash = 'doc-' + Math.random().toString(36).substring(2, 9);
      window.location.hash = hash;
    }
    return hash;
  }, []);

  // 4. Detect if the user is an 'editor' or 'viewer'
  const userRole = useMemo(() => {
    const hash = window.location.hash;
    const queryString = hash.includes('?') ? hash.split('?')[1] : window.location.search;
    const params = new URLSearchParams(queryString);
    return params.get('role') === 'viewer' ? 'viewer' : 'editor';
  }, []);

  const [provider] = useState(() => {
    return new WebsocketProvider('ws://localhost:1234', roomId, ydoc);
  });

  // 5. Connection Status & Share State
  const [connectionStatus, setConnectionStatus] = useState<
    'connecting' | 'connected' | 'disconnected'
  >('connecting');
  const [copied, setCopied] = useState(false);
  const [docTitle, setDocTitle] = useState('Untitled document');

  useEffect(() => {
    const statusHandler = (event: {
      status: 'connecting' | 'connected' | 'disconnected';
    }) => {
      setConnectionStatus(event.status);
    };
    provider.on('status', statusHandler);
    return () => {
      provider.off('status', statusHandler);
    };
  }, [provider]);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 6. Connect to Tiptap
  const editor = useEditor({
    editable: userRole === 'editor',
    extensions: [
      StarterKit.configure({ history: false }),
      Underline,
      Collaboration.configure({
        document: ydoc,
      }),
      CollaborationCursor.configure({
        provider: provider,
        user: currentUser,
      }),
    ],
  });

  const [, setTick] = useState(0);

  useEffect(() => {
    if (!editor) return;
    const handleUpdate = () => setTick((tick) => tick + 1);
    editor.on('transaction', handleUpdate);
    return () => {
      editor.off('transaction', handleUpdate);
    };
  }, [editor]);

  if (!editor) {
    return null;
  }

  return (
    <div className="doc-container">
      {/* 1. Authentic Google Docs Header */}
      <header className="gdocs-header">
        <div className="gdocs-header-left">
          {/* Authentic Google Docs Blue Document SVG */}
          <div className="gdocs-logo" title="Docs home">
            <svg viewBox="0 0 40 40" width="36" height="36">
              <path
                d="M25.333 4H10.667C8.467 4 6.68 5.8 6.68 8L6.667 32c0 2.2 1.787 4 3.987 4H29.333c2.2 0 4-1.8 4-4V12L25.333 4z"
                fill="#4285F4"
              />
              <path d="M25.333 4V12H33.333L25.333 4z" fill="#A1C2FA" />
              <path
                d="M26.667 22.667H13.333V20h13.334v2.667zm0 5.333H13.333V25.333h13.334V28zM13.333 17.333h8v-2.666h-8v2.666z"
                fill="#FFFFFF"
              />
            </svg>
          </div>

          <div className="gdocs-title-block">
            <div className="gdocs-title-row">
              <input
                type="text"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                className="gdocs-title-input"
                title="Rename document"
              />
              <button className="gdocs-icon-btn" title="Star">
                <Star size={14} className="star-icon" />
              </button>
              <div className="gdocs-save-status">
                <Cloud size={14} />
                <span>
                  {connectionStatus === 'connected'
                    ? 'Saved to Drive'
                    : 'Connecting...'}
                </span>
              </div>
            </div>

            {/* Authentic Google Docs Menu Bar */}
            <nav className="gdocs-menu-bar">
              <span>File</span>
              <span>Edit</span>
              <span>View</span>
              <span>Insert</span>
              <span>Format</span>
              <span>Tools</span>
              <span>Extensions</span>
              <span>Help</span>
            </nav>
          </div>
        </div>

        <div className="gdocs-header-right">
          {userRole === 'viewer' && (
            <div className="gdocs-view-tag">
              <Eye size={14} />
              <span>View only</span>
            </div>
          )}

          {/* User Avatar Circle */}
          <div
            className="gdocs-avatar"
            style={{ backgroundColor: currentUser.color }}
            title={currentUser.name}
          >
            {currentUser.name.charAt(0)}
          </div>

          {/* Authentic Google Share Button */}
          <button
            onClick={handleShare}
            className={`gdocs-share-btn ${copied ? 'copied' : ''}`}
          >
            {copied ? <Check size={16} /> : <Lock size={15} />}
            <span>{copied ? 'Link copied' : 'Share'}</span>
          </button>
        </div>
      </header>

      {/* 2. Pinned Full-Width Toolbar for Editors OR View-Only Banner */}
      {userRole === 'editor' ? (
        <div className="gdocs-toolbar">
          <button
            onClick={() => editor.chain().focus().undo().run()}
            title="Undo (Ctrl+Z)"
            className="toolbar-btn"
          >
            <Undo size={16} />
          </button>
          <button
            onClick={() => editor.chain().focus().redo().run()}
            title="Redo (Ctrl+Y)"
            className="toolbar-btn"
          >
            <Redo size={16} />
          </button>

          <div className="gdocs-divider" />

          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={`toolbar-btn ${editor.isActive('heading', { level: 1 }) ? 'is-active' : ''}`}
            title="Heading 1"
          >
            <Heading1 size={16} />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`toolbar-btn ${editor.isActive('heading', { level: 2 }) ? 'is-active' : ''}`}
            title="Heading 2"
          >
            <Heading2 size={16} />
          </button>

          <div className="gdocs-divider" />

          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`toolbar-btn ${editor.isActive('bold') ? 'is-active' : ''}`}
            title="Bold (Ctrl+B)"
          >
            <Bold size={16} />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`toolbar-btn ${editor.isActive('italic') ? 'is-active' : ''}`}
            title="Italic (Ctrl+I)"
          >
            <Italic size={16} />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={`toolbar-btn ${editor.isActive('underline') ? 'is-active' : ''}`}
            title="Underline (Ctrl+U)"
          >
            <UnderlineIcon size={16} />
          </button>

          <div className="gdocs-divider" />

          <button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`toolbar-btn ${editor.isActive('bulletList') ? 'is-active' : ''}`}
            title="Bulleted list"
          >
            <List size={16} />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`toolbar-btn ${editor.isActive('orderedList') ? 'is-active' : ''}`}
            title="Numbered list"
          >
            <ListOrdered size={16} />
          </button>
        </div>
      ) : (
        <div className="gdocs-view-banner">
          <Eye size={15} />
          <span>You are viewing this document in read-only mode. Live edits by collaborators appear automatically.</span>
        </div>
      )}

      {/* 3. Physical Paper Canvas & Desk Area */}
      <div className="gdocs-desk">
        <div className="gdocs-paper">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
};