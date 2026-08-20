import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { RefreshCw, Users, Award, ShieldAlert, CheckCircle, Clock, Trash2, Search, Filter, KeyRound, Printer, Menu, LogOut, Download, RotateCcw, Share2, Check } from 'lucide-react';
import { Button, Input } from '@/components/primitives';
import QRCode from 'qrcode';

function escapeCsv(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

const PATH_BADGES = {
  red: 'bg-accent-rose/10 border-accent-rose/30 text-accent-rose',
  blue: 'bg-accent-cyan/10 border-accent-cyan/30 text-accent-cyan',
  green: 'bg-accent-emerald/10 border-accent-emerald/30 text-accent-emerald',
  yellow: 'bg-accent-amber/10 border-accent-amber/30 text-accent-amber text-inverse',
  purple: 'bg-accent-violet/10 border-accent-violet/30 text-accent-violet',
  orange: 'bg-accent-orange/10 border-accent-orange/30 text-accent-orange text-inverse'
};

const PATH_DISPLAY = {
  red: 'RED',
  blue: 'BLUE',
  green: 'GREEN',
  yellow: 'YELLOW',
  purple: 'PURPLE',
  orange: 'ORANGE'
};

const pathAccentMap = { red: 'rose', blue: 'cyan', green: 'emerald', yellow: 'amber', purple: 'violet', orange: 'orange' };
const qrColors = { red: 'ef3b3b', blue: '06b6d4', green: '10b981', yellow: 'f59e0b', purple: 'a855f7', orange: 'f97316' };
const qrOrigin = (import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin).replace(/\/$/, '');

const getQrEntries = (tokens = []) => [
  ...['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange'].map((color) => ({
    title: 'KRITHOHUNT START',
    subtitle: 'Path Start',
    color,
    url: `${qrOrigin}/start?color=${color.toLowerCase()}`,
  })),
  ...tokens.map(({ token, color, stage }) => ({
    title: 'KRITHOHUNT GATE',
    subtitle: `Stage ${stage}`,
    color: color[0].toUpperCase() + color.slice(1),
    url: `${qrOrigin}/scan?token=${encodeURIComponent(token)}`,
  })),
];

const QRCard = ({ title, subtitle, url, color }) => {
  const accent = pathAccentMap[color.toLowerCase()] || 'brand';
  const hexColor = qrColors[color.toLowerCase()] || '0f766e';
  const [qrDataUrl, setQrDataUrl] = React.useState('');
  const [qrError, setQrError] = React.useState('');
  const [shared, setShared] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    setQrDataUrl('');
    setQrError('');
    QRCode.toDataURL(url, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 320,
      color: { dark: `#${hexColor}`, light: '#ffffff' },
    })
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setQrError('QR generation failed. Copy the URL below.');
      });

    return () => { cancelled = true; };
  }, [url, hexColor]);

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: `${title} - ${color} ${subtitle}`, text: url, url });
      } else {
        await navigator.clipboard.writeText(url);
      }
      setShared(true);
      setTimeout(() => setShared(false), 1800);
    } catch (error) {
      if (error.name !== 'AbortError') setQrError('Unable to share. Copy the URL below.');
    }
  };

  return (
    <div key={`${color}-${subtitle}`} className="text-center space-y-3 qr-card bg-surface-1 border border-border-subtle p-5 rounded-2xl shadow-md flex flex-col justify-between">
      <div className="space-y-3">
        <span className="text-micro font-semibold tracking-wide uppercase text-accent-brand block">{title}</span>
        <div className="bg-white p-3 rounded-xl inline-block shadow-lg mx-auto qr-image-frame" data-qr-status={qrDataUrl ? 'ready' : qrError ? 'error' : 'loading'}>
          {qrDataUrl ? (
            <img src={qrDataUrl} alt={`${color} ${subtitle} QR`} className="w-36 h-36 mx-auto qr-image" />
          ) : (
            <div className="w-36 h-36 flex items-center justify-center text-center text-xs text-slate-700">
              {qrError || 'Generating QR...'}
            </div>
          )}
        </div>
        <div className="space-y-1">
          <h4 className="text-caption font-semibold uppercase text-primary tracking-wide" style={{ color: `hsl(var(--accent-${accent}))` }}>
            {color} {subtitle}
          </h4>
          <p className="text-micro text-muted font-mono break-all line-clamp-1">{url}</p>
        </div>
      </div>
      <Button variant="ghost" size="sm" onClick={handleShare} className="no-print mx-auto">
        {shared ? <Check className="w-4 h-4 text-feedback-success" /> : <Share2 className="w-4 h-4" />}
        <span>{shared ? 'Copied' : 'Share URL'}</span>
      </Button>
    </div>
  );
};

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(sessionStorage.getItem('admin_authenticated') === 'true');
  const [adminPassword, setAdminPassword] = useState('');
  const [passError, setPassError] = useState('');

  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [colorFilter, setColorFilter] = useState('all');
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [qrTokens, setQrTokens] = useState([]);
  const [qrTokenError, setQrTokenError] = useState('');
  const teamsRequestRef = useRef(0);

  const fetchTeams = useCallback(async (showRefreshIndicator = false) => {
    const requestId = ++teamsRequestRef.current;
    if (showRefreshIndicator) setRefreshing(true);
    try {
      setError('');
      const { data, error: fetchError } = await supabase
        .from('teams')
        .select('*');

      if (fetchError) throw fetchError;
      if (requestId === teamsRequestRef.current) setTeams(data || []);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch teams from database.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchTeams();

    const interval = setInterval(() => {
      fetchTeams(false);
    }, 15000);

    return () => clearInterval(interval);
  }, [isAuthenticated, fetchTeams]);

  useEffect(() => {
    if (!isAuthenticated) return;
    supabase.rpc('get_location_qr_tokens').then(({ data, error: tokenError }) => {
      if (tokenError) setQrTokenError('Location QR tokens are unavailable. Run the latest Supabase migration.');
      else setQrTokens(data || []);
    });
  }, [isAuthenticated]);

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    const correctPassword = import.meta.env.VITE_ADMIN_PASSWORD;

    if (!correctPassword) {
      setPassError('Admin password not configured. Set VITE_ADMIN_PASSWORD environment variable.');
      return;
    }

    if (adminPassword === correctPassword) {
      sessionStorage.setItem('admin_authenticated', 'true');
      setIsAuthenticated(true);
      setPassError('');
    } else {
      setPassError('Incorrect organizer passcode.');
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('admin_authenticated');
    setIsAuthenticated(false);
    setAdminPassword('');
  };

  const handleExportCSV = () => {
    if (teams.length === 0) return;

    const headers = ['Rank', 'Team Name', 'Team ID', 'Path', 'Start Time', 'Progress', 'Penalties', 'Duration', 'Status', 'Game 1', 'Game 2', 'Game 3', 'Game 4', 'Game 5'];
    const rows = sortedTeams.map((team, idx) => {
      const status = getStatusText(team);
      const progress = team.clues_solved === 5 ? 'Finished' : `Game ${team.clues_solved + 1}`;
      const duration = team.finish_time ? getDurationText(team.start_time, team.finish_time) : 'Playing...';
      const stageTimes = getStageTimes(team);
      return [
        idx + 1,
        team.name,
        team.team_code || '',
        team.color.toUpperCase(),
        new Date(team.start_time).toLocaleString(),
        `${progress} (${team.clues_solved}/5)`,
        team.penalty_count,
        duration,
        status,
        ...stageTimes.map((t) => t || '-')
      ];
    });

    const csvContent = [headers, ...rows].map(row => row.map(escapeCsv).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `krithohunt-teams-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const handleResetAllTeams = async () => {
    if (!confirm('WARNING: This will delete ALL teams and reset the entire event. This action is PERMANENT and CANNOT BE UNDONE. Type "RESET ALL" to confirm.')) {
      return;
    }

    const confirmation = prompt('Type "RESET ALL" to confirm:');
    if (confirmation !== 'RESET ALL') {
      alert('Reset cancelled. Confirmation text did not match.');
      return;
    }

    setActionLoading('reset-all');
    try {
      const { data, error: resetError } = await supabase.rpc('admin_reset_teams');
      if (resetError) throw resetError;
      if (!data?.success) throw new Error(data?.error || 'Reset failed.');
      await fetchTeams(false);
      alert('All teams have been deleted. Event reset complete.');
    } catch (err) {
      console.error(err);
      alert(err.message || 'Failed to reset event.');
    } finally {
      setActionLoading(null);
    }
  };

  const handlePrintQRCodes = async () => {
    let printWindow = window.open('', '_blank', 'width=1100,height=800');
    let fallbackFrame = null;
    if (!printWindow) {
      fallbackFrame = document.createElement('iframe');
      fallbackFrame.title = 'KRITHOHUNT QR print sheet';
      fallbackFrame.style.position = 'fixed';
      fallbackFrame.style.width = '1px';
      fallbackFrame.style.height = '1px';
      fallbackFrame.style.border = '0';
      fallbackFrame.style.opacity = '0';
      document.body.appendChild(fallbackFrame);
      printWindow = fallbackFrame.contentWindow;
    }

    printWindow.document.write('<!doctype html><title>KRITHOHUNT QR Sheet</title><p style="font:16px sans-serif;padding:24px">Generating QR sheet...</p>');
    printWindow.document.close();

    try {
      const entries = getQrEntries(qrTokens);
      if (entries.length !== 36) throw new Error('Expected 6 start codes plus 30 issued location tokens. Run the latest Supabase migration.');
      const cards = await Promise.all(entries.map(async (entry) => {
        const colorKey = entry.color.toLowerCase();
        const dataUrl = await QRCode.toDataURL(entry.url, {
          errorCorrectionLevel: 'M',
          margin: 2,
          width: 320,
          color: { dark: `#${qrColors[colorKey]}`, light: '#ffffff' },
        });
        return `<article class="qr-card"><div class="qr-label">${entry.title}</div><img src="${dataUrl}" alt="${entry.color} ${entry.subtitle} QR"><strong>${entry.color} ${entry.subtitle}</strong></article>`;
      }));

      printWindow.document.open();
      printWindow.document.write(`<!doctype html><html><head><title>KRITHOHUNT QR Sheet</title><style>
        @page { size: A4; margin: 12mm; }
        * { box-sizing: border-box; }
        body { margin: 0; color: #111827; font-family: Arial, sans-serif; }
        h1 { font-size: 20px; margin: 0 0 16px; }
        .sheet { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
        .section { grid-column: 1 / -1; font-size: 12px; font-weight: 700; margin-top: 10px; padding: 6px 0; border-bottom: 1px solid #9ca3af; }
        .qr-card { min-height: 230px; border: 1px dashed #6b7280; padding: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 7px; text-align: center; break-inside: avoid; }
        .qr-card img { display: block; width: 150px; height: 150px; }
        .qr-label { font-size: 10px; font-weight: 700; letter-spacing: 1px; }
        .qr-card strong { font-size: 12px; text-transform: uppercase; }
        .qr-card code { max-width: 100%; overflow-wrap: anywhere; font-size: 8px; }
        @media print { .qr-card { page-break-inside: avoid; } }
      </style></head><body><h1>KRITHOHUNT QR SHEET</h1><main class="sheet"><div class="section">START DESK CODES</div>${cards.slice(0, 6).join('')}<div class="section">LOCATION CODES</div>${cards.slice(6).join('')}</main></body></html>`);
      printWindow.document.close();
      window.setTimeout(() => {
        printWindow.focus();
        printWindow.print();
        if (fallbackFrame) window.setTimeout(() => fallbackFrame.remove(), 1000);
      }, 250);
    } catch (error) {
      if (fallbackFrame) fallbackFrame.remove();
      else printWindow.close();
      alert(`QR sheet generation failed: ${error.message}`);
    }
  };

  const handleDeleteTeam = async (teamId, teamName) => {
    if (!confirm(`WARNING: Are you absolutely sure you want to delete team "${teamName}"? This action is permanent and cannot be undone.`)) {
      return;
    }

    setActionLoading(teamId);
    try {
      const { data, error: rpcError } = await supabase.rpc('admin_delete_team', {
        p_team_id: teamId
      });

      if (rpcError) throw rpcError;

      if (data.success) {
        await fetchTeams(false);
      } else {
        alert(data.error || 'Failed to delete team.');
      }
    } catch (err) {
      console.error(err);
      alert(err.message || 'Failed to delete team.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCloseTeam = async (teamId, teamName) => {
    if (!confirm(`Close ${teamName}'s game now? Current progress will be preserved.`)) return;
    setActionLoading(`close-${teamId}`);
    try {
      const { data, error: closeError } = await supabase.rpc('admin_close_team', { p_team_id: teamId });
      if (closeError) throw closeError;
      if (!data?.success) throw new Error(data?.error || 'Unable to close team.');
      await fetchTeams(false);
    } catch (err) {
      alert(err.message || 'Unable to close team.');
    } finally {
      setActionLoading(null);
    }
  };

  const getDurationText = (start, finish) => {
    if (!start || !finish) return '';
    const diff = new Date(finish) - new Date(start);
    const totalSecs = Math.floor(diff / 1000);
    const minutes = Math.floor(totalSecs / 60);
    const seconds = totalSecs % 60;
    return `${minutes}m ${seconds}s`;
  };

  const getStatusText = (team) => {
    if (team.finish_time) return 'Finished';
    if (team.closed_at) return 'Closed by Organizer';
    if (team.clues_solved === 5) return 'Finished';
    if (team.waiting_for_qr) return 'Waiting for QR';
    return 'Playing';
  };

  // Format the per-game completion timestamps (index 0-4 => clue 1-5) for tie-breaking.
  const getStageTimes = (team) => {
    const times = team.game_completion_times || [];
    if (!Array.isArray(times) || times.length === 0) return [];
    return times.map((t) => (t ? getDurationText(team.start_time, t) : null));
  };

  const getTimeLimitText = (team) => {
    if (team.finish_time) return getDurationText(team.start_time, team.finish_time);
    if (team.closed_at) return 'Closed';
    if (!team.start_time) return 'N/A';
    const elapsed = Math.max(0, Date.now() - new Date(team.start_time).getTime());
    const mins = Math.floor(elapsed / 60000);
    const secs = Math.floor((elapsed % 60000) / 1000);
    return `${mins}m ${secs}s`;
  };

  const sortedTeams = [...teams].sort((a, b) => {
    const getRankBucket = (team) => {
      if (team.finish_time) return 0;
      if (team.closed_at) return 4;
      if (team.clues_solved === 5) return 1;
      if (!team.waiting_for_qr) return 2;
      return 3;
    };
    const aBucket = getRankBucket(a);
    const bBucket = getRankBucket(b);

    if (aBucket !== bBucket) return aBucket - bBucket;

    if (aBucket === 0) {
      const durationA = new Date(a.finish_time) - new Date(a.start_time);
      const durationB = new Date(b.finish_time) - new Date(b.start_time);
      return durationA - durationB;
    }

    if (aBucket === 1) {
      return new Date(a.start_time) - new Date(b.start_time);
    }

    if (a.clues_solved !== b.clues_solved) {
      return b.clues_solved - a.clues_solved;
    }
    if (a.penalty_count !== b.penalty_count) {
      return a.penalty_count - b.penalty_count;
    }

    return new Date(a.start_time) - new Date(b.start_time);
  });

  const filteredTeams = sortedTeams.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesColor = colorFilter === 'all' || t.color.toLowerCase() === colorFilter.toLowerCase();
    return matchesSearch && matchesColor;
  });

  const totalCount = teams.length;
  const completedCount = teams.filter(t => t.finish_time || t.clues_solved >= 5).length;
  const waitingCount = teams.filter(t => !t.finish_time && t.clues_solved < 5 && t.waiting_for_qr).length;
  const activeCount = teams.filter(t => !t.finish_time && t.clues_solved < 5 && !t.waiting_for_qr).length;
  const pathMetrics = Object.keys(PATH_DISPLAY).map((color) => {
    const pathTeams = teams.filter((team) => team.color.toLowerCase() === color);
    return {
      color,
      total: pathTeams.length,
      playing: pathTeams.filter(t => !t.finish_time && t.clues_solved < 5 && !t.waiting_for_qr).length,
      waiting: pathTeams.filter(t => !t.finish_time && t.clues_solved < 5 && t.waiting_for_qr).length,
      finished: pathTeams.filter(t => t.finish_time || t.clues_solved >= 5).length,
    };
  });

  if (!isAuthenticated) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-8 relative">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full blur-[100px] pointer-events-none opacity-20 bg-accent-brand" />
        <div className="w-full max-w-sm relative z-10">
          <div className="text-center mb-8">
            <div className="inline-flex p-3 rounded-full bg-surface-1 border border-border-subtle mb-3 shadow-inner">
              <KeyRound className="w-8 h-8 text-accent-brand" />
            </div>
            <h1 className="text-h1 font-semibold text-primary tracking-tight">Organizer access</h1>
            <p className="text-caption text-muted mt-1 uppercase tracking-wide font-medium">Enter password to unlock dashboard</p>
          </div>

          <div className="bg-surface-2/40 border border-border-subtle/50 backdrop-blur-md rounded-2xl p-6 space-y-5 shadow-xl">
            <form onSubmit={handlePasswordSubmit} className="space-y-5">
              <div>
                <Input
                  id="adminPass"
                  label="Organizer Password"
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Enter passcode..."
                  required
                  error={passError || undefined}
                  className="min-h-[56px] text-body"
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                className="touch-target"
              >
                Unlock Dashboard
              </Button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-0 flex flex-col">
      <header className="md:hidden sticky top-0 z-40 h-[56px] flex items-center justify-between px-4 bg-surface-0/80 backdrop-blur-md border-b border-b-border-subtle">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open menu"
          className="p-2 min-h-[44px] min-w-[44px]"
        >
          <Menu className="w-6 h-6" />
        </Button>
        <span className="text-h2 font-semibold text-primary tracking-tight">Admin</span>
        <div className="w-10" />
      </header>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <aside
          className={`admin-sidebar flex flex-col w-full md:w-64 md:shrink-0 bg-surface-1 md:border-r md:border-border-subtle/50 z-50 md:z-0 ${sidebarOpen ? 'open' : ''}`}
          aria-label="Admin navigation"
        >
          <div className="p-4 border-b border-border-subtle">
            <h2 className="text-h2 font-semibold text-primary tracking-tight">KRITHOHUNT</h2>
            <p className="text-caption text-muted mt-1 uppercase tracking-wide">Organizer Panel</p>
          </div>

          <nav className="flex-1 p-4 space-y-2 overflow-y-auto" role="navigation" aria-label="Main navigation">
            <Button
              variant="secondary"
              size="md"
              onClick={() => fetchTeams(true)}
              disabled={refreshing}
              className="w-full justify-start"
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh Data</span>
            </Button>

            <Button
              variant="ghost"
              size="md"
              onClick={handleLogout}
              className="w-full justify-start text-feedback-error hover:bg-feedback-error/10"
            >
              <LogOut className="w-5 h-5" />
              <span>Lock Dashboard</span>
            </Button>
          </nav>

          <div className="p-4 border-t border-border-subtle space-y-3">
            <h3 className="text-caption font-semibold text-muted uppercase tracking-wide px-2">Stats overview</h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 bg-surface-2 border border-border-subtle rounded-xl">
                <span className="text-micro text-muted uppercase tracking-wide block">Total</span>
                <span className="text-body-sm font-semibold text-primary">{totalCount}</span>
              </div>
              <div className="p-3 bg-surface-2 border border-border-subtle rounded-xl">
                <span className="text-micro text-muted uppercase tracking-wide block">Active</span>
                <span className="text-body-sm font-semibold text-accent-cyan">{activeCount}</span>
              </div>
              <div className="p-3 bg-surface-2 border border-border-subtle rounded-xl">
                <span className="text-micro text-muted uppercase tracking-wide block">Waiting</span>
                <span className="text-body-sm font-semibold text-accent-amber">{waitingCount}</span>
              </div>
              <div className="p-3 bg-surface-2 border border-border-subtle rounded-xl">
                <span className="text-micro text-muted uppercase tracking-wide block">Finished</span>
                <span className="text-body-sm font-semibold text-accent-emerald">{completedCount}</span>
              </div>
            </div>
          </div>
        </aside>

        {sidebarOpen && (
          <div
            className="md:hidden fixed inset-0 z-40 bg-surface-0/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        <main className="flex-1 flex flex-col overflow-y-auto md:overflow-y-auto">
          <div className="w-full max-w-[1400px] mx-auto flex-1 p-6 md:p-8">
            <div className="flex justify-end gap-2 items-center w-full flex-wrap sm:flex-nowrap border-b border-border-subtle pb-4 mb-6">
              <Button
                variant="secondary"
                size="sm"
                onClick={handlePrintQRCodes}
                className="flex items-center gap-2 shrink-0 md:w-auto"
              >
                <Printer className="w-4 h-4" />
                <span>Print QR Codes</span>
              </Button>

              <Button
                variant="secondary"
                size="sm"
                onClick={handleExportCSV}
                disabled={teams.length === 0}
                className="flex items-center gap-2 shrink-0 md:w-auto"
              >
                <Download className="w-4 h-4" />
                <span>Export CSV</span>
              </Button>

              <Button
                variant="danger"
                size="sm"
                onClick={handleResetAllTeams}
                disabled={actionLoading === 'reset-all'}
                loading={actionLoading === 'reset-all'}
                className="flex items-center gap-2 shrink-0 md:w-auto"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reset All</span>
              </Button>
            </div>

            {error && (
              <div className="mb-6 p-4 rounded-xl border border-feedback-error/20 bg-feedback-error/5 flex gap-3 items-start">
                <ShieldAlert className="w-5 h-5 shrink-0 text-feedback-error" />
                <span className="text-feedback-error text-body-sm">{error}</span>
              </div>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              <div className="p-3.5 rounded-xl bg-surface-2/30 border border-border-subtle/50 hover:bg-surface-2/40 transition-colors shadow-inner flex items-center justify-between">
                <div>
                  <span className="text-micro font-semibold text-muted uppercase tracking-wide block">Total teams</span>
                  <span className="text-body font-semibold text-primary mt-1 block leading-none">{totalCount}</span>
                </div>
                <div className="p-1.5 rounded-md bg-accent-brand/10 text-accent-brand shrink-0">
                  <Users className="w-4 h-4" />
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-surface-2/30 border border-border-subtle/50 hover:bg-surface-2/40 transition-colors shadow-inner flex items-center justify-between">
                <div>
                  <span className="text-micro font-semibold text-muted uppercase tracking-wide block">Completed</span>
                  <span className="text-body font-semibold text-primary mt-1 block leading-none">{completedCount}</span>
                </div>
                <div className="p-1.5 rounded-md bg-accent-emerald/10 text-accent-emerald shrink-0">
                  <Award className="w-4 h-4" />
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-surface-2/30 border border-border-subtle/50 hover:bg-surface-2/40 transition-colors shadow-inner flex items-center justify-between">
                <div>
                  <span className="text-micro font-semibold text-muted uppercase tracking-wide block">Waiting QR</span>
                  <span className="text-body font-semibold text-primary mt-1 block leading-none">{waitingCount}</span>
                </div>
                <div className="p-1.5 rounded-md bg-accent-amber/10 text-accent-amber shrink-0">
                  <CheckCircle className="w-4 h-4" />
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-surface-2/30 border border-border-subtle/50 hover:bg-surface-2/40 transition-colors shadow-inner flex items-center justify-between">
                <div>
                  <span className="text-micro font-semibold text-muted uppercase tracking-wide block">Active playing</span>
                  <span className="text-body font-semibold text-primary mt-1 block leading-none">{activeCount}</span>
                </div>
                <div className="p-1.5 rounded-md bg-accent-cyan/10 text-accent-cyan shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
            </div>

            <div className="bg-surface-2/40 border border-border-subtle/50 rounded-xl p-5 mb-8 shadow-inner">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-h2 font-semibold text-primary">Live path monitor</h2>
                  <p className="text-caption text-muted">Playing now, waiting for a location QR, and finished teams.</p>
                </div>
                <span className="text-micro font-semibold uppercase tracking-wide text-accent-cyan">{activeCount} playing now · {waitingCount} waiting</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {pathMetrics.map(({ color, total, playing, waiting, finished }) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setColorFilter(color)}
                    className="text-left rounded-xl border border-border-strong/40 bg-surface-1/60 p-3 hover:bg-surface-2/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand"
                  >
                    <span className={`path-badge ${PATH_BADGES[color]} px-2 py-0.5 rounded text-micro font-semibold uppercase`}>{color}</span>
                    <span className="block text-body font-semibold text-primary mt-2">{total}</span>
                    <span className="block text-micro text-accent-cyan">{playing} playing</span>
                    <span className="block text-micro text-accent-amber">{waiting} waiting</span>
                    <span className="block text-micro text-accent-emerald">{finished} finished</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-surface-2/30 border border-border-subtle/50 mb-6 shadow-inner">
              <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative w-full md:max-w-xs">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                  <Input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search teams..."
                    className="pl-10 min-h-[48px]"
                  />
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto">
                  <Filter className="w-4 h-4 text-muted" />
                  <select
                    value={colorFilter}
                    onChange={(e) => setColorFilter(e.target.value)}
                    className="w-full md:w-auto bg-surface-2 border border-border-subtle rounded-xl px-3 py-2.5 text-body text-primary focus:outline-none focus:border-accent-brand"
                  >
                    <option value="all">All Paths</option>
                    <option value="red">Red Path</option>
                    <option value="blue">Blue Path</option>
                    <option value="green">Green Path</option>
                    <option value="yellow">Yellow Path</option>
                    <option value="purple">Purple Path</option>
                    <option value="orange">Orange Path</option>
                  </select>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="p-8 rounded-2xl border border-border-subtle bg-surface-2/30 text-center shadow-inner">
                <RefreshCw className="w-8 h-8 animate-spin text-accent-brand mx-auto mb-3" />
                <span className="text-body-sm text-muted font-semibold">Loading database data...</span>
              </div>
            ) : filteredTeams.length === 0 ? (
              <div className="p-8 rounded-2xl border border-border-subtle bg-surface-2/30 text-center shadow-inner">
                <span className="text-body-sm text-muted font-semibold">No teams found matching the filters.</span>
              </div>
            ) : (
              <>
                <div className="hidden lg:block">
                  <div className="rounded-2xl border border-border-subtle bg-surface-1 shadow-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-surface-1 border-b border-border-subtle text-caption font-semibold uppercase tracking-wide text-muted">
                            <th className="py-4 px-5">Rank & Team</th>
                            <th className="py-4 px-4">Team ID</th>
                            <th className="py-4 px-4">Path</th>
                            <th className="py-4 px-4">Start Time</th>
                            <th className="py-4 px-4">Progress</th>
                            <th className="py-4 px-4 text-center">Penalties</th>
                            <th className="py-4 px-4">Duration</th>
                            <th className="py-4 px-4">Status</th>
                            <th className="py-4 px-5 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border-subtle text-body-sm">
                          {filteredTeams.map((team, idx) => {
                            const status = getStatusText(team);
                            const isCompleted = status === 'Finished';
                            const isWaitingQr = status === 'Waiting for QR';
                            const isClosed = status === 'Time Expired' || status === 'Closed by Organizer';

                            return (
                              <tr
                                key={team.id}
                                className={`hover:bg-surface-2/50 transition-colors ${isCompleted ? 'bg-accent-emerald/5' : isWaitingQr ? 'bg-accent-amber/5' : ''}`}
                              >
                                <td className="py-4 px-5 font-semibold text-primary flex items-center gap-3">
                                  <span className="w-5 text-muted text-right">{idx + 1}.</span>
                                  <span className="uppercase tracking-wide">{team.name}</span>
                                </td>

                                <td className="py-4 px-4 font-mono font-semibold tracking-widest text-accent-brand">{team.team_code || '-----'}</td>

                                <td className="py-4 px-4">
                                  <span className={`inline-block px-2.5 py-0.5 rounded border text-caption font-semibold uppercase tracking-wider ${PATH_BADGES[team.color.toLowerCase()] || 'bg-surface-3'}`}>
                                    {PATH_DISPLAY[team.color.toLowerCase()] || team.color.toUpperCase()}
                                  </span>
                                </td>

                                <td className="py-4 px-4 text-muted">
                                  {new Date(team.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                </td>

                                <td className="py-4 px-4">
                                  <div className="flex flex-col gap-0.5">
                                    <span className="font-semibold text-primary">
                                      {team.clues_solved === 5 ? 'Finished' : `Game ${team.clues_solved + 1}`}
                                    </span>
                                    <span className="text-micro text-muted font-semibold uppercase">{team.clues_solved} / 5 Solved</span>
                                    {getStageTimes(team).some(Boolean) && (
                                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                        {getStageTimes(team).map((t, i) => t ? (
                                          <span key={i} title={`Game ${i + 1} completed in ${t}`} className="inline-flex items-center gap-1 text-[0.6875rem] font-mono text-secondary bg-surface-3/60 border border-border-subtle/80 px-2 py-0.5 rounded-md whitespace-nowrap shrink-0">
                                            <span className="text-muted font-semibold">G{i + 1}:</span>
                                            <span className="text-primary font-medium">{t}</span>
                                          </span>
                                        ) : null)}
                                      </div>
                                    )}
                                  </div>
                                </td>

                                <td className="py-4 px-4 text-center font-semibold text-feedback-warning">
                                  {team.penalty_count}
                                </td>

                                <td className="py-4 px-4 font-mono text-secondary">
                                  {team.finish_time ? getDurationText(team.start_time, team.finish_time) : getTimeLimitText(team)}
                                </td>

                                <td className="py-4 px-4">
                                  {isCompleted ? (
                                    <span className="text-accent-emerald font-semibold flex items-center gap-1.5">
                                      <span className="w-1.5 h-1.5 rounded-full bg-accent-emerald" />
                                      <span>Finished</span>
                                    </span>
                                  ) : isClosed ? (
                                    <span className="text-feedback-warning font-semibold">{status}</span>
                                  ) : isWaitingQr ? (
                                    <span className="text-accent-amber font-semibold flex items-center gap-1.5">
                                      <span className="w-1.5 h-1.5 rounded-full bg-accent-amber animate-pulse" />
                                      <span>Waiting for QR</span>
                                    </span>
                                  ) : (
                                    <span className="text-accent-cyan font-medium flex items-center gap-1.5">
                                      <span className="w-1.5 h-1.5 rounded-full bg-accent-cyan animate-pulse" />
                                      <span>Playing</span>
                                    </span>
                                  )}
                                </td>

                                <td className="py-4 px-5 text-right">
                                  <div className="flex justify-end gap-2">
                                    {!isCompleted && !isClosed && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleCloseTeam(team.id, team.name)}
                                        disabled={actionLoading === `close-${team.id}`}
                                      >
                                        Close Game
                                      </Button>
                                    )}

                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeleteTeam(team.id, team.name)}
                                      disabled={actionLoading === team.id}
                                      className="text-feedback-error hover:bg-feedback-error/10 p-2 min-h-[40px] min-w-[40px]"
                                      aria-label={`Delete team ${team.name}`}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="lg:hidden space-y-4">
                  {filteredTeams.map((team, idx) => {
                    const status = getStatusText(team);
                    const isCompleted = status === 'Finished';
                    const isWaitingQr = status === 'Waiting for QR';
                    const isClosed = status === 'Time Expired' || status === 'Closed by Organizer';

                    return (
                      <div
                        key={team.id}
                        className={`relative overflow-hidden rounded-2xl border bg-surface-1 shadow-md transition-all
                          ${isCompleted
                            ? 'border-accent-emerald/40 bg-accent-emerald/5'
                            : isWaitingQr
                              ? 'border-accent-amber/40 bg-accent-amber/5'
                              : 'border-border-subtle'
                          }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4">
                          <div className="flex items-center gap-3">
                            <span className="w-8 text-muted text-right text-body font-semibold">{idx + 1}.</span>
                            <div>
                              <span className="text-body font-semibold text-primary uppercase tracking-wide block">{team.name}</span>
                              <span className="text-micro font-mono font-semibold tracking-widest text-accent-brand">ID {team.team_code || '-----'}</span>
                              <span className={`inline-block px-2 py-0.5 rounded border text-micro font-semibold uppercase tracking-wide mt-1 ${PATH_BADGES[team.color.toLowerCase()] || 'bg-surface-3'}`}>
                                {PATH_DISPLAY[team.color.toLowerCase()] || team.color.toUpperCase()}
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto text-center sm:text-left">
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-micro text-muted uppercase tracking-wide">Progress</span>
                              <span className="text-body font-semibold text-primary">{Math.min(team.clues_solved + 1, 5)} / 5</span>
                            </div>
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-micro text-muted uppercase tracking-wide">Penalties</span>
                              <span className="text-body font-semibold text-feedback-warning">{team.penalty_count}</span>
                            </div>
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-micro text-muted uppercase tracking-wide">Status</span>
                              <span className={`text-caption font-semibold ${isCompleted ? 'text-accent-emerald' : isWaitingQr ? 'text-accent-amber' : 'text-accent-cyan'
                                }`}>
                                {isCompleted ? 'Finished' : isClosed ? status : isWaitingQr ? 'Waiting for QR' : 'Playing'}
                              </span>
                              <span className="text-micro text-muted">{getTimeLimitText(team)}</span>
                            </div>
                          </div>
                        </div>

                        {getStageTimes(team).some(Boolean) && (
                          <div className="border-t border-border-subtle/40 px-4 py-2 bg-surface-2/20 flex flex-wrap items-center gap-1.5">
                            {getStageTimes(team).map((t, i) => t ? (
                              <span key={i} title={`Game ${i + 1} completed in ${t}`} className="inline-flex items-center gap-1 text-[0.6875rem] font-mono text-secondary bg-surface-3/60 border border-border-subtle/80 px-2 py-0.5 rounded-md whitespace-nowrap shrink-0">
                                <span className="text-muted font-semibold">G{i + 1}:</span>
                                <span className="text-primary font-medium">{t}</span>
                              </span>
                            ) : null)}
                          </div>
                        )}

                        <div className="border-t border-border-subtle/50 px-4 py-3 bg-surface-2/30 flex justify-end gap-2">
                          {!isCompleted && !isClosed && (
                            <Button variant="ghost" size="sm" onClick={() => handleCloseTeam(team.id, team.name)} disabled={actionLoading === `close-${team.id}`}>
                              Close Game
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteTeam(team.id, team.name)}
                            disabled={actionLoading === team.id}
                            className="text-feedback-error hover:bg-feedback-error/10 p-2 min-h-[40px] min-w-[40px]"
                            aria-label={`Delete team ${team.name}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            <div className="mt-12 border-t border-border-subtle pt-8" id="printable-qr-area">
              <div className="flex justify-between items-center mb-6 no-print">
                <div>
                  <h2 className="text-h2 font-bold text-primary flex items-center gap-2">
                    <Printer className="w-5 h-5 text-accent-brand" />
                    <span>Event QR Sheet Generator</span>
                  </h2>
                  <p className="text-caption text-muted mt-0.5">
                    Generate and print starting QR codes and location verification QRs. Cards print in a grid with cut marks.
                  </p>
                </div>
                <Button
                  variant="accent"
                  size="md"
                  onClick={handlePrintQRCodes}
                  className="flex items-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print QR Sheet</span>
                </Button>
              </div>

              <h3 className="text-caption font-bold text-muted uppercase tracking-widest mb-4 no-print flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-emerald" />
                <span>Stage 1: Start Desk QR Codes (6 total)</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8 qr-card-grid">
                {['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange'].map((color) => {
                  const startUrl = `${qrOrigin}/start?color=${color.toLowerCase()}`;
                  return (
                    <QRCard
                      key={color}
                      title="KRITHOHUNT START"
                      subtitle="Path Start"
                      url={startUrl}
                      color={color}
                    />
                  );
                })}
              </div>

              <h3 className="text-caption font-bold text-muted uppercase tracking-widest mb-4 no-print flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-brand" />
                <span>Stage 2-6: Physical Location QR Codes (30 total)</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 qr-card-grid">
                {qrTokens.map(({ token, color, stage }) => (
                  <QRCard
                    key={token}
                    title="KRITHOHUNT GATE"
                    subtitle={`Stage ${stage}`}
                    url={`${qrOrigin}/scan?token=${encodeURIComponent(token)}`}
                    color={color}
                  />
                ))}
              </div>
              {qrTokenError && <p className="text-feedback-error text-body-sm mt-3">{qrTokenError}</p>}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}