import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { CheckCircle2, XCircle, Loader2, AlertCircle } from 'lucide-react';
import { Card, Button } from '@/components/primitives';

export default function ScanScreen({ teamId, onVerified, onGoToStart }) {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [teamColor, setTeamColor] = useState('');

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
        const { data: teamData } = await supabase
          .from('teams')
          .select('color')
          .eq('id', teamId)
          .maybeSingle();

        if (teamData) {
          setTeamColor(teamData.color.toLowerCase());
        }

        const { data, error } = await supabase.rpc('scan_location_qr', {
          p_team_id: teamId,
          p_token: token
        });

        if (error) throw error;

        if (data?.success === true) {
          setSuccessMsg(data.message || 'LOCATION VERIFIED! Challenge unlocked.');
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

  const colorToAccent = {
    red: 'rose',
    blue: 'cyan',
    green: 'emerald',
    yellow: 'amber',
    purple: 'violet',
    orange: 'orange',
  };
  const accentColor = `hsl(var(--accent-${colorToAccent[teamColor] || 'brand'}))`;

  // Case A: No team session registered yet
  if (!teamId) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 text-center">
        <Card variant="elevated" className="w-full max-w-sm p-8 space-y-6">
          <AlertCircle className="w-16 h-16 text-feedback-warning mx-auto animate-bounce" />
          <h2 className="text-h2 font-black text-primary">No Active Session</h2>
          <p className="text-body-sm text-secondary leading-relaxed">
            You have not registered your team yet. Please meet the organizers at the start desk, select your path, and scan the starting QR code.
          </p>
          <Button variant="secondary" size="lg" fullWidth onClick={onGoToStart} className="touch-target">
            Go to Homepage
          </Button>
        </Card>
      </div>
    );
  }

  // Case B: Verifying token (Loading)
  if (loading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 text-center">
        <Card variant="elevated" className="w-full max-w-sm p-8 space-y-4">
          <Loader2 className="w-10 h-10 animate-spin mx-auto" style={{ color: accentColor }} />
          <h3 className="text-body font-semibold text-primary">Verifying Location QR...</h3>
          <p className="text-caption text-muted">Checking path parameters database-side</p>
        </Card>
      </div>
    );
  }

  // Case C: Verification Success
  if (successMsg) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 text-center relative">
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full blur-[100px] pointer-events-none opacity-20"
          style={{ backgroundColor: accentColor }}
        />

        <Card variant="elevated" className="w-full max-w-sm p-8 space-y-6" style={{ borderColor: accentColor }}>
          <div className="inline-flex p-4 rounded-full bg-feedback-success/10 border border-feedback-success/25 mb-1 animate-pulse">
            <CheckCircle2 className="w-12 h-12 text-feedback-success" />
          </div>

          <div className="space-y-2">
            <h1 className="text-h2 font-black text-primary uppercase tracking-wider">LOCATION VERIFIED</h1>
            <p className="text-caption font-semibold text-feedback-success uppercase tracking-widest">Challenge unlocked!</p>
          </div>

          <Button
            variant="accent"
            size="lg"
            fullWidth
            onClick={onVerified}
            className="touch-target"
            style={{ backgroundColor: accentColor }}
          >
            Start Game
          </Button>
        </Card>
      </div>
    );
  }

  // Case D: Verification Failed (Error)
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 text-center relative">
      <Card variant="elevated" className="w-full max-w-sm p-8 space-y-6" style={{ borderColor: 'hsl(var(--feedback-error) / 0.2)' }}>
        <div className="inline-flex p-4 rounded-full bg-feedback-error/10 border border-feedback-error/25 mb-1">
          <XCircle className="w-12 h-12 text-feedback-error" />
        </div>

        <div className="space-y-2">
          <h1 className="text-h2 font-black text-primary uppercase tracking-wider">WRONG QR</h1>
          <p className="text-caption font-bold text-feedback-error uppercase tracking-widest">
            {errorMsg.includes('path') ? 'Wrong Path' : 'Wrong Location'}
          </p>
        </div>

        <p className="text-caption text-secondary leading-relaxed px-2">
          This is not the correct location. Check your clue and try again.
        </p>

        <Button
          variant="secondary"
          size="lg"
          fullWidth
          onClick={onVerified}
          className="touch-target"
        >
          Scan Again
        </Button>
      </Card>
    </div>
  );
}