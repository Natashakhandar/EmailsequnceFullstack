// Socket.io service for real-time campaign stats updates
// Note: This requires socket.io to be installed: npm install socket.io

let io = null;

/**
 * Initialize Socket.io server
 * @param {Object} server - HTTP server instance
 */
function initializeSocket(server) {
  const { Server } = require('socket.io');

  io = new Server(server, {
    cors: {
      origin: [
        'http://localhost:3000',
        'http://localhost:8080',
        'http://localhost:5173',
        'http://localhost:8081',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:8080',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:8081',
        'https://email.boostnow.in',
        'https://www.email.boostnow.in'
      ],
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    console.log('📡 Client connected to socket:', socket.id);

    // Join campaign-specific rooms
    socket.on('joinCampaign', (campaignId) => {
      socket.join(`campaign_${campaignId}`);
      console.log(`Client ${socket.id} joined campaign room: campaign_${campaignId}`);
    });

    // Leave campaign-specific rooms
    socket.on('leaveCampaign', (campaignId) => {
      socket.leave(`campaign_${campaignId}`);
      console.log(`Client ${socket.id} left campaign room: campaign_${campaignId}`);
    });

    // Join general stats room
    socket.on('joinStats', () => {
      socket.join('general_stats');
      console.log(`Client ${socket.id} joined general stats room`);
    });

    socket.on('disconnect', () => {
      console.log('📡 Client disconnected:', socket.id);
    });
  });

  console.log('✅ Socket.io server initialized');
}

/**
 * Broadcast campaign stats update to specific campaign room
 * @param {string} campaignId - Campaign ID
 * @param {Object} stats - Updated campaign statistics
 */
function broadcastCampaignStats(campaignId, stats) {
  if (!io) {
    console.log('⚠️ Socket.io not initialized. Campaign stats not broadcasted.');
    return;
  }

  const updateData = {
    campaignId,
    stats,
    timestamp: new Date().toISOString(),
    type: 'campaignStatsUpdate'
  };

  // Broadcast to campaign-specific room
  io.to(`campaign_${campaignId}`).emit('campaignStatsUpdate', updateData);

  // Also broadcast to general stats room
  io.to('general_stats').emit('campaignStatsUpdate', updateData);

  console.log(`📡 Broadcasted campaign stats update for campaign ${campaignId}:`, {
    totalSent: stats.emails?.sent || 0,
    openRate: stats.rates?.openRate || 0,
    replyRate: stats.rates?.replyRate || 0
  });
}

/**
 * Broadcast general analytics update
 * @param {Object} analytics - Updated analytics data
 */
function broadcastGeneralStats(analytics) {
  if (!io) {
    console.log('⚠️ Socket.io not initialized. General stats not broadcasted.');
    return;
  }

  const updateData = {
    analytics,
    timestamp: new Date().toISOString(),
    type: 'generalStatsUpdate'
  };

  io.to('general_stats').emit('generalStatsUpdate', updateData);

  console.log('📡 Broadcasted general stats update:', {
    totalCampaigns: analytics.totalCampaigns || 0,
    totalLeads: analytics.totalLeads || 0,
    avgResponseRate: analytics.avgResponseRate || 0
  });
}

/**
 * Broadcast real-time event (email sent, opened, replied, etc.)
 * @param {Object} event - Event data
 */
function broadcastRealTimeEvent(event) {
  if (!io) {
    console.log('⚠️ Socket.io not initialized. Real-time event not broadcasted.');
    return;
  }

  const eventData = {
    event,
    timestamp: new Date().toISOString(),
    type: 'realTimeEvent'
  };

  // Broadcast to all connected clients
  io.emit('realTimeEvent', eventData);

  // If event has campaignId, also broadcast to campaign-specific room
  if (event.campaignId) {
    io.to(`campaign_${event.campaignId}`).emit('campaignRealTimeEvent', eventData);
  }

  console.log(`📡 Broadcasted real-time event: ${event.type} for campaign ${event.campaignId || 'N/A'}`);
}

/**
 * Get connected clients count
 */
function getConnectedClientsCount() {
  if (!io) return 0;
  return io.engine.clientsCount || 0;
}

/**
 * Get socket.io instance
 */
function getSocketInstance() {
  return io;
}

module.exports = {
  initializeSocket,
  broadcastCampaignStats,
  broadcastGeneralStats,
  broadcastRealTimeEvent,
  getConnectedClientsCount,
  getSocketInstance
};
