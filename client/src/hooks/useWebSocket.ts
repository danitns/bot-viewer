import { useState, useEffect, useRef, useCallback } from 'react';

export type ProcessStatus = {
    current: string | null;
    progress: number,
    message: string,
    error: string | null,
    timestamp: string | null
}

export const useWebSocket = (url: string | URL) => {
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const [processStatus, setProcessStatus] = useState<ProcessStatus>({
    current: null,
    progress: 0,
    message: '',
    error: null,
    timestamp: null
  });
  
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeoutId = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    try {
      ws.current = new WebSocket(url);
      
      ws.current.onopen = () => {
        console.log('WebSocket connected');
        setConnectionStatus('Connected');
        reconnectAttempts.current = 0;
      };

      ws.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'progress') {
            setProcessStatus({
              current: data.process,
              progress: data.progress,
              message: data.message,
              error: data.error || null,
              timestamp: data.timestamp
            });
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.current.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        setConnectionStatus('Disconnected');
        
        // Attempt to reconnect
        if (reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;
          const timeout = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 10000);
          
          console.log(`Attempting to reconnect in ${timeout}ms (attempt ${reconnectAttempts.current})`);
          setConnectionStatus(`Reconnecting in ${timeout/1000}s...`);
          
          reconnectTimeoutId.current = setTimeout(() => {
            connect();
          }, timeout);
        } else {
          setConnectionStatus('Failed to connect');
        }
      };

      ws.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionStatus('Error');
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setConnectionStatus('Failed to connect');
    }
  }, [url]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutId.current) {
      clearTimeout(reconnectTimeoutId.current);
    }
    
    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }
    
    setConnectionStatus('Disconnected');
    reconnectAttempts.current = 0;
  }, []);

  const sendMessage = useCallback((message: string) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    }
  }, []);

  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    connectionStatus,
    processStatus,
    sendMessage,
    connect,
    disconnect
  };
};