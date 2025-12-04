import { useState, useRef, useEffect } from 'react';
import { Bot, User, X, Send, Mic, Copy, Check, ChevronDown, Clock, MessageCircle, PanelLeft, PanelRight, Minus, Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ChatMessage } from '@/hooks/useAIChat';
import { useViewportHeight } from '@/hooks/useViewportHeight';

interface ExpandableChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  isProcessing: boolean;
  withinOutlet?: boolean; // quando true, posiciona o dock relativo ao OUTLET
}

export function ExpandableChatInterface({ messages, onSendMessage, isProcessing, withinOutlet = false }: ExpandableChatInterfaceProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDockVisible, setIsDockVisible] = useState(true);
  const [inputValue, setInputValue] = useState('');
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { viewportHeight } = useViewportHeight(isExpanded);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [autoStick, setAutoStick] = useState(true);
  const [lastReadAt, setLastReadAt] = useState<Date>(new Date());
  const [expandedHeightPx, setExpandedHeightPx] = useState<number>(() => Math.round(window.innerHeight * 0.6));
  const [isResizing, setIsResizing] = useState(false);
  const [dockPosition, setDockPosition] = useState<'left' | 'center' | 'right'>('right');
  const touchStartY = useRef<number | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (autoStick) scrollToBottom();
  }, [messages, autoStick]);

  useEffect(() => {
    if (isExpanded) setLastReadAt(new Date());
  }, [isExpanded]);

  useEffect(() => {
    if (isExpanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isExpanded]);

  // Auto-resize para textarea ao estilo AI Studio
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = '0px';
    const next = Math.min(el.scrollHeight, 160); // limite 160px (~4-5 linhas)
    el.style.height = next + 'px';
  }, [inputValue]);

  const handleSubmit = () => {
    if (inputValue.trim()) {
      onSendMessage(inputValue);
      setInputValue('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleVoiceInput = () => {
    setIsListening(!isListening);
    
    // Mock voice recognition
    if (!isListening) {
      setTimeout(() => {
        setInputValue('Gastei R$ 50 no almoço hoje');
        setIsListening(false);
      }, 2000);
    }
  };

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1200);
    } catch {}
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 16;
    setAutoStick(atBottom);
  };

  const handleInputFocus = () => {
    setIsExpanded(true);
  };

  const handleClose = () => {
    setIsExpanded(false);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  const chatHeight = isExpanded 
    ? (window.innerWidth <= 768 && viewportHeight > 0 ? viewportHeight - 120 : expandedHeightPx)
    : 0;

  const unreadCount = messages.filter(m => m.sender === 'ai' && m.timestamp > lastReadAt).length;

  // Resize handlers (desktop)
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newH = Math.min(Math.max(240, window.innerHeight - e.clientY - 24), Math.round(window.innerHeight * 0.9));
      setExpandedHeightPx(newH);
    };
    const onMouseUp = () => setIsResizing(false);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isResizing]);

  // Swipe-to-close (mobile)
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const delta = e.changedTouches[0].clientY - touchStartY.current;
    if (delta > 60 && window.innerWidth <= 768) {
      setIsExpanded(false);
    }
    touchStartY.current = null;
  };

  const dockAlignClass = dockPosition === 'center' ? 'mx-auto' : dockPosition === 'left' ? 'mr-auto' : 'ml-auto';

  return (
    <>
      {/* Backdrop - only when expanded */}
      {isExpanded && (
        <div
          className={`fixed inset-0 md:left-[var(--sidebar-width)] bg-black bg-opacity-50 z-40 transition-opacity duration-300`}
          onClick={handleBackdropClick}
        />
      )}

      {/* FAB when dock hidden */}
      {!isDockVisible && (
        <div className="fixed left-0 right-0 bottom-5 z-50 pointer-events-none">
          <div className="md:ml-[var(--sidebar-width)] flex justify-end pr-5">
            <button
              className={`pointer-events-auto h-14 w-14 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 flex items-center justify-center`}
              onClick={() => { setIsDockVisible(true); setIsExpanded(false); }}
              aria-label="Abrir chat"
            >
              <div className="relative">
                <MessageCircle className="w-6 h-6" />
                {unreadCount > 0 && (
                  <span className="absolute -top-2 -right-2 h-5 min-w-5 px-1 rounded-full bg-red-600 text-[10px] leading-5 text-white text-center">
                    {unreadCount}
                  </span>
                )}
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Unified Chat Widget - positioned at bottom */}
      {isDockVisible && (
      <div className={`fixed left-0 right-0 bottom-0 z-50 p-4`}>
        <div className={`max-w-4xl md:ml-[var(--sidebar-width)] ${dockAlignClass}`}>
          {/* Single unified container */}
          <div className="bg-white/90 backdrop-blur border border-gray-200/80 rounded-2xl shadow-lg overflow-hidden dark:bg-neutral-900/60 dark:border-white/10">
            {/* Chat Messages Area - only visible when expanded */}
            {isExpanded && (
              <div 
                className="transition-all duration-300 ease-out"
                style={{ height: `${chatHeight}px` }}
                onTouchStart={onTouchStart}
                onTouchEnd={onTouchEnd}
              >
                {/* Chat Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white dark:bg-neutral-900/60 dark:border-white/10">
                  <div className="flex items-center space-x-3">
                    <div className="bg-blue-500 p-2 rounded-full">
                      <Bot className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Assistente Fincla</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Online - Pronto para ajudar</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClose}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>

                {/* Chat Messages */}
                <div 
                  className="overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-neutral-900/40"
                  style={{ height: `${chatHeight - 80}px` }}
                  onScroll={handleScroll}
                >
                  {/* Quick suggestions */}
                  <div className="flex flex-wrap gap-2 mb-2">
                    {['Registrar despesa', 'Quanto gastei este mês?', 'Gastos por categoria'].map((chip) => (
                      <button
                        key={chip}
                        className="px-3 py-1.5 text-xs rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700"
                        onClick={() => onSendMessage(chip)}
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex items-start space-x-3 chat-message ${
                        message.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                      }`}
                    >
                      {message.sender === 'user' ? (
                      <>
                        <div className="bg-blue-500 rounded-lg p-4 max-w-md text-white">
                          <div className="flex items-center justify-between gap-4">
                            <p className="text-sm whitespace-pre-line">{message.content}</p>
                            <span className="hidden md:inline-flex items-center gap-1 text-[10px] opacity-80">
                              <Clock className="w-3 h-3" />
                              {new Date(message.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                          <div className="bg-gray-300 p-2 rounded-full flex-shrink-0">
                            <User className="w-4 h-4 text-gray-600" />
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="bg-blue-500 p-2 rounded-full flex-shrink-0">
                            <Bot className="w-4 h-4 text-white" />
                          </div>
                        <div className="bg-white dark:bg-neutral-900 rounded-lg p-4 max-w-md shadow-sm border border-gray-100 dark:border-white/10">
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-line">{message.content}</p>
                            <button
                              aria-label="Copiar resposta"
                              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                              onClick={() => handleCopy(message.id, message.content)}
                            >
                              {copiedId === message.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            </button>
                          </div>
                          <div className="mt-2 text-[10px] text-gray-500 dark:text-gray-400 inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(message.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                        </>
                      )}
                    </div>
                  ))}
                  
                  {isProcessing && (
                    <div className="flex items-start space-x-3">
                      <div className="bg-blue-500 p-2 rounded-full flex-shrink-0">
                        <Bot className="w-4 h-4 text-white" />
                      </div>
                    <div className="bg-white dark:bg-neutral-900 rounded-lg p-4 shadow-sm border border-gray-100 dark:border-white/10">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Resize handle (desktop) */}
                <div
                  className="h-3 cursor-row-resize bg-transparent hover:bg-black/5 dark:hover:bg-white/5"
                  onMouseDown={() => window.innerWidth > 768 && setIsResizing(true)}
                  aria-hidden
                />
              </div>
            )}

            {/* Input Area - always visible at bottom of widget */}
            <div className="p-4 bg-white/90 backdrop-blur border-t border-gray-200/80 dark:bg-neutral-900/60 dark:border-white/10">
              {/* Peek (shown when not expanded) */}
              {!isExpanded && (
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="text-xs text-gray-600 dark:text-gray-300 truncate max-w-[70%]">
                    {(() => {
                      const lastAI = [...messages].reverse().find(m => m.sender === 'ai');
                      return lastAI ? lastAI.content : 'Pronto para ajudar — "Registrar despesa", "Gastos por categoria"...';
                    })()}
                  </div>
                  <div className="hidden sm:flex gap-2">
                    {['Registrar despesa', 'Relatório mensal'].map((chip) => (
                      <button key={chip} className="px-2 py-1 text-[10px] rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-white/10 dark:text-gray-200" onClick={() => onSendMessage(chip)}>
                        {chip}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDockPosition(p => p === 'right' ? 'center' : p === 'center' ? 'left' : 'right')} aria-label="Alternar posição do dock">
                      {dockPosition === 'left' ? <PanelLeft className="w-4 h-4" /> : dockPosition === 'right' ? <PanelRight className="w-4 h-4" /> : <PanelRight className="w-4 h-4 rotate-180" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsDockVisible(false)} aria-label="Ocultar dock">
                      <Minus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
              <div className="flex">
                <div className="flex-1">
                  <div className="group flex items-end gap-2 rounded-2xl border border-gray-200 bg-white/95 px-3 py-2 shadow-sm focus-within:ring-1 focus-within:ring-indigo-500 dark:border-white/10 dark:bg-neutral-900/70">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-white/10"
                      aria-label="Anexar arquivo"
                    >
                      <Paperclip className="w-4 h-4" />
                    </Button>
                    <Textarea
                      ref={inputRef}
                      placeholder="Pergunte algo ou registre uma transação... (Shift+Enter para nova linha)"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      onFocus={handleInputFocus}
                      rows={1}
                      className="min-h-[40px] max-h-40 flex-1 resize-none border-0 bg-transparent p-2 px-0 text-base shadow-none focus-visible:ring-0"
                      disabled={isProcessing}
                      aria-label="Mensagem para o assistente"
                    />
                    <Button
                      onClick={handleVoiceInput}
                      variant="ghost"
                      size="icon"
                      className={`h-9 w-9 rounded-full transition-colors ${
                        isListening 
                          ? 'bg-red-100 text-red-600 hover:bg-red-200' 
                          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-white/10'
                      }`}
                      aria-pressed={isListening}
                      aria-label={isListening ? 'Parar gravação de voz' : 'Iniciar gravação de voz'}
                    >
                      <Mic className={`w-4 h-4 ${isListening ? 'animate-pulse' : ''}`} />
                    </Button>
                    <Button
                      onClick={handleSubmit}
                      disabled={!inputValue.trim() || isProcessing}
                      className="h-9 w-9 rounded-full bg-blue-500 text-white hover:bg-blue-600"
                      aria-label="Enviar mensagem"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                  {isExpanded && !autoStick && (
                    <div className="mt-2 flex justify-end">
                      <button
                        className="inline-flex items-center gap-1 text-xs bg-white/90 dark:bg-neutral-900/80 border border-gray-200 dark:border-white/10 rounded-full px-3 py-1 shadow-sm"
                        onClick={() => { setAutoStick(true); scrollToBottom(); }}
                        aria-label="Rolar para o fim"
                      >
                        <ChevronDown className="w-3 h-3" /> Fim
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      )}
    </>
  );
}