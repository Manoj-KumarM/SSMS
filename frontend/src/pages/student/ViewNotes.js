import React, { useState, useEffect } from 'react';
import { api } from '../../contexts/AuthContext';
import { FileText, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

const ViewNotes = () => {
  const [notes, setNotes] = useState([]);

  useEffect(() => { fetchNotes(); }, []);

  const fetchNotes = async () => {
    try { const { data } = await api.get('/api/student/notes'); setNotes(data); } catch (e) { toast.error('Failed to fetch notes'); }
  };

  return (
    <div className="p-8" data-testid="view-notes-page">
      <div className="mb-8">
        <h1 className="text-4xl font-black tracking-tight mb-2">COURSE NOTES</h1>
        <p className="text-base text-zinc-600">Download materials shared by teachers</p>
      </div>

      {notes.length === 0 && (
        <div className="text-center p-12 text-zinc-400 border border-zinc-200">No notes available yet</div>
      )}

      <div className="space-y-4">
        {notes.map((note) => (
          <div key={note.id} className="border border-zinc-200 p-6 hover:border-black duration-150 flex items-center justify-between" data-testid="note-card">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-[#002FA7] flex items-center justify-center flex-shrink-0">
                <FileText size={20} className="text-white" />
              </div>
              <div>
                <h3 className="font-black">{note.title}</h3>
                <p className="text-sm text-zinc-400">{note.subject?.subject_name} ({note.subject?.subject_code})</p>
                <p className="text-xs text-zinc-400 mt-1">{new Date(note.created_at).toLocaleDateString()}</p>
              </div>
            </div>
            <a href={note.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-[#002FA7] hover:text-[#00227A] font-bold text-sm uppercase tracking-wider" data-testid="download-note-link">
              <ExternalLink size={16} /> OPEN
            </a>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ViewNotes;
