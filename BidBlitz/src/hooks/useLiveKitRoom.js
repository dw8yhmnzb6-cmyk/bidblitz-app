import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Room,
  RoomEvent,
  Track,
  createLocalVideoTrack,
  createLocalAudioTrack,
  ConnectionState,
} from 'livekit-client';

/**
 * useLiveKitRoom — hook to connect to a LiveKit room and expose remote/local tracks.
 *
 * Usage:
 *   const { room, status, error, participants, connect, disconnect, toggleCamera, toggleMic } = useLiveKitRoom();
 *   await connect({ url, token, asPublisher: true });
 *
 * @returns {{
 *   room: Room|null, status: string, error: string,
 *   participants: Array, localTracks: { camera: any, mic: any },
 *   connect: Function, disconnect: Function,
 *   toggleCamera: Function, toggleMic: Function,
 * }}
 */
export function useLiveKitRoom() {
  const [room, setRoom] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | connecting | connected | reconnecting | disconnected
  const [error, setError] = useState('');
  const [participants, setParticipants] = useState([]);
  const [cameraOn, setCameraOn] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const roomRef = useRef(null);

  const updateParticipants = useCallback((r) => {
    if (!r) return;
    const list = [];
    list.push({ identity: r.localParticipant.identity, isLocal: true, participant: r.localParticipant });
    r.remoteParticipants.forEach((p) => {
      list.push({ identity: p.identity, isLocal: false, participant: p });
    });
    setParticipants(list);
  }, []);

  const connect = useCallback(async ({ url, token, asPublisher = false }) => {
    setError('');
    setStatus('connecting');
    try {
      const r = new Room({
        adaptiveStream: true,
        dynacast: true,
        publishDefaults: {
          videoSimulcastLayers: [
            { width: 320, height: 180, fps: 15 },
            { width: 640, height: 360, fps: 30 },
          ],
        },
      });

      r.on(RoomEvent.Connected, () => {
        setStatus('connected');
        updateParticipants(r);
      });
      r.on(RoomEvent.Disconnected, () => setStatus('disconnected'));
      r.on(RoomEvent.Reconnecting, () => setStatus('reconnecting'));
      r.on(RoomEvent.Reconnected, () => setStatus('connected'));
      r.on(RoomEvent.ParticipantConnected, () => updateParticipants(r));
      r.on(RoomEvent.ParticipantDisconnected, () => updateParticipants(r));
      r.on(RoomEvent.TrackSubscribed, () => updateParticipants(r));
      r.on(RoomEvent.TrackUnsubscribed, () => updateParticipants(r));

      await r.connect(url, token);
      roomRef.current = r;
      setRoom(r);

      if (asPublisher) {
        try {
          const cam = await createLocalVideoTrack({ resolution: { width: 640, height: 360 } });
          const mic = await createLocalAudioTrack();
          await r.localParticipant.publishTrack(cam);
          await r.localParticipant.publishTrack(mic);
          setCameraOn(true);
          setMicOn(true);
        } catch (e) {
          console.error('Failed to publish:', e);
          setError('Kamera/Mikrofon konnte nicht freigegeben werden: ' + e.message);
        }
      }

      updateParticipants(r);
    } catch (e) {
      setError(e.message || 'Verbindung fehlgeschlagen');
      setStatus('disconnected');
    }
  }, [updateParticipants]);

  const disconnect = useCallback(async () => {
    if (roomRef.current) {
      await roomRef.current.disconnect();
      roomRef.current = null;
      setRoom(null);
      setStatus('disconnected');
      setParticipants([]);
      setCameraOn(false);
      setMicOn(false);
    }
  }, []);

  const toggleCamera = useCallback(async () => {
    const r = roomRef.current;
    if (!r) return;
    const enabled = !cameraOn;
    await r.localParticipant.setCameraEnabled(enabled);
    setCameraOn(enabled);
  }, [cameraOn]);

  const toggleMic = useCallback(async () => {
    const r = roomRef.current;
    if (!r) return;
    const enabled = !micOn;
    await r.localParticipant.setMicrophoneEnabled(enabled);
    setMicOn(enabled);
  }, [micOn]);

  useEffect(() => {
    return () => {
      if (roomRef.current) roomRef.current.disconnect();
    };
  }, []);

  return {
    room,
    status,
    error,
    participants,
    cameraOn,
    micOn,
    connect,
    disconnect,
    toggleCamera,
    toggleMic,
  };
}

/**
 * Attach a LiveKit Track to a video element.
 * Use as: <video ref={(el) => attachTrack(el, track)} autoPlay playsInline />
 */
export function attachTrack(el, track) {
  if (!el || !track) return;
  if (track.kind === Track.Kind.Video || track.kind === Track.Kind.Audio) {
    track.attach(el);
  }
}
