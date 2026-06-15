"use strict";
const {app, BrowserWindow} = require("electron");
console.log("app type:", typeof app);
console.log("BW type:", typeof BrowserWindow);
app.whenReady().then(() => { console.log("ready\!"); app.quit(); });