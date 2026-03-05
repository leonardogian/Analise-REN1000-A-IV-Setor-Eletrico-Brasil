const express = require('express');
const path = require('path');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 3000;

// Opcional: Ativa compressão gzip para acelerar o carregamento dos JSONs grandes
app.use(compression());

// Define o diretório de arquivos estáticos apontando para o seu frontend
app.use(express.static(path.join(__dirname, 'app/frontend')));

// Rota principal (não estritamente necessária se tiver um index.html em app/frontend, 
// mas é bom para garantir o fallback ou configurações)
app.get('/*', (req, res) => {
    res.sendFile(path.join(__dirname, 'app/frontend', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Servidor Node.js rodando na porta ${PORT}`);
});
