import { useState, useEffect, useMemo } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';


import { Bold, Italic, Underline as UnderlineIcon, Heading1, Heading2, List, ListOrdered, Undo, Redo } from 'lucide-react';
import './DocumentEditor.css'

export const DocumentEditor = () => {
    // 1. Pick a single, stable name and color for this user
    const currentUser = useMemo(() => ({
        name: 'User ' + Math.floor(Math.random() * 100),
        color: '#' + Math.floor(Math.random() * 16777215).toString(16),
    }), []);

    // 2. Persistent document and provider
    const [ydoc] = useState(() => new Y.Doc());
    const [provider] = useState(() => {
        return new WebsocketProvider(
            'ws://localhost:1234',
            'colabdocs-demo-room',
            ydoc
        );
    });

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