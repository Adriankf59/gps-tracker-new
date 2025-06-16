// Directus WebSocket Extension
// Place this in: extensions/endpoints/websocket/index.js

module.exports = {
  id: 'websocket',
  handler: (router, { services, database, getSchema }) => {
    const { ItemsService } = services;
    const WebSocket = require('ws');
    
    // Store WebSocket server instance
    let wss;
    
    // Store connected clients by userId
    const clients = new Map();
    
    // Initialize WebSocket server
    router.get('/websocket', async (req, res) => {
      // Upgrade HTTP connection to WebSocket
      if (!wss) {
        wss = new WebSocket.Server({ noServer: true });
        
        // Handle WebSocket connections
        wss.on('connection', async (ws, request) => {
          // Parse userId from query string
          const url = new URL(request.url, `http://${request.headers.host}`);
          const userId = url.searchParams.get('userId');
          
          if (!userId) {
            ws.send(JSON.stringify({ type: 'error', error: 'userId required' }));
            ws.close();
            return;
          }
          
          // Add client to map
          if (!clients.has(userId)) {
            clients.set(userId, []);
          }
          clients.get(userId).push(ws);
          
          console.log(`WebSocket client connected for user: ${userId}`);
          
          // Send initial data
          try {
            const schema = await getSchema();
            
            // Get vehicles
            const vehiclesService = new ItemsService('vehicle', {
              schema,
              accountability: { role: 'admin' }
            });
            const vehicles = await vehiclesService.readByQuery({
              filter: { user_id: { _eq: userId } },
              limit: -1
            });
            
            // Get vehicle data
            const vehicleDataService = new ItemsService('vehicle_datas', {
              schema,
              accountability: { role: 'admin' }
            });
            
            // Get GPS IDs from vehicles
            const gpsIds = vehicles.map(v => v.gps_id).filter(Boolean);
            
            let vehicleData = [];
            if (gpsIds.length > 0) {
              vehicleData = await vehicleDataService.readByQuery({
                filter: { gps_id: { _in: gpsIds } },
                limit: 1000,
                sort: ['-timestamp']
              });
            }
            
            // Send data to client
            ws.send(JSON.stringify({ type: 'vehicles', data: vehicles }));
            ws.send(JSON.stringify({ type: 'vehicle_data', data: vehicleData }));
            
          } catch (error) {
            console.error('Error loading initial data:', error);
            ws.send(JSON.stringify({ 
              type: 'error', 
              error: 'Failed to load initial data' 
            }));
          }
          
          // Handle messages from client
          ws.on('message', async (message) => {
            try {
              const data = JSON.parse(message);
              
              switch (data.type) {
                case 'ping':
                  ws.send(JSON.stringify({ type: 'pong' }));
                  break;
                  
                case 'refresh':
                  // Resend all data
                  const schema = await getSchema();
                  
                  const vehiclesService = new ItemsService('vehicle', {
                    schema,
                    accountability: { role: 'admin' }
                  });
                  const vehicles = await vehiclesService.readByQuery({
                    filter: { user_id: { _eq: userId } },
                    limit: -1
                  });
                  
                  const vehicleDataService = new ItemsService('vehicle_datas', {
                    schema,
                    accountability: { role: 'admin' }
                  });
                  
                  const gpsIds = vehicles.map(v => v.gps_id).filter(Boolean);
                  let vehicleData = [];
                  
                  if (gpsIds.length > 0) {
                    vehicleData = await vehicleDataService.readByQuery({
                      filter: { gps_id: { _in: gpsIds } },
                      limit: 1000,
                      sort: ['-timestamp']
                    });
                  }
                  
                  ws.send(JSON.stringify({ type: 'vehicles', data: vehicles }));
                  ws.send(JSON.stringify({ type: 'vehicle_data', data: vehicleData }));
                  break;
                  
                case 'subscribe':
                  console.log(`User ${userId} subscribed to updates`);
                  break;
                  
                default:
                  console.log('Unknown message type:', data.type);
              }
            } catch (error) {
              console.error('Error handling message:', error);
              ws.send(JSON.stringify({ 
                type: 'error', 
                error: 'Invalid message format' 
              }));
            }
          });
          
          // Handle disconnect
          ws.on('close', () => {
            const userClients = clients.get(userId) || [];
            const index = userClients.indexOf(ws);
            if (index > -1) {
              userClients.splice(index, 1);
            }
            
            if (userClients.length === 0) {
              clients.delete(userId);
            }
            
            console.log(`WebSocket client disconnected for user: ${userId}`);
          });
          
          // Handle errors
          ws.on('error', (error) => {
            console.error('WebSocket error:', error);
          });
        });
      }
      
      // Handle upgrade
      const server = req.socket.server;
      server.on('upgrade', (request, socket, head) => {
        if (request.url.startsWith('/websocket')) {
          wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit('connection', ws, request);
          });
        }
      });
      
      res.status(426).send('Upgrade required');
    });
    
    // Broadcast function for real-time updates
    const broadcastToUser = (userId, message) => {
      const userClients = clients.get(userId) || [];
      userClients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(message));
        }
      });
    };
    
    // Hook into Directus events for real-time updates
    const { action } = require('@directus/sdk');
    
    // Listen for vehicle data updates
    action('items.create', async ({ payload, key, collection }) => {
      if (collection === 'vehicle_datas') {
        try {
          const schema = await getSchema();
          
          // Get the vehicle to find the user
          const vehicleService = new ItemsService('vehicle', {
            schema,
            accountability: { role: 'admin' }
          });
          
          const vehicles = await vehicleService.readByQuery({
            filter: { gps_id: { _eq: payload.gps_id } },
            limit: 1
          });
          
          if (vehicles.length > 0) {
            const userId = vehicles[0].user_id;
            
            // Broadcast update to user
            broadcastToUser(userId, {
              type: 'vehicle_data',
              data: [payload]
            });
          }
        } catch (error) {
          console.error('Error broadcasting update:', error);
        }
      }
    });
    
    action('items.update', async ({ payload, keys, collection }) => {
      if (collection === 'vehicle_datas') {
        try {
          const schema = await getSchema();
          
          // Get updated records
          const vehicleDataService = new ItemsService('vehicle_datas', {
            schema,
            accountability: { role: 'admin' }
          });
          
          const updatedRecords = await vehicleDataService.readMany(keys);
          
          // Group by user and broadcast
          const userUpdates = new Map();
          
          for (const record of updatedRecords) {
            // Get the vehicle to find the user
            const vehicleService = new ItemsService('vehicle', {
              schema,
              accountability: { role: 'admin' }
            });
            
            const vehicles = await vehicleService.readByQuery({
              filter: { gps_id: { _eq: record.gps_id } },
              limit: 1
            });
            
            if (vehicles.length > 0) {
              const userId = vehicles[0].user_id;
              
              if (!userUpdates.has(userId)) {
                userUpdates.set(userId, []);
              }
              userUpdates.get(userId).push(record);
            }
          }
          
          // Broadcast updates to each user
          userUpdates.forEach((records, userId) => {
            broadcastToUser(userId, {
              type: 'vehicle_data',
              data: records
            });
          });
          
        } catch (error) {
          console.error('Error broadcasting updates:', error);
        }
      }
    });
  }
};