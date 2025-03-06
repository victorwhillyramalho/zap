const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode');
const app = express();
const port = 45000;

let client;
let isConnected = false;
let qrCode = null;

// Função para gerar o QR code em base64
const generateQRCode = async (qr) => {
    try {
        const qrBase64 = await qrcode.toDataURL(qr);
        return qrBase64;
    } catch (error) {
        console.error("Erro ao gerar QR code", error);
        return null;
    }
};

// Função para inicializar o cliente
const initializeClient = () => {
    client = new Client({
        authStrategy: new LocalAuth(),
        puppeteer: { headless: true } // Isso garante que o Chromium não será aberto
    });

    // Evento de QR Code gerado
    client.on('qr', async (qr) => {
        qrCode = await generateQRCode(qr);
    });

    // Evento de conexão
    client.on('ready', () => {
        isConnected = true;
    });

    // Evento de erro de conexão
    client.on('disconnected', () => {
        isConnected = false;
        qrCode = null;

        // Limpar a sessão e gerar um novo QR Code quando desconectado pelo celular
        console.log("Desconectado do WhatsApp. Limpando sessão e aguardando reconexão...");
        const authPath = path.join(__dirname, '.wwebjs_auth');
        const cachePath = path.join(__dirname, '.wwebjs_cache');

        // Deleta as pastas de sessão e cache, se existirem
        try {
            if (fs.existsSync(authPath)) {
                fs.rmSync(authPath, { recursive: true, force: true });
            }
            if (fs.existsSync(cachePath)) {
                fs.rmSync(cachePath, { recursive: true, force: true });
            }
            console.log("Sessão limpa com sucesso.");
        } catch (error) {
            console.error("Erro ao limpar sessão:", error);
        }

        // Reinicia o cliente para gerar novo QR Code
        initializeClient();
    });

    // Iniciar cliente do WhatsApp
    client.initialize();
};

// Inicializar o cliente ao iniciar o servidor
initializeClient();

// Rota para enviar mensagens
app.get('/send/:id/:numero/:mensagem', async (req, res) => {
    const { id, numero, mensagem } = req.params;

    if (!isConnected) {
        // Se não estiver conectado, retorna o QR code
        return res.json({ con: false, qrcode: qrCode });
    }

    try {
        // Enviar a mensagem para o número especificado
        const chatId = `${numero}@c.us`;
        const chat = await client.getChatById(chatId);
        await chat.sendMessage(mensagem);

        // Se a mensagem for enviada com sucesso
        return res.json({ con: true, qrcode: null, send: true });
    } catch (error) {
        // Se houver erro ao enviar a mensagem
        console.error("Erro ao enviar mensagem:", error);
        return res.json({ con: true, qrcode: null, send: false });
    }
});

// Rota para desconectar e limpar a sessão
app.get('/destroy/:id', async (req, res) => {
    const { id } = req.params;

    // Verifica se o WhatsApp está conectado
    if (isConnected) {
        // Desconectar o cliente
        await client.destroy();
        isConnected = false;
        qrCode = null;

        // Caminhos das pastas de sessão e cache
        const authPath = path.join(__dirname, '.wwebjs_auth');
        const cachePath = path.join(__dirname, '.wwebjs_cache');

        // Deleta as pastas de sessão e cache, se existirem
        try {
            if (fs.existsSync(authPath)) {
                fs.rmSync(authPath, { recursive: true, force: true });
            }
            if (fs.existsSync(cachePath)) {
                fs.rmSync(cachePath, { recursive: true, force: true });
            }
            console.log("Sessão limpa com sucesso.");
        } catch (error) {
            console.error("Erro ao limpar sessão:", error);
        }

        // Inicializa o cliente novamente para gerar um novo QR Code
        initializeClient();

        // Responde confirmando a desconexão e a limpeza
        return res.json({ con: false, qrcode: qrCode, destroy: true });
    }

    // Se não estiver conectado, apenas responde que já está desconectado
    return res.json({ con: false, qrcode: null, destroy: false });
});

// Iniciar servidor
app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});
