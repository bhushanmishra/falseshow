# 🎴 False Show - Multiplayer Card Game

Play the ultimate bluffing card game online with friends! No downloads, no servers - just pure P2P multiplayer fun.

## 🚀 Quick Deploy to Netlify

### Option 1: Drag & Drop
1. Download/copy the entire `false_show_game` folder
2. Go to [Netlify Drop](https://app.netlify.com/drop)
3. Drag the folder into the browser
4. Your game is live!

### Option 2: Git Deploy
1. Push this folder to a GitHub repo
2. Connect the repo to Netlify
3. Auto-deploy on every push

## 🎮 How to Play

1. **Create a Room** - One player creates a game room
2. **Share the Code** - Share the 6-letter code with friends
3. **Join & Play** - 4-6 players can join from any device
4. **No Server Needed** - Uses P2P WebRTC connections

## 📱 Features

- ✅ Works on mobile, tablet, and desktop
- ✅ No backend server required
- ✅ Real-time multiplayer (4-6 players)
- ✅ Progressive Web App (installable)
- ✅ Chat and emoji reactions
- ✅ Automatic host migration
- ✅ Private & public rooms

## 🛠️ Technology Stack

- **Trystero** - Serverless WebRTC P2P networking
- **Vanilla JavaScript** - No heavy frameworks
- **PWA** - Offline support & installable
- **Netlify** - Static hosting

## 📋 Game Rules

- **Objective**: Be the last player standing
- **Players**: 4-6 players
- **Duration**: 20-45 minutes
- **Card Values**: Ace=1, Face cards=11-13, Joker=0
- **Gameplay**: Play cards matching previous ranks to avoid penalties

## 🔧 Local Development

```bash
# No build step required!
# Just serve the files locally:
python -m http.server 8000
# or
npx serve .
```

## 📄 License

Game Design © 2025 - Created with ❤️ for multiplayer fun

## 🌐 Live Demo

Visit: https://falseshow.netlify.app