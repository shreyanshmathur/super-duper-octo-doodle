import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '../store/appStore';
import { buildContext, streamGroq, type ChatMessage } from '../utils/copilot';

const GROQ_KEY_STORAGE = 'solar_copilot_groq_key';
const ENV_KEY = (import.meta as { env?: Record<string, string> }).env?.VITE_GROQ_API_KEY ?? '';

const SUGGESTED: string[] = [
  'Which inverter is performing worst?',
  'What caused the highest penalty day?',
  'How can I reduce deviation penalties?',
  'Which consumer generates the most revenue?',
  'Summarise overall plant performance',
  'Are there any data quality issues I should fix?',
];

interface Message {
  role: 'user' | 'assistant';
  content: string;
  ts: number;
}

export const CopilotPanel: React.FC = () => {
  const state = useAppStore();
  const [open, setOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState<string>(() => ENV_KEY || localStorage.getItem(GROQ_KEY_STORAGE) || '');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<boolean>(false);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streaming]);

  const saveKey = useCallback(() => {
    const k = apiKeyInput.trim();
    if (k) {
      localStorage.setItem(GROQ_KEY_STORAGE, k);
      setApiKey(k);
      setApiKeyInput('');
      setShowSettings(false);
    }
  }, [apiKeyInput]);

  const send = useCallback(async (text: string) => {
    const question = text.trim();
    if (!question || streaming) return;
    if (!apiKey) { setShowSettings(true); return; }

    setError(null);
    const userMsg: Message = { role: 'user', content: question, ts: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setStreaming(true);
    abortRef.current = false;

    const systemPrompt = `You are an expert solar energy analyst copilot embedded in a solar plant revenue intelligence dashboard. You have access to live data from the dashboard below. Answer questions concisely and accurately, focusing on actionable insights. Use bullet points where helpful. When referring to inverters or dates, be specific.\n\n${buildContext(state)}`;

    const history: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: question },
    ];

    const assistantTs = Date.now();
    setMessages(prev => [...prev, { role: 'assistant', content: '', ts: assistantTs }]);

    try {
      for await (const chunk of streamGroq(history, apiKey)) {
        if (abortRef.current) break;
        setMessages(prev =>
          prev.map(m => m.ts === assistantTs ? { ...m, content: m.content + chunk } : m)
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setMessages(prev => prev.filter(m => m.ts !== assistantTs));
    } finally {
      setStreaming(false);
    }
  }, [apiKey, messages, state, streaming]);

  const exportMarkdown = useCallback(() => {
    const md = messages
      .map(m => `**${m.role === 'user' ? 'You' : 'Copilot'}**: ${m.content}`)
      .join('\n\n---\n\n');
    const blob = new Blob([`# Solar Copilot Chat Export\n\n${md}`], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `solar-copilot-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [messages]);

  const dataLoaded = state.intervalRows.length > 0 || state.assetRows.length > 0 || state.consumerRows.length > 0;

  return (
    <>
      {/* ── FAB ── */}
      <button
        onClick={() => setOpen(o => !o)}
        title="AI Copilot"
        className="fixed bottom-6 right-5 z-50 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center text-2xl transition-all hover:scale-110 active:scale-95"
        style={{ background: 'linear-gradient(135deg,#1D4ED8,#7C3AED)', border: '2px solid rgba(255,255,255,.3)' }}
      >
        {open ? '✕' : '🤖'}
      </button>

      {/* ── Panel ── */}
      {open && (
        <div
          className="fixed bottom-24 right-4 z-50 flex flex-col rounded-2xl shadow-2xl overflow-hidden fade-in"
          style={{
            width: 'min(420px, calc(100vw - 2rem))',
            height: 'min(600px, calc(100vh - 8rem))',
            background: '#fff',
            border: '1px solid #e2e8f0',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 shrink-0"
            style={{ background: 'linear-gradient(135deg,#1D4ED8,#7C3AED)' }}>
            <div className="flex items-center gap-2">
              <span className="text-xl">🤖</span>
              <div>
                <div className="text-white font-bold text-sm leading-tight">Solar AI Copilot</div>
                <div className="text-[10px]" style={{ color: 'rgba(255,255,255,.6)' }}>
                  {dataLoaded ? `${state.intervalRows.length} interval rows loaded` : 'No data yet — load data first'}
                </div>
              </div>
            </div>
            <div className="flex gap-1.5">
              {messages.length > 0 && (
                <button onClick={exportMarkdown} title="Export chat" className="text-white opacity-70 hover:opacity-100 text-xs px-2 py-1 rounded-lg transition-opacity" style={{ background: 'rgba(255,255,255,.15)' }}>
                  ↓ Export
                </button>
              )}
              <button onClick={() => setShowSettings(s => !s)} title="API key settings" className="text-white opacity-70 hover:opacity-100 text-xs px-2 py-1 rounded-lg transition-opacity" style={{ background: 'rgba(255,255,255,.15)' }}>
                ⚙️
              </button>
              {messages.length > 0 && (
                <button onClick={() => setMessages([])} title="Clear chat" className="text-white opacity-70 hover:opacity-100 text-xs px-2 py-1 rounded-lg transition-opacity" style={{ background: 'rgba(255,255,255,.15)' }}>
                  🗑️
                </button>
              )}
            </div>
          </div>

          {/* Settings overlay */}
          {showSettings && (
            <div className="px-4 py-3 bg-blue-50 border-b border-blue-100 shrink-0">
              <div className="text-xs font-bold text-blue-800 mb-2">Groq API Key</div>
              <div className="text-[10px] text-blue-600 mb-2">
                Get a free key at <strong>console.groq.com</strong>. Stored only in your browser.
                {ENV_KEY && <span className="ml-1 text-green-600 font-semibold"> (env var detected)</span>}
              </div>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={e => setApiKeyInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveKey()}
                  placeholder={apiKey ? '••••••••••••• (already set)' : 'gsk_...'}
                  className="flex-1 text-xs border border-blue-200 rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-blue-400 outline-none"
                />
                <button onClick={saveKey} className="text-xs font-bold bg-blue-600 text-white rounded-lg px-3 py-1.5 hover:bg-blue-700 transition-colors">
                  Save
                </button>
              </div>
              {apiKey && !ENV_KEY && (
                <div className="mt-1.5 text-[10px] text-green-600 font-semibold">✓ Key saved in browser storage</div>
              )}
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ scrollbarWidth: 'thin' }}>
            {messages.length === 0 && (
              <div className="space-y-3">
                <div className="text-center text-xs text-slate-400 py-4">
                  {dataLoaded
                    ? 'Ask me anything about your solar plant data.'
                    : '⚠️ Load data first via the Upload tab, then come back to ask questions.'}
                </div>
                {dataLoaded && (
                  <div className="space-y-1.5">
                    <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Suggested questions</div>
                    {SUGGESTED.map(q => (
                      <button key={q} onClick={() => send(q)}
                        className="w-full text-left text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg px-3 py-2 transition-colors border border-blue-100">
                        {q}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap break-words ${
                    m.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-sm'
                      : 'bg-slate-100 text-slate-800 rounded-bl-sm'
                  }`}
                >
                  {m.content || (m.role === 'assistant' && streaming && i === messages.length - 1 ? (
                    <span className="inline-flex gap-1">
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </span>
                  ) : '...')}
                </div>
              </div>
            ))}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs text-red-700">
                <span className="font-bold">Error: </span>{error}
                {error.includes('401') && ' — Check your Groq API key in ⚙️ settings.'}
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-slate-100 px-3 py-2.5 shrink-0 flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder="Ask about your solar plant… (Enter to send)"
              rows={2}
              className="flex-1 text-xs border border-slate-200 rounded-xl px-3 py-2 resize-none focus:ring-1 focus:ring-blue-400 outline-none bg-white"
              style={{ maxHeight: 100, scrollbarWidth: 'thin' }}
            />
            <button
              onClick={() => {
                if (streaming) { abortRef.current = true; setStreaming(false); }
                else send(input);
              }}
              disabled={!input.trim() && !streaming}
              className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-base font-bold transition-all ${
                streaming
                  ? 'bg-red-100 text-red-500 hover:bg-red-200'
                  : input.trim()
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-slate-100 text-slate-300 cursor-not-allowed'
              }`}
            >
              {streaming ? '⏹' : '↑'}
            </button>
          </div>
        </div>
      )}
    </>
  );
};
