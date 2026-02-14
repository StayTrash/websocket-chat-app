const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 1e8 // 100MB
});

app.use(express.static("public"));

const rooms = new Map();
const ROOM_TIMEOUT = 5 * 60 * 1000;

function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function destroyRoom(roomId, reason = "Room expired") {
  if (rooms.has(roomId)) {
    const room = rooms.get(roomId);

    io.to(roomId).emit("room-destroyed", reason);

    clearTimeout(room.timeout);
    rooms.delete(roomId);

    console.log("Room destroyed:", roomId);
  }
}

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // CREATE ROOM
  socket.on("create-room", () => {
    const roomId = generateRoomId();

    const timeout = setTimeout(() => {
      destroyRoom(roomId, "Room expired after 5 minutes");
    }, ROOM_TIMEOUT);

    rooms.set(roomId, {
      users: new Set([socket.id]),
      timeout
    });

    socket.join(roomId);

    socket.emit("room-created", roomId);
    socket.emit("user-count", 1);
  });

  // JOIN ROOM
  socket.on("join-room", (roomId) => {
    const room = rooms.get(roomId);

    if (!room) {
      socket.emit("error-message", "Room does not exist");
      return;
    }

    if (room.users.size >= 2) {
      socket.emit("error-message", "Room is full");
      return;
    }

    room.users.add(socket.id);
    socket.join(roomId);

    socket.emit("room-joined", roomId);

    const count = room.users.size;
    io.to(roomId).emit("user-count", count);
  });

  // CHAT MESSAGE
  socket.on("room-message", ({ roomId, message }) => {
    io.to(roomId).emit("room-message", message);
  });

  // FILE CHUNK FORWARDING
  socket.on("file-chunk", (data) => {
    socket.to(data.roomId).emit("file-chunk", data);
  });

  // DISCONNECT
  socket.on("disconnect", () => {
    for (let [roomId, room] of rooms.entries()) {
      if (room.users.has(socket.id)) {
        room.users.delete(socket.id);

        const count = room.users.size;
        io.to(roomId).emit("user-count", count);

        if (room.users.size === 0) {
          destroyRoom(roomId, "All users left");
        }
      }
    }
  });
});

server.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});
