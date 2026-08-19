import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Compass, ShieldAlert, Sparkles, Loader2, CheckCircle2, Copy } from 'lucide-react';
import { Card, Input, Button } from '@/components/primitives';

const PATH_THEMES = {
  red: { name: 'Red', accent: 'rose', badgeClass: 'path-badge-rose', themeColor: 'hsl(var(--accent-rose))', bgGlow: 'hsl(var(--accent-rose) / 0.3)', borderColor: 'hsl(var(--accent-rose) / 0.5)' },
  blue: { name: 'Blue', accent: 'cyan', badgeClass: 'path-badge-cyan', themeColor: 'hsl(var(--accent-cyan))', bgGlow: 'hsl(var(--accent-cyan) / 0.3)', borderColor: 'hsl(var(--accent-cyan) / 0.5)' },
  green: { name: 'Green', accent: 'emerald', badgeClass: 'path-badge-emerald', themeColor: 'hsl(var(--accent-emerald))', bgGlow: 'hsl(var(--accent-emerald) / 0.3)', borderColor: 'hsl(var(--accent-emerald) / 0.5)' },
  yellow: { name: 'Yellow', accent: 'amber', badgeClass: 'path-badge-amber', themeColor: 'hsl(var(--accent-amber))', bgGlow: 'hsl(var(--accent-amber) / 0.3)', borderColor: 'hsl(var(--accent-amber) / 0.5)' },
  purple: { name: 'Purple', accent: 'violet', badgeClass: 'path-badge-violet', themeColor: 'hsl(var(--accent-violet))', bgGlow: 'hsl(var(--accent-violet) / 0.3)', borderColor: 'hsl(var(--accent-violet) / 0.5)' },
  orange: { name: 'Orange', accent: 'orange', badgeClass: 'path-badge-orange', themeColor: 'hsl(var(--accent-orange))', bgGlow: 'hsl(var(--accent-orange) / 0.3)', borderColor: 'hsl(var(--accent-orange) / 0.5)' },
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
      setError('Invalid or missing path color. Please scan the QR code provided by the organizer.');
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

  const theme = PATH_THEMES[color] || PATH_THEMES.blue;

  if (issuedTeam) {
    const copyTeamCode = async () => {
      try {
        await navigator.clipboard.writeText(issuedTeam.code);
      } catch {
        // Fallback
      }
    };

    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] px-3 py-4">
        <Card
          variant="elevated"
          className="w-full max-w-[340px] p-4 text-center space-y-4"
          style={{
            borderColor: theme.borderColor,
            boxShadow: `0 0 25px ${theme.bgGlow}`,
          }}
        >
          <CheckCircle2 className="w-10 h-10 text-feedback-success mx-auto" />
          <div>
            <p className="text-micro font-medium text-feedback-success">Team registered</p>
            <h1 className="text-h2 font-semibold text-primary mt-1">Write down your Team ID</h1>
          </div>
          <div className="rounded-xl border p-3.5" style={{ borderColor: theme.borderColor, backgroundColor: theme.bgGlow }}>
            <p className="text-caption text-secondary font-medium">{issuedTeam.name}</p>
            <p className="font-mono text-display font-bold tracking-[0.1em]" style={{ color: theme.themeColor }}>{issuedTeam.code}</p>
          </div>
          <p className="text-caption text-secondary">Use this five-digit ID to resume your team on another device.</p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" size="md" onClick={copyTeamCode}>
              <Copy className="w-3.5 h-3.5" /> Copy ID
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => onRegistered(issuedTeam.id)}
              style={{ backgroundColor: theme.themeColor, color: theme.accent === 'amber' ? '#000' : '#fff' }}
            >
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
      <div className="flex flex-col items-center justify-center min-h-[80vh] px-3">
        <Card variant="elevated" className="w-full max-w-[340px] text-center p-4 space-y-3">
          <ShieldAlert className="w-12 h-12 text-accent-rose mx-auto" />
          <h2 className="text-h2 text-primary">Access Error</h2>
          <p className="text-secondary text-caption">{error}</p>
          <div className="text-micro text-muted bg-surface-2 p-2.5 rounded-xl border border-border-subtle text-left">
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
        <Loader2 className="w-7 h-7 animate-spin text-accent-brand" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[85vh] px-3 py-4 relative overflow-hidden">
      {/* Dynamic background aura matching team path color */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] h-[320px] rounded-full blur-[80px] pointer-events-none transition-all duration-700 opacity-25"
        style={{
          backgroundColor: theme.themeColor,
        }}
      />
 
      <div className="w-full max-w-[340px] relative z-10 space-y-4">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex p-2.5 rounded-full bg-surface-2 border border-border-subtle mb-2 shadow-inner">
            <Compass
              className="w-6 h-6 transition-transform duration-700 hover:rotate-180"
              style={{ color: theme.themeColor }}
            />
          </div>
          <h1 className="text-h2 font-semibold tracking-tight text-primary">Krithohunt</h1>
          <p className="text-micro text-muted font-medium">College treasure hunt</p>
        </div>
 
        <Card
          variant="elevated"
          padding="md"
          className="relative overflow-hidden transition-all duration-500"
          style={{
            borderColor: theme.borderColor,
            boxShadow: `0 0 30px ${theme.bgGlow}`,
          }}
        >
          {/* Path Header Indicator */}
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-border-subtle/60">
            <span className="text-micro font-bold text-muted">Assigned path</span>
            <span className={`path-badge ${theme.badgeClass} px-2.5 py-0.5 rounded-md text-micro font-semibold`}>
              {theme.name} Path
            </span>
          </div>
 
          <form onSubmit={handleStart} className="space-y-3">
            {!returning ? (
              <div>
                <Input
                  id="teamName"
                  label="Team name"
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="Enter team name..."
                  maxLength={30}
                  required
                  className="min-h-[42px] text-body-sm"
                />
              </div>
            ) : (
              <div>
                <Input
                  id="teamCode"
                  label="Five-digit team ID"
                  type="text"
                  inputMode="numeric"
                  value={teamCode}
                  onChange={(e) => setTeamCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                  placeholder="e.g. 48217"
                  maxLength={5}
                  required
                  className="min-h-[42px] text-body-sm font-mono text-center tracking-[0.1em]"
                />
              </div>
            )}
 
            {error && (
              <div className="p-2.5 rounded-xl bg-feedback-error/10 border border-feedback-error/25 text-feedback-error text-micro flex gap-2 items-start animate-shake" role="alert">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
 
            <Button
              type="submit"
              variant="primary"
              size="md"
              fullWidth
              disabled={loading}
              loading={loading}
              className="touch-target mt-1"
              style={{
                backgroundColor: theme.themeColor,
                color: theme.accent === 'amber' ? '#000000' : '#ffffff',
              }}
            >
              {loading ? (returning ? 'Resuming...' : 'Registering...') : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{returning ? 'Resume path' : 'Register team'}</span>
                </>
              )}
            </Button>
          </form>
 
          <div className="mt-3 pt-1 flex justify-center">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => { setReturning(!returning); setError(''); }}
              className="text-micro text-secondary hover:text-primary font-medium transition-all"
            >
              {returning ? 'Register a new team' : 'Already registered? Enter code'}
            </Button>
          </div>
        </Card>
 
        <p className="text-center text-micro text-muted px-2 leading-tight">
          Your progress will be verified after solving each clue. Ensure you stay on your assigned path.
        </p>
      </div>
    </div>
  );
}