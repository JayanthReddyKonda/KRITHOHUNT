import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Compass, ShieldAlert, Sparkles, Loader2 } from 'lucide-react';
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
    if (!teamName.trim()) {
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
      const trimmedName = teamName.trim();

      const { data: existingTeam, error: fetchError } = await supabase
        .from('teams')
        .select('*')
        .eq('name', trimmedName)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (existingTeam) {
        if (existingTeam.color.toLowerCase() === color) {
          localStorage.setItem('treasure_hunt_team_id', existingTeam.id);
          onRegistered(existingTeam.id);
          return;
        } else {
          setError(`"${trimmedName}" is already registered on the ${existingTeam.color.toUpperCase()} path.`);
          setLoading(false);
          return;
        }
      }

      const { data: newTeam, error: insertError } = await supabase
        .from('teams')
        .insert([{ name: trimmedName, color: color, waiting_for_qr: true }])
        .select()
        .single();

      if (insertError) throw insertError;

      localStorage.setItem('treasure_hunt_team_id', newTeam.id);
      onRegistered(newTeam.id);

    } catch (err) {
      console.error(err);
      setError(err.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const theme = PATH_THEMES[color];

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
    <div className="flex flex-col items-center justify-center min-h-[85vh] px-4 py-8 relative">
      {/* Full-screen radial glow using path accent (20% opacity) */}
      <div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full blur-[100px] pointer-events-none transition-all duration-500"
        style={{
          backgroundColor: `hsl(var(--accent-${theme.accent}) / 0.2)`,
        }}
      />

      <div className="w-full max-w-[360px] md:max-w-[420px] relative z-10">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="inline-flex p-3 rounded-full bg-surface-1 border border-border-subtle mb-4 shadow-inner">
            <Compass
              className="w-10 h-10 transition-transform duration-700 hover:rotate-180"
              style={{ color: `hsl(var(--accent-${theme.accent}))` }}
            />
          </div>
          <h1 className="text-display font-black tracking-tight text-primary">KRITHOHUNT</h1>
          <p className="text-micro text-muted mt-1 uppercase tracking-widest font-semibold">Start Desk QR Scanner</p>
        </div>

        {/* Card Container - surface-1/90, backdrop-blur, border-border-subtle, rounded-xl */}
        <Card variant="elevated" padding="lg" className="glow-active">
          {/* Path Header Indicator */}
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-border-subtle">
            <span className="text-caption text-muted uppercase tracking-wider">Assigned Path</span>
            <span className={`path-badge ${theme.badgeClass} px-3 py-1 rounded-full text-micro font-bold uppercase tracking-widest`}>
              {theme.name} PATH
            </span>
          </div>

          <form onSubmit={handleStart} className="space-y-5">
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
                error={error || undefined}
                className="min-h-[56px] text-body"
              />
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-feedback-error/10 border border-feedback-error/20 text-feedback-error text-caption flex gap-2 items-start" role="alert">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              variant="accent"
              size="lg"
              fullWidth
              disabled={loading}
              loading={loading}
              className="touch-target"
              style={{ backgroundColor: `hsl(var(--accent-${theme.accent}))` }}
            >
              {loading ? 'Registering...' : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Start Hunt</span>
                </>
              )}
            </Button>
          </form>
        </Card>

        <p className="text-center text-caption text-muted mt-6 px-4">
          By starting, your team progress will be linked to this device. Please use the same phone throughout the hunt.
        </p>
      </div>
    </div>
  );
}