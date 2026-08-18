import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { AlertTriangle, CheckCircle2, Loader2, MapPin, ZoomIn, ZoomOut, ChevronRight } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Card, Button } from '@/components/primitives';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

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
  const accentColorRef = useRef(`hsl(var(--accent-${colorTheme?.accent || 'indigo'}))`);

  useEffect(() => {
    accentColorRef.current = `hsl(var(--accent-${colorTheme?.accent || 'indigo'}))`;
  }, [colorTheme?.accent]);

  const mapImage = gameData?.map_image || '/geo/campus-satellite.png';
  const rounds = gameData?.rounds || DEFAULT_ROUNDS;

  const [currentRoundIdx, setCurrentRoundIdx] = useState(0);
  const [pin, setPin] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const currentRound = rounds[currentRoundIdx] || rounds[0];
  const totalRounds = rounds.length;

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

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
          html: `
            <div class="w-7 h-7 rounded-full border-2 border-surface-0 shadow-[0_0_12px_rgba(99,102,241,0.6)] flex items-center justify-center animate-pulse" style="background-color: ${accentColorRef.current};">
              <div class="w-2.5 h-2.5 bg-surface-0 rounded-full"></div>
            </div>
          `,
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
            setSuccessMsg(`ALL LOCATIONS FOUND! You completed all ${totalRounds} rounds!`);
            setTimeout(() => {
              onSolved();
            }, 1800);
          } else {
            setErrorMsg(data.error || 'Failed to submit final answer to server.');
          }
        } else {
          setSuccessMsg(`Correct location! Advancing to Round ${currentRoundIdx + 2}/${totalRounds}...`);
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

        setErrorMsg('Wrong location. Your guess was not close enough. Penalty +1 added.');
        onIncorrect();
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Connection error. Please check network and try again.');
    } finally {
      setLoading(false);
    }
  };

  const accentColor = `hsl(var(--accent-${colorTheme?.accent || 'indigo'}))`;

  return (
    <div className="space-y-5">
      <Card variant="elevated" padding="md" className="flex justify-between items-center">
        <div>
          <span className="text-micro font-bold text-muted uppercase tracking-widest">
            Campus Geo Guess
          </span>
          <h3 className="text-h2 text-primary uppercase tracking-wider">
            {currentRound?.label || `Location ${currentRoundIdx + 1}`}
          </h3>
        </div>

        <span className="px-3 py-1 bg-accent-indigo/10 border border-accent-indigo/30 rounded-lg text-accent-indigo text-micro font-black uppercase tracking-wider">
          Round {currentRoundIdx + 1} / {totalRounds}
        </span>
      </Card>

      <Card variant="panel" padding="md" className="space-y-3">
        <div className="flex justify-between items-center text-micro font-bold text-muted px-1">
          <span>Target Photograph</span>
          <span className="text-secondary">Where was this taken?</span>
        </div>

        <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden border border-border-subtle bg-surface-1 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
          <img
            src={currentRound?.photo}
            alt={currentRound?.label}
            className="w-full h-full object-contain transition-opacity duration-300"
            onError={(e) => {
              e.currentTarget.src = `https://via.placeholder.com/800x600/0b1120/6366f1?text=${encodeURIComponent(currentRound?.label || 'Campus Location')}`;
            }}
          />
          <div className="absolute bottom-3 left-3 px-2.5 py-1 bg-surface-0/80 backdrop-blur-md rounded-lg text-micro font-bold text-secondary border border-border-subtle">
            <MapPin className="w-3.5 h-3.5 inline-block mr-1 text-accent-indigo" aria-hidden="true" />
            {currentRound?.label}
          </div>
        </div>
      </Card>

      <Card variant="panel" padding="md" className="space-y-3">
        <div className="flex justify-between items-center text-micro font-bold text-muted px-1">
          <span>Satellite Campus Map</span>
          <span className="text-secondary">{pin ? `Guess: (${pin.x}, ${pin.y})` : 'Tap to place pin'}</span>
        </div>

        <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden border border-border-subtle bg-surface-1 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
          <div ref={mapContainerRef} className="w-full h-full z-10 geo-map-container" />

          <div className="absolute top-3 right-3 z-20 flex flex-col gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => mapInstanceRef.current?.zoomIn()}
              aria-label="Zoom in"
              className="min-h-[40px] min-w-[40px] p-2 bg-surface-1/90 hover:bg-surface-2 border border-border-subtle rounded-xl text-primary shadow-lg active:scale-95 transition-all"
            >
              <ZoomIn className="w-4 h-4" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => mapInstanceRef.current?.zoomOut()}
              aria-label="Zoom out"
              className="min-h-[40px] min-w-[40px] p-2 bg-surface-1/90 hover:bg-surface-2 border border-border-subtle rounded-xl text-primary shadow-lg active:scale-95 transition-all"
            >
              <ZoomOut className="w-4 h-4" aria-hidden="true" />
            </Button>
          </div>

          {!pin && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 px-3 py-1.5 bg-surface-0/85 backdrop-blur-md border border-border-subtle rounded-full text-micro font-semibold text-secondary pointer-events-none shadow-lg animate-pulse flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-accent-indigo" aria-hidden="true" />
              <span>Tap the satellite map to select location</span>
            </div>
          )}
        </div>
      </Card>

      <div className="space-y-3">
        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-feedback-error/10 border border-feedback-error/20 text-feedback-error text-body-sm flex gap-2.5 items-start animate-shake" role="alert">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <span className="font-bold">Wrong Location: </span>
              <span>{errorMsg}</span>
            </div>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 rounded-xl bg-feedback-success/10 border border-feedback-success/20 text-feedback-success text-body-sm flex gap-2.5 items-start" role="status">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <span className="font-bold">Location Found: </span>
              <span>{successMsg}</span>
            </div>
          </div>
        )}

        <Button
          variant="accent"
          size="lg"
          fullWidth
          onClick={handleSubmitGuess}
          disabled={loading || !pin || !!successMsg}
          loading={loading}
          style={pin && !successMsg ? { backgroundColor: accentColor } : {}}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              <span>Submitting...</span>
            </>
          ) : (
            <>
              <span>Submit Guess</span>
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}