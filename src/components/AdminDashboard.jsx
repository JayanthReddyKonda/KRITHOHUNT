import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { RefreshCw, Users, Award, ShieldAlert, CheckCircle, Clock, Trash2, Search, Filter, Lock, KeyRound } from 'lucide-react';

const PATH_BADGES = {
  red: 'bg-red-500/10 border-red-500/30 text-red-400',
  blue: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
  green: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
  yellow: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
  purple: 'bg-violet-500/10 border-violet-500/30 text-violet-400',
  orange: 'bg-orange-500/10 border-orange-500/30 text-orange-400'
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
  const [actionLoading, setActionLoading] = useState(null); // teamId of active action
  const [error, setError] = useState('');

  const fetchTeams = async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) setRefreshing(true);
    try {
      setError('');
      const { data, error: fetchError } = await supabase
        .from('teams')
        .select('*');

      if (fetchError) throw fetchError;
      setTeams(data || []);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch teams from database.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchTeams();

    // Auto-refresh every 15 seconds
    const interval = setInterval(() => {
      fetchTeams(false);
    }, 15000);

    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    const correctPassword = import.meta.env.VITE_ADMIN_PASSWORD || 'organizer123';
    
    if (adminPassword === correctPassword) {
      sessionStorage.setItem('admin_authenticated', 'true');
      setIsAuthenticated(true);
      setPassError('');
    } else {
      setPassError('Incorrect organizer passcode.');
    }
  };

  const handleLock = () => {
    sessionStorage.removeItem('admin_authenticated');
    setIsAuthenticated(false);
    setAdminPassword('');
  };


  const handleMarkFinished = async (teamId, teamName) => {
    if (!confirm(`Mark team "${teamName}" as finished? This records their official completion timestamp.`)) {
      return;
    }

    setActionLoading(teamId);
    try {
      const { data, error: rpcError } = await supabase.rpc('mark_team_finished', {
        p_team_id: teamId
      });

      if (rpcError) throw rpcError;
      
      if (data.success) {
        // Refresh local list
        await fetchTeams(false);
      } else {
        alert(data.error || 'Failed to update team finish state.');
      }
    } catch (err) {
      console.error(err);
      alert(err.message || 'Error occurred while updating the database.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteTeam = async (teamId, teamName) => {
    if (!confirm(`WARNING: Are you absolutely sure you want to delete team "${teamName}"? This action is permanent and cannot be undone.`)) {
      return;
    }

    setActionLoading(teamId);
    try {
      const { error: deleteError } = await supabase
        .from('teams')
        .delete()
        .eq('id', teamId);

      if (deleteError) throw deleteError;
      await fetchTeams(false);
    } catch (err) {
      console.error(err);
      alert(err.message || 'Failed to delete team.');
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

  const getStatusText = (cluesSolved, finishTime) => {
    if (finishTime) return 'Finished';
    if (cluesSolved === 5) return 'Ready for Final Challenge';
    return 'Playing';
  };

  // Sort logic:
  // 1. Finished teams first, sorted by duration (ascending, i.e. fastest first)
  // 2. Teams ready for jigsaw second, sorted by start_time (first who got there first)
  // 3. Teams playing third, sorted by clues_solved (descending) then penalties (ascending)
  const sortedTeams = [...teams].sort((a, b) => {
    // Check finish state
    const aFinished = !!a.finish_time;
    const bFinished = !!b.finish_time;
    
    if (aFinished && !bFinished) return -1;
    if (!aFinished && bFinished) return 1;

    // Both finished
    if (aFinished && bFinished) {
      const durationA = new Date(a.finish_time) - new Date(a.start_time);
      const durationB = new Date(b.finish_time) - new Date(b.start_time);
      return durationA - durationB;
    }

    // Check ready for jigsaw
    const aReady = a.clues_solved === 5;
    const bReady = b.clues_solved === 5;

    if (aReady && !bReady) return -1;
    if (!aReady && bReady) return 1;

    // Both ready for jigsaw (sort by start time, earlier first)
    if (aReady && bReady) {
      return new Date(a.start_time) - new Date(b.start_time);
    }

    // Both playing (sort by clues_solved desc, then penalties asc)
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

  // Basic stats
  const totalCount = teams.length;
  const completedCount = teams.filter(t => t.finish_time).length;
  const readyCount = teams.filter(t => t.clues_solved === 5 && !t.finish_time).length;
  const activeCount = totalCount - completedCount - readyCount;

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 py-8 relative">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full blur-[100px] pointer-events-none opacity-20 bg-indigo-500" />
        
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="inline-flex p-3 rounded-full bg-slate-900 border border-slate-800 mb-3 shadow-inner">
              <KeyRound className="w-8 h-8 text-indigo-400" />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">ORGANIZER ACCESS</h1>
            <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest font-semibold">Enter Password to Unlock Dashboard</p>
          </div>

          <div className="bg-slate-900/65 border border-slate-800/80 rounded-3xl p-6 shadow-2xl backdrop-blur-lg relative overflow-hidden">
            <form onSubmit={handlePasswordSubmit} className="space-y-5">
              <div>
                <label htmlFor="adminPass" className="block text-xs font-medium text-slate-300 mb-2 uppercase tracking-wide">
                  Organizer Password
                </label>
                <input
                  id="adminPass"
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Enter passcode..."
                  required
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-white text-base outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>

              {passError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex gap-2 items-center">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>{passError}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3.5 px-4 bg-indigo-650 hover:bg-indigo-700 text-slate-950 font-bold text-xs tracking-wider uppercase rounded-xl transition-all shadow-lg text-white"
              >
                Unlock Dashboard
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Admin header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
            Organizers Dashboard
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Monitor teams, record completions, and manage the event live.
          </p>
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          <button
            onClick={() => fetchTeams(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-semibold text-slate-300 transition-colors disabled:opacity-50 justify-center w-full md:w-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          
          <button
            onClick={handleLock}
            className="flex items-center gap-2 px-4 py-2.5 bg-red-950/20 hover:bg-red-950/40 border border-red-500/20 rounded-xl text-xs font-semibold text-red-400 transition-colors justify-center w-full md:w-auto"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Lock</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-sm flex gap-3">
          <ShieldAlert className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Stats Panel */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-900 border border-slate-850 p-5 rounded-2xl flex items-center gap-4">
          <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500">Total Teams</span>
            <h3 className="text-2xl font-black text-white">{totalCount}</h3>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-850 p-5 rounded-2xl flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500">Completed</span>
            <h3 className="text-2xl font-black text-white">{completedCount}</h3>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-850 p-5 rounded-2xl flex items-center gap-4">
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500">Ready Jigsaw</span>
            <h3 className="text-2xl font-black text-white">{readyCount}</h3>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-850 p-5 rounded-2xl flex items-center gap-4">
          <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500">Active Playing</span>
            <h3 className="text-2xl font-black text-white">{activeCount}</h3>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-slate-900/50 border border-slate-850 rounded-2xl p-4 mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:max-w-xs">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search teams..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-slate-700"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="w-3.5 h-3.5 text-slate-500" />
          <select
            value={colorFilter}
            onChange={(e) => setColorFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-slate-700 w-full md:w-auto"
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

      {/* Table Container */}
      {loading ? (
        <div className="flex flex-col justify-center items-center py-20 gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
          <span className="text-xs text-slate-400">Loading database data...</span>
        </div>
      ) : filteredTeams.length === 0 ? (
        <div className="bg-slate-900 border border-slate-850 p-12 text-center rounded-2xl text-slate-500 text-sm">
          No teams found matching the filters.
        </div>
      ) : (
        <div className="bg-slate-900/60 border border-slate-850 rounded-2xl overflow-hidden shadow-xl">
          {/* Scrollable table on desktop */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-850 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-4 px-5">Rank & Team</th>
                  <th className="py-4 px-4">Path</th>
                  <th className="py-4 px-4">Start Time</th>
                  <th className="py-4 px-4">Progress</th>
                  <th className="py-4 px-4 text-center">Penalties</th>
                  <th className="py-4 px-4">Duration</th>
                  <th className="py-4 px-4">Status</th>
                  <th className="py-4 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850 text-xs">
                {filteredTeams.map((team, idx) => {
                  const status = getStatusText(team.clues_solved, team.finish_time);
                  const isCompleted = status === 'Finished';
                  const isReady = status === 'Ready for Final Challenge';
                  
                  return (
                    <tr 
                      key={team.id} 
                      className={`hover:bg-slate-900/40 transition-colors ${
                        isReady ? 'bg-indigo-500/5' : isCompleted ? 'bg-emerald-500/5' : ''
                      }`}
                    >
                      {/* Rank & Team Name */}
                      <td className="py-4 px-5 font-bold text-white flex items-center gap-3">
                        <span className="w-5 text-slate-500 text-right">{idx + 1}.</span>
                        <span className="uppercase tracking-wide">{team.name}</span>
                      </td>

                      {/* Path Color */}
                      <td className="py-4 px-4">
                        <span className={`inline-block px-2.5 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider ${
                          PATH_BADGES[team.color.toLowerCase()] || 'bg-slate-800'
                        }`}>
                          {team.color}
                        </span>
                      </td>

                      {/* Start Time */}
                      <td className="py-4 px-4 text-slate-400">
                        {new Date(team.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>

                      {/* Progress Bar & Text */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-200">{team.clues_solved} / 5</span>
                          <div className="w-16 h-1.5 bg-slate-950 rounded-full overflow-hidden hidden sm:block">
                            <div 
                              className={`h-full rounded-full ${
                                isCompleted ? 'bg-emerald-500' : isReady ? 'bg-indigo-500' : 'bg-blue-500'
                              }`} 
                              style={{ width: `${(team.clues_solved / 5) * 100}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Penalties */}
                      <td className="py-4 px-4 text-center font-bold text-amber-500">
                        {team.penalty_count}
                      </td>

                      {/* Duration */}
                      <td className="py-4 px-4 font-mono text-slate-300">
                        {team.finish_time ? (
                          getDurationText(team.start_time, team.finish_time)
                        ) : (
                          <span className="text-[10px] text-slate-500">Playing...</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4">
                        {isCompleted ? (
                          <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span>Finished</span>
                          </span>
                        ) : isReady ? (
                          <span className="text-indigo-400 font-bold animate-pulse flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                            <span>Ready Jigsaw</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 font-medium flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                            <span>Playing</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-5 text-right">
                        <div className="flex justify-end gap-2">
                          {isReady && (
                            <button
                              onClick={() => handleMarkFinished(team.id, team.name)}
                              disabled={actionLoading === team.id}
                              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-[10px] uppercase tracking-wider rounded-lg transition-colors flex items-center gap-1"
                            >
                              <span>Mark Finished</span>
                            </button>
                          )}
                          
                          <button
                            onClick={() => handleDeleteTeam(team.id, team.name)}
                            disabled={actionLoading === team.id}
                            className="p-1.5 hover:bg-red-500/10 text-slate-500 hover:text-red-400 rounded-lg transition-colors"
                            title="Delete Team"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
