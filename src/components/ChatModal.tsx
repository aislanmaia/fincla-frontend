import { useEffect, useRef } from 'react';
import { Bot, User, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChatMessage } from '@/hooks/useAIChat';
import { useViewportHeight } from '@/hooks/useViewportHeight';

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  isProcessing: boolean;
}

export function ChatModal({ isOpen, onClose, messages, isProcessing }: ChatModalProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { viewportHeight, isKeyboardOpen } = useViewportHeight(isOpen);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Scroll to bottom when keyboard opens/closes to keep input visible
  useEffect(() => {
    if (isOpen && isKeyboardOpen) {
      setTimeout(scrollToBottom, 300); // Delay to allow viewport to adjust
    }
  }, [isKeyboardOpen, isOpen]);







  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50 transition-opacity duration-300"
        onClick={handleBackdropClick}
      />
      
      {/* Chat Panel - grows from bottom, leaving space for integrated input */}
      <div className="fixed bottom-16 left-0 right-0 z-40">
        <div 
          className="bg-white w-full flex flex-col shadow-2xl overflow-hidden transition-all duration-300 ease-in-out md:mx-auto md:max-w-3xl md:rounded-t-2xl chat-slide-up border-t border-gray-200"
          style={{
            height: window.innerWidth <= 768 && viewportHeight > 0 
              ? `${Math.min(viewportHeight - 80, window.innerHeight - 120)}px` 
              : 'calc(80vh - 4rem)',
            maxHeight: window.innerWidth <= 768 && viewportHeight > 0 
              ? `${Math.min(viewportHeight - 80, window.innerHeight - 120)}px` 
              : 'calc(80vh - 4rem)'
          }}
        >
          {/* Chat Header */}
          <div className="flex items-center justify-between p-4 md:p-6 border-b border-gray-200 bg-white flex-shrink-0 chat-header-mobile">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-500 p-2 rounded-full">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Assistente Fincla</h3>
                <p className="text-sm text-gray-500">Online - Pronto para ajudar</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Chat Messages */}
          <div 
            className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 md:pb-4"
            style={{
              height: window.innerWidth <= 768 && viewportHeight > 0 
                ? `${viewportHeight - 140}px` 
                : undefined,
              maxHeight: window.innerWidth <= 768 && viewportHeight > 0 
                ? `${viewportHeight - 140}px` 
                : undefined
            }}
          >
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex items-start space-x-3 chat-message ${
                  message.sender === 'user' ? 'justify-end' : ''
                }`}
              >
                {message.sender === 'user' ? (
                  <>
                    <div className="bg-blue-500 rounded-lg p-4 max-w-md text-white">
                      <p className="text-sm whitespace-pre-line">{message.content}</p>
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
                    <div className="bg-gray-100 rounded-lg p-4 max-w-md">
                      <p className="text-sm text-gray-800 whitespace-pre-line">{message.content}</p>
                    </div>
                  </>
                )}
              </div>
            ))}
            
            {isProcessing && (
              <div className="flex items-start space-x-3 chat-message">
                <div className="bg-blue-500 p-2 rounded-full flex-shrink-0">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="bg-gray-100 rounded-lg p-4">
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

          {/* No spacer needed - global input is outside this component */}
        </div>
      </div>
    </div>
  );
}
