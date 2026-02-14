const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

// Store rooms in memory
const rooms = new Map();

/*
Room structure:
{
  roomId: {
    users: Set(socketIds),
    createdAt: timestamp
  }
}
*/

function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // CREATE ROOM
  socket.on("create-room", () => {
    const roomId = generateRoomId();

    rooms.set(roomId, {
      users: new Set([socket.id]),
      createdAt: Date.now(),
    });

    socket.join(roomId);

    socket.emit("room-created", roomId);

    console.log("Room created:", roomId);
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
    io.to(roomId).emit("user-connected");

    console.log(socket.id, "joined", roomId);
  });

  // ROOM MESSAGE
  socket.on("room-message", ({ roomId, message }) => {
    io.to(roomId).emit("room-message", message);
  });

  // DISCONNECT
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);

    for (let [roomId, room] of rooms.entries()) {
      if (room.users.has(socket.id)) {
        room.users.delete(socket.id);

        io.to(roomId).emit("user-disconnected");

        if (room.users.size === 0) {
          rooms.delete(roomId);
          console.log("Room destroyed:", roomId);
        }
      }
    }
  });
});

server.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});
