import { useState, useEffect } from 'react';
import {
    Search, Plus, MoreVertical, FileText, Trash2, Edit2, ExternalLink, RefreshCw
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AccountPopover } from './AccountPopover';
import './Dashboard.css';

interface DocItem {
    id: string;
    title: string;
    view_token?: string;
    owner_id?: string | null;
    owner_name?: string | null;
    owner_email?: string | null;
    created_at: string;
    updated_at: string;
}

export const Dashboard = () => {
    const { currentUser } = useAuth();
    const [documents, setDocuments] = useState<DocItem[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

    // Fetch documents from our Neon PostgreSQL backend
    const loadDocuments = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('http://localhost:1234/api/documents');
            if (res.ok) {
                const data = await res.json();
                setDocuments(data);
            }
        } catch (err) {
            console.error('Failed to load documents:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadDocuments();
    }, []);

    // Close 3-dot dropdown menu on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (!(e.target as HTMLElement).closest('.doc-menu-wrapper')) {
                setMenuOpenId(null);
            }
        };
        window.addEventListener('click', handleClickOutside);
        return () => window.removeEventListener('click', handleClickOutside);
    }, []);

    // 1. Create a new document in Neon PostgreSQL with ownership and open it
    const handleCreateBlank = async () => {
        const newId = 'doc-' + Math.random().toString(36).substring(2, 9);
        try {
            await fetch('http://localhost:1234/api/documents', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: newId,
                    title: 'Untitled document',
                    ownerId: currentUser.id,
                    ownerName: currentUser.name,
                    ownerEmail: currentUser.email,
                }),
            });
        } catch (err) {
            console.error('Error saving new document to DB:', err);
        }
        // Navigate to the new document
        window.location.hash = newId;
    };

    // 2. Open an existing document
    const handleOpenDoc = (id: string) => {
        window.location.hash = id;
    };

    // 3. Rename a document
    const handleRenameDoc = async (id: string, currentTitle: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setMenuOpenId(null);
        const newTitle = window.prompt('Rename document:', currentTitle);
        if (!newTitle || newTitle === currentTitle) return;

        try {
            const res = await fetch(`http://localhost:1234/api/documents/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: newTitle }),
            });
            if (res.ok) {
                setDocuments((prev) =>
                    prev.map((d) => (d.id === id ? { ...d, title: newTitle } : d))
                );
            }
        } catch (err) {
            console.error('Failed to rename document:', err);
        }
    };

    // 4. Delete a document
    const handleDeleteDoc = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setMenuOpenId(null);
        if (!window.confirm('Are you sure you want to delete this document?')) return;

        try {
            const res = await fetch(`http://localhost:1234/api/documents/${id}`, {
                method: 'DELETE',
            });
            if (res.ok) {
                setDocuments((prev) => prev.filter((d) => d.id !== id));
            }
        } catch (err) {
            console.error('Failed to delete document:', err);
        }
    };

    const formatDate = (isoString: string) => {
        try {
            const date = new Date(isoString);
            return date.toLocaleDateString([], {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
            });
        } catch {
            return 'Recently';
        }
    };

    const filteredDocs = documents.filter((doc) =>
        doc.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="dashboard-container">
            {/* 1. Authentic Google Docs Navigation Header */}
            <header className="dashboard-header">
                <div className="dashboard-brand">
                    <div className="dashboard-logo" title="ColabDocs Home">
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
                    <span className="dashboard-title">ColabDocs</span>
                </div>

                <div className="dashboard-search-wrapper">
                    <Search size={18} className="search-icon" />
                    <input
                        type="text"
                        placeholder="Search your documents..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="dashboard-search-input"
                    />
                </div>

                <div className="dashboard-header-right">
                    <button onClick={loadDocuments} className="refresh-btn" title="Refresh documents">
                        <RefreshCw size={16} />
                    </button>
                    <AccountPopover />
                </div>
            </header>

            {/* 2. Template Bar: "Start a new document" */}
            <section className="dashboard-templates-section">
                <div className="templates-content">
                    <div className="section-title">Start a new document</div>
                    <div className="templates-row">
                        <div className="template-card-wrapper" onClick={handleCreateBlank}>
                            <div className="template-card blank-card">
                                <div className="plus-icon-container">
                                    <Plus size={36} className="plus-icon" />
                                </div>
                            </div>
                            <span className="template-label">Blank document</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* 3. Recent Documents List / Grid */}
            <main className="dashboard-recent-section">
                <div className="recent-header">
                    <h2>Recent documents</h2>
                    <span className="doc-count">
                        {filteredDocs.length} {filteredDocs.length === 1 ? 'document' : 'documents'}
                    </span>
                </div>

                {isLoading ? (
                    <div className="dashboard-loading">
                        <RefreshCw size={24} className="spinning" />
                        <p>Loading documents from Neon PostgreSQL...</p>
                    </div>
                ) : filteredDocs.length === 0 ? (
                    <div className="dashboard-empty">
                        <FileText size={48} className="empty-icon" />
                        <h3>No documents found</h3>
                        <p>Click "+ Blank document" above to create your first collaborative document!</p>
                    </div>
                ) : (
                    <div className="docs-grid">
                        {filteredDocs.map((doc) => (
                            <div
                                key={doc.id}
                                className="doc-card"
                                onClick={() => handleOpenDoc(doc.id)}
                            >
                                {/* Thumbnail Sheet Preview */}
                                <div className="doc-card-thumb">
                                    <div className="doc-thumb-paper">
                                        <div className="doc-thumb-line line-title" />
                                        <div className="doc-thumb-line line-body" />
                                        <div className="doc-thumb-line line-body short" />
                                    </div>
                                </div>

                                {/* Card Metadata Footer */}
                                <div className="doc-card-info">
                                    <div className="doc-card-title-row">
                                        <FileText size={16} className="doc-type-icon" />
                                        <span className="doc-card-title" title={doc.title}>
                                            {doc.title}
                                        </span>
                                    </div>

                                    <div className="doc-card-meta-row">
                                        <span className="doc-card-date">
                                            {doc.owner_name ? (doc.owner_id === currentUser.id ? 'Owned by me' : doc.owner_name) : 'Public'} • {formatDate(doc.updated_at)}
                                        </span>

                                        <div className="doc-menu-wrapper" onClick={(e) => e.stopPropagation()}>
                                            <button
                                                onClick={() =>
                                                    setMenuOpenId(menuOpenId === doc.id ? null : doc.id)
                                                }
                                                className="doc-menu-btn"
                                                title="Options"
                                            >
                                                <MoreVertical size={16} />
                                            </button>

                                            {menuOpenId === doc.id && (
                                                <div className="doc-dropdown">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            window.open(`#${doc.id}`, '_blank');
                                                            setMenuOpenId(null);
                                                        }}
                                                        className="doc-dropdown-item"
                                                    >
                                                        <ExternalLink size={14} />
                                                        <span>Open in new tab</span>
                                                    </button>
                                                    <button
                                                        onClick={(e) => handleRenameDoc(doc.id, doc.title, e)}
                                                        className="doc-dropdown-item"
                                                    >
                                                        <Edit2 size={14} />
                                                        <span>Rename</span>
                                                    </button>
                                                    <div className="dropdown-divider" />
                                                    <button
                                                        onClick={(e) => handleDeleteDoc(doc.id, e)}
                                                        className="doc-dropdown-item danger"
                                                    >
                                                        <Trash2 size={14} />
                                                        <span>Remove</span>
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
};
