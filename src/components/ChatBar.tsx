import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Mic, Paperclip, Send, X, ArrowDown, RefreshCcw, Copy, Check, Share2, MoreHorizontal, Star, Bot as BotIcon, User as UserIcon, Receipt, PlusCircle, BarChart3, PiggyBank, TrendingUp } from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChatMessage } from "@/hooks/useAIChat";

type ChatBarProps = {
  placeholder?: string;
  isProcessing?: boolean;
  onSend: (text: string) => void;
  suggestions?: string[];
  messages?: ChatMessage[];
};

export function ChatBar({ placeholder, isProcessing, onSend, suggestions = [], messages = [] }: ChatBarProps) {
  const [value, setValue] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [autoStick, setAutoStick] = useState(true);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [lastUserMessage, setLastUserMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const userInitials = "JS"; // TODO: pegar do perfil quando disponível

  // Medidas da viewport para calcular 50% da tela (desktop)
  const [viewport, setViewport] = useState<{ w: number; h: number }>({ w: 1280, h: 800 });
  const isDesktop = viewport.w >= 1024;

  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  type QuickAction = {
    id: string;
    title: string;
    description: string;
    prompt: string;
    icon: React.FC<React.SVGProps<SVGSVGElement>>;
  };

  const quickActions: QuickAction[] = [
    { id: 'expense', title: 'Registrar despesa', description: 'Lance uma saída com categoria e valor.', prompt: 'Registrar despesa de R$ 45,90 em Alimentação hoje', icon: Receipt },
    { id: 'income', title: 'Registrar receita', description: 'Adicione salário, bônus ou outra entrada.', prompt: 'Registrar receita de R$ 3.200,00 como Salário', icon: PlusCircle },
    { id: 'report', title: 'Relatório mensal', description: 'Resumo de gastos, receitas e saldo do mês.', prompt: 'Gerar relatório financeiro do mês atual', icon: BarChart3 },
    { id: 'goal', title: 'Definir meta', description: 'Crie ou ajuste metas de economia.', prompt: 'Definir meta de economia de R$ 5.000 em 3 meses', icon: PiggyBank },
    { id: 'insight', title: 'Insights', description: 'Descubra padrões e oportunidades de economia.', prompt: 'Quais insights você tem sobre meus gastos deste mês?', icon: TrendingUp },
  ];

  // O input não cresce; mantemos altura constante. (removido auto-resize)

  const handleSubmit = () => {
    const text = value.trim();
    if (!text) return;
    onSend(text);
    setLastUserMessage(text);
    setValue("");
    setAutoStick(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setIsExpanded(false);
      // Remover foco do input para que um novo clique dispare onFocus novamente
      ref.current?.blur();
    }
  };

  // Auto-scroll quando expandido e chegarem novas mensagens
  useEffect(() => {
    if (!isExpanded || !autoStick) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isExpanded, autoStick]);

  const onMessagesScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 16;
    setAutoStick(atBottom);
    setShowScrollToBottom(!atBottom);
  };

  const handleChipClick = (text: string) => {
    setIsExpanded(true);
    setAutoStick(true);
    onSend(text);
    setLastUserMessage(text);
    // foca o input após expandir
    setTimeout(() => ref.current?.focus(), 0);
  };

  const getDayLabel = (d: Date) => {
    if (isToday(d)) return "Hoje";
    if (isYesterday(d)) return "Ontem";
    return format(d, "dd 'de' MMMM, yyyy", { locale: ptBR });
  };

  // Foco automático no input visível ao expandir
  useEffect(() => {
    if (isExpanded) {
      setTimeout(() => ref.current?.focus(), 0);
    }
  }, [isExpanded]);

  // Fechar ao clicar fora do painel do chat
  useEffect(() => {
    if (!isExpanded) return;
    const onClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current && !panelRef.current.contains(target)) {
        setIsExpanded(false);
      }
    };
    window.addEventListener('mousedown', onClickOutside);
    return () => window.removeEventListener('mousedown', onClickOutside);
  }, [isExpanded]);

  // Permitir fechar com ESC mesmo quando o foco não está no textarea
  useEffect(() => {
    const onGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isExpanded) {
        e.preventDefault();
        setIsExpanded(false);
        // Garantir que qualquer foco interno não impeça reabrir depois
        ref.current?.blur();
      }
    };
    window.addEventListener('keydown', onGlobalKeyDown);
    return () => window.removeEventListener('keydown', onGlobalKeyDown);
  }, [isExpanded]);

  const handleShare = async (text: string) => {
    try {
      if ((navigator as any).share) {
        await (navigator as any).share({ text });
      } else {
        await navigator.clipboard.writeText(text);
        setCopiedId('share');
        setTimeout(() => setCopiedId(null), 1200);
      }
    } catch {}
  };

  // Animação estilo "chat-shell": transição de max-height e de altura do conteúdo
  const shellMaxHeight = isExpanded ? (isDesktop ? Math.floor(viewport.h * 0.7) : 440) : 76; // px
  const inputAreaHeight = 64; // aprox. altura do bloco de input
  const clearButtonHeight = isExpanded ? 28 : 0; // espaço do botão "Limpar conversa"
  const contentHeight = isExpanded ? Math.max(0, shellMaxHeight - (inputAreaHeight + clearButtonHeight)) : 0; // px

  return (
    <div className="fixed left-0 right-0 bottom-0 z-30 md:ml-[var(--sidebar-width)] px-4 pb-4 pt-2 bg-transparent pointer-events-none">
      {/* Sugestões (somente colapsado) */}
      {!isExpanded && suggestions.length > 0 && (
        <div className="w-full md:w-[60%] md:max-w-[1100px] xl:w-[66%] mx-auto mb-2 pointer-events-none">
          <div className="flex flex-wrap gap-2 w-fit pointer-events-auto">
            {suggestions.map((s) => (
              <button
                key={s}
                className="px-3 py-1.5 text-xs rounded-full border border-gray-200 bg-white/80 hover:bg-gray-50 text-gray-700 dark:border-white/10 dark:bg-white/10 dark:text-gray-200 pointer-events-auto"
                onClick={() => handleChipClick(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chat shell com transição de max-height */}
        <div className="w-full md:w-[60%] md:max-w-[1100px] xl:w-[66%] mx-auto pointer-events-auto">
          <div
          ref={panelRef}
            className={`group rounded-2xl border border-gray-200 ring-1 ring-gray-300/70 dark:ring-white/15 supports-[backdrop-filter]:bg-white/90 backdrop-blur ${isExpanded ? 'shadow-[0_22px_80px_-18px_rgba(28,30,35,0.38),0_10px_32px_rgba(28,30,35,0.16)] dark:shadow-[0_24px_96px_-18px_rgba(0,0,0,0.68),0_12px_36px_rgba(0,0,0,0.34)]' : ''} dark:border-white/10 dark:bg-neutral-900/70 overflow-hidden flex flex-col focus-within:ring-2 focus-within:ring-offset-3 focus-within:ring-offset-white dark:focus-within:ring-offset-neutral-900`}
          style={{ maxHeight: `${shellMaxHeight}px`, transition: 'max-height 300ms ease', opacity: isExpanded ? 1 : 0.97 }}
        >
          {/* Conteúdo expansível: 2 colunas (mensagens + ações rápidas) */}
          <div
            className="w-full overflow-hidden bg-white dark:bg-neutral-900"
            style={{ height: `${contentHeight}px`, transition: 'height 300ms ease' }}
          >
            {isExpanded && (
                <div className="h-full flex flex-col chat-fade-in">
                  {/* Top bar única para ambas as colunas */}
                  <div className="shrink-0 h-14 px-5 flex items-center justify-between border-b border-gray-200 dark:border-white/10 supports-[backdrop-filter]:bg-white/90 backdrop-blur dark:supports-[backdrop-filter]:bg-neutral-900/70">
                    <div className="text-sm font-medium text-[#111827] dark:text-gray-100">Assistente Fincla</div>
                    <button
                      className="ml-auto h-7 w-7 inline-flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10"
                      aria-label="Minimizar"
                      onClick={() => setIsExpanded(false)}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex-1 min-h-0 flex flex-row">
                    {/* Coluna mensagens */}
                    <div className="flex-[1.85] min-w-0 flex flex-col border-r border-gray-100 dark:border-white/10 relative">
                    <div className="flex-1 min-h-0 overflow-y-auto bg-transparent pr-2 overscroll-contain" onScroll={onMessagesScroll}>
                      <div className="px-4 py-3 space-y-5 pb-6">
                        {messages.map((m, idx) => {
                          const isUser = m.sender === 'user';
                          const isError = m.sender === 'ai' && m.content.toLowerCase().startsWith('desculpe');
                          const prev = messages[idx - 1];
                          const showDaySeparator = !prev || getDayLabel(prev.timestamp) !== getDayLabel(m.timestamp);
                          const showActionsAi = m.sender === 'ai' && idx !== 0;
                          return (
                            <div key={m.id}>
                              {showDaySeparator && (
                                <div className="relative my-3 flex items-center justify-center">
                                  <span className="z-10 rounded-full border border-gray-200 bg-white/90 px-3 py-1 text-[10px] uppercase tracking-wide text-gray-500 dark:border-white/10 dark:bg-neutral-900/80">
                                    {getDayLabel(m.timestamp)}
                                  </span>
                                  <div className="absolute inset-x-0 top-1/2 -z-0 h-px bg-gray-200 dark:bg-white/10" />
                                </div>
                              )}

                              <div className={`mb-1 text-[11px] text-gray-500 dark:text-gray-400 ${isUser ? 'text-right' : 'text-left'}`}>
                                <span className="font-medium">{isUser ? 'Você' : 'Fincla'}</span>
                                <span className="mx-1">•</span>
                                <span>{format(m.timestamp, 'HH:mm', { locale: ptBR })}</span>
                              </div>

                              {isUser ? (
                                <div className="ml-auto max-w-[75%] flex items-start gap-3 justify-end">
                                  <div className="text-right">
                                    <p className="text-sm leading-relaxed text-gray-900 dark:text-gray-100 whitespace-pre-line">{m.content}</p>
                                  </div>
                                  <Avatar className="h-6 w-6 ring-1 ring-gray-200 dark:ring-white/10">
                                    <AvatarFallback className="bg-gray-200 text-gray-800 text-[10px] dark:bg-white/20 dark:text-white">{userInitials}</AvatarFallback>
                                  </Avatar>
                                </div>
                              ) : (
                                <div className="max-w-[85%] flex items-start gap-3">
                                  <Avatar className="h-6 w-6 ring-1 ring-gray-200 dark:ring-white/10">
                                    <AvatarFallback className="bg-[#4A56E2] text-white text-[10px]">AI</AvatarFallback>
                                  </Avatar>
                                  <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden dark:border-white/10 dark:bg-neutral-900">
                                    <div className="p-4">
                                      <div className="prose prose-sm max-w-none dark:prose-invert">
                                        <p className="whitespace-pre-line m-0">{m.content}</p>
                                      </div>
                                    </div>
                                    {showActionsAi && (
                                      <div className="px-3 pt-2 pb-3 flex items-center gap-3 text-gray-500 dark:text-gray-300">
                                        {isError && (
                                          <button className="hover:text-gray-900 dark:hover:text-white" title="Tentar novamente" onClick={() => onSend(lastUserMessage || '')}>
                                            <RefreshCcw className="w-4 h-4" />
                                          </button>
                                        )}
                                        <button className="hover:text-gray-900 dark:hover:text-white" title="Copiar" onClick={() => { navigator.clipboard.writeText(m.content); setCopiedId(m.id); setTimeout(() => setCopiedId(null), 1200); }}>
                                          {copiedId === m.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                        </button>
                                        <button className="hover:text-gray-900 dark:hover:text-white" title="Compartilhar" onClick={() => handleShare(m.content)}>
                                          <Share2 className="w-4 h-4" />
                                        </button>
                                        <button className="hover:text-gray-900 dark:hover:text-white" title="Favoritar">
                                          <Star className="w-4 h-4" />
                                        </button>
                                        <button className="hover:text-gray-900 dark:hover:text-white" title="Mais">
                                          <MoreHorizontal className="w-4 h-4" />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {isProcessing && (
                          <div className="flex justify-start">
                            <div className="bg-white dark:bg-neutral-900 border border-gray-100 dark:border-white/10 text-gray-900 dark:text-gray-100 rounded-2xl px-3 py-2 shadow-sm">
                              <div className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" />
                                <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:120ms]" />
                                <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:240ms]" />
                              </div>
                            </div>
                          </div>
                        )}
                        <div ref={messagesEndRef} />
                      </div>

                      {showScrollToBottom && (
                        <button
                          className="absolute right-4 bottom-8 inline-flex items-center gap-1 rounded-full bg-white/90 backdrop-blur px-2 py-1 text-xs text-[#4B5563] ring-1 ring-[#E5E7EB] shadow-sm hover:bg-white dark:bg-neutral-800/80 dark:text-gray-200 dark:ring-white/10"
                          onClick={() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); setShowScrollToBottom(false); }}
                          aria-label="Voltar ao fim"
                        >
                          <ArrowDown className="w-3 h-3" /> Rolar até o fim
                        </button>
                      )}
                      {/* Botão limpar conversa dentro da área de mensagens (levemente abaixo do botão "Ao fim") */}
                      <button
                        className="absolute right-4 bottom-2 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs bg-white ring-1 ring-[#E5E7EB] shadow-sm hover:bg-[#F9FAFB] text-[#4B5563] hover:text-[#111827] dark:bg-neutral-900/70 dark:text-gray-200 dark:ring-white/10"
                        onClick={() => {
                          const ev = new CustomEvent('walletai:clear-chat');
                          window.dispatchEvent(ev);
                        }}
                        aria-label="Limpar conversa"
                      >
                        <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M8 6v12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                        Limpar conversa
                      </button>
                    </div>
                    {/* fecha coluna mensagens */}
                    </div>

                    {/* Coluna ações rápidas */}
                    <aside className="flex-[1.15] min-w-[200px] max-w-[260px] hidden md:flex flex-col bg-white dark:bg-neutral-900">
                      <div className="flex-1 min-h-0 overflow-y-hidden p-4 space-y-3">
                        {quickActions.map((a) => (
                          <button
                            key={a.id}
                            className="w-full text-left rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-colors dark:border-white/10 dark:bg-neutral-900/70 dark:hover:bg-neutral-900/60 p-3 shadow-sm"
                            onClick={() => handleChipClick(a.prompt)}
                          >
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-md bg-[#E6F0F6] text-[#4A56E2] ring-1 ring-[#E5E7EB] dark:bg-indigo-900/30 dark:text-indigo-300 dark:ring-indigo-900/50">
                                <a.icon className="h-4 w-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{a.title}</div>
                                <div className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2">{a.description}</div>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </aside>
                  </div>
                </div>
            )}
          </div>


          {/* Input invariável na base do shell (sem wrapper externo) */}
          <div className="px-2 py-1.5">
            <div className="flex items-center gap-2 rounded-2xl border border-gray-200 supports-[backdrop-filter]:bg-white/90 backdrop-blur px-2 dark:border-white/10 dark:bg-neutral-900/70 transition-all duration-300">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-white/10" aria-label="Anexar arquivo">
                <Paperclip className="w-4 h-4" />
              </Button>
              <Textarea
                ref={ref}
                placeholder={placeholder || "Digite um prompt… (Shift+Enter para nova linha, Enter para enviar)"}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => setIsExpanded(true)}
                onMouseDown={() => setIsExpanded(true)}
                rows={1}
                className={`flex-1 resize-none border-0 bg-transparent px-0 text-[15px] leading-none shadow-none ring-offset-background ring-0 focus-visible:ring-0 focus-visible:ring-offset-3 py-[10px] h-[44px] min-h-[44px] max-h-[44px]`}
                disabled={isProcessing}
                aria-label="Mensagem para o assistente"
              />
              <Button onClick={() => setIsListening((p) => !p)} variant="ghost" size="icon" className={`h-8 w-8 rounded-full transition-colors ${isListening ? "bg-red-100 text-red-600 hover:bg-red-200" : "text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-white/10"}`} aria-pressed={isListening} aria-label={isListening ? "Parar gravação de voz" : "Iniciar gravação de voz"}>
                <Mic className={`w-4 h-4 ${isListening ? "animate-pulse" : ""}`} />
              </Button>
              <Button onClick={handleSubmit} disabled={!value.trim() || isProcessing} className="h-8 w-8 rounded-full bg-[#4A56E2] text-white hover:bg-[#343D9B]" aria-label="Enviar mensagem">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChatBar;


