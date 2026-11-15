module.exports = (error, req, res, next) => {
  console.error(error);

  res.status(error.status || 500).render('error', {
    title: 'Erro interno',
    message: process.env.NODE_ENV === 'production'
      ? 'Ocorreu um erro inesperado.'
      : error.message
  });
};
