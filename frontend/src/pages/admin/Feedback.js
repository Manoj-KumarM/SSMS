import React, { useState, useEffect } from 'react';
import { api } from '../../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Star, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

const Feedback = () => {
  const [forms, setForms] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [viewingForm, setViewingForm] = useState(null);
  const [responses, setResponses] = useState([]);
  const [formData, setFormData] = useState({ event_name: '', questions: [''] });

  useEffect(() => { fetchForms(); }, []);

  const fetchForms = async () => {
    try { const { data } = await api.get('/api/admin/feedback-forms'); setForms(data); } catch (e) { toast.error('Failed to fetch forms'); }
  };

  const fetchResponses = async (formId) => {
    try { const { data } = await api.get(`/api/admin/feedback-responses/${formId}`); setResponses(data); } catch (e) { toast.error('Failed to fetch responses'); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const filteredQuestions = formData.questions.filter(q => q.trim() !== '');
    if (filteredQuestions.length === 0) { toast.error('Add at least one question'); return; }
    try {
      await api.post('/api/admin/feedback-forms', { event_name: formData.event_name, questions: filteredQuestions });
      toast.success('Feedback form created');
      setIsDialogOpen(false);
      setFormData({ event_name: '', questions: [''] });
      fetchForms();
    } catch (error) { toast.error(error.response?.data?.detail || 'Failed'); }
  };

  const addQuestion = () => setFormData({ ...formData, questions: [...formData.questions, ''] });
  const updateQuestion = (idx, val) => { const qs = [...formData.questions]; qs[idx] = val; setFormData({ ...formData, questions: qs }); };
  const removeQuestion = (idx) => { const qs = formData.questions.filter((_, i) => i !== idx); setFormData({ ...formData, questions: qs }); };

  return (
    <div className="p-8" data-testid="feedback-page">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-black tracking-tight mb-2">FEEDBACK FORMS</h1>
          <p className="text-base text-zinc-600">Create and manage feedback forms</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} className="bg-[#002FA7] hover:bg-[#00227A] text-white rounded-none font-bold uppercase" data-testid="create-feedback-button">
          <Plus size={18} className="mr-2" /> NEW FORM
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {forms.map((form) => (
          <div key={form.id} className="border border-zinc-200 p-6 hover:border-black duration-150" data-testid="feedback-form-card">
            <div className="flex items-center gap-3 mb-4">
              <MessageSquare size={20} className="text-[#002FA7]" />
              <h3 className="text-lg font-black">{form.event_name}</h3>
            </div>
            <p className="text-sm text-zinc-600 mb-4">{form.questions.length} question(s)</p>
            <Button onClick={() => { setViewingForm(form); fetchResponses(form.id); }} variant="outline" className="rounded-none border-black w-full" data-testid="view-responses-button">VIEW RESPONSES</Button>
          </div>
        ))}
        {forms.length === 0 && <div className="col-span-3 text-center p-12 text-zinc-400 border border-zinc-200">No feedback forms created yet</div>}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg bg-white border-4 border-black rounded-none">
          <DialogHeader><DialogTitle className="text-2xl font-black">NEW FEEDBACK FORM</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div><Label className="text-xs uppercase tracking-widest font-bold">Event Name</Label><Input value={formData.event_name} onChange={(e) => setFormData({ ...formData, event_name: e.target.value })} required className="rounded-none" data-testid="event-name-input" /></div>
            <div>
              <Label className="text-xs uppercase tracking-widest font-bold mb-2 block">Questions</Label>
              {formData.questions.map((q, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <Input value={q} onChange={(e) => updateQuestion(i, e.target.value)} placeholder={`Question ${i + 1}`} className="rounded-none flex-1" data-testid={`question-input-${i}`} />
                  {formData.questions.length > 1 && <Button type="button" onClick={() => removeQuestion(i)} variant="outline" className="rounded-none border-[#FF2A2A] text-[#FF2A2A]">X</Button>}
                </div>
              ))}
              <Button type="button" onClick={addQuestion} variant="outline" className="rounded-none border-black mt-2 w-full" data-testid="add-question-button">+ ADD QUESTION</Button>
            </div>
            <div className="flex justify-end gap-4 pt-4">
              <Button type="button" onClick={() => setIsDialogOpen(false)} variant="outline" className="rounded-none border-black">CANCEL</Button>
              <Button type="submit" className="bg-[#002FA7] hover:bg-[#00227A] text-white rounded-none" data-testid="submit-form-button">CREATE FORM</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingForm} onOpenChange={() => setViewingForm(null)}>
        <DialogContent className="max-w-2xl bg-white border-4 border-black rounded-none">
          <DialogHeader><DialogTitle className="text-2xl font-black">RESPONSES: {viewingForm?.event_name}</DialogTitle></DialogHeader>
          <div className="border border-zinc-200 overflow-hidden">
            <table className="w-full">
              <thead><tr className="border-b border-zinc-200 bg-zinc-50">
                <th className="p-4 text-left text-xs uppercase tracking-widest font-bold">Student</th>
                <th className="p-4 text-left text-xs uppercase tracking-widest font-bold">USN</th>
                <th className="p-4 text-left text-xs uppercase tracking-widest font-bold">Rating</th>
                <th className="p-4 text-left text-xs uppercase tracking-widest font-bold">Comments</th>
              </tr></thead>
              <tbody>
                {responses.map((r) => (
                  <tr key={r.id} className="border-b border-zinc-200">
                    <td className="p-4">{r.student_name || '-'}</td>
                    <td className="p-4">{r.usn || '-'}</td>
                    <td className="p-4"><div className="flex">{Array.from({ length: 5 }, (_, i) => <Star key={i} size={14} className={i < r.rating ? 'text-[#FFD700] fill-[#FFD700]' : 'text-zinc-300'} />)}</div></td>
                    <td className="p-4 text-sm text-zinc-600">{r.comments || '-'}</td>
                  </tr>
                ))}
                {responses.length === 0 && <tr><td colSpan="4" className="p-8 text-center text-zinc-400">No responses yet</td></tr>}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Feedback;
