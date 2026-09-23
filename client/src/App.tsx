import { useState, useEffect } from 'react';
import { DocumentEditor } from './components/DocumentEditor';
import { Dashboard } from './components/Dashboard';

function App() {
  const [currentHash, setCurrentHash] = useState(() => window.location.hash);

  useEffect(() => {
    const handleHashChange = () => {
      setCurrentHash(window.location.hash);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // If the hash starts with #doc- or #view-, open the collaborative document editor!
  // Otherwise, display the authentic Google Docs Home Dashboard!
  const isEditingDoc = currentHash.startsWith('#doc-') || currentHash.startsWith('#view-');

  return (
    <div>
      {isEditingDoc ? (
        <DocumentEditor key={currentHash.split('?')[0]} />
      ) : (
        <Dashboard />
      )}
    </div>
  );
}

export default App;
