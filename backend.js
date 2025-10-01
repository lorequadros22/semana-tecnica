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

// index.js (arquivo do backend)

// API: Votar em um projeto usando e-mail (VERSÃO CORRIGIDA)
app.post("/api/vote", async (req, res) => {
  const { id, email } = req.body;

  if (typeof id !== "number") {
    return res.status(400).json({ error: "Campo 'id' numérico é obrigatório." });
  }
  if (!email || typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ error: "Campo 'email' é obrigatório e precisa ser válido." });
  }

  try {
    // ETAPA 1: TENTAR SALVAR O REGISTRO DE VOTO PRIMEIRO.
    // Esta é a nossa operação "atômica" de verificação.
    // Se o par (projectId, email) já existir, o .save() vai falhar
    // por causa do índice único, e o código pulará para o bloco CATCH.
    const newVoteLog = new VoteLog({ projectId: id, email: email });
    await newVoteLog.save();

    // ETAPA 2: SE O .save() ACIMA FUNCIONOU, ENTÃO O VOTO É ÚNICO.
    // Só agora nós podemos incrementar a contagem de votos com segurança.
    const updatedProject = await Project.findOneAndUpdate(
      { id: id },
      { $inc: { votes: 1 } },
      { new: true } // Retorna o documento atualizado
    );

    if (!updatedProject) {
      // Caso raro: se o projeto for deletado entre as operações.
      // Podemos até remover o log que acabamos de criar para consistência.
      await VoteLog.deleteOne({ _id: newVoteLog._id });
      return res.status(404).json({ error: "Projeto não encontrado." });
    }

    // ETAPA 3: Retornar sucesso.
    res.json({ ok: true, project: updatedProject });

  } catch (error) {
    // O erro mais comum aqui será o de chave duplicada (código 11000).
    if (error.code === 11000) {
      return res.status(403).json({ error: "Este e-mail já votou neste projeto." });
    }
    
    // Lidar com outros erros inesperados.
    console.error("Erro ao votar:", error);
    res.status(500).json({ error: "Ocorreu um erro ao processar seu voto." });
  }
});

// index.js (backend)

// Defina uma chave secreta. O ideal é colocá-la no arquivo .env
const RESET_SECRET_KEY = process.env.RESET_SECRET_KEY;

app.post("/api/reset", async (req, res) => {
  // Exige que a chave secreta seja enviada no corpo da requisição
  const { secret } = req.body;

  if (secret !== RESET_SECRET_KEY) {
    return res.status(403).json({ error: "Acesso não autorizado." });
  }

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