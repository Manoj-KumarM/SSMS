import React, { useState, useEffect } from 'react';
import { api } from '../../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const ManageNotes = () => {
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [title, setTitle] = useState('');
  const [fileUrl, setFileUrl] = useState('');

  useEffect(() => { fetchSubjects(); }, []);

  const fetchSubjects = async () => {
    try { const { data } = await api.get('/api/teacher/subjects'); setSubjects(data); } catch (e) { console.error(e); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/teacher/notes', {
        subject_id: selectedSubject,
        title: title,
        file_url: fileUrl
      });
      toast.success('Notes uploaded');
      setTitle('');
      setFileUrl('');
    } catch (error) { toast.error(error.response?.data?.detail || 'Failed to upload notes'); }
  };

  return (
    <div className="p-8" data-testid="manage-notes-page">
      <div className="mb-8">
        <h1 className="text-4xl font-black tracking-tight mb-2">UPLOAD NOTES</h1>
        <p className="text-base text-zinc-600">Share course materials with students</p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-xl space-y-6">
        <div>
          <Label className="text-xs uppercase tracking-widest font-bold">Subject</Label>
          <Select onValueChange={(v) => setSelectedSubject(v)}>
            <SelectTrigger className="rounded-none" data-testid="notes-subject-select"><SelectValue placeholder="Choose subject" /></SelectTrigger>
            <SelectContent>
              {subjects.map((a) => <SelectItem key={a.subject_id} value={a.subject_id}>{a.subject?.subject_name} ({a.subject?.subject_code})</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs uppercase tracking-widest font-bold">Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="e.g., Chapter 1 Notes" className="rounded-none" data-testid="notes-title-input" />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-widest font-bold">File URL (PDF Link)</Label>
          <Input value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} required placeholder="https://example.com/notes.pdf" className="rounded-none" data-testid="notes-url-input" />
        </div>
        <Button type="submit" className="w-full bg-[#002FA7] hover:bg-[#00227A] text-white rounded-none h-12 font-bold uppercase tracking-wider" data-testid="upload-notes-button">UPLOAD NOTES</Button>
      </form>
    </div>
  );
};

export default ManageNotes;
