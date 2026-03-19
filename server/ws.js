import { WebSocketServer } from "ws";

const PORT = 8080;
const DEFAULT_OLLAMA_URL = "http://127.0.0.1:11434";
const DEFAULT_MODEL = "gemma3:4b";

const wss = new WebSocketServer({ port: PORT });

function getBaseUrl(endpoint) {
  return (endpoint || DEFAULT_OLLAMA_URL).replace(/\/$/, "");
}

async function queryOllama({ endpoint, model, system, message }) {
  const response = await fetch(`${getBaseUrl(endpoint)}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: model || DEFAULT_MODEL,
      stream: true,
      messages: [
        ...(system ? [{ role: "system", content: system }] : []),
        { role: "user", content: message },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    const normalizedError = errorText.toLowerCase();

    if (response.status === 404 && normalizedError.includes("model")) {
      const error = new Error(`Modelo não encontrado: ${model || DEFAULT_MODEL}`);
      error.name = "MODEL_NOT_FOUND";
      throw error;
    }

    throw new Error(`Ollama respondeu com ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return data.message?.content?.trim() || "O modelo não retornou conteúdo.";
}

async function installModel({ endpoint, model }) {
  const response = await fetch(`${getBaseUrl(endpoint)}/api/pull`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: model || DEFAULT_MODEL,
      stream: false,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Falha ao baixar o modelo: ${errorText}`);
  }
}

wss.on("connection", (ws) => {
  console.log("Cliente WebSocket conectado");

  ws.send(JSON.stringify({
    type: "status",
    content: "Conectado ao bridge local do Jarvis.",
  }));

  ws.on("message", async (rawMessage) => {
    try {
      const payload = JSON.parse(rawMessage.toString());

      if (payload?.type === "install-model") {
        const modelName = String(payload.model || "").trim();

        if (!modelName) {
          ws.send(JSON.stringify({
            type: "error",
            content: "Modelo inválido para instalação.",
          }));
          return;
        }

        ws.send(JSON.stringify({
          type: "status",
          content: `Baixando o modelo ${modelName}...`,
        }));

        await installModel({
          endpoint: payload.endpoint,
          model: modelName,
        });

        ws.send(JSON.stringify({
          type: "model-installed",
          model: modelName,
          content: `Modelo ${modelName} instalado com sucesso.`,
        }));
        return;
      }

      if (payload?.type !== "chat") {
        ws.send(JSON.stringify({
          type: "error",
          content: "Tipo de mensagem não suportado.",
        }));
        return;
      }

      const userMessage = String(payload.message || "").trim();

      if (!userMessage) {
        ws.send(JSON.stringify({
          type: "error",
          content: "Mensagem vazia.",
        }));
        return;
      }

      ws.send(JSON.stringify({
        type: "status",
        content: "Consultando o Ollama...",
      }));

      try {
        const content = await queryOllama({
          endpoint: payload.endpoint,
          model: payload.model,
          system: payload.system,
          message: userMessage,
        });

        ws.send(JSON.stringify({
          type: "assistant-message",
          content,
        }));
      } catch (error) {
        if (error instanceof Error && error.name === "MODEL_NOT_FOUND") {
          ws.send(JSON.stringify({
            type: "model-missing",
            model: payload.model || DEFAULT_MODEL,
            content: `O modelo ${payload.model || DEFAULT_MODEL} não está disponível localmente.`,
          }));
          return;
        }

        throw error;
      }
    } catch (error) {
      ws.send(JSON.stringify({
        type: "error",
        content: error instanceof Error ? error.message : "Erro inesperado ao consultar o Ollama.",
      }));
    }
  });

  ws.on("close", () => {
    console.log("Cliente WebSocket desconectado");
  });
});

console.log(`Servidor WebSocket rodando na porta ${PORT}`);
