import { useEffect, useRef } from 'react';
import { Track } from 'livekit-client';

/**
 * Renders all video/audio tracks from a LiveKit Participant.
 * Auto-attaches/detaches tracks as they are subscribed.
 */
export function ParticipantTile({ participant, isLocal = false, label }) {
  const videoRef = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => {
    if (!participant) return;

    const attachTracks = () => {
      participant.trackPublications.forEach((pub) => {
        const track = pub.track;
        if (!track) return;
        if (track.kind === Track.Kind.Video && videoRef.current) {
          track.attach(videoRef.current);
        } else if (track.kind === Track.Kind.Audio && audioRef.current && !isLocal) {
          track.attach(audioRef.current);
        }
      });
    };

    attachTracks();

    const onTrackSubscribed = () => attachTracks();
    const onTrackUnsubscribed = (track) => track.detach();

    participant.on('trackSubscribed', onTrackSubscribed);
    participant.on('trackUnsubscribed', onTrackUnsubscribed);
    participant.on('trackPublished', onTrackSubscribed);

    return () => {
      participant.off('trackSubscribed', onTrackSubscribed);
      participant.off('trackUnsubscribed', onTrackUnsubscribed);
      participant.off('trackPublished', onTrackSubscribed);
      if (videoRef.current) videoRef.current.srcObject = null;
      if (audioRef.current) audioRef.current.srcObject = null;
    };
  }, [participant, isLocal]);

  return (
    <div
      className="relative aspect-video bg-black rounded-xl overflow-hidden border border-white/10"
      data-testid={`participant-tile-${participant?.identity || 'unknown'}`}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className="w-full h-full object-cover"
      />
      <audio ref={audioRef} autoPlay />
      <div className="absolute bottom-2 left-2 px-2 py-1 rounded-md bg-black/60 text-xs font-semibold text-white">
        {label || participant?.identity || 'Unknown'}{isLocal && ' (Du)'}
      </div>
    </div>
  );
}
