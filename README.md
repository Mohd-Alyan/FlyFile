# FlyFile - P2P File Sharing

A professional-grade web application for secure, private browser-to-browser file transfers using WebRTC.

## Features

- 🚀 **Direct P2P Transfer**: Files transfer directly between browsers without server storage
- 🔒 **Privacy First**: No files stored on servers, encrypted WebRTC connections
- 📱 **Mobile Friendly**: Responsive design works on all devices
- 🎯 **Simple UX**: Drag & drop files, generate shareable links, QR codes
- ⚡ **Fast**: No upload/download to servers, direct peer connections
- 🌙 **Dark Mode**: Beautiful light and dark themes

## Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start development server**:
   ```bash
   npm run dev
   ```

3. **Open your browser**:
   - Frontend: http://localhost:5173
   - Signaling Server: http://localhost:3001

## How It Works

1. **Sender** uploads a file and gets a shareable link
2. **Receiver** opens the link and sees file details
3. **Accept/Decline** - receiver chooses to accept the transfer
4. **P2P Connection** - WebRTC establishes direct connection
5. **Transfer** - file transfers directly between browsers
6. **Complete** - both users see success confirmation

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

## Browser Support

- Chrome 80+
- Firefox 75+
- Safari 14+
- Edge 80+

## Development

```bash
# Install dependencies
npm install

# Start both client and server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## License

MIT License - see LICENSE file for details.
