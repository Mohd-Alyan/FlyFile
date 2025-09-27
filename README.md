# FlyFile - P2P File Sharing

A professional-grade web application for secure, private browser-to-browser file transfers using WebRTC.

## Features

- 🚀 **Direct P2P Transfer**: Files transfer directly between browsers without server storage
- 🔒 **Privacy First**: No files stored on servers, encrypted WebRTC connections
- 📱 **Mobile Friendly**: Responsive design works on all devices
- 🎯 **Simple UX**: Drag & drop files, generate shareable links, QR codes
- ⚡ **Fast**: No upload/download to servers, direct peer connections
- 🌙 **Dark Mode**: Beautiful light and dark themes

## How It Works

1. **Both The Users** connect to the same Wi-Fi network
2. **Sender** uploads a file and gets a shareable link
3. **Receiver** opens the link and sees file details
4. **Accept/Decline** - receiver chooses to accept the transfer
5. **P2P Connection** - WebRTC establishes direct connection
6. **Transfer** - file transfers directly between browsers
7. **Complete** - both users see success confirmation

## Architecture

- **Frontend**: React + Vite + Tailwind CSS
- **Signaling Server**: Node.js + Socket.IO + Express
- **P2P Layer**: WebRTC DataChannels
- **Styling**: Tailwind CSS + Framer Motion animations

## Security

- WebRTC DTLS encryption by default
- No server-side file storage
- Session-based temporary connections
- Optional end-to-end encryption layer
