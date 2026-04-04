import React, { useState, useEffect } from 'react';
import { api } from '../../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Star, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

const SubmitFeedback = () => {
  const [forms, setForms] = useState([]);
  const [selectedForm, setSelectedForm] = useState(null);
  const [rating, setRating] = useState(0);
  const [comments, setComments] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => { fetchForms(); }, []);

  const fetchForms = async () => {
    try { const { data } = await api.get('/api/student/feedback-forms'); setForms(data); } catch (e) { toast.error('Failed to fetch forms'); }
  };

  const handleSubmit = async () => {
    if (!selectedForm || rating === 0) { toast.error('Select a form and provide a rating'); return; }
    try {
      await api.post('/api/student/feedback', { form_id: selectedForm.id, rating, comments });
      toast.success('Feedback submitted');
      setSubmitted(true);
    } catch (error) { toast.error(error.response?.data?.detail || 'Failed to submit feedback'); }
  };

  if (submitted) {
    return (
      <div className="p-8" data-testid="feedback-success-page">
        <div className="max-w-md mx-auto text-center border-4 border-black p-12">
          <MessageSquare size={48} className="mx-auto text-[#002FA7] mb-4" />
          <h1 className="text-3xl font-black mb-2">THANK YOU</h1>
          <p className="text-zinc-600 mb-6">Your feedback has been recorded</p>
          <Button onClick={() => { setSubmitted(false); setSelectedForm(null); setRating(0); setComments(''); }} variant="outline" className="rounded-none border-black font-bold uppercase" data-testid="submit-another-button">SUBMIT ANOTHER</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8" data-testid="submit-feedback-page">
      <div className="mb-8">
        <h1 className="text-4xl font-black tracking-tight mb-2">SUBMIT FEEDBACK</h1>
        <p className="text-base text-zinc-600">Share your thoughts</p>
      </div>

      {!selectedForm ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {forms.map((form) => (
            <button key={form.id} onClick={() => setSelectedForm(form)} className="border border-zinc-200 p-6 hover:border-black duration-150 text-left" data-testid="feedback-form-card">
              <MessageSquare size={24} className="text-[#002FA7] mb-3" />
              <h3 className="text-lg font-black">{form.event_name}</h3>
              <p className="text-sm text-zinc-400 mt-1">{form.questions?.length} question(s)</p>
            </button>
          ))}
          {forms.length === 0 && <div className="col-span-3 text-center p-12 text-zinc-400 border border-zinc-200">No feedback forms available</div>}
        </div>
      ) : (
        <div className="max-w-xl space-y-6">
          <div className="border border-zinc-200 p-6">
            <h2 className="text-2xl font-black mb-4">{selectedForm.event_name}</h2>
            {selectedForm.questions?.map((q, i) => (
              <div key={i} className="mb-4 p-4 bg-zinc-50 border border-zinc-200">
                <p className="font-bold text-sm">{i + 1}. {q}</p>
              </div>
            ))}
          </div>

          <div className="border border-zinc-200 p-6">
            <Label className="text-xs uppercase tracking-widest font-bold mb-3 block">RATING</Label>
            <div className="flex gap-2" data-testid="rating-stars">
              {[1, 2, 3, 4, 5].map((star) => (
                <button key={star} onClick={() => setRating(star)} className="p-1" data-testid={`star-${star}`}>
                  <Star size={32} className={star <= rating ? 'text-[#FFD700] fill-[#FFD700]' : 'text-zinc-300'} />
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs uppercase tracking-widest font-bold">Comments (Optional)</Label>
            <Textarea value={comments} onChange={(e) => setComments(e.target.value)} className="rounded-none min-h-[100px]" placeholder="Your feedback..." data-testid="feedback-comments" />
          </div>

          <div className="flex gap-4">
            <Button onClick={() => setSelectedForm(null)} variant="outline" className="rounded-none border-black font-bold uppercase flex-1">BACK</Button>
            <Button onClick={handleSubmit} className="bg-[#002FA7] hover:bg-[#00227A] text-white rounded-none font-bold uppercase flex-1" data-testid="submit-feedback-button">SUBMIT FEEDBACK</Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubmitFeedback;
