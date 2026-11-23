require('dotenv').config();

const path = require('path');
const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const MongoStore = require('connect-mongo').default;

const connectDatabase = require('./src/config/database');
const migrarRequisicoesSuprimentos = require('./src/config/migrarRequisicoesSuprimentos');
const criarUsuarioAdministrador = require('./src/config/criarUsuarioAdministrador');
const routes = require('./routes');
const notFound = require('./src/middlewares/notFound');
const errorHandler = require('./src/middlewares/errorHandler');

const app = express();
const port = process.env.PORT;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src', 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.DATABASE,
    dbName: process.env.DB_NAME,
    collectionName: 'sessions'
  }),
  cookie: {
    maxAge: 1000 * 60 * 60 * 24,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  }
}));
app.use(flash());
const rotasComFilial = new Set([
  '/',
  '/entrada_estoque',
  '/editar_estoque',
  '/adicionar_estoque',
  '/excluir_estoque',
  '/suprimentos',
  '/suprimentos/relatorio',
  '/requisicoes-suprimentos',
  '/requisicoes-estoque',
  '/saidas-produtos',
  '/saidas-suprimentos',
  '/transferencias'
]);
app.use((req, res, next) => {
  const filialInformada = Number(req.query.filial ?? req.body?.filial);
  const filialInformadaValida = [1, 3, 4].includes(filialInformada);
  if (filialInformadaValida) {
    req.session.filialSelecionada = filialInformada;
  }
  const filialSalva = Number(req.session.filialSelecionada);
  const filialAtual = filialInformadaValida
    ? filialInformada
    : [1, 3, 4].includes(filialSalva) ? filialSalva : 1;

  if (req.method === 'GET' && rotasComFilial.has(req.path) && !filialInformadaValida) {
    const parametros = new URLSearchParams(req.url.split('?')[1] || '');
    parametros.set('filial', String(filialAtual));
    return res.redirect(302, `${req.path}?${parametros.toString()}`);
  }

  next();
});
app.use((req, res, next) => {
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  const filialInformada = Number(req.query.filial ?? req.body?.filial);
  const filialSalva = Number(req.session.filialSelecionada);
  res.locals.filial = [1, 3, 4].includes(filialInformada)
    ? filialInformada
    : [1, 3, 4].includes(filialSalva) ? filialSalva : 1;
  next();
});

app.use('/', routes);
app.use(notFound);
app.use(errorHandler);

async function startServer() {
  try {
    await connectDatabase();
    const administradorCriado = await criarUsuarioAdministrador();
    if (administradorCriado) {
      console.warn('Conta inicial de administrador criada. Altere as credenciais padrão após o primeiro acesso.');
    }
    const requisicoesMigradas = await migrarRequisicoesSuprimentos();
    if (requisicoesMigradas) {
      console.log(`${requisicoesMigradas} requisição(ões) antiga(s) migrada(s) para o MongoDB.`);
    }
    app.listen(port, () => {
      console.log(`Servidor rodando em http://localhost:${port}`);
    });
  } catch (error) {
    console.error('Não foi possível iniciar o servidor:', error.message);
    process.exit(1);
  }
}

startServer();
