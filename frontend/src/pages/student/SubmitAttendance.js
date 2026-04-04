import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MapPin, QrCode, Check, X, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const SubmitAttendance = () => {
  const [sessionCode, setSessionCode] = useState('');
  const [location, setLocation] = useState(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef(null);

  const getLocation = () => {
    setGettingLocation(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => { setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setGettingLocation(false); toast.success('Location captured'); },
        (err) => { setGettingLocation(false); toast.error('Failed to get location. Please enable GPS.'); },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    } else {
      setGettingLocation(false);
      toast.error('Geolocation not supported');
    }
  };

  const startScanner = async () => {
    setScanning(true);
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          setSessionCode(decodedText);
          stopScanner();
          toast.success('QR Code scanned!');
        },
        () => {}
      );
    } catch (err) {
      setScanning(false);
      toast.error('Camera access denied or not available');
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch (e) {}
      scannerRef.current = null;
    }
    setScanning(false);
  };

  useEffect(() => { return () => { stopScanner(); }; }, []);

  const handleSubmit = async () => {
    if (!sessionCode) { toast.error('Please scan QR code or enter session code'); return; }
    if (!location) { toast.error('Please capture your location first'); return; }

    setSubmitting(true);
    try {
      const { data } = await api.post('/api/student/attendance/submit', {
        session_code: sessionCode,
        student_latitude: location.lat,
        student_longitude: location.lng
      });
      setResult(data);
      if (data.status === 'Present') {
        toast.success('Attendance marked as Present!');
      } else {
        toast.error(`Attendance Invalid: Distance ${data.distance}m (max 50m). Attempts remaining: ${data.remaining_attempts}`);
      }
    } catch (error) {
      const detail = error.response?.data?.detail || 'Failed to submit attendance';
      toast.error(detail);
      if (detail.includes('Maximum 3 attempts')) {
        setResult({ status: 'MaxAttempts', message: detail });
      }
    }
    setSubmitting(false);
  };

  if (result) {
    const isSuccess = result.status === 'Present';
    const isMaxAttempts = result.status === 'MaxAttempts';
    
    return (
      <div className="p-8" data-testid="attendance-result-page">
        <div className="max-w-md mx-auto text-center">
          <div className={`border-4 p-12 mb-6 ${isSuccess ? 'border-black' : 'border-[#FF2A2A]'}`}>
            {isSuccess ? (
              <Check size={64} className="mx-auto text-black mb-4" />
            ) : (
              <X size={64} className="mx-auto text-[#FF2A2A] mb-4" />
            )}
            <div className="text-4xl font-black mb-2" data-testid="attendance-status">
              {isSuccess ? 'PRESENT' : isMaxAttempts ? 'MAX ATTEMPTS' : 'INVALID'}
            </div>
            {result.distance && <div className="text-sm text-zinc-600">Distance: {result.distance}m</div>}
            {result.attempt_number && <div className="text-sm text-zinc-600 mt-1">Attempt: {result.attempt_number}/3</div>}
            {result.remaining_attempts > 0 && !isSuccess && (
              <div className="text-sm text-[#002FA7] mt-2 font-bold">
                {result.remaining_attempts} attempt(s) remaining
              </div>
            )}
            {isMaxAttempts && <div className="text-sm text-[#FF2A2A] mt-2">You have exhausted all 3 attempts</div>}
            {!isSuccess && !isMaxAttempts && <div className="text-sm text-[#FF2A2A] mt-2">You must be within 50 meters of the teacher</div>}
          </div>
          {(result.remaining_attempts > 0 || isSuccess) && (
            <Button onClick={() => { setResult(null); if (!isSuccess) { setLocation(null); } }} variant="outline" className="rounded-none border-black font-bold uppercase" data-testid="try-again-button">
              {isSuccess ? 'DONE' : 'TRY AGAIN'}
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8" data-testid="submit-attendance-page">
      <div className="mb-8">
        <h1 className="text-4xl font-black tracking-tight mb-2">SUBMIT ATTENDANCE</h1>
        <p className="text-base text-zinc-600">Scan QR code and verify your location (max 3 attempts)</p>
      </div>

      <div className="max-w-xl space-y-6">
        <div className="border border-zinc-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <QrCode size={20} className="text-[#002FA7]" />
            <div className="text-sm font-bold uppercase tracking-widest">STEP 1: SCAN QR CODE</div>
          </div>

          {scanning ? (
            <div>
              <div id="qr-reader" className="w-full mb-4" data-testid="qr-scanner"></div>
              <Button onClick={stopScanner} variant="outline" className="rounded-none border-black w-full" data-testid="stop-scanner-button">STOP SCANNING</Button>
            </div>
          ) : (
            <div className="space-y-4">
              <Button onClick={startScanner} variant="outline" className="rounded-none border-black w-full font-bold uppercase" data-testid="start-scanner-button">
                <QrCode size={18} className="mr-2" /> OPEN CAMERA & SCAN
              </Button>
              <div className="text-center text-xs text-zinc-400 uppercase tracking-widest">OR ENTER CODE MANUALLY</div>
              <Input value={sessionCode} onChange={(e) => setSessionCode(e.target.value.toUpperCase())} placeholder="Enter session code" className="rounded-none text-center text-lg font-black tracking-[0.2em]" data-testid="session-code-input" />
            </div>
          )}

          {sessionCode && !scanning && (
            <div className="mt-4 p-3 bg-zinc-50 border border-zinc-200 flex items-center gap-2">
              <Check size={16} className="text-green-600" />
              <span className="font-bold">{sessionCode}</span>
            </div>
          )}
        </div>

        <div className="border border-zinc-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <MapPin size={20} className="text-[#002FA7]" />
              <div className="text-sm font-bold uppercase tracking-widest">STEP 2: CAPTURE LOCATION</div>
            </div>
            {location && <Check size={20} className="text-green-600" />}
          </div>
          {location ? (
            <div className="text-sm text-zinc-600 mb-4">Lat: {location.lat.toFixed(6)} | Lng: {location.lng.toFixed(6)}</div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-zinc-400 mb-4">
              <AlertCircle size={14} />
              <span>Your location will be compared with teacher's location (50m radius)</span>
            </div>
          )}
          <Button onClick={getLocation} disabled={gettingLocation} variant="outline" className="rounded-none border-black w-full font-bold uppercase" data-testid="get-location-button">
            {gettingLocation ? 'GETTING LOCATION...' : location ? 'UPDATE LOCATION' : 'GET MY LOCATION'}
          </Button>
        </div>

        <Button onClick={handleSubmit} disabled={!sessionCode || !location || submitting} className="w-full bg-[#002FA7] hover:bg-[#00227A] text-white rounded-none h-14 font-bold uppercase tracking-wider text-lg" data-testid="submit-attendance-button">
          {submitting ? 'SUBMITTING...' : 'SUBMIT ATTENDANCE'}
        </Button>
      </div>
    </div>
  );
};

export default SubmitAttendance;
