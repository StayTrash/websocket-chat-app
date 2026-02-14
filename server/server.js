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

function destroyRoom(roomId, reason = "Room closed") {
  if (!rooms.has(roomId)) return;

  io.to(roomId).emit("room-destroyed", reason);
  rooms.delete(roomId);

  console.log("Room destroyed:", roomId);
}

io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

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

  socket.on("signal", ({ roomId, data }) => {
    socket.to(roomId).emit("signal", data);
  });

  socket.on("room-message", ({ roomId, message }) => {
    io.to(roomId).emit("room-message", message);
  });

  socket.on("transfer-complete", (roomId) => {
    io.to(roomId).emit("transfer-complete");

    setTimeout(() => {
      destroyRoom(roomId, "Transfer complete. Room auto-closed.");
    }, 10000); // 10 sec delay
  });

  socket.on("disconnect", () => {
    for (let [roomId, users] of rooms.entries()) {
      if (users.has(socket.id)) {
        users.delete(socket.id);

        if (users.size === 0) {
          destroyRoom(roomId, "All users left");
        }
      }
    }
  });
});

server.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});
