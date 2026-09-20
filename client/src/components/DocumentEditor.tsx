import { useState, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';

import { Bold, Italic, Underline as UnderlineIcon, Heading1, Heading2, List, ListOrdered, Undo, Redo } from 'lucide-react';
import './DocumentEditor.css'

export const DocumentEditor = () => {
    const editor = useEditor({
        extensions: [StarterKit, Underline],
        content: `
        <h1>Untitled Document</h1>
        <p>Start typing your thoughts, notes, or collaborating with your team in real time...</p>
        `
    })
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