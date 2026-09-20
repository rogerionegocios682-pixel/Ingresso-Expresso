import React, { useState, useEffect, useRef } from 'react';
import jsQR from 'jsqr';
import {
  Camera,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  QrCode,
  Search,
  Users,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Clock,
  Ticket as TicketIcon,
  Volume2,
  VolumeX,
  Cloud,
  Loader2,
  Zap
} from 'lucide-react';
import { User, ValidationResult, Event } from '../types';
import { StorageService } from '../services/storage';
import { formatDate } from '../services/whatsapp';

interface CheckInViewProps {
  currentUser: User;
}

export const CheckInView: React.FC<CheckInViewProps> = ({ currentUser }) => {
  if (!['MASTER', 'ADMIN', 'DOORMAN', 'CHECKIN'].includes(currentUser.role)) {
    return (
      <div className="bg-white p-8 rounded-2xl border border-rose-200 text-center space-y-3">
        <p className="text-rose-600 font-bold">Acesso restrito à equipe de portaria e administração.</p>
      </div>
    );
  }

  const companyId = StorageService.getCurrentCompanyId();
  const allEvents = StorageService.getEvents(currentUser.role === 'MASTER' ? undefined : companyId);

  const [selectedEventId, setSelectedEventId] = useState<string>('all');
  const [manualCode, setManualCode] = useState<string>('');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [continuousMode, setContinuousMode] = useState<boolean>(true);
  const [cameraError, setCameraError] = useState<string>('');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [, setStoreTick] = useState<number>(0);

  // Re-render when database updates
  useEffect(() => {
    const unsubscribe = StorageService.subscribe(() => {
      setStoreTick(t => t + 1);
    });
    return unsubscribe;
  }, []);

  // Result state
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [confirmedSuccess, setConfirmedSuccess] = useState<boolean>(false);
  const [recentScans, setRecentScans] = useState<{
    id: string;
    code: string;
    customer: string;
    ticketType: string;
    time: string;
    status: 'VALID' | 'ALREADY_USED' | 'INVALID' | 'CANCELLED';
  }[]>([]);

  const [queueCount, setQueueCount] = useState<number>(0);
  const [isReaderBusy, setIsReaderBusy] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const isReaderDisabledRef = useRef<boolean>(false);
  const isProcessingRef = useRef<boolean>(false);
  const queueRef = useRef<{ id: string; code: string; timestamp: number }[]>([]);
  const lastProcessedCodeRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });
  const selectedEventIdRef = useRef(selectedEventId);
  selectedEventIdRef.current = selectedEventId;
  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;

  const currentEvent = allEvents.find(e => e.id === selectedEventId);

  // Helper date and time formatters for validation
  const formatUtilizedDate = (isoString?: string) => {
    if (!isoString) return '--/--/----';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      const day = d.getDate().toString().padStart(2, '0');
      const month = (d.getMonth() + 1).toString().padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return isoString;
    }
  };

  const formatUtilizedTime = (isoString?: string) => {
    if (!isoString) return '--:--:--';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      const hours = d.getHours().toString().padStart(2, '0');
      const minutes = d.getMinutes().toString().padStart(2, '0');
      const seconds = d.getSeconds().toString().padStart(2, '0');
      return `${hours}:${minutes}:${seconds}`;
    } catch {
      return isoString;
    }
  };

  // Audio effects using Web Audio API
  const playFeedbackSound = (type: 'success' | 'error' | 'warning') => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === 'success') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
        osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.1); // A5
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
      } else if (type === 'warning') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, audioCtx.currentTime);
        osc.frequency.setValueAtTime(330, audioCtx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.4);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, audioCtx.currentTime);
        osc.frequency.setValueAtTime(160, audioCtx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.4);
      }
    } catch {
      // AudioContext unavailable or suppressed
    }
  };

  // Start Camera - keep continuous stream alive
  const startCamera = async () => {
    setCameraError('');
    setIsScanning(true);
    isReaderDisabledRef.current = false;
    setIsReaderBusy(false);
    setValidationResult(null);
    setConfirmedSuccess(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.play();
        requestAnimationFrame(tickScanner);
      }
    } catch (err: unknown) {
      console.error('Camera access error', err);
      setCameraError('Permissão para câmera negada ou câmera não suportada no momento.');
      setIsScanning(false);
    }
  };

  // Stop Camera
  const stopCamera = () => {
    isReaderDisabledRef.current = false;
    setIsReaderBusy(false);
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
  };

  // Leitura contínua em alto desempenho via canvas
  const tickScanner = () => {
    if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      // O leitor só processa quando NÃO estiver desabilitado durante a transação atômica
      if (canvas && !isReaderDisabledRef.current) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert'
          });

          if (code && code.data && code.data.trim()) {
            enqueueCode(code.data.trim(), 'CAMERA');
          }
        }
      }
    }
    animFrameRef.current = requestAnimationFrame(tickScanner);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Fila de processamento assíncrona: enfileiramento
  const enqueueCode = (codeStr: string, source: 'CAMERA' | 'MANUAL' = 'CAMERA') => {
    const clean = codeStr.trim();
    if (!clean) return;

    const now = Date.now();
    // Proteção contra leitura repetida do mesmo QR code na câmera enquanto permanecer no enquadramento
    if (source === 'CAMERA') {
      if (clean === lastProcessedCodeRef.current.code && now - lastProcessedCodeRef.current.time < 1500) {
        return;
      }
    }

    // Evita duplicatas pendentes na fila
    if (queueRef.current.some(item => item.code === clean)) {
      return;
    }

    lastProcessedCodeRef.current = { code: clean, time: now };
    queueRef.current.push({
      id: `queue-${now}-${Math.random().toString(36).substring(2, 6)}`,
      code: clean,
      timestamp: now
    });
    setQueueCount(queueRef.current.length);

    // Aciona a fila assíncrona
    processQueue();
  };

  // Trabalhador assíncrono da fila: executa a transação atômica no Firestore
  const processQueue = async () => {
    if (isProcessingRef.current) return;
    if (queueRef.current.length === 0) return;

    const nextItem = queueRef.current.shift();
    setQueueCount(queueRef.current.length);
    if (!nextItem) return;

    isProcessingRef.current = true;
    // 1. DESABILITA O LEITOR APENAS DURANTE A TRANSAÇÃO ATÔMICA NO FIRESTORE
    isReaderDisabledRef.current = true;
    setIsReaderBusy(true);
    setIsValidating(true);

    try {
      const res = await StorageService.validateTicketAsync(
        nextItem.code,
        selectedEventIdRef.current === 'all' ? undefined : selectedEventIdRef.current,
        currentUserRef.current
      );
      setValidationResult(res);

      // Feedback sonoro & estado
      if (res.status === 'VALID') {
        setConfirmedSuccess(true);
        playFeedbackSound('success');
      } else if (res.status === 'ALREADY_USED') {
        playFeedbackSound('warning');
      } else {
        playFeedbackSound('error');
      }

      // Adiciona ao histórico de leituras recentes
      setRecentScans(prev => [
        {
          id: `scan-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          code: nextItem.code,
          customer: res.ticket?.customerName || 'Não identificado',
          ticketType: res.ticket?.ticketTypeName || '-',
          time: new Date().toLocaleTimeString('pt-BR'),
          status: res.status === 'VALID' ? 'VALID' : res.status === 'ALREADY_USED' ? 'ALREADY_USED' : res.status === 'CANCELLED' ? 'CANCELLED' : 'INVALID'
        },
        ...prev.slice(0, 9)
      ]);
    } catch (err) {
      console.error('Erro na transação de validação atômica:', err);
    } finally {
      setIsValidating(false);
      isProcessingRef.current = false;

      // 2. REATIVAÇÃO IMEDIATA DO LEITOR após o retorno da validação para permitir leituras sequenciais rápidas!
      isReaderDisabledRef.current = false;
      setIsReaderBusy(false);

      // Se houver mais códigos aguardando na fila, processa o próximo sem atraso
      if (queueRef.current.length > 0) {
        processQueue();
      }
    }
  };

  const handleManualSubmit = () => {
    if (!manualCode.trim() || isValidating) return;
    const clean = manualCode.trim();
    setManualCode('');
    enqueueCode(clean, 'MANUAL');
  };

  const handleConfirmEntry = () => {
    if (!validationResult?.ticket) return;

    const res = StorageService.confirmCheckIn(validationResult.ticket.id, currentUser);
    if (res.success) {
      setConfirmedSuccess(true);
      playFeedbackSound('success');
    }
  };

  const handleNextScan = () => {
    setValidationResult(null);
    setConfirmedSuccess(false);
    setManualCode('');
    isReaderDisabledRef.current = false;
    setIsReaderBusy(false);

    // If camera stream is not running, start it
    if (!streamRef.current || !isScanning) {
      startCamera();
    }
  };

  // Stats for the active event or all events
  const eventStats = StorageService.getDashboardStats(
    currentUser.role === 'MASTER' ? undefined : companyId,
    selectedEventId === 'all' ? undefined : selectedEventId
  );

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Top Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <QrCode className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-slate-900">Check-in na Portaria</h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-semibold text-emerald-700">
                  <Cloud className="w-3 h-3 text-emerald-600" />
                  Banco em Nuvem Conectado
                </span>
              </div>
              <p className="text-xs text-slate-500">Validação instantânea e segura de ingressos com controle antifraude em tempo real</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setContinuousMode(!continuousMode)}
            className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
              continuousMode
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                : 'bg-slate-100 border-slate-300 text-slate-600'
            }`}
            title="Leitura Contínua: lê QR codes sucessivos automaticamente com o menor intervalo possível"
          >
            <Zap className={`w-3.5 h-3.5 ${continuousMode ? 'text-emerald-600 fill-emerald-500' : 'text-slate-400'}`} />
            <span>{continuousMode ? 'Modo Contínuo: LIGADO' : 'Modo Contínuo: DESLIGADO'}</span>
          </button>

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              soundEnabled ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-slate-100 border-slate-300 text-slate-500'
            }`}
            title="Ativar/Desativar som do leitor"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span className="hidden sm:inline">Som</span>
          </button>

          {/* Event Selector */}
          <select
            value={selectedEventId}
            onChange={e => {
              setSelectedEventId(e.target.value);
              setValidationResult(null);
              setConfirmedSuccess(false);
            }}
            className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 bg-white text-slate-800 focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">Todos os Eventos (Geral)</option>
            {allEvents.map(evt => (
              <option key={evt.id} value={evt.id}>
                {evt.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Live Entrance Indicator Counters */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-slate-500 font-medium uppercase">Entradas Liberadas</span>
            <p className="text-lg font-black text-slate-900">{eventStats.checkInsCompleted}</p>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-indigo-50 text-indigo-600">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-slate-500 font-medium uppercase">Aguardando Entrada</span>
            <p className="text-lg font-black text-slate-900">{eventStats.peopleWaiting}</p>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-amber-50 text-amber-600">
            <TicketIcon className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-slate-500 font-medium uppercase">Total Vendidos</span>
            <p className="text-lg font-black text-slate-900">{eventStats.totalTicketsSold}</p>
          </div>
        </div>
      </div>

      {/* Main Validation Stage */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-6">
        {/* State 1: Active Camera Scanning */}
        {isScanning && (
          <div className="space-y-4">
            <div className="relative mx-auto max-w-sm aspect-square bg-black rounded-2xl overflow-hidden shadow-inner flex items-center justify-center border-4 border-indigo-500">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
              />
              <canvas ref={canvasRef} className="hidden" />

              {/* Scanning visual crosshair overlay */}
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-between p-4 sm:p-6">
                {/* Live reader & queue status indicator */}
                <div className="w-full flex justify-between items-center z-10">
                  {isReaderBusy ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/95 text-white text-[11px] font-bold shadow-md backdrop-blur-xs animate-pulse">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Validando transação...</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-600/95 text-white text-[11px] font-bold shadow-md backdrop-blur-xs">
                      <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
                      <span>Leitor Ativo (Sequencial)</span>
                    </span>
                  )}

                  {queueCount > 0 && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-600 text-white text-[11px] font-bold shadow-md">
                      <span>Fila: {queueCount}</span>
                    </span>
                  )}
                </div>

                <div className="w-48 h-48 border-2 border-emerald-400 rounded-xl relative animate-pulse my-auto">
                  <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-emerald-400"></div>
                  <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-emerald-400"></div>
                  <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-emerald-400"></div>
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-emerald-400"></div>
                </div>

                <p className="text-xs text-white/95 font-semibold bg-black/70 px-3 py-1 rounded-full text-center">
                  {isReaderBusy ? 'Aguardando confirmação atômica...' : 'Aponte a câmera para o QR Code do ingresso'}
                </p>
              </div>
            </div>

            <div className="text-center">
              <button
                type="button"
                onClick={stopCamera}
                className="px-5 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-sm font-semibold transition-colors"
              >
                Cancelar Câmera
              </button>
            </div>
          </div>
        )}

        {/* State 2: Camera Trigger & Manual Input */}
        {!isScanning && !validationResult && (
          <div className="space-y-6">
            <div className="text-center py-6 border-2 border-dashed border-slate-300 rounded-2xl bg-slate-50/70 p-6">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-3">
                <Camera className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-1">Leitor de QR Code</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mb-5">
                Utilize a câmera do celular para escanear e validar o ingresso com um clique
              </p>

              <button
                type="button"
                onClick={startCamera}
                className="py-3.5 px-8 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md transition-all inline-flex items-center gap-2 cursor-pointer"
              >
                <Camera className="w-5 h-5" />
                <span>ESCANEAR QR CODE</span>
              </button>
            </div>

            {cameraError && (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{cameraError} Você pode digitar o código ou token manualmente abaixo.</span>
              </div>
            )}

            {/* Manual fallback input */}
            <div className="pt-2 border-t border-slate-200">
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase">
                Ou digite o Código / Token do Ingresso:
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder="Ex: EVT-2026-000101 ou TKT-8F72A9C4-..."
                    value={manualCode}
                    onChange={e => setManualCode(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleManualSubmit()}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 text-sm font-mono focus:ring-2 focus:ring-indigo-500 uppercase"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleManualSubmit}
                  disabled={!manualCode.trim() || isValidating}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-sm font-bold transition-colors cursor-pointer inline-flex items-center gap-2"
                >
                  {isValidating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Validando...</span>
                    </>
                  ) : (
                    'Consultar'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Validation in progress */}
        {isValidating && !validationResult && (
          <div className="p-8 rounded-2xl bg-indigo-50/70 border border-indigo-200 text-center space-y-2">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
            <p className="text-sm font-bold text-slate-800">Consultando banco de dados em nuvem...</p>
            <p className="text-xs text-slate-500">Verificando autenticidade e status antifraude do ingresso</p>
          </div>
        )}

        {/* State 3: Validation Outcome Display matching requirements #12, #13, #14 */}
        {validationResult && (
          <div className="space-y-5">
            {/* SUCCESS / VALID MATCH */}
            {validationResult.status === 'VALID' && (
              <div className={`p-6 rounded-2xl border-2 transition-all ${
                confirmedSuccess ? 'bg-emerald-50 border-emerald-500' : 'bg-emerald-50/60 border-emerald-400'
              }`}>
                <div className="flex items-center gap-3 pb-4 border-b border-emerald-200">
                  <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <div>
                    <span className="text-xs uppercase font-extrabold tracking-wider text-emerald-800">
                      {confirmedSuccess ? 'Status: Check-in Concluído' : 'Status: Ingresso Autenticado'}
                    </span>
                    <h3 className="text-xl font-black text-emerald-950">
                      {confirmedSuccess ? 'ENTRADA LIBERADA ✓' : '✓ INGRESSO VÁLIDO'}
                    </h3>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-4 text-sm">
                  <div>
                    <span className="text-xs text-slate-500 font-medium">Cliente / Portador:</span>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-slate-900 text-base">
                        {validationResult.ticket?.customerName || 'Portador (Ingresso Físico)'}
                      </p>
                      {validationResult.ticket?.isBatchGenerated && (
                        <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-[10px] font-black uppercase tracking-wider">
                          Físico (9x5 cm)
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">
                      {validationResult.ticket?.customerPhone || 'Emissão Física em Lote'}
                    </p>
                  </div>

                  <div>
                    <span className="text-xs text-slate-500 font-medium">Tipo de Ingresso:</span>
                    <p className="font-bold text-indigo-700 text-base">{validationResult.ticket?.ticketTypeName}</p>
                    <p className="text-xs text-slate-500">{validationResult.ticket?.batchName}</p>
                  </div>

                  <div>
                    <span className="text-xs text-slate-500 font-medium">Número do Ingresso:</span>
                    <p className="font-mono font-bold text-slate-900 text-sm">{validationResult.ticket?.ticketNumber}</p>
                  </div>

                  <div>
                    <span className="text-xs text-slate-500 font-medium">Evento:</span>
                    <p className="font-semibold text-slate-800">{validationResult.event?.name || currentEvent?.name}</p>
                  </div>
                </div>

                {/* Confirm Button matching requirement #12 */}
                {!confirmedSuccess ? (
                  <div className="pt-3 border-t border-emerald-200 flex flex-col sm:flex-row gap-3">
                    <button
                      type="button"
                      onClick={handleConfirmEntry}
                      className="flex-1 py-3.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-base shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <ShieldCheck className="w-5 h-5" />
                      <span>CONFIRMAR ENTRADA</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleNextScan}
                      className="py-3 px-5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-sm transition-colors cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <div className="pt-3 border-t border-emerald-200 text-center">
                    <div className="bg-emerald-600 text-white py-2.5 px-4 rounded-xl font-bold text-sm mb-3">
                      ENTRADA REGISTRADA COM SUCESSO!
                    </div>
                    <button
                      type="button"
                      onClick={handleNextScan}
                      className="py-3 px-8 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm transition-all cursor-pointer"
                    >
                      Próximo Ingresso (Escanear)
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ALREADY USED ALERT matching requirement */}
            {validationResult.status === 'ALREADY_USED' && (
              <div className="p-6 rounded-2xl bg-amber-50 border-2 border-amber-500 space-y-4">
                <div className="flex items-center gap-3 pb-4 border-b border-amber-200">
                  <div className="w-12 h-12 rounded-full bg-amber-600 text-white flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-7 h-7" />
                  </div>
                  <div>
                    <span className="text-xs uppercase font-extrabold tracking-wider text-amber-800">
                      Alerta de Fraude / Duplicidade
                    </span>
                    <h3 className="text-xl sm:text-2xl font-black text-amber-950">
                      ⚠️ VOUCHER JÁ UTILIZADO
                    </h3>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-xs text-slate-500 font-medium">Cliente:</span>
                    <p className="font-bold text-slate-900">{validationResult.ticket?.customerName}</p>
                  </div>

                  <div>
                    <span className="text-xs text-slate-500 font-medium">Tipo:</span>
                    <p className="font-bold text-slate-900">{validationResult.ticket?.ticketTypeName}</p>
                  </div>

                  <div>
                    <span className="text-xs text-slate-500 font-medium">Evento:</span>
                    <p className="font-semibold text-slate-800">{validationResult.event?.name || currentEvent?.name}</p>
                  </div>

                  <div className="p-4 bg-amber-100/90 rounded-xl border-2 border-amber-400 space-y-1.5">
                    <span className="text-xs uppercase font-extrabold tracking-wider text-amber-900 block">
                      Utilizado em:
                    </span>
                    <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4 font-mono font-black text-amber-950">
                      <span className="text-xl">
                        {formatUtilizedDate(validationResult.firstUsedAt)}
                      </span>
                      <span className="text-xl text-amber-900">
                        {formatUtilizedTime(validationResult.firstUsedAt)}
                      </span>
                    </div>
                    {validationResult.firstUsedByName && (
                      <p className="text-xs text-amber-800 font-semibold pt-1 border-t border-amber-300">
                        Operador: {validationResult.firstUsedByName}
                      </p>
                    )}
                  </div>
                </div>

                <div className="p-3 bg-rose-100 border border-rose-300 rounded-xl text-xs text-rose-900 font-bold text-center">
                  ENTRADA NÃO PERMITIDA — Este voucher já teve entrada liberada e não pode ser reutilizado.
                </div>

                <div className="pt-2 text-center flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={handleNextScan}
                    className="py-3 px-8 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm transition-all cursor-pointer flex items-center gap-2"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Escanear Próximo</span>
                  </button>
                </div>
              </div>
            )}

            {/* INVALID OR CANCELLED matching requirement #14 */}
            {(validationResult.status === 'INVALID' || validationResult.status === 'CANCELLED' || validationResult.status === 'EVENT_MISMATCH') && (
              <div className="p-6 rounded-2xl bg-rose-50 border-2 border-rose-500 space-y-4">
                <div className="flex items-center gap-3 pb-4 border-b border-rose-200">
                  <div className="w-12 h-12 rounded-full bg-rose-600 text-white flex items-center justify-center">
                    <XCircle className="w-7 h-7" />
                  </div>
                  <div>
                    <span className="text-xs uppercase font-extrabold tracking-wider text-rose-800">
                      Acesso Negado
                    </span>
                    <h3 className="text-xl font-black text-rose-950">
                      {validationResult.status === 'CANCELLED' ? 'INGRESSO CANCELADO' : 'INGRESSO INVÁLIDO'}
                    </h3>
                  </div>
                </div>

                <p className="text-sm font-semibold text-rose-900">
                  {validationResult.message}
                </p>

                {validationResult.ticket && (
                  <div className="bg-white p-3.5 rounded-xl border border-rose-200 text-xs text-slate-700 space-y-1">
                    <p><strong>Nº:</strong> {validationResult.ticket.ticketNumber}</p>
                    <p><strong>Cliente:</strong> {validationResult.ticket.customerName}</p>
                    {validationResult.ticket.notes && <p><strong>Motivo:</strong> {validationResult.ticket.notes}</p>}
                  </div>
                )}

                <div className="p-3 bg-rose-200/60 rounded-xl text-xs text-rose-950 font-bold text-center">
                  NÃO PERMITIR ENTRADA NO EVENTO
                </div>

                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={handleNextScan}
                    className="py-3 px-8 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm transition-all cursor-pointer"
                  >
                    Escanear Próximo
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Recent Scans History on this device */}
      {recentScans.length > 0 && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              Últimas Leituras Realizadas
            </h4>
            <span className="text-xs text-slate-400">{recentScans.length} registros</span>
          </div>

          <div className="divide-y divide-slate-100">
            {recentScans.map(scan => (
              <div key={scan.id} className="py-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  {scan.status === 'VALID' ? (
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"></span>
                  ) : scan.status === 'ALREADY_USED' ? (
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0"></span>
                  ) : (
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0"></span>
                  )}
                  <div>
                    <p className="font-semibold text-slate-900">{scan.customer}</p>
                    <p className="text-[11px] text-slate-500 font-mono">{scan.code}</p>
                  </div>
                </div>

                <div className="text-right">
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                    scan.status === 'VALID'
                      ? 'bg-emerald-100 text-emerald-800'
                      : scan.status === 'ALREADY_USED'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}>
                    {scan.status === 'VALID' ? 'Liberado' : scan.status === 'ALREADY_USED' ? 'Duplicado' : 'Inválido'}
                  </span>
                  <p className="text-[11px] text-slate-400 mt-0.5">{scan.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
