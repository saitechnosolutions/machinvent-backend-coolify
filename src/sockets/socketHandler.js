// const User = require('../models/userModel');
// const Call = require('../models/calls');

// // Map to track userId -> socket
// const userSocketMap = new Map();
// // Track per-call timeout timers so we can cancel them when a call is answered/rejected/cancelled
// const callTimeouts = new Map();

// function socketHandler(io) {
//   io.on('connection', (socket) => {
//     const userId = socket.handshake.query.userId;
//     console.log('🟢 Socket connected:', socket.id, 'from user:', userId);

//     if (userId) {
//       socket.userId = userId;

//       // Clean up any existing socket for the same user
//       const existingSocket = userSocketMap.get(userId);
//       if (existingSocket && existingSocket.id !== socket.id) {
//         existingSocket.disconnect();
//         console.log(`♻️ Disconnected old socket for user ${userId}`);
//       }

//       userSocketMap.set(String(userId), socket);

//       // Update user online status
//       User.update({ isOnline: true }, { where: { id: userId } })
//         .then(() => {
//           io.emit('presence_update', { userId, isOnline: true });
//           console.log(`✅ User ${userId} is online`);
//         })
//         .catch((err) => console.error('Error updating user online:', err));
//     }

//     // 📞 Initiate a call
//     socket.on('call_user', async (data) => {
//       console.log(`🔴 [SERVER] call_user received:`, data);
//       console.log(`🔴 [SERVER] Socket ID: ${socket.id}`);
//       console.log(`🔴 [SERVER] User ID: ${userId}`);
//       console.log(`🔴 [SERVER] Connected users:`, Array.from(userSocketMap.keys()));
      
//       const { fromUserId, toUserId, channelName, callType } = data;

//       // Prevent calling self
//       if (fromUserId === toUserId) {
//         console.log(`❌ [SERVER] User trying to call themselves: ${fromUserId}`);
//         return socket.emit('error', { message: 'Cannot call yourself' });
//       }

//       // Check if callee is online
//       const calleeSocket = userSocketMap.get(String(toUserId));
//       if (!calleeSocket) {
//         console.log(`❌ [SERVER] Callee ${toUserId} not online`);
//         return socket.emit('error', { message: 'User is offline' });
//       }

//       console.log(`✅ [SERVER] Callee ${toUserId} is online, creating call record...`);

//       // Create call record
//       const call = await Call.create({
//         fromUserId,
//         toUserId,
//         channelName,
//         callType,
//         status: 'missed', // waiting for response
//       });

//       console.log(`✅ [SERVER] Call record created with ID: ${call.id}`);

//       // Store callId on socket for reference (optional)
//       socket.currentCallId = call.id;

//       // Send call ID back to the caller
//       socket.emit('call_created', { callId: call.id });
//       console.log(`📤 [SERVER] Sent call_created event to caller ${fromUserId} with callId: ${call.id}`);
//       console.log(`📤 [SERVER] Caller socket ID: ${socket.id}`);
//       console.log(`📤 [SERVER] Caller socket connected: ${socket.connected}`);

//       // Setup an auto-timeout if the call isn't answered in time
//       try {
//         const TIMEOUT_MS = 30000; // 30s timeout for unanswered calls
//         const timeoutRef = setTimeout(async () => {
//           try {
//             const staleCall = await Call.findByPk(call.id);
//             if (!staleCall) return;
//             // If still pending (missed), notify both parties and keep status as 'missed'
//             if (staleCall.status === 'missed') {
//               const callerSocket = userSocketMap.get(String(fromUserId));
//               const calleeSocketTimeout = userSocketMap.get(String(toUserId));
//               if (callerSocket) {
//                 callerSocket.emit('call_timeout', { callId: call.id });
//               }
//               if (calleeSocketTimeout) {
//                 calleeSocketTimeout.emit('call_timeout', { callId: call.id });
//               }
//               console.log(`⏱️ [SERVER] Call ${call.id} timed out (no answer)`);
//             }
//           } catch (timeoutErr) {
//             console.error('❌ [SERVER] Error processing call timeout:', timeoutErr);
//           } finally {
//             // Timeout finished for this call; clear timeout tracking and any socket pointers
//             callTimeouts.delete(call.id);
//             const callerSocket = userSocketMap.get(String(fromUserId));
//             const calleeSocket = userSocketMap.get(String(toUserId));
//             if (callerSocket?.currentCallId === call.id) callerSocket.currentCallId = null;
//             if (calleeSocket?.currentCallId === call.id) calleeSocket.currentCallId = null;
//           }
//         }, TIMEOUT_MS);
//         callTimeouts.set(call.id, timeoutRef);
//       } catch (e) {
//         console.error('❌ [SERVER] Failed to schedule call timeout:', e);
//       }

//       // Fetch caller info
//       try {
//         const caller = await User.findByPk(fromUserId);
//         const callerName = caller ? caller.name : 'Unknown';
//         const avatarUrl = caller ? caller.photo : '';

//         console.log(`📞 [SERVER] Caller info - Name: ${callerName}, Photo: ${avatarUrl}`);

//         // Notify callee
//         calleeSocket.emit('incoming_call', {
//           fromUserId,
//           toUserId,
//           channelName,
//           callType,
//           callId: call.id,
//           callerName,
//           avatarUrl,
//         });

//         console.log(`✅ [SERVER] Sent incoming_call to user ${toUserId}`);
//       } catch (err) {
//         console.error('❌ [SERVER] Error fetching caller info:', err);
//         calleeSocket.emit('incoming_call', {
//           fromUserId,
//           toUserId,
//           channelName,
//           callType,
//           callId: call.id,
//           callerName: 'Unknown',
//           avatarUrl: '',
//         });
//       }
//     });

//     // ✅ Accept call
//     socket.on('accept_call', async ({ callId, fromUserId, toUserId, channelName }) => {
//       console.log('🔴 RECEIVED accept_call:', { callId, fromUserId, toUserId, channelName });

//       const call = await Call.findByPk(callId);
//       if (!call) {
//         return console.log(`Call ${callId} not found`);
//       }

//       // Prevent accepting already-ended/rejected calls
//       if (call.status !== 'missed') {
//         return console.log(`Call ${callId} cannot be accepted (status: ${call.status})`);
//       }

//       // Clear any pending timeout for this call
//       const t = callTimeouts.get(callId);
//       if (t) {
//         clearTimeout(t);
//         callTimeouts.delete(callId);
//       }

//       const callerSocket = userSocketMap.get(String(fromUserId));
//       if (callerSocket) {
//         callerSocket.emit('call_accepted', { channelName, by: toUserId, callId });
//       }

//       await call.update({
//         status: 'accepted',
//         startedAt: new Date(),
//       });

//       console.log(`📞 Call ${callId} accepted by user ${toUserId}`);
//     });

//     // ❌ Reject call
//     socket.on('reject_call', async ({ callId, fromUserId, toUserId }) => {
//       console.log('🔴 RECEIVED reject_call:', { callId, fromUserId, toUserId });

//       const call = await Call.findByPk(callId);
//       if (!call || call.status !== 'missed') {
//         return console.log(`Call ${callId} cannot be rejected (not pending)`);
//       }

//       // Clear any pending timeout for this call
//       const t = callTimeouts.get(callId);
//       if (t) {
//         clearTimeout(t);
//         callTimeouts.delete(callId);
//       }

//       const callerSocket = userSocketMap.get(String(fromUserId));
//       if (callerSocket) {
//         console.log(`📤 [SERVER] Sending reject_call event to caller ${fromUserId}`);
//         callerSocket.emit('reject_call', { by: toUserId, callId });
//       } else {
//         console.log(`❌ [SERVER] Caller ${fromUserId} not found in socket map`);
//       }

//       await call.update({ status: 'rejected' });
//       console.log(`📞 Call ${callId} rejected by user ${toUserId}`);
//     });

//     // 🚫 Cancel call (before answer)
//     socket.on('cancel_call', async ({ callId, fromUserId, toUserId }) => {
//       console.log('🔴 RECEIVED cancel_call:', { callId, fromUserId, toUserId });
      
//       const call = await Call.findByPk(callId);
//       if (!call || !['missed'].includes(call.status)) {
//         return console.log(`Call ${callId} cannot be cancelled (status: ${call.status})`);
//       }

//       // Clear any pending timeout for this call
//       const t = callTimeouts.get(callId);
//       if (t) {
//         clearTimeout(t);
//         callTimeouts.delete(callId);
//       }

//       const calleeSocket = userSocketMap.get(String(toUserId));
//       if (calleeSocket) {
//         calleeSocket.emit('cancel_call', { by: fromUserId, callId });
//       }

//       await call.update({ status: 'cancelled' });
//       console.log(`📞 Call ${callId} cancelled by caller ${fromUserId}`);

//       // Clear currentCallId from socket
//       if (socket.currentCallId === callId) {
//         socket.currentCallId = null;
//       }
//     });

//     // 🛑 End call (after accepted)
//     socket.on('end_call', async ({ callId, fromUserId }) => {
//       console.log('🔴 RECEIVED end_call:', { callId, fromUserId, socketId: socket.id });

//       const call = await Call.findByPk(callId);
//       if (!call) {
//         console.log(`❌ [SERVER] Call ${callId} not found in database`);
//         return;
//       }

//       // Prevent double-ending or ending invalid states
//       if (['ended', 'rejected', 'cancelled'].includes(call.status)) {
//         console.log(`❌ [SERVER] Call ${callId} already ended or invalid (status: ${call.status})`);
//         return;
//       }

//       // Clear any pending timeout for this call
//       const t = callTimeouts.get(callId);
//       if (t) {
//         clearTimeout(t);
//         callTimeouts.delete(callId);
//       }

//       const endedAt = new Date();
//       let duration = 0;

//       if (call.startedAt) {
//         duration = Math.floor((endedAt - new Date(call.startedAt)) / 1000);
//       }

//       await call.update({
//         status: 'ended',
//         endedAt,
//         duration,
//       });

//       console.log(`📞 [SERVER] Call ${callId} ended, duration: ${duration}s`);

//       // Notify the other user
//       const otherUserId = fromUserId === call.fromUserId ? call.toUserId : call.fromUserId;
//       const otherUserSocket = userSocketMap.get(String(otherUserId));

//       if (otherUserSocket) {
//         console.log(`📤 [SERVER] Sending end_call event to user ${otherUserId}`);
//         otherUserSocket.emit('end_call', { callId, fromUserId });
//       } else {
//         console.log(`❌ [SERVER] No socket found for user: ${otherUserId}`);
//       }

//       // Clean up
//       if (socket.currentCallId === callId) {
//         socket.currentCallId = null;
//       }
//     });

//     // 🛑 End call by channel (fallback when call ID is not available)
//     socket.on('end_call_by_channel', async ({ channelName, fromUserId }) => {
//       console.log('🔴 RECEIVED end_call_by_channel:', { channelName, fromUserId, socketId: socket.id });

//       // Find call by channel name
//       const call = await Call.findOne({
//         where: { 
//           channelName: channelName,
//           status: ['accepted', 'missed'] // Only active calls
//         }
//       });

//       if (!call) {
//         console.log(`❌ [SERVER] Call with channel ${channelName} not found in database`);
//         return;
//       }

//       console.log(`📞 [SERVER] Found call ${call.id} for channel ${channelName}`);

//       // Prevent double-ending or ending invalid states
//       if (['ended', 'rejected', 'cancelled'].includes(call.status)) {
//         console.log(`❌ [SERVER] Call ${call.id} already ended or invalid (status: ${call.status})`);
//         return;
//       }

//       // Clear any pending timeout for this call
//       const t = callTimeouts.get(call.id);
//       if (t) {
//         clearTimeout(t);
//         callTimeouts.delete(call.id);
//       }

//       const endedAt = new Date();
//       let duration = 0;

//       if (call.startedAt) {
//         duration = Math.floor((endedAt - new Date(call.startedAt)) / 1000);
//       }

//       await call.update({
//         status: 'ended',
//         endedAt,
//         duration,
//       });

//       console.log(`📞 [SERVER] Call ${call.id} ended by channel, duration: ${duration}s`);

//       // Notify the other user
//       const otherUserId = fromUserId === call.fromUserId ? call.toUserId : call.fromUserId;
//       const otherUserSocket = userSocketMap.get(String(otherUserId));

//       if (otherUserSocket) {
//         console.log(`📤 [SERVER] Sending end_call event to user ${otherUserId}`);
//         otherUserSocket.emit('end_call', { callId: call.id, fromUserId });
//       } else {
//         console.log(`❌ [SERVER] No socket found for user: ${otherUserId}`);
//       }

//       // Clean up
//       if (socket.currentCallId === call.id) {
//         socket.currentCallId = null;
//       }
//     });

//     // 🔌 Socket disconnect
//     socket.on('disconnect', async () => {
//       const userId = socket.userId;
//       const currentSocket = userSocketMap.get(userId);

//       if (currentSocket?.id === socket.id) {
//         userSocketMap.delete(userId);
//         console.log(`🔴 User ${userId} disconnected`);

//         // Mark user offline
//         await User.update(
//           { isOnline: false, lastSeen: new Date() },
//           { where: { id: userId } }
//         );
//         io.emit('presence_update', { userId, isOnline: false });
//       }

//       // Optional: Auto-cancel ongoing call if user disconnects mid-call
//       if (socket.currentCallId) {
//         const call = await Call.findByPk(socket.currentCallId);
//         if (call && call.status === 'missed') {
//           // Only auto-cancel if the call is still actively ringing (timeout pending)
//           const t = callTimeouts.get(call.id);
//           if (t) {
//             clearTimeout(t);
//             callTimeouts.delete(call.id);

//             const otherUserId = userId === call.fromUserId ? call.toUserId : call.fromUserId;
//             const otherUserSocket = userSocketMap.get(String(otherUserId));

//             if (otherUserSocket) {
//               otherUserSocket.emit('cancel_call', { by: userId, callId: socket.currentCallId });
//             }

//             await call.update({ status: 'cancelled' });
//             console.log(`📞 Call ${socket.currentCallId} auto-cancelled due to disconnection`);
//           } else {
//             // Timeout already processed; do not flip missed to cancelled
//             console.log(`ℹ️ [SERVER] Disconnect after timeout for call ${call.id}; leaving status 'missed'`);
//           }
//         }
//         // Always clear the pointer on this socket to avoid future side-effects
//         socket.currentCallId = null;
//       }
//     });
//   });
// }

// module.exports = socketHandler;

const User = require('../models/userModel');
const Call = require('../models/calls');
const { Wallet, CallRates } = require('../models');

// Map to track userId -> socket
const userSocketMap = new Map();
// Track per-call timeout timers so we can cancel them when a call is answered/rejected/cancelled
const callTimeouts = new Map();

function socketHandler(io) {
  io.on('connection', (socket) => {
    const userId = socket.handshake.query.userId;
    console.log('🟢 Socket connected:', socket.id, 'from user:', userId);

    if (userId) {
      socket.userId = userId;

      // Clean up any existing socket for the same user
      const existingSocket = userSocketMap.get(userId);
      if (existingSocket && existingSocket.id !== socket.id) {
        existingSocket.disconnect();
        console.log(`♻️ Disconnected old socket for user ${userId}`);
      }

      userSocketMap.set(String(userId), socket);

      // Update user online status
      User.update({ isOnline: true }, { where: { id: userId } })
        .then(() => {
          io.emit('presence_update', { userId, isOnline: true });
          console.log(`✅ User ${userId} is online`);
        })
        .catch((err) => console.error('Error updating user online:', err));
    }

    // 📞 Initiate a call
    socket.on('call_user', async (data) => {
      console.log(`🔴 [SERVER] call_user received:`, data);
      console.log(`🔴 [SERVER] Socket ID: ${socket.id}`);
      console.log(`🔴 [SERVER] User ID: ${userId}`);
      console.log(`🔴 [SERVER] Connected users:`, Array.from(userSocketMap.keys()));
      
      const { fromUserId, toUserId, channelName, callType } = data;

      // Prevent calling self
      if (fromUserId === toUserId) {
        console.log(`❌ [SERVER] User trying to call themselves: ${fromUserId}`);
        return socket.emit('error', { message: 'Cannot call yourself' });
      }

      // Check if callee is online
      const calleeSocket = userSocketMap.get(String(toUserId));
      if (!calleeSocket) {
        console.log(`❌ [SERVER] Callee ${toUserId} not online`);
        return socket.emit('error', { message: 'User is offline' });
      }

      console.log(`✅ [SERVER] Callee ${toUserId} is online, creating call record...`);

      // Create call record
      const call = await Call.create({
        fromUserId,
        toUserId,
        channelName,
        callType,
        status: 'missed', // waiting for response
      });

      console.log(`✅ [SERVER] Call record created with ID: ${call.id}`);

      // Store callId on socket for reference (optional)
      socket.currentCallId = call.id;

      // Send call ID back to the caller
      socket.emit('call_created', { callId: call.id });
      console.log(`📤 [SERVER] Sent call_created event to caller ${fromUserId} with callId: ${call.id}`);
      console.log(`📤 [SERVER] Caller socket ID: ${socket.id}`);
      console.log(`📤 [SERVER] Caller socket connected: ${socket.connected}`);

      // Setup an auto-timeout if the call isn't answered in time
      try {
        const TIMEOUT_MS = 30000; // 30s timeout for unanswered calls
        const timeoutRef = setTimeout(async () => {
          try {
            const staleCall = await Call.findByPk(call.id);
            if (!staleCall) return;
            // If still pending (missed), notify both parties and keep status as 'missed'
            if (staleCall.status === 'missed') {
              const callerSocket = userSocketMap.get(String(fromUserId));
              const calleeSocketTimeout = userSocketMap.get(String(toUserId));
              if (callerSocket) {
                callerSocket.emit('call_timeout', { callId: call.id });
              }
              if (calleeSocketTimeout) {
                calleeSocketTimeout.emit('call_timeout', { callId: call.id });
              }
              console.log(`⏱️ [SERVER] Call ${call.id} timed out (no answer)`);
            }
          } catch (timeoutErr) {
            console.error('❌ [SERVER] Error processing call timeout:', timeoutErr);
          } finally {
            // Timeout finished for this call; clear timeout tracking and any socket pointers
            callTimeouts.delete(call.id);
            const callerSocket = userSocketMap.get(String(fromUserId));
            const calleeSocket = userSocketMap.get(String(toUserId));
            if (callerSocket?.currentCallId === call.id) callerSocket.currentCallId = null;
            if (calleeSocket?.currentCallId === call.id) calleeSocket.currentCallId = null;
          }
        }, TIMEOUT_MS);
        callTimeouts.set(call.id, timeoutRef);
      } catch (e) {
        console.error('❌ [SERVER] Failed to schedule call timeout:', e);
      }

      // Fetch caller info
      try {
        const caller = await User.findByPk(fromUserId);
        const callerName = caller ? caller.name : 'Unknown';
        const avatarUrl = caller ? caller.photo : '';

        console.log(`📞 [SERVER] Caller info - Name: ${callerName}, Photo: ${avatarUrl}`);

        // Notify callee
        calleeSocket.emit('incoming_call', {
          fromUserId,
          toUserId,
          channelName,
          callType,
          callId: call.id,
          callerName,
          avatarUrl,
        });

        console.log(`✅ [SERVER] Sent incoming_call to user ${toUserId}`);
      } catch (err) {
        console.error('❌ [SERVER] Error fetching caller info:', err);
        calleeSocket.emit('incoming_call', {
          fromUserId,
          toUserId,
          channelName,
          callType,
          callId: call.id,
          callerName: 'Unknown',
          avatarUrl: '',
        });
      }
    });

    // ✅ Accept call
    socket.on('accept_call', async ({ callId, fromUserId, toUserId, channelName }) => {
      console.log('🔴 RECEIVED accept_call:', { callId, fromUserId, toUserId, channelName });

      const call = await Call.findByPk(callId);
      if (!call) {
        return console.log(`Call ${callId} not found`);
      }

      // Prevent accepting already-ended/rejected calls
      if (call.status !== 'missed') {
        return console.log(`Call ${callId} cannot be accepted (status: ${call.status})`);
      }

      // Clear any pending timeout for this call
      const t = callTimeouts.get(callId);
      if (t) {
        clearTimeout(t);
        callTimeouts.delete(callId);
      }

      const callerSocket = userSocketMap.get(String(fromUserId));
      if (callerSocket) {
        callerSocket.emit('call_accepted', { channelName, by: toUserId, callId });
      }

      await call.update({
        status: 'accepted',
        startedAt: new Date(),
      });

      console.log(`📞 Call ${callId} accepted by user ${toUserId}`);

      // Server-side duration cap & notify max duration to caller
      try {
        const wallet = await Wallet.findOne({ where: { userId: fromUserId } });
        const rateRow = await CallRates.findOne({ where: { type: call.callType } });
        const ratePerMinute = rateRow ? rateRow.rate : (call.callType === 'audio' ? 20 : 25);
        const balance = wallet ? parseFloat(wallet.balance) : 0;
        const maxDurationSeconds = ratePerMinute > 0 ? Math.floor((balance / ratePerMinute) * 60) : 0;

        // Notify both parties of maxDuration (frontend can auto-end)
        const callerSocket = userSocketMap.get(String(fromUserId));
        const calleeSocketAfter = userSocketMap.get(String(toUserId));
        if (callerSocket) callerSocket.emit('call_budget', { callId, maxDurationSeconds, ratePerMinute });
        if (calleeSocketAfter) calleeSocketAfter.emit('call_budget', { callId, maxDurationSeconds, ratePerMinute });

        if (maxDurationSeconds > 0) {
          const budgetTimer = setTimeout(async () => {
            try {
              const active = await Call.findByPk(callId);
              if (!active || active.status !== 'accepted') return;

              const endedAt = new Date();
              let duration = 0;
              if (active.startedAt) {
                duration = Math.floor((endedAt - new Date(active.startedAt)) / 1000);
              }

              await active.update({ status: 'ended', endedAt, duration });

              const otherUserId = fromUserId === active.fromUserId ? active.toUserId : active.fromUserId;
              const otherUserSocket = userSocketMap.get(String(otherUserId));
              if (otherUserSocket) otherUserSocket.emit('end_call', { callId, fromUserId });
              if (callerSocket) callerSocket.emit('end_call', { callId, fromUserId });
            } catch (err) {
              console.error('❌ [SERVER] Error auto-ending call on budget cap:', err);
            }
          }, maxDurationSeconds * 1000);

          callTimeouts.set(`budget_${callId}`, budgetTimer);
        }
      } catch (e) {
        console.error('❌ [SERVER] Failed to compute/emit call budget:', e);
      }
    });

    // ❌ Reject call
    socket.on('reject_call', async ({ callId, fromUserId, toUserId }) => {
      console.log('🔴 RECEIVED reject_call:', { callId, fromUserId, toUserId });

      const call = await Call.findByPk(callId);
      if (!call || call.status !== 'missed') {
        return console.log(`Call ${callId} cannot be rejected (not pending)`);
      }

      // Clear any pending timeout for this call
      const t = callTimeouts.get(callId);
      if (t) {
        clearTimeout(t);
        callTimeouts.delete(callId);
      }
      const bt = callTimeouts.get(`budget_${callId}`);
      if (bt) {
        clearTimeout(bt);
        callTimeouts.delete(`budget_${callId}`);
      }

      const callerSocket = userSocketMap.get(String(fromUserId));
      if (callerSocket) {
        console.log(`📤 [SERVER] Sending reject_call event to caller ${fromUserId}`);
        callerSocket.emit('reject_call', { by: toUserId, callId });
      } else {
        console.log(`❌ [SERVER] Caller ${fromUserId} not found in socket map`);
      }

      await call.update({ status: 'rejected' });
      console.log(`📞 Call ${callId} rejected by user ${toUserId}`);
    });

    // 🚫 Cancel call (before answer)
    socket.on('cancel_call', async ({ callId, fromUserId, toUserId }) => {
      console.log('🔴 RECEIVED cancel_call:', { callId, fromUserId, toUserId });
      
      const call = await Call.findByPk(callId);
      if (!call || !['missed'].includes(call.status)) {
        return console.log(`Call ${callId} cannot be cancelled (status: ${call.status})`);
      }

      // Clear any pending timeout for this call
      const t = callTimeouts.get(callId);
      if (t) {
        clearTimeout(t);
        callTimeouts.delete(callId);
      }

      const calleeSocket = userSocketMap.get(String(toUserId));
      if (calleeSocket) {
        calleeSocket.emit('cancel_call', { by: fromUserId, callId });
      }

      await call.update({ status: 'cancelled' });
      console.log(`📞 Call ${callId} cancelled by caller ${fromUserId}`);

      // Clear currentCallId from socket
      if (socket.currentCallId === callId) {
        socket.currentCallId = null;
      }
    });

    // 🛑 End call (after accepted)
    socket.on('end_call', async ({ callId, fromUserId }) => {
      console.log('🔴 RECEIVED end_call:', { callId, fromUserId, socketId: socket.id });

      const call = await Call.findByPk(callId);
      if (!call) {
        console.log(`❌ [SERVER] Call ${callId} not found in database`);
        return;
      }

      // Prevent double-ending or ending invalid states
      if (['ended', 'rejected', 'cancelled'].includes(call.status)) {
        console.log(`❌ [SERVER] Call ${callId} already ended or invalid (status: ${call.status})`);
        return;
      }

      // Clear any pending timeout for this call
      const t = callTimeouts.get(callId);
      if (t) {
        clearTimeout(t);
        callTimeouts.delete(callId);
      }

      const endedAt = new Date();
      let duration = 0;

      if (call.startedAt) {
        duration = Math.floor((endedAt - new Date(call.startedAt)) / 1000);
      }

      await call.update({
        status: 'ended',
        endedAt,
        duration,
      });

      console.log(`📞 [SERVER] Call ${callId} ended, duration: ${duration}s`);

      // Notify the other user
      const otherUserId = fromUserId === call.fromUserId ? call.toUserId : call.fromUserId;
      const otherUserSocket = userSocketMap.get(String(otherUserId));

      if (otherUserSocket) {
        console.log(`📤 [SERVER] Sending end_call event to user ${otherUserId}`);
        otherUserSocket.emit('end_call', { callId, fromUserId });
      } else {
        console.log(`❌ [SERVER] No socket found for user: ${otherUserId}`);
      }

      // Clean up
      if (socket.currentCallId === callId) {
        socket.currentCallId = null;
      }
    });

    // 🛑 End call by channel (fallback when call ID is not available)
    socket.on('end_call_by_channel', async ({ channelName, fromUserId }) => {
      console.log('🔴 RECEIVED end_call_by_channel:', { channelName, fromUserId, socketId: socket.id });

      // Find call by channel name
      const call = await Call.findOne({
        where: { 
          channelName: channelName,
          status: ['accepted', 'missed'] // Only active calls
        }
      });

      if (!call) {
        console.log(`❌ [SERVER] Call with channel ${channelName} not found in database`);
        return;
      }

      console.log(`📞 [SERVER] Found call ${call.id} for channel ${channelName}`);

      // Prevent double-ending or ending invalid states
      if (['ended', 'rejected', 'cancelled'].includes(call.status)) {
        console.log(`❌ [SERVER] Call ${call.id} already ended or invalid (status: ${call.status})`);
        return;
      }

      // Clear any pending timeout for this call
      const t = callTimeouts.get(call.id);
      if (t) {
        clearTimeout(t);
        callTimeouts.delete(call.id);
      }
      const bt = callTimeouts.get(`budget_${call.id}`);
      if (bt) {
        clearTimeout(bt);
        callTimeouts.delete(`budget_${call.id}`);
      }

      const endedAt = new Date();
      let duration = 0;

      if (call.startedAt) {
        duration = Math.floor((endedAt - new Date(call.startedAt)) / 1000);
      }

      await call.update({
        status: 'ended',
        endedAt,
        duration,
      });

      console.log(`📞 [SERVER] Call ${call.id} ended by channel, duration: ${duration}s`);

      // Notify the other user
      const otherUserId = fromUserId === call.fromUserId ? call.toUserId : call.fromUserId;
      const otherUserSocket = userSocketMap.get(String(otherUserId));

      if (otherUserSocket) {
        console.log(`📤 [SERVER] Sending end_call event to user ${otherUserId}`);
        otherUserSocket.emit('end_call', { callId: call.id, fromUserId });
      } else {
        console.log(`❌ [SERVER] No socket found for user: ${otherUserId}`);
      }

      // Clean up
      if (socket.currentCallId === call.id) {
        socket.currentCallId = null;
      }
    });

    // 🔌 Socket disconnect
    socket.on('disconnect', async () => {
      const userId = socket.userId;
      const currentSocket = userSocketMap.get(userId);

      if (currentSocket?.id === socket.id) {
        userSocketMap.delete(userId);
        console.log(`🔴 User ${userId} disconnected`);

        // Mark user offline
        await User.update(
          { isOnline: false, lastSeen: new Date() },
          { where: { id: userId } }
        );
        io.emit('presence_update', { userId, isOnline: false });
      }

      // Optional: Auto-cancel ongoing call if user disconnects mid-call
      if (socket.currentCallId) {
        const call = await Call.findByPk(socket.currentCallId);
        if (call && call.status === 'missed') {
          // Only auto-cancel if the call is still actively ringing (timeout pending)
          const t = callTimeouts.get(call.id);
          if (t) {
            clearTimeout(t);
            callTimeouts.delete(call.id);

            const otherUserId = userId === call.fromUserId ? call.toUserId : call.fromUserId;
            const otherUserSocket = userSocketMap.get(String(otherUserId));

            if (otherUserSocket) {
              otherUserSocket.emit('cancel_call', { by: userId, callId: socket.currentCallId });
            }

            await call.update({ status: 'cancelled' });
            console.log(`📞 Call ${socket.currentCallId} auto-cancelled due to disconnection`);
          } else {
            // Timeout already processed; do not flip missed to cancelled
            console.log(`ℹ️ [SERVER] Disconnect after timeout for call ${call.id}; leaving status 'missed'`);
          }
        }
        // Always clear the pointer on this socket to avoid future side-effects
        socket.currentCallId = null;
      }
    });
  });
}

module.exports = socketHandler;