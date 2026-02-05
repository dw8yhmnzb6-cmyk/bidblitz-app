/**
 * Voice Debug Assistant Component
 * AI-powered voice debugging for admin panel
 * Works on all browsers including iOS Safari
 */
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { 
  Mic, MicOff, AlertTriangle, CheckCircle, XCircle, 
  FileText, Loader2, Bug, Sparkles, X,
  AlertCircle, Info, ChevronDown, ChevronUp, Square
} from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

// Translations
const translations = {
  de: {
    title: 'Sprach-Debug-Assistent',
    subtitle: 'Beschreibe den Fehler per Sprache',
    listening: 'Höre zu...',
    recording: 'Aufnahme läuft... Beschreibe den Fehler!',
    processing: 'Verarbeite...',
    analyzing: 'Analysiere Fehler mit KI...',
    speakNow: 'Sprich jetzt...',
    stopRecording: 'Aufnahme stoppen',
    startRecording: 'Aufnahme starten',
    errorReport: 'Fehler-Report',
    description: 'Beschreibung',
    severity: 'Schweregrad',
    possibleCauses: 'Mögliche Ursachen',
    affectedFiles: 'Betroffene Dateien',
    recommendations: 'Empfehlungen',
    transcription: 'Was du gesagt hast',
    noMicrophone: 'Kein Mikrofon gefunden. Bitte erlaube den Zugriff.',
    microphoneError: 'Mikrofon-Fehler',
    analysisComplete: 'Analyse abgeschlossen!',
    analysisFailed: 'Analyse fehlgeschlagen',
    low: 'Niedrig',
    medium: 'Mittel',
    high: 'Hoch',
    critical: 'Kritisch',
    newReport: 'Neuer Report',
    close: 'Schließen',
    hint: 'Tipp: Drücke den roten Button und beschreibe den Fehler. Z.B. "Der Login funktioniert nicht" oder "Die Seite lädt nicht richtig"',
    permissionDenied: 'Mikrofon-Zugriff verweigert. Bitte erlaube den Zugriff in deinen Browser-Einstellungen.',
    recordingTooShort: 'Aufnahme zu kurz. Bitte sprich mindestens 2 Sekunden.',
  },
  en: {
    title: 'Voice Debug Assistant',
    subtitle: 'Describe the bug using voice',
    listening: 'Listening...',
    recording: 'Recording... Describe the bug!',
    processing: 'Processing...',
    analyzing: 'Analyzing error with AI...',
    speakNow: 'Speak now...',
    stopRecording: 'Stop recording',
    startRecording: 'Start recording',
    errorReport: 'Error Report',
    description: 'Description',
    severity: 'Severity',
    possibleCauses: 'Possible Causes',
    affectedFiles: 'Affected Files',
    recommendations: 'Recommendations',
    transcription: 'What you said',
    noMicrophone: 'No microphone found. Please allow access.',
    microphoneError: 'Microphone error',
    analysisComplete: 'Analysis complete!',
    analysisFailed: 'Analysis failed',
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    critical: 'Critical',
    newReport: 'New Report',
    close: 'Close',
    hint: 'Tip: Press the red button and describe the bug. E.g. "The login doesn\'t work" or "The page doesn\'t load correctly"',
    permissionDenied: 'Microphone access denied. Please allow access in your browser settings.',
    recordingTooShort: 'Recording too short. Please speak for at least 2 seconds.',
  }
};

const severityColors = {
  low: 'bg-blue-100 text-blue-700 border-blue-300',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  high: 'bg-orange-100 text-orange-700 border-orange-300',
  critical: 'bg-red-100 text-red-700 border-red-300',
};

const severityIcons = {
  low: <Info className="w-5 h-5" />,
  medium: <AlertCircle className="w-5 h-5" />,
  high: <AlertTriangle className="w-5 h-5" />,
  critical: <XCircle className="w-5 h-5" />,
};

export const VoiceDebugAssistant = ({ isOpen, onClose }) => {
  const { token } = useAuth();
  const { language } = useLanguage();
  const t = translations[language] || translations.de;
  
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [report, setReport] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [expandedSections, setExpandedSections] = useState({
    causes: true,
    files: true,
    recommendations: true,
  });
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);
  
  // Start recording
  const startRecording = async () => {
    try {
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      });
      
      streamRef.current = stream;
      
      // Check for supported MIME types
      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/mp4';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'audio/ogg';
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = ''; // Use default
          }
        }
      }
      
      const options = mimeType ? { mimeType } : {};
      mediaRecorderRef.current = new MediaRecorder(stream, options);
      audioChunksRef.current = [];
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorderRef.current.onstop = async () => {
        const mimeTypeUsed = mediaRecorderRef.current.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeTypeUsed });
        
        // Check if recording is long enough (at least 1 second)
        if (recordingTime < 1) {
          toast.error(t.recordingTooShort);
          return;
        }
        
        await analyzeAudio(audioBlob);
      };
      
      mediaRecorderRef.current.start(100); // Collect data every 100ms
      setIsRecording(true);
      setRecordingTime(0);
      
      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
      toast.success(t.recording);
      
      // Auto-stop after 60 seconds
      setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          stopRecording();
        }
      }, 60000);
      
    } catch (err) {
      console.error('Recording error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        toast.error(t.permissionDenied);
      } else {
        toast.error(t.noMicrophone);
      }
    }
  };
  
  // Stop recording
  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    
    setIsRecording(false);
  };
  
  // Analyze audio
  const analyzeAudio = async (audioBlob) => {
    setIsProcessing(true);
    
    try {
      // Determine file extension based on MIME type
      let extension = 'webm';
      if (audioBlob.type.includes('mp4')) extension = 'mp4';
      else if (audioBlob.type.includes('ogg')) extension = 'ogg';
      else if (audioBlob.type.includes('wav')) extension = 'wav';
      
      const formData = new FormData();
      formData.append('audio', audioBlob, `recording.${extension}`);
      formData.append('language', language);
      
      const response = await axios.post(
        `${API}/api/admin/voice-debug/analyze`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          },
          timeout: 60000 // 60 second timeout
        }
      );
      
      if (response.data.success && response.data.report) {
        setReport(response.data.report);
        toast.success(t.analysisComplete);
      } else {
        toast.error(response.data.error || t.analysisFailed);
      }
      
    } catch (err) {
      console.error('Analysis error:', err);
      const errorMsg = err.response?.data?.detail || err.response?.data?.error || t.analysisFailed;
      toast.error(errorMsg);
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Toggle section
  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };
  
  // Reset for new report
  const resetForNewReport = () => {
    setReport(null);
    setIsRecording(false);
    setIsProcessing(false);
    setRecordingTime(0);
  };
  
  // Format time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                <Bug className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold">{t.title}</h2>
                <p className="text-white/80 text-sm">{t.subtitle}</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="text-white/80 hover:text-white p-2"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Recording Interface */}
          {!report && (
            <div className="text-center py-8">
              {/* Microphone Animation */}
              <div className={`w-32 h-32 mx-auto rounded-full flex items-center justify-center mb-6 transition-all duration-300 ${
                isRecording 
                  ? 'bg-red-100 animate-pulse scale-110' 
                  : isProcessing
                    ? 'bg-purple-100'
                    : 'bg-gray-100 hover:bg-gray-200'
              }`}>
                {isProcessing ? (
                  <Loader2 className="w-16 h-16 text-purple-600 animate-spin" />
                ) : isRecording ? (
                  <div className="relative">
                    <Mic className="w-16 h-16 text-red-600" />
                    <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full font-mono">
                      {formatTime(recordingTime)}
                    </div>
                  </div>
                ) : (
                  <Mic className="w-16 h-16 text-gray-400" />
                )}
              </div>
              
              {/* Status Text */}
              <p className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">
                {isProcessing 
                  ? t.analyzing 
                  : isRecording 
                    ? t.recording 
                    : t.subtitle}
              </p>
              
              {/* Hint */}
              {!isRecording && !isProcessing && (
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 mb-6 text-left">
                  <div className="flex items-start gap-2">
                    <Sparkles className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-purple-700 dark:text-purple-300">
                      {t.hint}
                    </p>
                  </div>
                </div>
              )}
              
              {/* Recording Progress Bar */}
              {isRecording && (
                <div className="w-full max-w-xs mx-auto mb-6">
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-red-500 transition-all duration-1000"
                      style={{ width: `${Math.min((recordingTime / 60) * 100, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Max. 60 Sekunden</p>
                </div>
              )}
              
              {/* Control Buttons */}
              <div className="flex justify-center gap-4 mt-4">
                {isRecording ? (
                  <Button 
                    onClick={stopRecording}
                    size="lg"
                    className="bg-red-500 hover:bg-red-600 text-white px-8 py-6 text-lg"
                    disabled={isProcessing}
                  >
                    <Square className="w-6 h-6 mr-2 fill-current" />
                    {t.stopRecording}
                  </Button>
                ) : (
                  <Button 
                    onClick={startRecording}
                    size="lg"
                    className="bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-400 hover:to-pink-400 text-white px-8 py-6 text-lg"
                    disabled={isProcessing}
                  >
                    <Mic className="w-6 h-6 mr-2" />
                    {t.startRecording}
                  </Button>
                )}
              </div>
            </div>
          )}
          
          {/* Report Display */}
          {report && (
            <div className="space-y-6">
              {/* Report Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="w-6 h-6 text-purple-600" />
                  <div>
                    <h3 className="font-bold text-gray-800 dark:text-gray-200">{t.errorReport}</h3>
                    <p className="text-sm text-gray-500">{report.id}</p>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium border flex items-center gap-1 ${severityColors[report.severity]}`}>
                  {severityIcons[report.severity]}
                  <span>{t[report.severity]}</span>
                </span>
              </div>
              
              {/* Transcription */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                <p className="text-sm text-gray-500 mb-1">{t.transcription}</p>
                <p className="text-gray-800 dark:text-gray-200 italic">"{report.transcription}"</p>
              </div>
              
              {/* Description */}
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
                <p className="text-sm text-purple-600 dark:text-purple-400 mb-1">{t.description}</p>
                <p className="text-gray-800 dark:text-gray-200">{report.description}</p>
              </div>
              
              {/* Possible Causes */}
              <div className="border rounded-lg dark:border-gray-700 overflow-hidden">
                <button 
                  onClick={() => toggleSection('causes')}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-orange-500" />
                    <span className="font-medium text-gray-800 dark:text-gray-200">{t.possibleCauses}</span>
                    <span className="text-sm text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                      {report.possible_causes.length}
                    </span>
                  </div>
                  {expandedSections.causes ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                </button>
                {expandedSections.causes && (
                  <div className="px-4 pb-4 border-t dark:border-gray-700">
                    <ul className="space-y-2 mt-3">
                      {report.possible_causes.map((cause, i) => (
                        <li key={i} className="flex items-start gap-2 text-gray-600 dark:text-gray-400">
                          <span className="text-orange-500 mt-1">•</span>
                          {cause}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              
              {/* Affected Files */}
              <div className="border rounded-lg dark:border-gray-700 overflow-hidden">
                <button 
                  onClick={() => toggleSection('files')}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-500" />
                    <span className="font-medium text-gray-800 dark:text-gray-200">{t.affectedFiles}</span>
                    <span className="text-sm text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                      {report.affected_files.length}
                    </span>
                  </div>
                  {expandedSections.files ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                </button>
                {expandedSections.files && (
                  <div className="px-4 pb-4 border-t dark:border-gray-700">
                    <ul className="space-y-2 mt-3">
                      {report.affected_files.map((file, i) => (
                        <li key={i} className="font-mono text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-3 py-2 rounded">
                          {file}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              
              {/* Recommendations */}
              <div className="border rounded-lg dark:border-gray-700 overflow-hidden">
                <button 
                  onClick={() => toggleSection('recommendations')}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span className="font-medium text-gray-800 dark:text-gray-200">{t.recommendations}</span>
                    <span className="text-sm text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                      {report.recommendations.length}
                    </span>
                  </div>
                  {expandedSections.recommendations ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                </button>
                {expandedSections.recommendations && (
                  <div className="px-4 pb-4 border-t dark:border-gray-700">
                    <ul className="space-y-2 mt-3">
                      {report.recommendations.map((rec, i) => (
                        <li key={i} className="flex items-start gap-2 text-gray-600 dark:text-gray-400">
                          <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              
              {/* New Report Button */}
              <div className="flex justify-center pt-4">
                <Button 
                  onClick={resetForNewReport}
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white"
                >
                  <Mic className="w-5 h-5 mr-2" />
                  {t.newReport}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VoiceDebugAssistant;
