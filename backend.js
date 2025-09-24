const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
// A porta será fornecida pelo ambiente de hospedagem (Render)
const PORT = process.env.PORT || 3000;

// Caminhos
const DATA_PATH = path.join(__dirname, "data.json");
// IMPORTANTE: O frontend não será mais servido daqui.
// A pasta 'public' não precisa mais existir no backend.
// const PUBLIC_PATH = path.join(__dirname, "..", "public");

// =================== MUDANÇA AQUI ===================
// Middlewares
// Configura o CORS para permitir requisições apenas do seu site Netlify e localhost
const allowedOrigins = [
  'https://semana-tecnica-votos.netlify.app', // <-- SUBSTITUA PELA URL REAL DO SEU SITE NA NETLIFY
  'http://localhost:5173',      // <-- Porta comum para dev (Vite)
  'http://127.0.0.1:5173'
];

app.use(cors({
  origin: function (origin, callback) {
    // Permite requisições sem 'origin' (ex: Postman, apps mobile) ou da lista de permitidos
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));
app.use(express.json());
// =================== FIM DA MUDANÇA ===================

// Util: carregar/salvar JSON (sincrono simples p/ evento pequeno)
function loadData() {
  try {
    const raw = fs.readFileSync(DATA_PATH, "utf-8");
    const obj = JSON.parse(raw);
    if (!obj || !Array.isArray(obj.projects)) throw new Error("data inválido");
    return obj;
  } catch (e) {
    console.error("Erro ao carregar data.json:", e.message);
    return { projects: [] };
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), "utf-8");
}

// API: listar projetos e votos
app.get("/api/projects", (req, res) => {
  const data = loadData();
  res.json(data.projects);
});

// API: votar em um projeto
app.post("/api/vote", (req, res) => {
  const { id } = req.body || {};
  if (typeof id !== "number") {
    return res.status(400).json({ error: "Campo 'id' numérico é obrigatório." });
  }

  const data = loadData();
  const idx = data.projects.findIndex(p => p.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: "Projeto não encontrado." });
  }

  data.projects[idx].votes = Number(data.projects[idx].votes || 0) + 1;
  saveData(data);
  return res.json({ ok: true, project: data.projects[idx] });
});

// A ROTA PARA RESETAR NÃO ESTAVA NO SEU CÓDIGO, ADICIONEI ELA AQUI
app.post("/api/reset", (req, res) => {
  const data = loadData();
  data.projects.forEach(p => p.votes = 0);
  saveData(data);
  res.json({ ok: true });
});


// =================== MUDANÇA AQUI ===================
// REMOVA as linhas que servem o frontend estático.
// O backend agora só cuida da API.
// app.use(express.static(PUBLIC_PATH));
// app.get(/^\/(?!api\/).*/, (req, res) => {
//   res.sendFile(path.join(PUBLIC_PATH, "index.html"));
// });
// =================== FIM DA MUDANÇA ===================


app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);

});


