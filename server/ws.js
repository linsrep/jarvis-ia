const WebSocket = require('ws');

// Cria um servidor WebSocket
const wss = new WebSocket.Server({ port: 8080 });

// Função para lidar com novas conexões
function onOpen(ws) {
  console.log('Cliente conectado');

  // Simulando uma resposta do modelo de linguagem grande
  const resposta = "A resposta do modelo de Ollama";
  ws.send(resposta);
}

// Evento de conexão
wss.on('connection', onOpen);

console.log('Servidor WebSocket rodando na porta 8080');