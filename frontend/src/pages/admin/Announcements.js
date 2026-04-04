import React, { useState, useEffect } from 'react';
import { api } from '../../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Megaphone, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const Announcements = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [formData, setFormData] = useState({ title: '', message: '', branch: '', semester: '', section: '' });

  useEffect(() => { fetchAnnouncements(); }, []);

  const fetchAnnouncements = async () => {
    try { const { data } = await api.get('/api/admin/announcements'); setAnnouncements(data); } catch (e) { toast.error('Failed to fetch announcements'); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...formData, semester: parseInt(formData.semester) };
      if (editingAnnouncement) {
        await api.put(`/api/admin/announcements/${editingAnnouncement.id}`, payload);
        toast.success('Announcement updated');
      } else {
        await api.post('/api/admin/announcements', payload);
        toast.success('Announcement created');
      }
      setIsDialogOpen(false);
      setEditingAnnouncement(null);
      setFormData({ title: '', message: '', branch: '', semester: '', section: '' });
      fetchAnnouncements();
    } catch (error) { toast.error(error.response?.data?.detail || 'Operation failed'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this announcement?')) return;
    try {
      await api.delete(`/api/admin/announcements/${id}`);
      toast.success('Announcement deleted');
      fetchAnnouncements();
    } catch (error) { toast.error('Failed to delete announcement'); }
  };

  const openEdit = (a) => {
    setEditingAnnouncement(a);
    setFormData({ title: a.title, message: a.message, branch: a.branch, semester: String(a.semester), section: a.section });
    setIsDialogOpen(true);
  };

  return (
    <div className="p-8" data-testid="announcements-page">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-black tracking-tight mb-2">ANNOUNCEMENTS</h1>
          <p className="text-base text-zinc-600">Broadcast announcements to students</p>
        </div>
        <Button onClick={() => { setEditingAnnouncement(null); setFormData({ title: '', message: '', branch: '', semester: '', section: '' }); setIsDialogOpen(true); }} className="bg-[#002FA7] hover:bg-[#00227A] text-white rounded-none font-bold uppercase" data-testid="create-announcement-button">
          <Plus size={18} className="mr-2" /> NEW ANNOUNCEMENT
        </Button>
      </div>

      <div className="space-y-4">
        {announcements.map((a) => (
          <div key={a.id} className="border border-zinc-200 p-6 hover:border-black duration-150" data-testid="announcement-card">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-[#002FA7] flex items-center justify-center flex-shrink-0"><Megaphone size={20} className="text-white" /></div>
              <div className="flex-1">
                <h3 className="text-lg font-black">{a.title}</h3>
                <p className="text-zinc-600 mt-1">{a.message}</p>
                <div className="flex gap-4 mt-3 text-xs uppercase tracking-widest font-bold text-zinc-400">
                  <span>{a.branch}</span><span>SEM {a.semester}</span><span>SEC {a.section}</span>
                  <span>{new Date(a.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => openEdit(a)} className="p-2 hover:bg-zinc-100 duration-150" data-testid="edit-announcement-button"><Pencil size={16} /></button>
                <button onClick={() => handleDelete(a.id)} className="p-2 hover:bg-red-50 text-[#FF2A2A] duration-150" data-testid="delete-announcement-button"><Trash2 size={16} /></button>
              </div>
            </div>
          </div>
        ))}
        {announcements.length === 0 && <div className="text-center p-12 text-zinc-400 border border-zinc-200">No announcements yet</div>}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg bg-white border-4 border-black rounded-none">
          <DialogHeader><DialogTitle className="text-2xl font-black">{editingAnnouncement ? 'EDIT ANNOUNCEMENT' : 'NEW ANNOUNCEMENT'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div><Label className="text-xs uppercase tracking-widest font-bold">Title</Label><Input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} required className="rounded-none" data-testid="announcement-title-input" /></div>
            <div><Label className="text-xs uppercase tracking-widest font-bold">Message</Label><Textarea value={formData.message} onChange={(e) => setFormData({ ...formData, message: e.target.value })} required className="rounded-none min-h-[100px]" data-testid="announcement-message-input" /></div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label className="text-xs uppercase tracking-widest font-bold">Branch</Label><Input value={formData.branch} onChange={(e) => setFormData({ ...formData, branch: e.target.value })} required className="rounded-none" data-testid="announcement-branch-input" /></div>
              <div><Label className="text-xs uppercase tracking-widest font-bold">Semester</Label><Input type="number" value={formData.semester} onChange={(e) => setFormData({ ...formData, semester: e.target.value })} required className="rounded-none" data-testid="announcement-semester-input" /></div>
              <div><Label className="text-xs uppercase tracking-widest font-bold">Section</Label><Input value={formData.section} onChange={(e) => setFormData({ ...formData, section: e.target.value })} required className="rounded-none" data-testid="announcement-section-input" /></div>
            </div>
            <div className="flex justify-end gap-4 pt-4">
              <Button type="button" onClick={() => setIsDialogOpen(false)} variant="outline" className="rounded-none border-black">CANCEL</Button>
              <Button type="submit" className="bg-[#002FA7] hover:bg-[#00227A] text-white rounded-none" data-testid="submit-announcement-button">{editingAnnouncement ? 'UPDATE' : 'PUBLISH'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Announcements;
