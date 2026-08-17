import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Simple .env parser
const envText = fs.readFileSync('.env', 'utf8');
const env = {};
envText.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
    env[key] = val;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function solve() {
  // Get latest team
  const { data: teams, error: fetchErr } = await supabase
    .from('teams')
    .select('id, name, color, clues_solved, waiting_for_qr')
    .order('start_time', { ascending: false })
    .limit(1);

  if (fetchErr || !teams || teams.length === 0) {
    console.error('Error fetching latest team:', fetchErr);
    return;
  }

  const latestTeam = teams[0];
  console.log('Latest Team:', latestTeam);

  // 1. Scan QR first
  const { data: scanRes, error: scanErr } = await supabase.rpc('scan_location_qr', {
    p_team_id: latestTeam.id,
    p_scanned_color: latestTeam.color.toLowerCase(),
    p_scanned_stage: latestTeam.clues_solved + 1
  });

  if (scanErr) {
    console.error('Error scanning QR:', scanErr);
    return;
  }
  console.log('Scan QR result:', scanRes);

  // 2. Call RPC to solve Sudoku
  const { data: solveRes, error: solveErr } = await supabase.rpc('submit_team_answer', {
    p_team_id: latestTeam.id,
    p_answer: '[[1,2,3,4],[3,4,1,2],[2,1,4,3],[4,3,2,1]]'
  });

  if (solveErr) {
    console.error('Error solving Sudoku:', solveErr);
  } else {
    console.log('Solve result:', solveRes);
  }
}

solve();
