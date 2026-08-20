import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { AlertTriangle, CheckCircle2, Loader2, MapPin, ZoomIn, ZoomOut, ChevronRight } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Button } from '@/components/primitives';

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

  const mapImage = gameData?.map_image || '/geo/campus-satellite.png';
  const rounds = gameData?.rounds || DEFAULT_ROUNDS;

  const [currentRoundIdx, setCurrentRoundIdx] = useState(0);
  const [pin, setPin] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const submittingRef = useRef(false);
  const currentRound = rounds[currentRoundIdx] || rounds[0];
  const totalRounds = rounds.length;
  const storageKey = `krithohunt_geoguessr_${teamId}`;

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }
    markerRef.current = null;

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

    L.imageOverlay(mapImage, bounds).addTo(map);
    map.fitBounds(bounds);

    map.on('click', (e) => {
      const lat = e.latlng.lat;
      const lng = e.latlng.lng;

      const clampedY = Math.max(0, Math.min(1000, lat));
      const clampedX = Math.max(0, Math.min(1000, lng));

      const normX = Number((clampedX / 1000).toFixed(4));
      const normY = Number(((1000 - clampedY) / 1000).toFixed(4));

      setPin({ x: normX, y: normY });
      setErrorMsg('');

      if (markerRef.current) {
        markerRef.current.setLatLng([clampedY, clampedX]);
      } else {
        const customIcon = L.divIcon({
          className: 'custom-pin-marker geo-pin-marker',
          html: '<div class="geo-pin-dot"><div class="geo-pin-core"></div></div>',
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
      markerRef.current = null;
    };
  }, [mapImage]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
      if (saved && Number.isInteger(saved.roundIndex) && saved.roundIndex >= 0 && saved.roundIndex < totalRounds) {
        setCurrentRoundIdx(saved.roundIndex);
        setPin(saved.pin || null);
      }
    } catch {
      localStorage.removeItem(storageKey);
    }
  }, [storageKey, totalRounds]);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify({ roundIndex: currentRoundIdx, pin }));
  }, [storageKey, currentRoundIdx, pin]);

  useEffect(() => {
    if (!pin || !mapInstanceRef.current || markerRef.current) return;
    const map = mapInstanceRef.current;
    const x = pin.x * 1000;
    const y = (1 - pin.y) * 1000;
    const customIcon = L.divIcon({
      className: 'custom-pin-marker geo-pin-marker',
      html: '<div class="geo-pin-dot"><div class="geo-pin-core"></div></div>',
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
    markerRef.current = L.marker([y, x], { icon: customIcon }).addTo(map);
  }, [pin]);

  const handleSubmitGuess = async () => {
    if (submittingRef.current || loading || successMsg) return;
    if (!pin) {
      setErrorMsg('Please tap or click on the campus map to place your guess marker.');
      return;
    }

    submittingRef.current = true;
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
    const roundNumber = currentRoundIdx + 1;

    try {
      if (isCorrect) {
        if (roundNumber >= totalRounds) {
          // FINAL ROUND - submit to server, this completes the GeoGuessr game (clue #3)
          const { data, error } = await supabase.rpc('submit_team_answer', {
            p_team_id: teamId,
            p_answer: `${pin.x},${pin.y},${roundNumber}`
          });

          if (error) throw error;

          if (data.success) {
            localStorage.removeItem(storageKey);
            setSuccessMsg(`ALL LOCATIONS FOUND! You completed all ${totalRounds} rounds!`);
            setTimeout(() => {
              onSolved();
            }, 1800);
          } else {
            setErrorMsg(data.error || 'Failed to submit answer to server.');
            submittingRef.current = false;
          }
        } else {
          // Intermediate round - advance locally, NO server call yet
          setSuccessMsg(`Correct location! Advancing to Round ${roundNumber + 1}/${totalRounds}...`);
          setTimeout(() => {
            submittingRef.current = false;
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
        // Wrong guess - submit 'wrong' to record penalty immediately
        const { error } = await supabase.rpc('submit_team_answer', {
          p_team_id: teamId,
          p_answer: 'wrong'
        });

        if (error) console.error("Penalty update error:", error);

        setErrorMsg('Wrong location. Your guess was not close enough. Penalty +1 added.');
        onIncorrect();
        submittingRef.current = false;
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Connection error. Please check network and try again.');
      submittingRef.current = false;
    } finally {
      setLoading(false);
    }
  };

  const accentColor = `hsl(var(--accent-${colorTheme?.accent || 'brand'}))`;

  return (
    <div className="space-y-3">
      {/* Compact header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-accent-brand">Puzzle 3 · Round {currentRoundIdx + 1}/{totalRounds}</p>
          <h3 className="text-[1.05rem] font-semibold text-primary">{currentRound?.label || `Location ${currentRoundIdx + 1}`}</h3>
        </div>
        <span
          className="text-[11px] font-semibold px-2 py-1 rounded-md border"
          style={{
            background: `hsl(var(--accent-${colorTheme?.accent || 'brand'}) / 0.1)`,
            borderColor: `hsl(var(--accent-${colorTheme?.accent || 'brand'}) / 0.3)`,
            color: `hsl(var(--accent-${colorTheme?.accent || 'brand'}))`,
          }}
        >
          {currentRoundIdx + 1}&nbsp;/&nbsp;{totalRounds}
        </span>
      </div>

      {/* Location photo */}
      <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden border border-border-subtle bg-surface-1">
        <img
          src={currentRound?.photo}
          alt={currentRound?.label}
          className="w-full h-full object-contain"
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = '/geo/campus-satellite.png';
          }}
        />
        <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-surface-0/80 backdrop-blur-md rounded-md text-[11px] font-medium text-secondary border border-border-subtle">
          <MapPin className="w-3 h-3 inline-block mr-0.5" style={{ color: accentColor }} />
          Where was this taken?
        </div>
      </div>

      {/* Map */}
      <div className="relative w-full rounded-xl overflow-hidden border border-border-subtle bg-surface-1 shadow-sm" style={{ height: 'min(55vw, 240px)' }}>
        <div ref={mapContainerRef} className="w-full h-full z-10 geo-map-container" />
        <div className="absolute top-2 right-2 z-20 flex flex-col gap-1">
          <Button
            variant="ghost" size="sm"
            onClick={() => mapInstanceRef.current?.zoomIn()}
            aria-label="Zoom in"
            className="min-h-[36px] min-w-[36px] p-1.5 bg-surface-1/90 border border-border-subtle rounded-lg text-primary shadow-sm"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost" size="sm"
            onClick={() => mapInstanceRef.current?.zoomOut()}
            aria-label="Zoom out"
            className="min-h-[36px] min-w-[36px] p-1.5 bg-surface-1/90 border border-border-subtle rounded-lg text-primary shadow-sm"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </Button>
        </div>
        {!pin && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 px-3 py-1 bg-surface-0/85 backdrop-blur-md border border-border-subtle rounded-full text-[11px] font-medium text-secondary pointer-events-none shadow-sm">
            Tap the map to place a pin
          </div>
        )}
      </div>

      <div className="space-y-2.5">
        {errorMsg && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-feedback-error/10 border border-feedback-error/20 text-feedback-error text-[0.8125rem] animate-shake" role="alert">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-feedback-success/15 border border-feedback-success/25 text-feedback-success text-[0.8125rem]" role="status">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={handleSubmitGuess}
          disabled={loading || !pin || !!successMsg}
          loading={loading}
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /><span>Submitting...</span></>
          ) : (
            <><span>Submit Guess</span><ChevronRight className="w-4 h-4" /></>
          )}
        </Button>
      </div>
    </div>
  );
}