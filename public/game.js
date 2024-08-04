const socket = io();
let peerConnection;
let dataChannel;
let roomId;

const createBtn = document.getElementById('create-btn');
const joinBtn = document.getElementById('join-btn');
const joinInput = document.getElementById('join-input');
const leaveBtn = document.getElementById('leave-btn');
const leaveInput = document.getElementById('leave-input');
const gameBoard = document.getElementById('game-board');
const chatMessages = document.getElementById('chat-messages');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');

createBtn.addEventListener('click', createRoom);
joinBtn.addEventListener('click', joinRoom);
leaveBtn.addEventListener('click', disconnectRoom);
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
  if (e.key === 'return') {
    sendMessage();
  }
});

function createRoom() {
  roomId = Math.random().toString(36).substr(2, 9);
  socket.emit('create', roomId);
  // response_roomId(roomId)
}

function joinRoom() {
  roomId = joinInput.value;
  if(roomId){
    socket.emit('join', roomId);
  } else {
    console.log("joinInput is null");
  }
  
}

function disconnectRoom() {
  roomId = leaveInput.value;
  if(roomId){
    socket.emit('disconnect', roomId);
  } else {
    console.log("joinInput is null");
  }
}

socket.on('created', (id) => {
  console.log(`Room created with ID: ${id}`);
  initializePeerConnection();
});

socket.on('joined', (id) => {
  console.log(`Joined room with ID: ${id}`);
  initializePeerConnection();
});

socket.on('disconnect', () => {
  console.log('Disconnected from room');
  peerConnection.close();
});

socket.on('opponent_joined', () => {
  console.log('Opponent joined, creating offer');
  createOffer();
});

socket.on('offer', (offer) => {
  handleOffer(offer);
});

socket.on('answer', (answer) => {
  handleAnswer(answer);
});

socket.on('ice-candidate', (candidate) => {
  handleNewICECandidate(candidate);
});

function initializePeerConnection() {
  const configuration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      // 必要に応じてTURNサーバーも設定
    ]
  };
  
  peerConnection = new RTCPeerConnection(configuration);

  dataChannel = peerConnection.createDataChannel('gameChannel');
  dataChannel.onmessage = handleDataChannelMessage;
  dataChannel.onopen = () => console.log('DataChannel is open');

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('ice-candidate', event.candidate, roomId);
    }
  };

  peerConnection.ondatachannel = (event) => {
    dataChannel = event.channel;
    dataChannel.onmessage = handleDataChannelMessage;
  };

  peerConnection.oniceconnectionstatechange = () => {
    if (peerConnection.iceConnectionState === 'disconnected') {
      console.log('Peer disconnected');
      // 再接続ロジックを実装
    }
  };

  peerConnection.onerror = (error) => {
    console.error('PeerConnection error:', error);
    // エラー処理ロジックを実装
  };
}

async function createOffer() {
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  socket.emit('offer', offer, roomId);
}

async function handleOffer(offer) {
  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  socket.emit('answer', answer, roomId);
}

function handleAnswer(answer) {
  peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
}

function handleNewICECandidate(candidate) {
  peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
}

function handleDataChannelMessage(event) {
  const data = JSON.parse(event.data);
  if (data.type === 'chat') {
    addMessageToChat('Opponent', data.content);
  } else if (data.type === 'game_action') {
    updateGameBoard(data);
  }
}

function sendGameAction(action) {
  if (dataChannel && dataChannel.readyState === 'open') {
    dataChannel.send(JSON.stringify({ type: 'game_action', ...action }));
  } else {
    console.error('DataChannel not ready');
  }
}

function updateGameBoard(action) {
  gameBoard.innerHTML = `Opponent's action: ${action.type}`;
}

gameBoard.addEventListener('click', () => {
  const action = { type: 'click', position: { x: Math.random(), y: Math.random() } };
  sendGameAction(action);
  updateGameBoard(action);
});

function sendMessage() {
  const message = messageInput.value.trim();
  if (message && dataChannel && dataChannel.readyState === 'open') {
    const messageObj = {
      type: 'chat',
      content: message
    };
    dataChannel.send(JSON.stringify(messageObj));
    addMessageToChat('You', message);
    messageInput.value = '';
  }
}

function addMessageToChat(sender, message) {
  const messageElement = document.createElement('div');
  messageElement.textContent = `${sender}: ${message}`;
  chatMessages.appendChild(messageElement);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}