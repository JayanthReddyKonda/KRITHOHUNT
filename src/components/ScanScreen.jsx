import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { CheckCircle2, XCircle, Loader2, AlertCircle } from 'lucide-react';
import { Card, Button } from '@/components/primitives';

export default function ScanScreen({ teamId, onVerified, onGoToStart }) {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token') || '';

  useEffect(() => {
    const verifyScannedToken = async () => {
      if (!teamId) {
        setLoading(false);
        return;
      }

      if (!/^[a-f0-9]{36}$/.test(token)) {
        setErrorMsg('Missing or invalid location token. Please scan an organizer-issued QR code.');
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase.rpc('scan_location_qr', {
          p_team_id: teamId,
          p_token: token
        });

        if (error) throw error;

        if (data?.success === true) {
          setSuccessMsg(data.message || 'Location verified! Challenge unlocked.');
        } else {
          setErrorMsg(data.error || 'Verification failed. Wrong location.');
        }
      } catch (err) {
        console.error(err);
        setErrorMsg(err.message || 'Connection error. Please try scanning again.');
      } finally {
        setLoading(false);
      }
    };

    verifyScannedToken();
  }, [teamId, token]);

  // Case A: No team session registered yet
  if (!teamId) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-6 text-center relative overflow-hidden">
        <Card variant="elevated" padding="lg" className="w-full max-w-[420px] space-y-5">
          <div className="inline-flex p-3 rounded-full bg-feedback-warning/10 border border-feedback-warning/20 mx-auto">
            <AlertCircle className="w-8 h-8 text-feedback-warning" />
          </div>
          <div className="space-y-1">
            <h2 className="text-h2 font-semibold text-primary">No active session</h2>
            <p className="text-micro text-muted font-medium">Registration required</p>
          </div>
          <p className="text-caption text-secondary leading-relaxed px-1">
            You have not registered your team yet. Please meet the organizers at the start desk, select your path, and scan the starting QR code.
          </p>
          <Button variant="secondary" size="md" fullWidth onClick={onGoToStart} className="touch-target">
            Go to home page
          </Button>
        </Card>
      </div>
    );
  }
 
  // Case B: Verifying token (Loading)
  if (loading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-6 text-center relative overflow-hidden">
        <Card variant="elevated" padding="lg" className="w-full max-w-[420px] space-y-4">
          <div className="py-4">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-accent-brand" />
          </div>
          <div className="space-y-1">
            <h3 className="text-body-sm font-semibold text-primary">Verifying location...</h3>
            <p className="text-micro text-muted">Checking clue location QR</p>
          </div>
        </Card>
      </div>
    );
  }
 
  // Case C: Verification Success
  if (successMsg) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-6 text-center relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-56 h-56 rounded-full blur-[100px] pointer-events-none opacity-20 bg-accent-brand" />
 
        <Card
          variant="elevated"
          padding="lg"
          className="w-full max-w-[420px] space-y-5 relative z-10 border border-border-subtle shadow-2xl"
        >
          <div className="inline-flex p-3 rounded-full bg-feedback-success/15 border border-feedback-success/30 mx-auto">
            <CheckCircle2 className="w-10 h-10 text-feedback-success" />
          </div>
 
          <div className="space-y-1">
            <h1 className="text-h2 font-semibold text-primary tracking-tight">Location verified</h1>
            <p className="text-caption font-semibold text-feedback-success">Challenge unlocked!</p>
          </div>
 
          <Button
            variant="primary"
            size="md"
            fullWidth
            onClick={onVerified}
            className="touch-target"
          >
            Start game
          </Button>
        </Card>
      </div>
    );
  }
 
  // Case D: Verification Failed (Error)
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-6 text-center relative overflow-hidden">
      <Card variant="elevated" padding="lg" className="w-full max-w-[420px] space-y-5 border border-feedback-error/30">
        <div className="inline-flex p-3 rounded-full bg-feedback-error/15 border border-feedback-error/30 mx-auto">
          <XCircle className="w-10 h-10 text-feedback-error" />
        </div>
 
        <div className="space-y-1">
          <h1 className="text-h2 font-semibold text-primary tracking-tight">Wrong QR</h1>
          <p className="text-caption font-semibold text-feedback-error">
            {errorMsg.includes('path') ? 'Wrong path color' : 'Wrong location'}
          </p>
        </div>
 
        <p className="text-caption text-secondary leading-relaxed px-1">
          This is not the correct location. Check your clue and try again.
        </p>
 
        <Button
          variant="secondary"
          size="md"
          fullWidth
          onClick={onVerified}
          className="touch-target"
        >
          Scan again
        </Button>
      </Card>
    </div>
  );
}