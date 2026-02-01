import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { Button } from '../ui/button';
import { 
  Mic, MicOff, Send, Loader2, CheckCircle, XCircle, 
  History, Volume2, Sparkles, MessageSquare, Command,
  Image, X, Camera
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AdminVoiceCommand() {
  const { token } = useAuth();
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [parsedCommand, setParsedCommand] = useState(null);
  const [executionResult, setExecutionResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const fileInputRef = useRef(null);
  
  useEffect(() => {
    fetchHistory();
  }, []);
  
  const fetchHistory = async () => {
    try {
      const response = await axios.get(`${API}/voice-command/history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setHistory(response.data);
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  };

  // Image handling functions
  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Accept both images and videos
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
        toast.error('Bitte nur Bild- oder Videodateien auswählen');
        return;
      }
      if (file.size > 20 * 1024 * 1024) { // 20MB limit for videos
        toast.error('Datei zu groß. Maximum: 20MB');
        return;
      }
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = (e) => setImagePreview(e.target.result);
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const analyzeImage = async () => {
    if (!selectedImage) {
      toast.error('Bitte zuerst ein Bild oder Video auswählen');
      return;
    }

    setIsAnalyzingImage(true);
    setIsProcessing(true);

    try {
      const formData = new FormData();
      formData.append('image', selectedImage);
      
      const defaultPrompt = selectedImage.type?.startsWith('video/')
        ? 'Analysiere dieses Video und beschreibe was du siehst. Was könnte das Problem sein?'
        : 'Analysiere dieses Bild und beschreibe was du siehst. Was könnte das Problem sein?';
      
      formData.append('text', textInput || defaultPrompt);

      const response = await axios.post(`${API}/voice-command/analyze-image`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.success) {
        setTranscription(textInput || 'Bildanalyse');
        setExecutionResult({
          success: true,
          message: response.data.analysis
        });
        setParsedCommand({ action: 'analyze_image', parameters: {} });
        toast.success('Bildanalyse abgeschlossen!');
      } else {
        toast.error(response.data.message || 'Bildanalyse fehlgeschlagen');
      }
    } catch (error) {
      console.error('Image analysis error:', error);
      toast.error(error.response?.data?.detail || 'Bildanalyse fehlgeschlagen');
    } finally {
      setIsAnalyzingImage(false);
      setIsProcessing(false);
    }
  };
  
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await processAudio(audioBlob);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      toast.info('🎤 Aufnahme gestartet... Sprechen Sie Ihren Befehl');
      
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Mikrofon-Zugriff verweigert');
    }
  };
  
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };
  
  const processAudio = async (audioBlob) => {
    setIsProcessing(true);
    setTranscription('');
    setParsedCommand(null);
    setExecutionResult(null);
    
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      
      const response = await axios.post(`${API}/voice-command/transcribe`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      
      setTranscription(response.data.transcription);
      setParsedCommand(response.data.parsed_command);
      
      toast.success('✓ Befehl erkannt');
      
    } catch (error) {
      console.error('Error processing audio:', error);
      toast.error(error.response?.data?.detail || 'Fehler bei der Verarbeitung');
    } finally {
      setIsProcessing(false);
    }
  };
  
  const processTextCommand = async () => {
    if (!textInput.trim()) return;
    
    setIsProcessing(true);
    setTranscription(textInput);
    setParsedCommand(null);
    setExecutionResult(null);
    
    try {
      const response = await axios.post(`${API}/voice-command/execute`, {
        text: textInput,
        execute: false
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setParsedCommand(response.data.parsed_command);
      toast.success('✓ Befehl erkannt');
      
    } catch (error) {
      console.error('Error processing command:', error);
      toast.error(error.response?.data?.detail || 'Fehler bei der Verarbeitung');
    } finally {
      setIsProcessing(false);
    }
  };
  
  const executeCommand = async () => {
    if (!parsedCommand || parsedCommand.action === 'unknown') return;
    
    setIsProcessing(true);
    
    try {
      const response = await axios.post(`${API}/voice-command/confirm-execute`, {
        action: parsedCommand.action,
        parameters: parsedCommand.parameters
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setExecutionResult(response.data);
      fetchHistory();
      
      if (response.data.success) {
        toast.success(response.data.message);
      } else {
        toast.error(response.data.message);
      }
      
    } catch (error) {
      console.error('Error executing command:', error);
      toast.error(error.response?.data?.detail || 'Fehler bei der Ausführung');
    } finally {
      setIsProcessing(false);
    }
  };
  
  const resetState = () => {
    setTranscription('');
    setParsedCommand(null);
    setExecutionResult(null);
    setTextInput('');
  };
  
  return (
    <div className="space-y-4 md:space-y-6" data-testid="admin-voice-command">
      {/* Header - Responsive */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shrink-0">
            <Command className="w-5 h-5 md:w-6 md:h-6 text-white" />
          </div>
          <div>
            <h2 className="text-lg md:text-xl font-bold text-white">Sprachbefehle</h2>
            <p className="text-gray-400 text-xs md:text-sm">Steuern Sie die Plattform mit Ihrer Stimme</p>
          </div>
        </div>
        <Button
          onClick={() => setShowHistory(!showHistory)}
          variant="outline"
          className="border-white/20 text-white text-sm self-start sm:self-auto"
          size="sm"
        >
          <History className="w-4 h-4 mr-1 md:mr-2" />
          Verlauf
        </Button>
      </div>
      
      {/* Main Recording Area - More compact on mobile */}
      <div className="glass-card rounded-xl md:rounded-2xl p-4 md:p-8 bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/30">
        <div className="text-center">
          {/* Microphone Button - Smaller on mobile */}
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isProcessing}
            className={`w-20 h-20 md:w-32 md:h-32 rounded-full mx-auto mb-4 md:mb-6 flex items-center justify-center transition-all transform hover:scale-105 ${
              isRecording 
                ? 'bg-red-500 animate-pulse shadow-lg shadow-red-500/50' 
                : isProcessing
                  ? 'bg-gray-600 cursor-not-allowed'
                  : 'bg-gradient-to-br from-purple-500 to-pink-500 hover:shadow-lg hover:shadow-purple-500/50'
            }`}
          >
            {isProcessing ? (
              <Loader2 className="w-8 h-8 md:w-12 md:h-12 text-white animate-spin" />
            ) : isRecording ? (
              <MicOff className="w-8 h-8 md:w-12 md:h-12 text-white" />
            ) : (
              <Mic className="w-8 h-8 md:w-12 md:h-12 text-white" />
            )}
          </button>
          
          <p className="text-white font-medium text-sm md:text-base mb-1 md:mb-2">
            {isRecording ? '🔴 Aufnahme läuft...' :
             isProcessing ? '⏳ Verarbeitung...' :
             '🎤 Klicken zum Sprechen'}
          </p>
          <p className="text-gray-400 text-xs md:text-sm">
            Beispiel: "Erstelle 50 Auktionen"
          </p>
        </div>
        
        {/* Or Text Input - More compact */}
        <div className="mt-4 md:mt-8 pt-4 md:pt-6 border-t border-white/10">
          <p className="text-gray-400 text-xs md:text-sm text-center mb-3 md:mb-4">Text-Befehl:</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && processTextCommand()}
              placeholder="z.B. Erstelle 20 Auktionen"
              className="flex-1 min-w-0 bg-[#181824] border border-white/10 rounded-lg px-3 md:px-4 py-2 md:py-3 text-sm md:text-base text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
            />
            <Button
              onClick={processTextCommand}
              disabled={isProcessing || !textInput.trim()}
              className="bg-purple-500 hover:bg-purple-600 px-3 md:px-6 shrink-0"
            >
              <Send className="w-4 h-4 md:w-5 md:h-5" />
            </Button>
          </div>
        </div>

        {/* Image/Video Upload Section - More compact on mobile */}
        <div className="mt-4 md:mt-6 pt-4 md:pt-6 border-t border-white/10">
          <p className="text-gray-400 text-xs md:text-sm text-center mb-3 md:mb-4">
            <Camera className="w-3 h-3 md:w-4 md:h-4 inline mr-1" />
            Bild oder Video für KI-Analyse:
          </p>
          
          {/* Hidden file input - accepts images AND videos */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageSelect}
            accept="image/*,video/*"
            className="hidden"
          />
          
          <div className="flex flex-col items-center gap-3 md:gap-4">
            {/* Preview */}
            {imagePreview ? (
              <div className="relative w-full max-w-xs">
                {selectedImage?.type?.startsWith('video/') ? (
                  <video 
                    src={imagePreview} 
                    className="w-full max-h-32 md:max-h-48 rounded-lg border border-white/20 object-contain"
                    controls
                  />
                ) : (
                  <img 
                    src={imagePreview} 
                    alt="Preview" 
                    className="w-full max-h-32 md:max-h-48 rounded-lg border border-white/20 object-contain"
                  />
                )}
                <button
                  onClick={removeImage}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full max-w-xs py-6 md:py-8 border-2 border-dashed border-white/20 rounded-lg hover:border-purple-500/50 transition-colors flex flex-col items-center gap-2"
              >
                <Image className="w-6 h-6 md:w-8 md:h-8 text-gray-400" />
                <span className="text-gray-400 text-xs md:text-sm">Klicken zum Hochladen</span>
                <span className="text-gray-500 text-xs">Bild/Video bis 10MB</span>
              </button>
            )}
            
            {/* Analyze Button */}
            {selectedImage && (
              <div className="flex gap-2 w-full max-w-xs">
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Frage (optional)"
                  className="flex-1 min-w-0 bg-[#181824] border border-white/10 rounded-lg px-3 py-2 text-white text-xs md:text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
                <Button
                  onClick={analyzeImage}
                  disabled={isAnalyzingImage}
                  className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-xs md:text-sm px-3 shrink-0"
                >
                  {isAnalyzingImage ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Sparkles className="w-3 h-3 md:w-4 md:h-4 mr-1" />
                      <span className="hidden sm:inline">Analysieren</span>
                      <span className="sm:hidden">KI</span>
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Transcription & Parsed Command - More compact */}
      {transcription && (
        <div className="glass-card rounded-xl p-4 md:p-6">
          <h3 className="text-white font-bold text-sm md:text-base mb-3 md:mb-4 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 md:w-5 md:h-5 text-cyan-400" />
            Erkannter Befehl
          </h3>
          
          {/* Transcription */}
          <div className="bg-[#181824] rounded-lg p-3 md:p-4 mb-3 md:mb-4">
            <p className="text-gray-400 text-xs mb-1">Transkription:</p>
            <p className="text-white text-sm md:text-lg">"{transcription}"</p>
          </div>
          
          {/* Parsed Command */}
          {parsedCommand && (
            <div className={`rounded-lg p-3 md:p-4 mb-3 md:mb-4 ${
              parsedCommand.action === 'unknown' 
                ? 'bg-red-500/10 border border-red-500/30' 
                : 'bg-green-500/10 border border-green-500/30'
            }`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-gray-400 text-xs mb-1">Aktion:</p>
                  <p className={`font-bold text-lg ${
                    parsedCommand.action === 'unknown' ? 'text-red-400' : 'text-green-400'
                  }`}>
                    {parsedCommand.action === 'unknown' ? '❌ Nicht erkannt' : `✓ ${parsedCommand.action}`}
                  </p>
                </div>
                {parsedCommand.action !== 'unknown' && (
                  <div className="text-right">
                    <p className="text-gray-400 text-xs mb-1">Parameter:</p>
                    <code className="text-xs text-gray-300">
                      {JSON.stringify(parsedCommand.parameters)}
                    </code>
                  </div>
                )}
              </div>
              
              {parsedCommand.confirmation_message && (
                <div className="mt-4 pt-4 border-t border-white/10">
                  <p className="text-white">{parsedCommand.confirmation_message}</p>
                </div>
              )}
            </div>
          )}
          
          {/* Action Buttons */}
          {parsedCommand && parsedCommand.action !== 'unknown' && !executionResult && (
            <div className="flex gap-3">
              <Button
                onClick={executeCommand}
                disabled={isProcessing}
                className="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold py-3"
              >
                {isProcessing ? (
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                ) : (
                  <CheckCircle className="w-5 h-5 mr-2" />
                )}
                Ausführen
              </Button>
              <Button
                onClick={resetState}
                variant="outline"
                className="border-white/20 text-white"
              >
                <XCircle className="w-5 h-5 mr-2" />
                Abbrechen
              </Button>
            </div>
          )}
          
          {/* Execution Result */}
          {executionResult && (
            <div className={`rounded-lg p-4 ${
              executionResult.success 
                ? 'bg-green-500/20 border border-green-500/50' 
                : 'bg-red-500/20 border border-red-500/50'
            }`}>
              <div className="flex items-center gap-3">
                {executionResult.success ? (
                  <CheckCircle className="w-8 h-8 text-green-400" />
                ) : (
                  <XCircle className="w-8 h-8 text-red-400" />
                )}
                <div>
                  <p className={`font-bold text-lg ${executionResult.success ? 'text-green-400' : 'text-red-400'}`}>
                    {executionResult.message}
                  </p>
                  {executionResult.data && (
                    <pre className="text-xs text-gray-300 mt-2">
                      {JSON.stringify(executionResult.data, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
              
              <Button
                onClick={resetState}
                className="w-full mt-4 bg-white/10 hover:bg-white/20 text-white"
              >
                Neuer Befehl
              </Button>
            </div>
          )}
        </div>
      )}
      
      {/* Command Examples */}
      <div className="glass-card rounded-xl p-6">
        <h3 className="text-white font-bold mb-4 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-yellow-400" />
          Verfügbare Befehle
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { cmd: "Erstelle 50 neue Auktionen", desc: "Neue Auktionen erstellen" },
            { cmd: "Lösche alle beendeten Auktionen", desc: "Alte Auktionen löschen" },
            { cmd: "Übersetze alle Produkte", desc: "Produkte in alle Sprachen übersetzen" },
            { cmd: "Übersetzung überprüfen", desc: "Übersetzungsstatus anzeigen" },
            { cmd: "Zeige mir die Statistiken", desc: "Plattform-Statistiken" },
            { cmd: "Setze die Auktion des Tages", desc: "AOTD automatisch setzen" },
            { cmd: "Füge 100 Gebote zu kunde@email.de hinzu", desc: "Gebote vergeben" },
            { cmd: "Erstelle Gutscheincode mit 50 Geboten", desc: "Gutschein generieren" }
          ].map((example, idx) => (
            <button
              key={idx}
              onClick={() => {
                setTextInput(example.cmd);
                processTextCommand();
              }}
              className="text-left p-3 rounded-lg bg-[#181824] hover:bg-[#202030] border border-white/5 hover:border-purple-500/30 transition-colors"
            >
              <p className="text-white font-medium text-sm">"{example.cmd}"</p>
              <p className="text-gray-500 text-xs">{example.desc}</p>
            </button>
          ))}
        </div>
      </div>
      
      {/* History */}
      {showHistory && (
        <div className="glass-card rounded-xl p-6">
          <h3 className="text-white font-bold mb-4 flex items-center gap-2">
            <History className="w-5 h-5 text-cyan-400" />
            Befehlsverlauf
          </h3>
          {history.length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {history.map((entry, idx) => (
                <div key={idx} className="p-3 rounded-lg bg-[#181824] border border-white/5">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-sm font-medium ${
                      entry.result?.success ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {entry.action}
                    </span>
                    <span className="text-gray-500 text-xs">
                      {new Date(entry.created_at).toLocaleString('de-DE')}
                    </span>
                  </div>
                  <p className="text-gray-400 text-xs">{entry.result?.message}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">Noch keine Befehle ausgeführt</p>
          )}
        </div>
      )}
    </div>
  );
}
