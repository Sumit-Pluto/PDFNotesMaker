import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Sparkles, X, Settings, Send, FileText, MessageSquare,
  ArrowLeft, Loader2, ExternalLink, KeyRound, Eye, EyeOff, Trash2,
} from 'lucide-react';
import type { PdfDocumentInfo } from '../types';
import {
  PROVIDERS, PROVIDER_ORDER, chatComplete,
  type ProviderId, type ChatMessage,
} from '../services/aiProviders';
import {
  loadAiSettings, saveAiSettings, clearAiSettings, type AiSettings,
} from '../services/aiStore';
import { extractPdfText, retrieveContext } from '../services/pdfText';

// ─── Types ──────────────────────────────────────────────────────────────────
type ChatMode = 'pdf' | 'general';

interface UiMessage {
  role: 'user' | 'assistant';
  content: string;
  error?: boolean;
  sources?: number[];
}

interface Props {
  activeDocument: PdfDocumentInfo | null;
}

// ─── Prompt templates ─────────────────────────────────────────────────────────
const GENERAL_SYSTEM =
  'You are a concise, helpful study assistant embedded in a PDF notes app. ' +
  'Answer clearly. Use short paragraphs or bullet points when it helps.';

function pdfSystem(docName: string, context: string): string {
  return (
    `You are a study assistant answering questions about the document "${docName}". ` +
    `Use ONLY the excerpts below to answer. If the answer is not in them, say you ` +
    `could not find it in this document. Cite page numbers like (p.3) when you use a fact.\n\n` +
    `=== DOCUMENT EXCERPTS ===\n${context}\n=== END EXCERPTS ===`
  );
}

// ─── Component ──────────────────────────────────────────────────────────────
export const AiAssistant: React.FC<Props> = ({ activeDocument }) => {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<AiSettings | null>(() => loadAiSettings());
  const [showSetup, setShowSetup] = useState(false);

  // Setup draft state
  const [draftProvider, setDraftProvider] = useState<ProviderId | null>(null);
  const [draftKey, setDraftKey] = useState('');
  const [draftModel, setDraftModel] = useState('');
  const [showKey, setShowKey] = useState(false);

  // Chat state
  const [mode, setMode] = useState<ChatMode>('pdf');
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusNote, setStatusNote] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const canPdf = !!activeDocument;
  const needsSetup = !settings || showSetup;

  // Keep "Ask this PDF" only when a document is open.
  useEffect(() => {
    if (!canPdf) setMode('general');
    else setMode('pdf');
  }, [canPdf]);

  // Auto-scroll to the latest message.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading, statusNote]);

  // ── Setup handlers ──────────────────────────────────────────────────────────
  const pickProvider = (id: ProviderId) => {
    setDraftProvider(id);
    setDraftModel(PROVIDERS[id].defaultModel);
    setDraftKey(settings?.provider === id ? settings.apiKey : '');
    setShowKey(false);
  };

  const saveSetup = () => {
    if (!draftProvider || !draftKey.trim()) return;
    const next: AiSettings = {
      provider: draftProvider,
      apiKey: draftKey.trim(),
      model: draftModel.trim() || PROVIDERS[draftProvider].defaultModel,
    };
    saveAiSettings(next);
    setSettings(next);
    setShowSetup(false);
    setDraftProvider(null);
  };

  const openSetup = () => {
    setShowSetup(true);
    setDraftProvider(settings?.provider ?? null);
    if (settings) {
      setDraftModel(settings.model);
      setDraftKey(settings.apiKey);
    }
  };

  const disconnect = () => {
    clearAiSettings();
    setSettings(null);
    setShowSetup(false);
    setDraftProvider(null);
    setDraftKey('');
    setMessages([]);
  };

  // ── Send a message ──────────────────────────────────────────────────────────
  const send = useCallback(async () => {
    const question = input.trim();
    if (!question || loading || !settings) return;

    const history: UiMessage[] = [...messages, { role: 'user', content: question }];
    setMessages(history);
    setInput('');
    setLoading(true);
    setStatusNote(null);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const usePdf = mode === 'pdf' && !!activeDocument;
    let system = GENERAL_SYSTEM;
    let sources: number[] | undefined;

    try {
      if (usePdf && activeDocument) {
        setStatusNote('Searching the PDF…');
        const pages = await extractPdfText(activeDocument);
        const { context, usedPages, matched } = retrieveContext(pages, question);
        if (context) {
          system = pdfSystem(activeDocument.name, context);
          sources = usedPages;
          setStatusNote(matched
            ? `Reading page${usedPages.length > 1 ? 's' : ''} ${usedPages.join(', ')}`
            : 'No exact match — using the document start');
        } else {
          setStatusNote('No readable text found — answering generally');
        }
      }

      const apiMessages: ChatMessage[] = history
        .filter(m => !m.error)
        .slice(-8)
        .map(m => ({ role: m.role, content: m.content }));

      const reply = await chatComplete({
        provider: settings.provider,
        apiKey: settings.apiKey,
        model: settings.model,
        system,
        messages: apiMessages,
        signal: controller.signal,
      });

      setMessages(prev => [...prev, { role: 'assistant', content: reply, sources }]);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setMessages(prev => [...prev, { role: 'assistant', content: (err as Error).message, error: true }]);
    } finally {
      setLoading(false);
      setStatusNote(null);
    }
  }, [input, loading, settings, messages, mode, activeDocument]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  // ── Launcher (closed) ─────────────────────────────────────────────────────
  if (!open) {
    return (
      <button className="ai-fab" onClick={() => setOpen(true)} title="Chat with your PDF">
        <Sparkles size={18} />
        <span>AI</span>
      </button>
    );
  }

  const providerMeta = settings ? PROVIDERS[settings.provider] : null;

  // ── Panel (open) ────────────────────────────────────────────────────────────
  return (
    <div className="ai-panel" role="dialog" aria-label="AI assistant">
      {/* Header */}
      <div className="ai-header">
        <div className="ai-header-title">
          <div className="ai-header-logo"><Sparkles size={16} /></div>
          <div>
            <div className="ai-header-name">Chat with your PDF</div>
            {providerMeta && !needsSetup && (
              <div className="ai-header-sub">{providerMeta.name} · {settings?.model}</div>
            )}
          </div>
        </div>
        <div className="ai-header-actions">
          {settings && !needsSetup && (
            <button className="ai-icon-btn" onClick={openSetup} title="Change provider / key">
              <Settings size={15} />
            </button>
          )}
          <button className="ai-icon-btn" onClick={() => setOpen(false)} title="Close">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Setup: provider picker + key form */}
      {needsSetup ? (
        <div className="ai-setup">
          {draftProvider === null ? (
            <>
              <p className="ai-setup-lead">Choose an AI provider to connect. You use your own API key — it stays in this browser.</p>
              <div className="ai-provider-grid">
                {PROVIDER_ORDER.map(id => {
                  const p = PROVIDERS[id];
                  return (
                    <button key={id} className="ai-provider-card" onClick={() => pickProvider(id)}>
                      <span className="ai-provider-dot" style={{ background: p.accent }} />
                      <span className="ai-provider-name">{p.name}</span>
                      <span className="ai-provider-blurb">{p.blurb}</span>
                      {p.free && <span className="ai-provider-free">Free tier</span>}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="ai-keyform">
              <button className="ai-back" onClick={() => setDraftProvider(null)}>
                <ArrowLeft size={14} /> Back
              </button>
              <div className="ai-keyform-head">
                <span className="ai-provider-dot" style={{ background: PROVIDERS[draftProvider].accent }} />
                <strong>{PROVIDERS[draftProvider].name}</strong>
              </div>

              <label className="ai-field-label"><KeyRound size={13} /> API key</label>
              <div className="ai-key-input">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={draftKey}
                  onChange={e => setDraftKey(e.target.value)}
                  placeholder={PROVIDERS[draftProvider].keyLabel}
                  autoComplete="off"
                  spellCheck={false}
                />
                <button className="ai-icon-btn" onClick={() => setShowKey(v => !v)} title={showKey ? 'Hide' : 'Show'}>
                  {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>

              <label className="ai-field-label">Model</label>
              <input
                className="ai-model-input"
                value={draftModel}
                onChange={e => setDraftModel(e.target.value)}
                placeholder={PROVIDERS[draftProvider].defaultModel}
                spellCheck={false}
              />

              <a className="ai-key-link" href={PROVIDERS[draftProvider].keyUrl} target="_blank" rel="noreferrer">
                Get a free key <ExternalLink size={12} />
              </a>

              <button className="ai-save-btn" onClick={saveSetup} disabled={!draftKey.trim()}>
                Save &amp; start chatting
              </button>

              {settings && (
                <button className="ai-disconnect" onClick={disconnect}>
                  <Trash2 size={13} /> Disconnect current key
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Mode toggle */}
          <div className="ai-toggle">
            <button
              className={`ai-toggle-btn ${mode === 'pdf' ? 'active' : ''}`}
              onClick={() => canPdf && setMode('pdf')}
              disabled={!canPdf}
              title={canPdf ? 'Answer from the open PDF' : 'Open a PDF to use this mode'}
            >
              <FileText size={14} /> Ask this PDF
            </button>
            <button
              className={`ai-toggle-btn ${mode === 'general' ? 'active' : ''}`}
              onClick={() => setMode('general')}
              title="Ask the AI anything"
            >
              <MessageSquare size={14} /> Ask AI
            </button>
          </div>

          {/* Messages */}
          <div className="ai-messages" ref={scrollRef}>
            {messages.length === 0 && (
              <div className="ai-empty">
                <div className="ai-empty-icon"><Sparkles size={22} /></div>
                <p className="ai-empty-title">
                  {mode === 'pdf' ? 'Ask anything about this PDF' : 'Ask me anything'}
                </p>
                <p className="ai-empty-sub">
                  {mode === 'pdf'
                    ? (canPdf ? `Answers are drawn from "${activeDocument?.name}".` : 'Open a PDF to ask about its contents.')
                    : 'General questions — not tied to the document.'}
                </p>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`ai-msg ai-msg-${m.role} ${m.error ? 'ai-msg-error' : ''}`}>
                <div className="ai-msg-bubble">{m.content}</div>
                {m.sources && m.sources.length > 0 && (
                  <div className="ai-msg-sources">
                    <FileText size={11} /> Pages {m.sources.join(', ')}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="ai-msg ai-msg-assistant">
                <div className="ai-msg-bubble ai-typing">
                  <Loader2 size={14} className="ai-spin" />
                  {statusNote ?? 'Thinking…'}
                </div>
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="ai-composer">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={mode === 'pdf' ? 'Ask about this PDF…' : 'Ask anything…'}
              rows={1}
            />
            <button className="ai-send-btn" onClick={send} disabled={!input.trim() || loading} title="Send">
              {loading ? <Loader2 size={16} className="ai-spin" /> : <Send size={16} />}
            </button>
          </div>
        </>
      )}
    </div>
  );
};
