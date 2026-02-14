const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const rooms = new Map();

function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("create-room", () => {
    const roomId = generateRoomId();

    rooms.set(roomId, new Set([socket.id]));
    socket.join(roomId);

    socket.emit("room-created", roomId);
  });

  socket.on("join-room", (roomId) => {
    const room = rooms.get(roomId);

    if (!room || room.size >= 2) {
      socket.emit("error-message", "Room invalid or full");
      return;
    }

    room.add(socket.id);
    socket.join(roomId);

    socket.emit("room-joined", roomId);
    socket.to(roomId).emit("peer-joined");
  });

  // WebRTC signaling
  socket.on("signal", ({ roomId, data }) => {
    socket.to(roomId).emit("signal", data);
  });

  socket.on("disconnect", () => {
    for (let [roomId, users] of rooms.entries()) {
      if (users.has(socket.id)) {
        users.delete(socket.id);
        if (users.size === 0) rooms.delete(roomId);
      }
    }
  });
});

server.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});
