import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { AlertTriangle, CheckCircle2, Loader2, MapPin, ZoomIn, ZoomOut, ChevronRight } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default icon URL issues in Vite/Webpack build
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Default target locations for 5 rounds if not supplied in gameData
const DEFAULT_ROUNDS = [
  {
    round: 1,
    label: "Central Library",
    photo: "/geo/locations/library.png",
    target: { x: 0.3100, y: 0.3000 },
    radius: 0.10
  },
  {
    round: 2,
    label: "Student Canteen",
    photo: "/geo/locations/canteen.png",
    target: { x: 0.3100, y: 0.1600 },
    radius: 0.10
  },
  {
    round: 3,
    label: "Auditorium",
    photo: "/geo/locations/auditorium.png",
    target: { x: 0.3150, y: 0.2500 },
    radius: 0.10
  },
  {
    round: 4,
    label: "Main Circle",
    photo: "/geo/locations/main-circle.png",
    target: { x: 0.6495, y: 0.7700 },
    radius: 0.10
  },
  {
    round: 5,
    label: "Cricket Ground",
    photo: "/geo/locations/cricket.png",
    target: { x: 0.4008, y: 0.1700 },
    radius: 0.10
  }
];

export default function CampusGeoguessrGame({ teamId, colorTheme, gameData, onSolved, onIncorrect }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);

  // Configuration from props or default
  const mapImage = gameData?.map_image || '/geo/campus-satellite.png';
  const rounds = gameData?.rounds || DEFAULT_ROUNDS;

  // Local State
  const [currentRoundIdx, setCurrentRoundIdx] = useState(0);
  const [pin, setPin] = useState(null); // { x: 0..1, y: 0..1 }
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const currentRound = rounds[currentRoundIdx] || rounds[0];
  const totalRounds = rounds.length;

  // Initialize Leaflet Map with ImageOverlay
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Clean up old instance if exists
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    // Standard image dimensions bound: [ [0, 0], [1000, 1000] ] using simple CRS
    const bounds = [[0, 0], [1000, 1000]];

    const map = L.map(mapContainerRef.current, {
      crs: L.CRS.Simple,
      minZoom: -2,
      maxZoom: 2,
      zoomControl: false,
      attributionControl: false,
      doubleClickZoom: false
    });

    mapInstanceRef.current = map;

    // Load satellite image overlay
    L.imageOverlay(mapImage, bounds).addTo(map);
    map.fitBounds(bounds);

    // Map Click Handler - Converts lat/lng click inside [0,1000] to normalized (0.0 -> 1.0)
    map.on('click', (e) => {
      const lat = e.latlng.lat;
      const lng = e.latlng.lng;

      // Clamp coordinates to image boundaries
      const clampedY = Math.max(0, Math.min(1000, lat));
      const clampedX = Math.max(0, Math.min(1000, lng));

      // Leaflet CRS Simple: y goes bottom-to-top (0 at bottom, 1000 at top)
      // Normalized y for game: 0 at top, 1 at bottom
      const normX = Number((clampedX / 1000).toFixed(4));
      const normY = Number(((1000 - clampedY) / 1000).toFixed(4));

      setPin({ x: normX, y: normY });
      setErrorMsg('');

      // Add or update marker on Leaflet map
      if (markerRef.current) {
        markerRef.current.setLatLng([clampedY, clampedX]);
      } else {
        const customIcon = L.divIcon({
          className: 'custom-pin-marker',
          html: `<div class="w-7 h-7 bg-indigo-600 rounded-full border-2 border-white shadow-xl flex items-center justify-center text-white animate-bounce">
                   <div class="w-2.5 h-2.5 bg-white rounded-full"></div>
                 </div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14]
        });

        markerRef.current = L.marker([clampedY, clampedX], { icon: customIcon }).addTo(map);
      }
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [mapImage]);

  // Handle Guess Submission
  const handleSubmitGuess = async () => {
    if (!pin) {
      setErrorMsg('Please tap or click on the campus map to place your guess marker.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    const targetX = currentRound.target.x;
    const targetY = currentRound.target.y;
    const radius = currentRound.radius || 0.08;

    const distance = Math.sqrt(
      Math.pow(pin.x - targetX, 2) + Math.pow(pin.y - targetY, 2)
    );

    const isCorrect = distance <= radius;

    try {
      if (isCorrect) {
        if (currentRoundIdx + 1 >= totalRounds) {
          const { data, error } = await supabase.rpc('submit_team_answer', {
            p_team_id: teamId,
            p_answer: 'solve'
          });

          if (error) throw error;

          if (data.success) {
            setSuccessMsg(`🎉 ALL LOCATIONS FOUND! You completed all ${totalRounds} rounds!`);
            setTimeout(() => {
              onSolved();
            }, 1800);
          } else {
            setErrorMsg(data.error || 'Failed to submit final answer to server.');
          }
        } else {
          setSuccessMsg(`✓ Correct location! Advancing to Round ${currentRoundIdx + 2}/${totalRounds}...`);
          setTimeout(() => {
            setCurrentRoundIdx(prev => prev + 1);
            setPin(null);
            setSuccessMsg('');
            if (markerRef.current && mapInstanceRef.current) {
              mapInstanceRef.current.removeLayer(markerRef.current);
              markerRef.current = null;
            }
          }, 1500);
        }
      } else {
        const { error } = await supabase.rpc('submit_team_answer', {
          p_team_id: teamId,
          p_answer: 'wrong'
        });

        if (error) console.error("Penalty update error:", error);

        setErrorMsg('✗ WRONG LOCATION. Your guess was not close enough. Penalty +1 added.');
        onIncorrect();
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Connection error. Please check network and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Round Header & Progress */}
      <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 text-left flex justify-between items-center">
        <div>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            Campus Geo Guess
          </span>
          <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">
            {currentRound?.label || `Location ${currentRoundIdx + 1}`}
          </h3>
        </div>

        <div className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-indigo-400 text-xs font-black uppercase tracking-wider">
          Round {currentRoundIdx + 1} / {totalRounds}
        </div>
      </div>

      {/* Location Photograph (The Question) */}
      <div className="space-y-2">
        <div className="flex justify-between items-center text-[10px] uppercase font-bold text-slate-400 px-1">
          <span>Target Photograph</span>
          <span className="text-slate-500">Where was this taken?</span>
        </div>

        <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl">
          <img
            src={currentRound?.photo}
            alt={currentRound?.label}
            className="w-full h-full object-cover transition-opacity duration-300"
            onError={(e) => {
              // Fallback placeholder image
              e.currentTarget.src = `https://via.placeholder.com/800x600/0f172a/818cf8?text=${encodeURIComponent(currentRound?.label || 'Campus Location')}`;
            }}
          />
          <div className="absolute bottom-3 left-3 px-2.5 py-1 bg-slate-950/80 backdrop-blur-md rounded-lg text-[10px] font-bold text-slate-300 border border-slate-800">
            📍 {currentRound?.label}
          </div>
        </div>
      </div>

      {/* Interactive Satellite Campus Map (Leaflet) */}
      <div className="space-y-2">
        <div className="flex justify-between items-center text-[10px] uppercase font-bold text-slate-400 px-1">
          <span>Satellite Campus Map</span>
          <span>{pin ? `Guess: (${pin.x}, ${pin.y})` : 'Tap to place pin'}</span>
        </div>

        <div className="relative w-full aspect-square rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl">
          <div ref={mapContainerRef} className="w-full h-full z-10" />

          {/* Map Controls */}
          <div className="absolute top-3 right-3 z-20 flex flex-col gap-1.5">
            <button
              onClick={() => mapInstanceRef.current?.zoomIn()}
              className="p-2 bg-slate-900/90 hover:bg-slate-800 border border-slate-700 rounded-xl text-white shadow-lg active:scale-95 transition-all cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => mapInstanceRef.current?.zoomOut()}
              className="p-2 bg-slate-900/90 hover:bg-slate-800 border border-slate-700 rounded-xl text-white shadow-lg active:scale-95 transition-all cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
          </div>

          {/* HUD Overlay instruction */}
          {!pin && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 px-3 py-1.5 bg-slate-950/85 backdrop-blur-md border border-slate-800 rounded-full text-[10px] font-semibold text-slate-400 pointer-events-none shadow-lg animate-pulse flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-indigo-400" />
              <span>Tap the satellite map to select location</span>
            </div>
          )}
        </div>
      </div>

      {/* Feedback & Actions */}
      <div className="space-y-3 pt-1">
        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex gap-2.5 items-start animate-shake">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Wrong Location: </span>
              <span>{errorMsg}</span>
            </div>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex gap-2.5 items-start">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Location Found: </span>
              <span>{successMsg}</span>
            </div>
          </div>
        )}

        <button
          onClick={handleSubmitGuess}
          disabled={loading || !pin || !!successMsg}
          style={pin && !successMsg ? { backgroundColor: `rgba(${colorTheme.rgb}, 0.95)` } : {}}
          className={`
            w-full py-4 rounded-2xl text-slate-950 font-black text-xs tracking-wider uppercase shadow-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-40 cursor-pointer
            ${successMsg ? 'bg-emerald-500 text-slate-950' : 'hover:brightness-110'}
          `}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <span>Submit Guess</span>
              <ChevronRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
