const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("varexDesktop", {
  platform: process.platform,
  version: "1.0.0"
});

