import { useState, useEffect, useMemo } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';

import {
    Bold, Italic, Underline as UnderlineIcon, Heading1, Heading2,
    List, ListOrdered, Undo, Redo, Lock, Check, Eye, Cloud, Star,
    FileText, Code, History, X, Link2, Globe
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AccountPopover } from './AccountPopover';
import './DocumentEditor.css';

interface DocVersion {
    id: string;
    timestamp: string;
    author: string;
    color: string;
    content: string;
}

interface Collaborator {
    clientId: number;
    name: string;
    color: string;
}

export const DocumentEditor = () => {
    // 1. Authenticated global user profile
    const { currentUser } = useAuth();

    // 2. Persistent document and provider
    const [ydoc] = useState(() => new Y.Doc());

    // 3. Resolve Document Route & Security Key
    const initialKey = useMemo(() => {
        let hash = window.location.hash.replace('#', '');
        if (hash.includes('?')) hash = hash.split('?')[0];
        if (!hash) {
            hash = 'doc-' + Math.random().toString(36).substring(2, 9);
            window.location.hash = hash;
        }
        return hash;
    }, []);

    // 4. Role detection: If hash is #view-..., user is strictly a viewer!
    const isCapabilityViewUrl = initialKey.startsWith('view-');
    const [userRole, setUserRole] = useState<'editor' | 'viewer'>(isCapabilityViewUrl ? 'viewer' : 'editor');
    const [actualDocId, setActualDocId] = useState<string>(isCapabilityViewUrl ? '' : initialKey);
    const [viewToken, setViewToken] = useState<string>(isCapabilityViewUrl ? initialKey : '');
    const [docTitle, setDocTitle] = useState('Untitled document');
    const [docOwner, setDocOwner] = useState<{ id?: string; name?: string; email?: string } | null>(null);

    // Connect to Yjs room (using actual doc id once resolved)
    const provider = useMemo(() => {
        const room = actualDocId || initialKey;
        return new WebsocketProvider('ws://localhost:1234', room, ydoc);
    }, [actualDocId, initialKey, ydoc]);

    // 5. Connection Status & Share State
    const [connectionStatus, setConnectionStatus] = useState<
        'connecting' | 'connected' | 'disconnected'
    >('connecting');

    // Fetch document title, owner, and resolve capability token from Neon DB
    useEffect(() => {
        const syncDocWithDb = async () => {
            try {
                if (isCapabilityViewUrl) {
                    // Resolve capability viewer token from Neon DB
                    const res = await fetch(`http://localhost:1234/api/documents/resolve/${initialKey}`);
                    if (res.ok) {
                        const data = await res.json();
                        setActualDocId(data.docId);
                        setDocTitle(data.title);
                        setUserRole('viewer');
                        setViewToken(data.viewToken);
                        if (data.ownerName) {
                            setDocOwner({ id: data.ownerId, name: data.ownerName, email: data.ownerEmail });
                        }
                    }
                } else {
                    // Master editor route: ensure document is in DB and obtain view_token & owner
                    const res = await fetch('http://localhost:1234/api/documents', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            id: initialKey,
                            title: docTitle,
                            ownerId: currentUser.id,
                            ownerName: currentUser.name,
                            ownerEmail: currentUser.email,
                        }),
                    });
                    if (res.ok) {
                        const data = await res.json();
                        if (data.title) setDocTitle(data.title);
                        if (data.view_token) setViewToken(data.view_token);
                        if (data.owner_name) {
                            setDocOwner({ id: data.owner_id, name: data.owner_name, email: data.owner_email });
                        }
                    }
                }
            } catch (err) {
                console.error('Error syncing doc with DB:', err);
            }
        };
        syncDocWithDb();
    }, [initialKey, isCapabilityViewUrl, currentUser.id, currentUser.name, currentUser.email]);

    const handleTitleChange = (newTitle: string) => {
        if (userRole !== 'editor') return;
        setDocTitle(newTitle);
        fetch(`http://localhost:1234/api/documents/${actualDocId || initialKey}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: newTitle }),
        }).catch((err) => console.error('Error updating title:', err));
    };

    // 6. Version History State
    const [versions, setVersions] = useState<DocVersion[]>([]);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);


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

    // Live Active Collaborators Tracking (Awareness with Deduplication)
    const [activeUsers, setActiveUsers] = useState<Collaborator[]>([]);

    useEffect(() => {
        const updateAwareness = () => {
            const states = provider.awareness.getStates();
            // Deduplicate by name so 1 person = exactly 1 avatar (cleans up any ghost refresh sessions)
            const uniqueMap = new Map<string, Collaborator>();

            states.forEach((state, clientId) => {
                if (state.user && state.user.name) {
                    uniqueMap.set(state.user.name, {
                        clientId,
                        name: state.user.name,
                        color: state.user.color || '#2563eb',
                    });
                }
            });

            setActiveUsers(Array.from(uniqueMap.values()));
        };

        provider.awareness.on('change', updateAwareness);
        updateAwareness();

        // Immediate cleanup on tab close or page navigation
        const handleUnload = () => {
            provider.awareness.setLocalState(null);
        };
        window.addEventListener('beforeunload', handleUnload);

        return () => {
            window.removeEventListener('beforeunload', handleUnload);
            provider.awareness.off('change', updateAwareness);
            provider.awareness.setLocalState(null);
        };
    }, [provider]);

    // Keep local awareness in sync with the authenticated user profile
    useEffect(() => {
        provider.awareness.setLocalStateField('user', {
            name: currentUser.name,
            color: currentUser.color || '#2563eb',
            email: currentUser.email,
        });
    }, [provider, currentUser]);

    // Share Modal & Capability Link State
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [sharePermission, setSharePermission] = useState<'editor' | 'viewer'>('editor');
    const [shareCopied, setShareCopied] = useState(false);

    const handleCopyShareLink = () => {
        const baseUrl = window.location.origin + window.location.pathname;
        // Distinct Capability Link: Viewer receives a completely separate #view-... cryptographic link!
        const link = sharePermission === 'viewer'
            ? `${baseUrl}#${viewToken || ('view-' + (actualDocId || initialKey).replace('doc-', ''))}`
            : `${baseUrl}#${actualDocId || initialKey}`;

        navigator.clipboard.writeText(link);
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2500);
    };

    // 7. File Menu & Export Logic
    const [isFileMenuOpen, setIsFileMenuOpen] = useState(false);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (!(e.target as HTMLElement).closest('.gdocs-menu-item-wrapper')) {
                setIsFileMenuOpen(false);
            }
        };
        window.addEventListener('click', handleClickOutside);
        return () => window.removeEventListener('click', handleClickOutside);
    }, []);

    const exportToPDF = () => {
        setIsFileMenuOpen(false);
        window.print();
    };

    const exportToMarkdown = () => {
        setIsFileMenuOpen(false);
        if (!editor) return;

        const html = editor.getHTML();
        // Convert basic HTML to Markdown
        const md = html
            .replace(/<h1>(.*?)<\/h1>/gi, '# $1\n\n')
            .replace(/<h2>(.*?)<\/h2>/gi, '## $1\n\n')
            .replace(/<p>(.*?)<\/p>/gi, '$1\n\n')
            .replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
            .replace(/<em>(.*?)<\/em>/gi, '*$1*')
            .replace(/<u>(.*?)<\/u>/gi, '_$1_')
            .replace(/<li>(.*?)<\/li>/gi, '- $1\n')
            .replace(/<ul>|<\/ul>|<ol>|<\/ol>/gi, '\n')
            .replace(/&nbsp;/g, ' ')
            .trim();

        const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${docTitle || 'document'}.md`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // 8. Save & Restore Snapshot Logic
    const saveVersion = () => {
        if (!editor) return;
        const content = editor.getHTML();

        // Don't save empty document snapshots
        if (!content || content === '<p></p>') return;

        const newVersion: DocVersion = {
            id: 'v-' + Date.now(),
            timestamp: new Date().toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
            }),
            author: currentUser.name,
            color: currentUser.color,
            content: content,
        };

        setVersions((prev) => [newVersion, ...prev]);
    };

    const restoreVersion = (version: DocVersion) => {
        if (!editor) return;
        // Overwrites the editor and syncs the rollback to all collaborators via Yjs
        editor.commands.setContent(version.content);
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
    }, [userRole, provider]);

    useEffect(() => {
        if (editor) {
            editor.setEditable(userRole === 'editor');
        }
    }, [editor, userRole]);

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
                    <div
                        className="gdocs-logo"
                        title="Back to ColabDocs Home"
                        onClick={() => { window.location.hash = ''; }}
                        style={{ cursor: 'pointer' }}
                    >
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
                                onChange={(e) => handleTitleChange(e.target.value)}
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
                            <button
                                onClick={() => setIsHistoryOpen(true)}
                                className="gdocs-icon-btn history-toggle-btn"
                                title="Version history"
                            >
                                <History size={14} />
                            </button>
                        </div>

                        {/* Authentic Google Docs Menu Bar */}
                        <nav className="gdocs-menu-bar">
                            <div className="gdocs-menu-item-wrapper">
                                <span
                                    onClick={() => setIsFileMenuOpen(!isFileMenuOpen)}
                                    className={isFileMenuOpen ? 'is-active' : ''}
                                >
                                    File
                                </span>

                                {isFileMenuOpen && (
                                    <div className="gdocs-dropdown">
                                        <div className="dropdown-label">Download</div>
                                        <button onClick={exportToPDF} className="dropdown-item">
                                            <FileText size={15} />
                                            <span>PDF Document (.pdf)</span>
                                        </button>
                                        <button onClick={exportToMarkdown} className="dropdown-item">
                                            <Code size={15} />
                                            <span>Markdown (.md)</span>
                                        </button>

                                        <div className="dropdown-divider" />

                                        <div className="dropdown-label">History</div>
                                        <button
                                            onClick={() => {
                                                setIsFileMenuOpen(false);
                                                setIsHistoryOpen(true);
                                            }}
                                            className="dropdown-item"
                                        >
                                            <History size={15} />
                                            <span>Version history</span>
                                        </button>
                                    </div>
                                )}
                            </div>

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

                    {/* Stacked Remote Collaborator Avatars */}
                    <div className="gdocs-avatars-group">
                        {activeUsers
                            .filter((user) => user.name !== currentUser.name)
                            .map((user) => (
                                <div
                                    key={user.clientId}
                                    className="gdocs-avatar"
                                    style={{ backgroundColor: user.color }}
                                >
                                    {user.name.charAt(0).toUpperCase()}
                                    <span className="avatar-tooltip">
                                        {user.name}
                                    </span>
                                </div>
                            ))}
                    </div>

                    {/* Authentic Google Account Popover */}
                    <AccountPopover />



                    {/* Authentic Google Share Button */}
                    <button
                        onClick={() => setIsShareModalOpen(true)}
                        className="gdocs-share-btn"
                        title="Share document permissions"
                    >
                        <Lock size={15} />
                        <span>Share</span>
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

            {/* 3. Physical Paper Canvas & Workspace with History Drawer */}
            <div className="gdocs-workspace">
                <div className="gdocs-desk">
                    <div className="gdocs-paper">
                        <EditorContent editor={editor} />
                    </div>
                </div>

                {isHistoryOpen && (
                    <aside className="gdocs-history-sidebar">
                        <div className="history-header">
                            <div className="history-title-group">
                                <History size={16} />
                                <h3>Version history</h3>
                            </div>
                            <button
                                onClick={() => setIsHistoryOpen(false)}
                                className="history-close-btn"
                                title="Close version history"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="history-actions">
                            <button onClick={saveVersion} className="history-snapshot-btn">
                                + Save snapshot
                            </button>
                        </div>

                        <div className="history-list">
                            {versions.length === 0 ? (
                                <div className="history-empty">
                                    <p>No snapshots saved yet.</p>
                                    <span>Click "+ Save snapshot" to record the current state of this document.</span>
                                </div>
                            ) : (
                                versions.map((ver) => (
                                    <div key={ver.id} className="history-card">
                                        <div className="history-card-header">
                                            <span className="history-time">{ver.timestamp}</span>
                                            <button
                                                onClick={() => restoreVersion(ver)}
                                                className="history-restore-btn"
                                                title="Restore this version"
                                            >
                                                Restore
                                            </button>
                                        </div>
                                        <div className="history-card-user">
                                            <span
                                                className="history-user-badge"
                                                style={{ backgroundColor: ver.color }}
                                            />
                                            <span className="history-user-name">{ver.author}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </aside>
                )}
            </div>

            {/* 4. Authentic Google Docs Share Dialog */}
            {isShareModalOpen && (
                <div className="gdocs-modal-overlay" onClick={() => setIsShareModalOpen(false)}>
                    <div className="gdocs-share-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="share-modal-header">
                            <h3>Share "{docTitle}"</h3>
                            <button
                                onClick={() => setIsShareModalOpen(false)}
                                className="share-modal-close-btn"
                                title="Close"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="share-modal-body">
                            <div className="share-section-title">People with access</div>
                            <div className="share-access-card" style={{ marginBottom: 12 }}>
                                <div
                                    className="share-access-icon-wrapper"
                                    style={{
                                        backgroundColor: docOwner?.id === currentUser.id ? (currentUser.color || '#2563eb') : '#e8f0fe',
                                        color: docOwner?.id === currentUser.id ? '#ffffff' : '#1a73e8',
                                        fontWeight: 600,
                                        fontSize: 14,
                                    }}
                                >
                                    {(docOwner?.name || currentUser.name).charAt(0).toUpperCase()}
                                </div>
                                <div className="share-access-text">
                                    <span className="share-access-main">
                                        {docOwner?.name || currentUser.name} {(!docOwner?.id || docOwner?.id === currentUser.id) ? '(you)' : ''}
                                    </span>
                                    <span className="share-access-desc">
                                        {docOwner?.email || currentUser.email}
                                    </span>
                                </div>
                                <span className="share-owner-tag">Owner</span>
                            </div>

                            <div className="share-section-title">General access</div>

                            <div className="share-access-card">
                                <div className="share-access-icon-wrapper">
                                    <Globe size={20} />
                                </div>
                                <div className="share-access-text">
                                    <span className="share-access-main">Anyone with the link</span>
                                    <span className="share-access-desc">
                                        {sharePermission === 'editor'
                                            ? 'Anyone on the internet with this link can make live edits'
                                            : 'Anyone on the internet with this link can only view'}
                                    </span>
                                </div>
                                <div className="share-permission-picker">
                                    <select
                                        value={sharePermission}
                                        onChange={(e) => setSharePermission(e.target.value as 'editor' | 'viewer')}
                                        className="share-role-select"
                                    >
                                        <option value="editor">Editor</option>
                                        <option value="viewer">Viewer</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="share-modal-footer">
                            <button
                                onClick={handleCopyShareLink}
                                className={`share-copy-btn ${shareCopied ? 'copied' : ''}`}
                            >
                                {shareCopied ? <Check size={16} /> : <Link2 size={16} />}
                                <span>{shareCopied ? 'Link copied' : 'Copy link'}</span>
                            </button>

                            <button
                                onClick={() => setIsShareModalOpen(false)}
                                className="share-done-btn"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};