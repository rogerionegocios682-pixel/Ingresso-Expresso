import React, { useState } from 'react';
import {
  Plus,
  Ticket as TicketIcon,
  Layers,
  Calendar,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  X,
  Edit2,
  Filter,
  FileDown,
  Printer,
  QrCode,
  Sparkles,
  Loader2,
  ShieldCheck,
  Hash
} from 'lucide-react';
import { Event, TicketBatch, BatchStatus, User, Ticket } from '../types';
import { StorageService } from '../services/storage';
import { formatCurrency, formatDate } from '../services/whatsapp';
import { exportTicketsBatchToPDF, exportTicketsBatchToA4PDF } from '../services/ticketPdf';

interface LotsAndTicketsViewProps {
  currentUser: User;
  initialEventId?: string;
  onOpenPOS: (eventId: string) => void;
}

export const LotsAndTicketsView: React.FC<LotsAndTicketsViewProps> = ({
  currentUser,
  initialEventId,
  onOpenPOS
}) => {
  if (currentUser.role !== 'MASTER' && currentUser.role !== 'ADMIN') {
    return (
      <div className="bg-white p-8 rounded-2xl border border-rose-200 text-center space-y-3">
        <p className="text-rose-600 font-bold">Acesso restrito à administração da plataforma.</p>
      </div>
    );
  }

  const companyId = StorageService.getCurrentCompanyId();
  const events = StorageService.getEvents(currentUser.role === 'MASTER' ? undefined : companyId);

  const [selectedEventId, setSelectedEventId] = useState<string>(
    initialEventId || events[0]?.id || ''
  );
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingBatch, setEditingBatch] = useState<TicketBatch | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    batchCode: 'L01',
    name: '1º Lote',
    ticketTypeName: 'Pista',
    price: 100.0,
    totalQuantity: 100,
    startDate: new Date().toISOString().split('T')[0],
    endDate: '2026-12-31',
    status: 'active' as BatchStatus,
    notes: ''
  });

  // Batch Generation State
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState<boolean>(false);
  const [batchForGeneration, setBatchForGeneration] = useState<TicketBatch | null>(null);
  const [generateQuantity, setGenerateQuantity] = useState<number>(50);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationProgress, setGenerationProgress] = useState<string>('');
  const [generationSuccessInfo, setGenerationSuccessInfo] = useState<{
    count: number;
    tickets: Ticket[];
  } | null>(null);

  // PDF Export Progress State
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [pdfProgressText, setPdfProgressText] = useState<string>('');
  const [activePdfBatchId, setActivePdfBatchId] = useState<string | null>(null);

  const batches = StorageService.getBatches(
    currentUser.role === 'MASTER' ? undefined : companyId,
    selectedEventId || undefined
  );

  const selectedEvent = events.find(e => e.id === selectedEventId);

  const handleOpenCreate = () => {
    setEditingBatch(null);
    const existingCount = batches.length;
    const nextSeq = (existingCount + 1).toString().padStart(2, '0');
    setFormData({
      batchCode: `L${nextSeq}`,
      name: `${existingCount + 1}º Lote`,
      ticketTypeName: 'Pista',
      price: 100.0,
      totalQuantity: 100,
      startDate: selectedEvent?.date || new Date().toISOString().split('T')[0],
      endDate: selectedEvent?.date || '2026-12-31',
      status: 'active',
      notes: ''
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (batch: TicketBatch) => {
    setEditingBatch(batch);
    setFormData({
      batchCode: batch.batchCode || 'L01',
      name: batch.name,
      ticketTypeName: batch.ticketTypeName,
      price: batch.price,
      totalQuantity: batch.totalQuantity,
      startDate: batch.startDate,
      endDate: batch.endDate,
      status: batch.status,
      notes: batch.notes || ''
    });
    setIsModalOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventId) return;

    if (editingBatch) {
      StorageService.updateBatch(editingBatch.id, {
        batchCode: formData.batchCode,
        name: formData.name,
        ticketTypeName: formData.ticketTypeName,
        price: Number(formData.price),
        totalQuantity: Number(formData.totalQuantity),
        startDate: formData.startDate,
        endDate: formData.endDate,
        status: formData.status,
        notes: formData.notes
      });
    } else {
      StorageService.saveBatch(
        {
          companyId: selectedEvent?.companyId || companyId,
          eventId: selectedEventId,
          batchCode: formData.batchCode,
          name: formData.name,
          ticketTypeName: formData.ticketTypeName,
          price: Number(formData.price),
          totalQuantity: Number(formData.totalQuantity),
          startDate: formData.startDate,
          endDate: formData.endDate,
          status: formData.status,
          notes: formData.notes,
          artworkUrl: selectedEvent?.coverImage
        },
        currentUser
      );
    }

    setIsModalOpen(false);
  };

  // Open the Bulk Ticket Generation Modal
  const handleOpenGenerateModal = (batch: TicketBatch) => {
    setBatchForGeneration(batch);
    setGenerateQuantity(Math.min(100, Math.max(10, batch.totalQuantity - (batch.generatedQuantity || 0))));
    setGenerationSuccessInfo(null);
    setGenerationProgress('');
    setIsGenerateModalOpen(true);
  };

  // Execute Bulk Ticket Generation
  const handleConfirmGenerateTickets = async () => {
    if (!batchForGeneration) return;
    setIsGenerating(true);
    setGenerationProgress(`Gerando ${generateQuantity} ingressos individuais e calculando QR Codes...`);

    try {
      const result = await StorageService.generateBatchTickets({
        batchId: batchForGeneration.id,
        quantity: Number(generateQuantity),
        operator: currentUser
      });

      if (result.success && result.tickets.length > 0) {
        setGenerationSuccessInfo({
          count: result.count,
          tickets: result.tickets
        });
      } else {
        alert(result.error || 'Não foi possível gerar os ingressos.');
      }
    } catch (err) {
      console.error('Erro na geração em lote:', err);
      alert('Falha ao processar a geração em lote.');
    } finally {
      setIsGenerating(false);
      setGenerationProgress('');
    }
  };

  // Export Batch Tickets as 9x5 cm PDF
  const handleExportBatchPdf = async (batch: TicketBatch, ticketsToExport?: Ticket[]) => {
    if (!selectedEvent) {
      alert('Selecione um evento válido.');
      return;
    }

    setIsExportingPdf(true);
    setActivePdfBatchId(batch.id);

    try {
      // Get all tickets of this batch (both generated or sold)
      let list = ticketsToExport;
      if (!list || list.length === 0) {
        const allEventTickets = StorageService.getTickets(
          currentUser.role === 'MASTER' ? undefined : companyId,
          batch.eventId
        );
        list = allEventTickets.filter(t => t.batchId === batch.id);
      }

      if (list.length === 0) {
        alert('Este lote ainda não possui ingressos gerados. Clique em "Gerar Ingressos Físicos" primeiro.');
        return;
      }

      setPdfProgressText(`Processando ${list.length} ingressos (Formato 9x5 cm)...`);

      await exportTicketsBatchToPDF(
        list,
        selectedEvent,
        batch,
        (current, total) => {
          setPdfProgressText(`Diagramando página ${current} de ${total}...`);
        }
      );
    } catch (err) {
      console.error('Erro ao exportar PDF:', err);
      alert('Ocorreu um erro ao gerar o arquivo PDF para impressão.');
    } finally {
      setIsExportingPdf(false);
      setActivePdfBatchId(null);
      setPdfProgressText('');
    }
  };

  // Export Batch Tickets as Optimized A4 PDF (12 tickets per A4 sheet, 90x50 mm)
  const handleExportBatchA4Pdf = async (batch: TicketBatch, ticketsToExport?: Ticket[]) => {
    if (!selectedEvent) {
      alert('Selecione um evento válido.');
      return;
    }

    setIsExportingPdf(true);
    setActivePdfBatchId(batch.id);

    try {
      let list = ticketsToExport;
      if (!list || list.length === 0) {
        const allEventTickets = StorageService.getTickets(
          currentUser.role === 'MASTER' ? undefined : companyId,
          batch.eventId
        );
        list = allEventTickets.filter(t => t.batchId === batch.id);
      }

      if (list.length === 0) {
        alert('Este lote ainda não possui ingressos gerados. Clique em "Gerar Ingressos Físicos" primeiro.');
        return;
      }

      const totalSheets = Math.ceil(list.length / 12);
      setPdfProgressText(`Diagramando ${list.length} ingressos em ${totalSheets} folha(s) A4...`);

      await exportTicketsBatchToA4PDF(
        list,
        selectedEvent,
        batch,
        (current, total) => {
          setPdfProgressText(`Montando folha A4 ${current} de ${total}...`);
        }
      );
    } catch (err) {
      console.error('Erro ao exportar A4 PDF:', err);
      alert('Ocorreu um erro ao gerar o PDF em folha A4.');
    } finally {
      setIsExportingPdf(false);
      setActivePdfBatchId(null);
      setPdfProgressText('');
    }
  };

  const presetTicketTypes = [
    'Pista',
    'VIP',
    'Área Premium',
    'Camarote Open Bar',
    'Lounge Exclusivo',
    'Cortesia',
    'Meia-Entrada Estudante'
  ];

  const presetBatches = [
    'Lote Promocional',
    '1º Lote',
    '2º Lote',
    '3º Lote',
    'Lote Extra',
    'Portaria / Na Hora'
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Lotes & Ingressos Físicos</h1>
            <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-[11px] font-black uppercase">
              Padrão 9x5 cm
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500">
            Criação de lotes, geração de ingressos individuais com QR Code único e exportação em PDF para gráfica
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedEventId}
            onChange={e => setSelectedEventId(e.target.value)}
            className="px-3 py-2 text-xs sm:text-sm font-semibold rounded-xl border border-slate-300 bg-white text-slate-800 focus:ring-2 focus:ring-indigo-500"
          >
            {events.map(evt => (
              <option key={evt.id} value={evt.id}>
                {evt.name}
              </option>
            ))}
          </select>

          {(currentUser.role === 'MASTER' || currentUser.role === 'ADMIN') && (
            <button
              onClick={handleOpenCreate}
              className="flex items-center gap-2 py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>CRIAR LOTE</span>
            </button>
          )}
        </div>
      </div>

      {/* Batches Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {batches.map(batch => {
          const available = batch.totalQuantity - batch.soldQuantity;
          const isSoldOut = available <= 0 || batch.status === 'exhausted';
          const percentSold = batch.totalQuantity > 0 ? (batch.soldQuantity / batch.totalQuantity) * 100 : 0;
          const generatedCount = batch.generatedQuantity || 0;

          const isThisBatchExporting = isExportingPdf && activePdfBatchId === batch.id;

          return (
            <div
              key={batch.id}
              className={`bg-white rounded-2xl border-2 transition-all p-5 shadow-xs flex flex-col justify-between ${
                isSoldOut ? 'border-slate-200 bg-slate-50/70' : 'border-slate-200 hover:border-indigo-300'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs uppercase font-extrabold tracking-wider text-indigo-600">
                        {batch.name}
                      </span>
                      {batch.batchCode && (
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[10px] font-bold">
                          {batch.batchCode}
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-black text-slate-900">{batch.ticketTypeName}</h3>
                  </div>

                  {isSoldOut ? (
                    <span className="px-2.5 py-1 rounded-md bg-rose-600 text-white text-[10px] font-black uppercase tracking-wider">
                      ESGOTADO
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase">
                      Ativo
                    </span>
                  )}
                </div>

                <div className="py-2 border-y border-slate-100 flex items-baseline justify-between">
                  <span className="text-xs text-slate-500 font-medium">Valor Unitário:</span>
                  <span className="text-2xl font-black text-slate-900">
                    {batch.price === 0 ? 'Cortesia (R$ 0)' : formatCurrency(batch.price)}
                  </span>
                </div>

                {/* Stock progress bar */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Vendas PDV:</span>
                    <span className="font-bold text-slate-800">
                      {batch.soldQuantity} vendidos / {batch.totalQuantity} total
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${
                        isSoldOut ? 'bg-rose-500' : percentSold > 75 ? 'bg-amber-500' : 'bg-indigo-600'
                      }`}
                      style={{ width: `${Math.min(100, percentSold)}%` }}
                    ></div>
                  </div>
                </div>

                {/* Physical Ticket Generation Badge */}
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-slate-700">
                    <Printer className="w-3.5 h-3.5 text-indigo-600" />
                    <span className="font-semibold">Ingressos Físicos Gerados:</span>
                  </div>
                  <span className="font-mono font-black text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                    {generatedCount} un.
                  </span>
                </div>

                <div className="text-[11px] text-slate-400 flex items-center gap-1 pt-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-300" />
                  <span>Vendas até: {formatDate(batch.endDate)}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 mt-4 border-t border-slate-100 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleOpenGenerateModal(batch)}
                    className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Layers className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Gerar Ingressos</span>
                  </button>

                  <button
                    type="button"
                    title="Imprimir ingressos agrupados em folha A4 (12 por folha, 9x5 cm)"
                    disabled={isThisBatchExporting || (generatedCount === 0 && batch.soldQuantity === 0)}
                    onClick={() => handleExportBatchA4Pdf(batch)}
                    className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                  >
                    {isThisBatchExporting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                    ) : (
                      <Printer className="w-3.5 h-3.5 text-white" />
                    )}
                    <span>Folha A4 (12 un)</span>
                  </button>

                  <button
                    type="button"
                    title="Baixar ingressos em páginas individuais de 9x5 cm"
                    disabled={isThisBatchExporting || (generatedCount === 0 && batch.soldQuantity === 0)}
                    onClick={() => handleExportBatchPdf(batch)}
                    className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <FileDown className="w-3.5 h-3.5 text-slate-500" />
                    <span>PDF 9x5</span>
                  </button>
                </div>

                <div className="flex items-center justify-between pt-1">
                  {(currentUser.role === 'MASTER' || currentUser.role === 'ADMIN') && (
                    <button
                      onClick={() => handleOpenEdit(batch)}
                      className="text-xs font-semibold text-slate-500 hover:text-slate-900 flex items-center gap-1"
                    >
                      <Edit2 className="w-3 h-3" /> Editar Lote
                    </button>
                  )}

                  <button
                    disabled={isSoldOut}
                    onClick={() => onOpenPOS(batch.eventId)}
                    className="ml-auto py-1 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    Vender PDV
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Bulk Ticket Generation (Geração em Massa) */}
      {isGenerateModalOpen && batchForGeneration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto space-y-0">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                  <Printer className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2 className="text-base font-bold">Geração de Ingressos para Impressão</h2>
                  <p className="text-xs text-slate-400">Padrão Gráfico Obrigatório: 9 cm x 5 cm</p>
                </div>
              </div>
              <button
                onClick={() => setIsGenerateModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Event & Artwork Header Preview */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-3.5">
                {selectedEvent?.coverImage ? (
                  <img
                    src={selectedEvent.coverImage}
                    alt={selectedEvent.name}
                    className="w-16 h-12 rounded-lg object-cover border border-slate-300 shadow-2xs shrink-0"
                  />
                ) : (
                  <div className="w-16 h-12 rounded-lg bg-indigo-900 text-white flex items-center justify-center text-[10px] font-bold text-center p-1 shrink-0">
                    ARTE EVENTO
                  </div>
                )}
                <div className="min-w-0">
                  <span className="text-[10px] font-black uppercase text-indigo-600 tracking-wider">
                    {batchForGeneration.name} • {batchForGeneration.ticketTypeName}
                  </span>
                  <h4 className="font-bold text-slate-900 text-sm truncate">{selectedEvent?.name}</h4>
                  <p className="text-xs text-slate-500">{selectedEvent?.venue || selectedEvent?.city}</p>
                </div>
              </div>

              {!generationSuccessInfo ? (
                <>
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-700">
                      Quantidade de Ingressos Individuais a Gerar:
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        max="2000"
                        value={generateQuantity}
                        onChange={e => setGenerateQuantity(Math.max(1, Number(e.target.value)))}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-base font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    {/* Quick selection chips */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {[25, 50, 100, 200, 500].map(qty => (
                        <button
                          key={qty}
                          type="button"
                          onClick={() => setGenerateQuantity(qty)}
                          className={`text-xs px-2.5 py-1 rounded-lg font-bold transition-colors ${
                            generateQuantity === qty
                              ? 'bg-indigo-600 text-white'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          }`}
                        >
                          {qty} un.
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Specification Box */}
                  <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-100 text-xs space-y-1.5 text-indigo-950">
                    <div className="flex items-center gap-1.5 font-bold">
                      <ShieldCheck className="w-4 h-4 text-indigo-600" />
                      <span>Controle Antifraude e Autenticidade:</span>
                    </div>
                    <ul className="list-disc list-inside space-y-0.5 text-indigo-800 text-[11px] pl-1">
                      <li>Cada ingresso terá um <strong>QR Code exclusivo</strong> (token de 128 bits);</li>
                      <li>Código sequencial estruturado: <code className="bg-white px-1 py-0.5 rounded text-indigo-900">EVT26-{(batchForGeneration.batchCode || 'L01')}-000001</code>;</li>
                      <li>Dimensões exatas de impressão: <strong>9 cm de largura × 5 cm de altura</strong>;</li>
                      <li>Gravação no banco de dados isolado para a empresa/evento.</li>
                    </ul>
                  </div>

                  {isGenerating && (
                    <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200 text-center space-y-2">
                      <Loader2 className="w-6 h-6 text-indigo-600 animate-spin mx-auto" />
                      <p className="text-xs font-bold text-slate-800">{generationProgress}</p>
                    </div>
                  )}

                  <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                    <button
                      type="button"
                      disabled={isGenerating}
                      onClick={() => setIsGenerateModalOpen(false)}
                      className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={isGenerating || generateQuantity <= 0}
                      onClick={handleConfirmGenerateTickets}
                      className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>CONFIRMAR E GERAR {generateQuantity} INGRESSOS</span>
                    </button>
                  </div>
                </>
              ) : (
                /* Success State with immediate PDF download */
                <div className="space-y-4 text-center py-2">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900">
                      {generationSuccessInfo.count} Ingressos Gerados com Sucesso!
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Todos os registros já estão sincronizados no banco de dados e prontos para impressão física.
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 text-left space-y-1 font-mono">
                    <p><strong>Primeiro ingresso:</strong> {generationSuccessInfo.tickets[0]?.ticketNumber}</p>
                    <p><strong>Último ingresso:</strong> {generationSuccessInfo.tickets[generationSuccessInfo.tickets.length - 1]?.ticketNumber}</p>
                  </div>

                  <div className="pt-2 flex flex-col gap-2">
                    <button
                      type="button"
                      disabled={isExportingPdf}
                      onClick={() => handleExportBatchA4Pdf(batchForGeneration, generationSuccessInfo.tickets)}
                      className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm shadow-md cursor-pointer"
                    >
                      {isExportingPdf && activePdfBatchId === batchForGeneration.id ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-white" />
                          <span>{pdfProgressText || 'DIAGRAMANDO FOLHA A4...'}</span>
                        </>
                      ) : (
                        <>
                          <Printer className="w-4 h-4" />
                          <span>IMPRIMIR EM FOLHA A4 (12 INGRESSOS / PÁGINA)</span>
                        </>
                      )}
                    </button>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={isExportingPdf}
                        onClick={() => handleExportBatchPdf(batchForGeneration, generationSuccessInfo.tickets)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 cursor-pointer"
                      >
                        <FileDown className="w-4 h-4 text-slate-500" />
                        <span>PDF Individual (9x5 cm)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsGenerateModalOpen(false)}
                        className="py-2.5 px-5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 cursor-pointer"
                      >
                        Concluir
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create/Edit Batch */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <h2 className="text-lg font-bold">
                {editingBatch ? 'Editar Lote' : 'Novo Lote / Tipo de Ingresso'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Código do Lote *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.batchCode}
                    onChange={e => setFormData({ ...formData, batchCode: e.target.value.toUpperCase() })}
                    placeholder="Ex: L01"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono font-bold focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nome do Lote *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: 1º Lote, Lote Promocional..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {presetBatches.map(pb => (
                  <button
                    key={pb}
                    type="button"
                    onClick={() => setFormData({ ...formData, name: pb })}
                    className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700"
                  >
                    {pb}
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tipo / Categoria de Ingresso *
                </label>
                <input
                  type="text"
                  required
                  value={formData.ticketTypeName}
                  onChange={e => setFormData({ ...formData, ticketTypeName: e.target.value })}
                  placeholder="Ex: VIP, Pista, Camarote..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
                />
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {presetTicketTypes.map(pt => (
                    <button
                      key={pt}
                      type="button"
                      onClick={() => setFormData({ ...formData, ticketTypeName: pt })}
                      className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700"
                    >
                      {pt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Preço (R$) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formData.price}
                    onChange={e => setFormData({ ...formData, price: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 font-bold"
                  />
                  <span className="text-[11px] text-slate-400">Use 0 para cortesias</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Quantidade Total *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.totalQuantity}
                    onChange={e => setFormData({ ...formData, totalQuantity: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 font-bold"
                  />
                  <span className="text-[11px] text-slate-400">Limite de estoque</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Início das Vendas
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Término das Vendas
                  </label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
                <strong>Arte do Evento:</strong> Todos os ingressos físicos gerados a partir deste lote utilizarão automaticamente a identidade visual do evento selecionado.
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs"
                >
                  {editingBatch ? 'Salvar Lote' : 'Cadastrar Lote'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
