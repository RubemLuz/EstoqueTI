const fs = require('fs');
const path = require('path');
const RequisicaoSuprimento = require('../models/RequisicaoSuprimento');

const dadosPath = path.join(__dirname, '..', '..', 'data', 'requisicoes-suprimentos.json');
const migrationId = 'migrate-requisicoes-suprimentos-json-v1';

const migrarRequisicoesSuprimentos = async () => {
  if (!fs.existsSync(dadosPath)) return 0;

  const migrations = RequisicaoSuprimento.db.collection('app_migrations');
  if (await migrations.findOne({ _id: migrationId })) return 0;

  const conteudo = fs.readFileSync(dadosPath, 'utf8').trim();
  if (!conteudo) {
    await migrations.updateOne(
      { _id: migrationId },
      { $setOnInsert: { completedAt: new Date() } },
      { upsert: true }
    );
    return 0;
  }

  const requisicoes = JSON.parse(conteudo);
  if (!Array.isArray(requisicoes)) {
    throw new Error('O arquivo de requisições legado precisa conter uma lista.');
  }
  if (!requisicoes.length) return 0;

  const operacoes = requisicoes.map((requisicao) => ({
    updateOne: {
      filter: { id: String(requisicao.id) },
      update: {
        $setOnInsert: {
          ...requisicao,
          id: String(requisicao.id),
          data: new Date(requisicao.data),
          ...(requisicao.dataRecebimento
            ? { dataRecebimento: new Date(requisicao.dataRecebimento) }
            : {})
        }
      },
      upsert: true
    }
  }));
  const resultado = await RequisicaoSuprimento.bulkWrite(operacoes, { ordered: true });
  await migrations.updateOne(
    { _id: migrationId },
    { $setOnInsert: { completedAt: new Date() } },
    { upsert: true }
  );
  return resultado.upsertedCount;
};

module.exports = migrarRequisicoesSuprimentos;
