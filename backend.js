require('dotenv').config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middlewares ---
const allowedOrigins = [
  'https://semana-tecnica-votos.netlify.app', // <-- SUBSTITUA PELA URL REAL
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5500'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));
app.use(express.json());

// --- Conexão com o Banco de Dados MongoDB ---
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("Conectado ao MongoDB com sucesso!"))
  .catch(err => console.error("Falha ao conectar ao MongoDB:", err));

// --- Modelos do Banco de Dados (Schemas) ---

// Modelo para os projetos (sem alterações)
const projectSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  name: { type: String, required: true },
  description: { type: String },
  image: { type: String },
  votes: { type: Number, default: 0 }
});
const Project = mongoose.model('Project', projectSchema);

// ****** ALTERAÇÃO AQUI ******
// Modelo para registrar os votos por E-MAIL
const voteLogSchema = new mongoose.Schema({
  projectId: { type: Number, required: true },
  // Trocamos 'ipAddress' por 'email'
  email: { type: String, required: true, lowercase: true } // lowercase: true para garantir que "Email@.. " e "email@.." sejam tratados como iguais
});

// O índice de unicidade agora é na combinação de projeto e e-mail
voteLogSchema.index({ projectId: 1, email: 1 }, { unique: true });
const VoteLog = mongoose.model('VoteLog', voteLogSchema);


// --- Rotas da API ---

// API: Listar projetos (sem alterações)
app.get("/api/projects", async (req, res) => {
  try {
    const projects = await Project.find().sort({ id: 1 });
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar projetos." });
  }
});

// ****** GRANDES ALTERAÇÕES AQUI ******
// API: Votar em um projeto usando e-mail
app.post("/api/vote", async (req, res) => {
  // Agora esperamos 'id' e 'email' no corpo da requisição
  const { id, email } = req.body;

  // Validação dos campos recebidos
  if (typeof id !== "number") {
    return res.status(400).json({ error: "Campo 'id' numérico é obrigatório." });
  }
  if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: "Campo 'email' é obrigatório." });
  }
  // Validação simples do formato do e-mail
  if (!/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ error: "Formato de e-mail inválido." });
  }

  try {
    // 1. Verifica se este E-MAIL já votou neste projeto
    const existingVote = await VoteLog.findOne({ projectId: id, email: email });
    if (existingVote) {
      return res.status(403).json({ error: "Este e-mail já votou neste projeto." });
    }

    // 2. Encontra o projeto e incrementa o voto (operação atômica)
    const updatedProject = await Project.findOneAndUpdate(
      { id: id },
      { $inc: { votes: 1 } },
      { new: true }
    );

    if (!updatedProject) {
      return res.status(404).json({ error: "Projeto não encontrado." });
    }

    // 3. Registra o voto no log com o e-mail
    const newVoteLog = new VoteLog({ projectId: id, email: email });
    await newVoteLog.save();

    res.json({ ok: true, project: updatedProject });

  } catch (error) {
      if (error.code === 11000) { // Erro de duplicidade do banco de dados
          return res.status(403).json({ error: "Este e-mail já votou neste projeto." });
      }
      console.error("Erro ao votar:", error);
      res.status(500).json({ error: "Ocorreu um erro ao processar seu voto." });
  }
});

// API: Resetar todos os votos (sem alterações na lógica)
app.post("/api/reset", async (req, res) => {
  try {
      await Project.updateMany({}, { $set: { votes: 0 } });
      await VoteLog.deleteMany({});
      res.json({ ok: true, message: "Todos os votos foram resetados." });
  } catch (error) {
      res.status(500).json({ error: "Erro ao resetar os votos." });
  }
});


app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});