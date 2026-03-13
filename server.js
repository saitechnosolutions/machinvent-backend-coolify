// require('dotenv').config();
// const app = require('./src/app');
// const http = require('http');
// const { Server } = require('socket.io');
// const db = require('./src/models/index');
// const User = require('./src/models/userModel');
// const Call = require('./src/models/calls');
// const userSocketMap = new Map();

// const server = http.createServer(app);
// const io = new Server(server, {
//   cors: {
//     origin: '*', // ⚠️ Change this in production
//   }
// });

// io.on('connection', (socket) => {
//   const userId = socket.handshake.query.userId;
//   console.log('🟢 Socket connected:', socket.id, 'from user:', userId);

//   if (userId) {
//     socket.userId = userId;

//     const existingSocket = userSocketMap.get(userId);
//     if (existingSocket && existingSocket.id !== socket.id) {
//       existingSocket.disconnect();
//       console.log(`♻️ Disconnected old socket for user ${userId}`);
//     }

//     userSocketMap.set(userId, socket);

//     User.update({ isOnline: true }, { where: { id: userId } })
//       .then(() => {
//         io.emit('presence_update', { userId, isOnline: true });
//         console.log(`✅ User ${userId} is online`);
//       })
//       .catch((err) => {
//         console.error('Error updating user as online:', err);
//       });
//   }

//   // ✅ Agora call events START here
//   socket.on('call_user', async (data) => {
//     const { fromUserId, toUserId, channelName, callType } = data;

//     const call = await Call.create({
//       fromUserId,
//       toUserId,
//       channelName,
//       callType,
//       status: 'missed',
//     });

//     const calleeSocket = userSocketMap.get(toUserId);
//     if (calleeSocket) {
//       calleeSocket.emit('incoming_call', {
//         fromUserId,
//         channelName,
//         callType,
//         callId: call.id,
//       });
//     }

//     socket.callId = call.id;
//   });

//   socket.on('accept_call', async (data) => {
//     const { fromUserId, toUserId, channelName, callId } = data;

//     const callerSocket = userSocketMap.get(fromUserId);
//     if (callerSocket) {
//       callerSocket.emit('call_accepted', { channelName, by: toUserId });
//     }

//     await Call.update({
//       status: 'accepted',
//       startedAt: new Date(),
//     }, {
//       where: { id: callId }
//     });
//   });

//   socket.on('reject_call', async (data) => {
//     const { fromUserId, toUserId, callId } = data;

//     const callerSocket = userSocketMap.get(fromUserId);
//     if (callerSocket) {
//       callerSocket.emit('call_rejected', { by: toUserId });
//     }

//     await Call.update({ status: 'rejected' }, { where: { id: callId } });
//   });

//   socket.on('cancel_call', async (data) => {
//     const { toUserId, fromUserId, callId } = data;

//     const calleeSocket = userSocketMap.get(toUserId);
//     if (calleeSocket) {
//       calleeSocket.emit('call_cancelled', { by: fromUserId });
//     }

//     await Call.update({ status: 'cancelled' }, { where: { id: callId } });
//   });

//   socket.on('end_call', async (data) => {
//     const { callId } = data;

//     const call = await Call.findByPk(callId);
//     if (call && call.startedAt) {
//       const endedAt = new Date();
//       const duration = Math.floor((endedAt - call.startedAt) / 1000);

//       await call.update({
//         status: 'ended',
//         endedAt,
//         duration,
//       });

//       console.log(`📞 Call ${callId} ended, duration: ${duration}s`);
//     }
//   });
//   // ✅ Agora call events END here

//   // Disconnect cleanup
//   socket.on('disconnect', async () => {
//     const userId = socket.userId;
//     const currentSocket = userSocketMap.get(userId);
//     if (currentSocket?.id === socket.id) {
//       userSocketMap.delete(userId);
//       console.log(`🔴 User ${userId} disconnected`);
//       await User.update(
//         { isOnline: false, lastSeen: new Date() },
//         { where: { id: userId } }
//       );
//       io.emit('presence_update', { userId, isOnline: false });
//     }
//   });
// });

// // Start server
// const PORT = process.env.PORT || 3000;

// db.sequelize.sync({ alter: true })
//   .then(() => {
//     console.log('✅ Database connected successfully');
//     server.listen(PORT, () => {
//       console.log(`🚀 Server running at http://localhost:${PORT}`);
//     });
//   })
//   .catch((err) => {
//     console.error('❌ Unable to connect to the database:', err);
//   });

require('dotenv').config();
const app = require('./src/app');
const http = require('http');
const { Server } = require('socket.io');
const db = require('./src/models/index');
const socketHandler = require('./src/sockets/socketHandler');

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

socketHandler(io);

const PORT = 5000;

db.sequelize.sync({ alter: true })
  .then(() => {
    console.log('✅ Database connected successfully');

    server.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

  })
  .catch((err) => {
    console.error('❌ Unable to connect to the database:', err);
  });