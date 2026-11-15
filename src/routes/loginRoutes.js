const express = require('express');
const controller = require('../controllers/loginController');
const router = express.Router();

router.get('/login', controller.index);
router.post('/login', controller.entrar);
router.get('/esqueci-senha', controller.esqueciSenha);
router.post('/esqueci-senha', controller.redefinirSenha);
router.post('/logout', controller.sair);

module.exports = router;
