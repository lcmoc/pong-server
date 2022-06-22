const express = require("express");
const socket = require("socket.io");
const { v4: uuidv4 } = require("uuid");
const PatchManager = require("./PatchManager");
const { SyncStateRemote } = require("@syncstate/remote-server");
const remote = new SyncStateRemote();

const PORT = process.env.PORT || 8000;
const INDEX = '/index.html';

const server = express()
  .use((req, res) => res.sendFile(INDEX, { root: __dirname }))
  .listen(PORT, () => console.log(`Listening on ${PORT}`));
  
var activeUserCount = 0;

const io = socket(server, {
  cors: {
    origin: "*",
  },
});

const projectId = uuidv4(); //generate unique id

let patchManager = new PatchManager();


io.on("connection", function (socket) {

    // Count active clients
    activeUserCount++;

    socket.emit("counter", { activeUserCount: activeUserCount });
  
    // /* Disconnect socket */
    socket.on("disconnect", function () {
      activeUserCount--;
      socket.emit("counter", { activeUserCount: activeUserCount });
    });
  
    setInterval(() => socket.emit('counter', { activeUserCount: activeUserCount }), 1000);
  

  socket.on("fetchDoc", (path) => {
    //get all patches
    const patchesList = patchManager.getAllPatches(projectId, path);

    if (patchesList) {
      //send each patch to the client
      patchesList.forEach((change) => {
        socket.emit("change", path, change);
      });
    }
  });
  
  //patches recieved from the client
  socket.on("change", (path, change) => {
    change.origin = socket.id;

    //resolves conflicts internally
    remote.processChange(socket.id, path, change);
  });

  const dispose = remote.onChangeReady(socket.id, (path, change) => {
    //store the patches in js runtime or a persistent storage
    patchManager.store(projectId, path, change);

    //broadcast the pathes to other clients
    socket.broadcast.emit("change", path, change);
  });
});
