import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Compass, ShieldAlert, Sparkles, Loader2, CheckCircle2, Copy } from 'lucide-react';
import { Card, Input, Button } from '@/components/primitives';

const PATH_THEMES = {
  red: { name: 'RED', accent: 'rose', badgeClass: 'path-badge-rose' },
  blue: { name: 'BLUE', accent: 'cyan', badgeClass: 'path-badge-cyan' },
  green: { name: 'GREEN', accent: 'emerald', badgeClass: 'path-badge-emerald' },
  yellow: { name: 'YELLOW', accent: 'amber', badgeClass: 'path-badge-amber' },
  purple: { name: 'PURPLE', accent: 'violet', badgeClass: 'path-badge-violet' },
  orange: { name: 'ORANGE', accent: 'orange', badgeClass: 'path-badge-orange' },
};

export default function StartScreen({ onRegistered }) {
  const [color, setColor] = useState('');
  const [teamName, setTeamName] = useState('');
  const [teamCode, setTeamCode] = useState('');
  const [returning, setReturning] = useState(false);
  const [issuedTeam, setIssuedTeam] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlColor = (params.get('color') || '').toLowerCase();

    if (urlColor && PATH_THEMES[urlColor]) {
      setColor(urlColor);
    } else {
      setError('Invalid or missing path color! Please scan the correct QR code provided by the organizer.');
    }
  }, []);

  const handleStart = async (e) => {
    e.preventDefault();
    if (!returning && !teamName.trim()) {
      setError('Please enter a team name.');
      return;
    }
    if (!color) {
      setError('No valid color path detected.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (returning) {
        if (!/^\d{5}$/.test(teamCode)) {
          setError('Enter the five-digit team ID shown when your team registered.');
          return;
        }
        const { data, error: resumeError } = await supabase.rpc('resume_team', {
          p_team_code: teamCode,
          p_color: color,
        });
        if (resumeError) throw resumeError;
        if (!data?.success) throw new Error(data?.error || 'Team ID not found for this path.');
        localStorage.setItem('treasure_hunt_team_id', data.team_id);
        localStorage.setItem('treasure_hunt_team_code', data.team_code);
        onRegistered(data.team_id);
      } else {
        const trimmedName = teamName.trim();
        if (!trimmedName) {
          setError('Please enter a team name.');
          return;
        }
        const { data, error: registerError } = await supabase.rpc('register_team', {
          p_name: trimmedName,
          p_color: color,
        });
        if (registerError) throw registerError;
        if (!data?.success) throw new Error(data?.error || 'Unable to register team.');
        localStorage.setItem('treasure_hunt_team_id', data.team_id);
        localStorage.setItem('treasure_hunt_team_code', data.team_code);
        setIssuedTeam({ id: data.team_id, code: data.team_code, name: data.name });
      }

    } catch (err) {
      console.error(err);
      setError(err.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const theme = PATH_THEMES[color];

  if (issuedTeam) {
    const copyTeamCode = async () => {
      try {
        await navigator.clipboard.writeText(issuedTeam.code);
      } catch {
        // The visible ID remains available if clipboard access is denied.
      }
    };

    return (
      <div className="flex flex-col items-center justify-center min-h-[85vh] px-4 py-8">
        <Card variant="elevated" className="w-full max-w-md p-6 text-center space-y-5">
          <CheckCircle2 className="w-14 h-14 text-feedback-success mx-auto" />
          <div>
            <p className="text-micro font-medium uppercase tracking-wide text-feedback-success">Team registered</p>
            <h1 className="text-h1 font-semibold text-primary mt-2">Write down your Team ID</h1>
          </div>
          <div className="rounded-xl border border-accent-brand/40 bg-accent-brand/10 p-5">
            <p className="text-caption text-secondary uppercase tracking-wide font-medium">{issuedTeam.name}</p>
            <p className="font-mono text-display font-bold tracking-[0.1em] text-accent-brand">{issuedTeam.code}</p>
          </div>
          <p className="text-body-sm text-secondary">Use this five-digit ID to resume your team on another device. The organiser can also see it in the dashboard.</p>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" size="lg" onClick={copyTeamCode}>
              <Copy className="w-4 h-4" /> Copy ID
            </Button>
            <Button variant="primary" size="lg" onClick={() => onRegistered(issuedTeam.id)}>
              Continue
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Render error screen if invalid QR code color
  if (!color && error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">
        <Card variant="elevated" className="w-full max-w-md text-center p-6">
          <ShieldAlert className="w-16 h-16 text-accent-rose mx-auto mb-4" />
          <h2 className="text-h2 text-primary mb-2">Access Error</h2>
          <p className="text-secondary text-body-sm mb-6">{error}</p>
          <div className="text-caption text-muted bg-surface-2 p-3 rounded-xl border border-border-subtle text-left">
            Path QR codes format:<br />
            <code className="text-accent-violet">/start?color=red</code> (or blue, green, etc.)
          </div>
        </Card>
      </div>
    );
  }

  // Loading while detecting params
  if (!color) {
    return (
      <div className="flex justify-center items-center min-h-[80vh]">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: `hsl(var(--accent-brand))` }} />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[85vh] px-4 py-8 relative overflow-hidden">
      {/* Soft background aura aligning with path accent */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] h-[340px] rounded-full blur-[140px] pointer-events-none transition-all duration-700 opacity-[0.06]"
        style={{
          backgroundColor: `hsl(var(--accent-${theme.accent}))`,
        }}
      />
 
      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex p-3 rounded-full bg-surface-2 border border-border-subtle mb-3.5 shadow-inner">
            <Compass
              className="w-8 h-8 transition-transform duration-700 hover:rotate-180"
              style={{ color: `hsl(var(--accent-${theme.accent}))` }}
            />
          </div>
          <h1 className="text-h1 font-semibold tracking-tight text-primary uppercase">KRITHOHUNT</h1>
          <p className="text-caption text-muted mt-1 uppercase tracking-wide font-medium">College Treasure Hunt</p>
        </div>
 
        <Card variant="elevated" padding="lg" className="border-border-subtle/50 relative overflow-hidden">
          {/* Path Header Indicator */}
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-border-subtle/60">
            <span className="text-caption font-bold text-muted uppercase tracking-wide">Assigned Path</span>
            <span className={`path-badge ${theme.badgeClass} px-3 py-1 rounded-lg text-micro font-semibold uppercase tracking-wide`}>
              {theme.name} Path
            </span>
          </div>
 
          <form onSubmit={handleStart} className="space-y-4">
            {!returning ? (
              <div>
                <Input
                  id="teamName"
                  label="Team Name"
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="Enter team name..."
                  maxLength={30}
                  required
                  className="min-h-[50px] text-body"
                />
              </div>
            ) : (
              <div>
                <Input
                  id="teamCode"
                  label="Five-Digit Team ID"
                  type="text"
                  inputMode="numeric"
                  value={teamCode}
                  onChange={(e) => setTeamCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                  placeholder="e.g. 48217"
                  maxLength={5}
                  required
                  className="min-h-[50px] text-body font-mono text-center tracking-[0.1em]"
                />
              </div>
            )}
 
            {error && (
              <div className="p-3.5 rounded-xl bg-feedback-error/10 border border-feedback-error/25 text-feedback-error text-caption flex gap-2.5 items-start animate-shake" role="alert">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
 
            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              disabled={loading}
              loading={loading}
              className="touch-target mt-2"
            >
              {loading ? (returning ? 'Resuming...' : 'Registering...') : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>{returning ? 'Resume Path' : 'Register Team'}</span>
                </>
              )}
            </Button>
          </form>
 
          <div className="mt-4 pt-1 flex justify-center">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => { setReturning(!returning); setError(''); }}
              className="text-caption text-secondary hover:text-primary font-medium transition-all"
            >
              {returning ? 'Register a new team' : 'Already registered? Enter code'}
            </Button>
          </div>
        </Card>
 
        <p className="text-center text-caption text-muted px-4 leading-relaxed">
          Your progress will be verified at location checkpoints. Ensure you stay on your assigned path!
        </p>
      </div>
    </div>
  );
}