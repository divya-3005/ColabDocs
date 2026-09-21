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
    List, ListOrdered, Undo, Redo, Share2, Check
} from 'lucide-react';

import './DocumentEditor.css'

export const DocumentEditor = () => {
    // 1. Pick a single, stable name and color for this user
    const currentUser = useMemo(() => ({
        name: 'User ' + Math.floor(Math.random() * 100),
        color: '#' + Math.floor(Math.random() * 16777215).toString(16),
    }), []);

    // 2. Persistent document and provider
    const [ydoc] = useState(() => new Y.Doc());
    // 1. Get or generate a unique document room ID from the URL
    const roomId = useMemo(() => {
        let hash = window.location.hash.replace('#', '');
        if (!hash) {
            hash = 'doc-' + Math.random().toString(36).substring(2, 9);
            window.location.hash = hash;
        }
        return hash;
    }, []);

    const [provider] = useState(() => {
        return new WebsocketProvider(
            'ws://localhost:1234',
            roomId,
            ydoc
        );
    });
    // 4. Connection Status & Share State
    const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        const statusHandler = (event: { status: 'connecting' | 'connected' | 'disconnected' }) => {
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



    // 3. Connect to Tiptap
    const editor = useEditor({
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
            {/* 0. Top App Header */}
            <div className="doc-header">
                <div className="doc-header-left">
                    <div className="doc-logo">📄</div>
                    <div className="doc-title-wrapper">
                        <input
                            type="text"
                            defaultValue="Untitled Document"
                            className="doc-title-input"
                            title="Rename"
                        />
                        <div className="doc-status-tag">
                            <span className={`status-dot ${connectionStatus}`} />
                            <span>{connectionStatus === 'connected' ? 'Saved to Cloud' : 'Connecting...'}</span>
                        </div>
                    </div>
                </div>

                <div className="doc-header-right">
                    <div className="user-badge" style={{ backgroundColor: currentUser.color }}>
                        {currentUser.name}
                    </div>
                    <button
                        onClick={handleShare}
                        className={`share-btn ${copied ? 'copied' : ''}`}
                    >
                        {copied ? <Check size={16} /> : <Share2 size={16} />}
                        <span>{copied ? 'Link Copied!' : 'Share'}</span>
                    </button>
                </div>
            </div>

            {/* //tool bar */}
            <div className="doc-toolbar">
                {/*buttons*/}
                <button
                    onClick={() => editor.chain().focus().undo().run()}
                    title="Undo"
                >
                    <Undo size={18} />
                </button>
                <button
                    onClick={() => editor.chain().focus().redo().run()}
                    title="Redo"
                >
                    <Redo size={18} />
                </button>

                <div className="toolbar-divider"></div>
                <button onClick={() => editor.chain().focus().toggleBold().run()}
                    className={editor.isActive('bold') ? 'is-active' : ""}
                    title="Bold">
                    <Bold size={18}></Bold>
                </button>
                <button
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    className={editor.isActive('italic') ? 'is-active' : ''}
                    title="Italic"
                >
                    <Italic size={18} />
                </button>
                <button
                    onClick={() => editor.chain().focus().toggleUnderline().run()}
                    className={editor.isActive('underline') ? 'is-active' : ''}
                    title="Underline"
                >
                    <UnderlineIcon size={18} />
                </button>
                <div className="toolbar-divider" />
                <button
                    onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                    className={editor.isActive('heading', { level: 1 }) ? 'is-active' : ''}
                    title="Heading 1"
                >
                    <Heading1 size={18} />
                </button>
                <button
                    onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                    className={editor.isActive('heading', { level: 2 }) ? 'is-active' : ''}
                    title="Heading 2"
                >
                    <Heading2 size={18} />
                </button>

                <div className="toolbar-divider" />
                <button onClick={() =>
                    editor.chain().focus().toggleBulletList().run()}
                    className={editor.isActive('bulletList') ? 'is-active' : ''}
                    title="Bullet List"

                >
                    <List size={18}></List>
                </button>
                <button
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    className={editor.isActive('orderedList') ? 'is-active' : ''}
                    title="Numbered List"
                >
                    <ListOrdered size={18} />
                </button>




            </div>
            <div className="doc-page-wrapper">
                <div className="doc-page">
                    <EditorContent editor={editor}></EditorContent>
                </div>
            </div>
        </div>
    )

}