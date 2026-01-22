import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Custom hook for WebSocket connection to auction updates
 * Provides real-time bid updates, auction status, and viewer count
 */
export function useAuctionWebSocket(auctionId = null) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const [auctionData, setAuctionData] = useState(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [bidNotification, setBidNotification] = useState(null);
  
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  // Build WebSocket URL
  const getWsUrl = useCallback(() => {
    const backendUrl = process.env.REACT_APP_BACKEND_URL || '';
    // Convert http(s) to ws(s)
    const wsProtocol = backendUrl.startsWith('https') ? 'wss' : 'ws';
    const wsHost = backendUrl.replace(/^https?:\/\//, '');
    
    // Use /api/ws/ prefix to ensure routing through ingress
    if (auctionId) {
      return `${wsProtocol}://${wsHost}/api/ws/auction/${auctionId}`;
    }
    return `${wsProtocol}://${wsHost}/api/ws/auctions`;
  }, [auctionId]);

  // Handle incoming messages
  const handleMessage = useCallback((event) => {
    try {
      const message = JSON.parse(event.data);
      setLastMessage(message);

      switch (message.type) {
        case 'auction_state':
          setAuctionData(message.data);
          setViewerCount(message.data?.viewers || 0);
          break;
          
        case 'auctions_state':
          setAuctionData(message.data);
          setViewerCount(message.viewers || 0);
          break;
          
        case 'bid_update':
          // Update auction data with new bid info
          setAuctionData(prev => {
            if (!prev) return message.data;
            
            // For single auction view
            if (!Array.isArray(prev)) {
              return {
                ...prev,
                current_price: message.data.current_price,
                end_time: message.data.end_time,
                last_bidder_name: message.data.last_bidder_name,
                total_bids: message.data.total_bids
              };
            }
            
            // For auctions list view
            return prev.map(auction => 
              auction.id === message.auction_id
                ? {
                    ...auction,
                    current_price: message.data.current_price,
                    end_time: message.data.end_time,
                    last_bidder_name: message.data.last_bidder_name,
                    total_bids: message.data.total_bids
                  }
                : auction
            );
          });
          
          // Show bid notification
          setBidNotification({
            message: message.data.bidder_message || 'Neues Gebot!',
            price: message.data.current_price,
            timestamp: message.timestamp
          });
          
          // Clear notification after 3 seconds
          setTimeout(() => setBidNotification(null), 3000);
          break;
          
        case 'auction_ended':
          setAuctionData(prev => {
            if (!prev) return null;
            
            if (!Array.isArray(prev)) {
              return {
                ...prev,
                status: 'ended',
                winner_name: message.data.winner_name,
                final_price: message.data.final_price
              };
            }
            
            return prev.map(auction =>
              auction.id === message.auction_id
                ? { ...auction, status: 'ended' }
                : auction
            );
          });
          break;
        
        case 'auction_restarted':
          // Handle auction restart - update with new data
          setAuctionData(prev => {
            if (!prev) return message.data;
            
            // For single auction view
            if (!Array.isArray(prev)) {
              if (prev.id === message.auction_id) {
                return {
                  ...prev,
                  status: message.data.status || 'active',
                  current_price: message.data.current_price,
                  end_time: message.data.end_time,
                  total_bids: message.data.total_bids || 0,
                  last_bidder_name: message.data.last_bidder_name
                };
              }
              return prev;
            }
            
            // For auctions list view
            return prev.map(auction =>
              auction.id === message.auction_id
                ? {
                    ...auction,
                    status: message.data.status || 'active',
                    current_price: message.data.current_price,
                    end_time: message.data.end_time,
                    total_bids: message.data.total_bids || 0,
                    last_bidder_name: message.data.last_bidder_name
                  }
                : auction
            );
          });
          break;
          
        case 'heartbeat':
        case 'pong':
          // Connection is alive
          break;
          
        default:
          console.log('Unknown WebSocket message type:', message.type);
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }, []);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const wsUrl = getWsUrl();
    console.log('Connecting to WebSocket:', wsUrl);
    
    try {
      wsRef.current = new WebSocket(wsUrl);
      
      wsRef.current.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        reconnectAttempts.current = 0;
      };
      
      wsRef.current.onmessage = handleMessage;
      
      wsRef.current.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        setIsConnected(false);
        
        // Attempt reconnect if not intentionally closed
        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          console.log(`Reconnecting in ${delay}ms...`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            connect();
          }, delay);
        }
      };
      
      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
      
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
    }
  }, [getWsUrl, handleMessage]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    if (wsRef.current) {
      wsRef.current.close(1000, 'Client disconnect');
      wsRef.current = null;
    }
    
    setIsConnected(false);
    reconnectAttempts.current = maxReconnectAttempts; // Prevent reconnect
  }, []);

  // Send ping to keep connection alive
  const sendPing = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'ping' }));
    }
  }, []);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    connect();
    
    // Set up ping interval
    const pingInterval = setInterval(sendPing, 25000);
    
    return () => {
      clearInterval(pingInterval);
      disconnect();
    };
  }, [connect, disconnect, sendPing]);

  // Reconnect when auctionId changes
  useEffect(() => {
    if (auctionId) {
      disconnect();
      reconnectAttempts.current = 0;
      connect();
    }
  }, [auctionId, connect, disconnect]);

  return {
    isConnected,
    lastMessage,
    auctionData,
    viewerCount,
    bidNotification,
    reconnect: connect,
    disconnect
  };
}

export default useAuctionWebSocket;
