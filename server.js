const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

const rooms = new Map();

io.on('connection', (socket) => {
  socket.on('create', (roomId) => {
    rooms.set(roomId, socket.id);
    socket.join(roomId);
    socket.emit('created', roomId);
  });

  socket.on('join', (roomId) => {
    if (rooms.has(roomId)) {
      socket.join(roomId);
      socket.to(roomId).emit('opponent_joined');
      socket.emit('joined', roomId);
    } else {
      socket.emit('join_error', 'Room not found');
    }
  });

  socket.on('disconnect', (roomId) => {
    rooms.forEach((value, key) => {
      if (value === socket.id && key === roomId) {
        socket.to(roomId).emit('disconnect');
        socket.emit('disconnect', roomId);
        rooms.delete(key);
      }
    });
  })

  socket.on('offer', (offer, roomId) => {
    console.log("offer");
    socket.to(roomId).emit('offer', offer);
  });

  socket.on('answer', (answer, roomId) => {
    console.log("anser", answer);
    socket.to(roomId).emit('answer', answer);
  });

  socket.on('ice-candidate', (candidate, roomId) => {
    socket.to(roomId).emit('ice-candidate', candidate);
  });
});

const port = 3000;
http.listen(port, () => {
  console.log(`Server running on port ${port}`);
});