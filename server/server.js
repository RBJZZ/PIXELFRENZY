const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" } 
});

let players = {};

io.on('connection', (socket) => {
    console.log('Un jugador se ha conectado:', socket.id);

    socket.on('joinGame', (color) => {
        players[socket.id] = {
            x: 0, z: 0, color: color
        };
        socket.emit('currentPlayers', players);
        socket.broadcast.emit('newPlayer', { id: socket.id, playerInfo: players[socket.id] });
    });

    socket.on('move', (movementData) => {
        if (players[socket.id]) {
            players[socket.id].x = movementData.x;
            players[socket.id].z = movementData.z;
            socket.broadcast.emit('playerMoved', { id: socket.id, x: movementData.x, z: movementData.z });
        }
    });

    socket.on('disconnect', () => {
        console.log('Jugador desconectado:', socket.id);
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Servidor multijugador corriendo en http://localhost:${PORT}`);
});