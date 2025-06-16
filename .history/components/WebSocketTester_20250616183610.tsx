import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { WifiOff, Wifi, Send, Trash2, RefreshCw } from 'lucide-react';

// WebSocket Test Component
export function WebSocketTester() {
  const [wsUrl, setWsUrl] = useState('ws://vehitrack.my.id/websocket');
  const [userId, setUserId] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<Array<{type: 'sent' | 'received', data: any, timestamp: Date}>>([]);
  const [customMessage, setCustomMessage] = useState('');
  const wsRef = useRef<WebSocket | null>(null);

  // Get userId from session storage on mount
  useEffect(() => {
    try {
      const userData = JSON.parse(sessionStorage.getItem('user') || '{}');
      const id = userData.id || userData.user_id || '';
      setUserId(id);
    } catch (error) {
      console.error('Failed to get user data:', error);
    }
  }, []);

  // Connect to WebSocket
  const connect = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      disconnect();
      return;
    }

    try {
      const url = userId ? `${wsUrl}?userId=${userId}` : wsUrl;
      console.log('Connecting to:', url);
      
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        addMessage('received', { type: 'system', message: 'Connected to WebSocket' });
        
        // Send subscribe message
        if (userId) {
          const subscribeMsg = { type: 'subscribe', userId };
          ws.send(JSON.stringify(subscribeMsg));
          addMessage('sent', subscribeMsg);
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('Received:', data);
          addMessage('received', data);
        } catch (error) {
          console.error('Failed to parse message:', error);
          addMessage('received', { type: 'error', message: 'Failed to parse message', raw: event.data });
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        addMessage('received', { type: 'error', message: 'WebSocket error occurred' });
      };

      ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        setIsConnected(false);
        wsRef.current = null;
        addMessage('received', { 
          type: 'system', 
          message: `Disconnected (code: ${event.code}, reason: ${event.reason || 'none'})` 
        });
      };

    } catch (error) {
      console.error('Failed to connect:', error);
      addMessage('received', { type: 'error', message: `Failed to connect: ${error}` });
    }
  };

  // Disconnect from WebSocket
  const disconnect = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  };

  // Add message to history
  const addMessage = (type: 'sent' | 'received', data: any) => {
    setMessages(prev => [...prev, { type, data, timestamp: new Date() }]);
  };

  // Send message
  const sendMessage = (message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      addMessage('sent', message);
    } else {
      addMessage('received', { type: 'error', message: 'WebSocket is not connected' });
    }
  };

  // Predefined messages
  const sendPing = () => sendMessage({ type: 'ping' });
  const sendRefresh = () => sendMessage({ type: 'refresh', userId });
  const sendSubscribe = () => sendMessage({ type: 'subscribe', userId });

  // Send custom message
  const sendCustom = () => {
    if (!customMessage.trim()) return;
    
    try {
      const msg = JSON.parse(customMessage);
      sendMessage(msg);
      setCustomMessage('');
    } catch (error) {
      addMessage('received', { type: 'error', message: 'Invalid JSON format' });
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>WebSocket Connection Tester</span>
            <Badge variant={isConnected ? "success" : "secondary"}>
              {isConnected ? (
                <>
                  <Wifi className="w-3 h-3 mr-1" />
                  Connected
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 mr-1" />
                  Disconnected
                </>
              )}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Connection Settings */}
          <div className="space-y-2">
            <label className="text-sm font-medium">WebSocket URL</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={wsUrl}
                onChange={(e) => setWsUrl(e.target.value)}
                className="flex-1 px-3 py-2 border rounded-md"
                placeholder="ws://example.com/websocket"
              />
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-32 px-3 py-2 border rounded-md"
                placeholder="User ID"
              />
              <Button
                onClick={connect}
                variant={isConnected ? "destructive" : "default"}
              >
                {isConnected ? 'Disconnect' : 'Connect'}
              </Button>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Quick Actions</label>
            <div className="flex gap-2 flex-wrap">
              <Button 
                size="sm" 
                variant="outline" 
                onClick={sendPing}
                disabled={!isConnected}
              >
                Send Ping
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={sendRefresh}
                disabled={!isConnected || !userId}
              >
                Send Refresh
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={sendSubscribe}
                disabled={!isConnected || !userId}
              >
                Send Subscribe
              </Button>
            </div>
          </div>

          {/* Custom Message */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Custom Message (JSON)</label>
            <div className="flex gap-2">
              <textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                className="flex-1 px-3 py-2 border rounded-md font-mono text-sm"
                placeholder='{"type": "custom", "data": "test"}'
                rows={3}
              />
              <div className="flex flex-col gap-2">
                <Button 
                  size="sm"
                  onClick={sendCustom}
                  disabled={!isConnected || !customMessage.trim()}
                >
                  <Send className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCustomMessage(JSON.stringify({ type: 'subscribe', userId }, null, 2))}
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Message History */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Message History</label>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setMessages([])}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Clear
              </Button>
            </div>
            <ScrollArea className="h-96 border rounded-md p-2">
              <div className="space-y-2">
                {messages.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No messages yet</p>
                ) : (
                  messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`p-2 rounded-md text-sm ${
                        msg.type === 'sent' 
                          ? 'bg-blue-50 ml-8' 
                          : 'bg-gray-50 mr-8'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-xs">
                          {msg.type === 'sent' ? '→ Sent' : '← Received'}
                        </span>
                        <span className="text-xs text-gray-500">
                          {msg.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                      <pre className="text-xs overflow-x-auto whitespace-pre-wrap">
                        {JSON.stringify(msg.data, null, 2)}
                      </pre>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}