import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { loginSchema, perfilSchema, registroSchema } from '@cortemadepinus/shared';
import { conferirSenha, exigirAutenticacao, gerarHash, gerarToken } from '../lib/auth';
import { assincrono, naoAutorizado, requisicaoInvalida } from '../lib/erros';
import { mapearUsuario } from '../lib/mapear';
import { prisma } from '../prisma';

const limitadorLogin = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { erro: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' },
});

export const rotasAutenticacao = Router();

rotasAutenticacao.post(
  '/registrar',
  limitadorLogin,
  assincrono(async (req, res) => {
    const dados = registroSchema.parse(req.body);

    const jaExiste = await prisma.usuario.findUnique({ where: { email: dados.email } });
    if (jaExiste) throw requisicaoInvalida('Já existe uma conta com este e-mail');

    const usuario = await prisma.usuario.create({
      data: {
        nome: dados.nome,
        email: dados.email,
        senhaHash: await gerarHash(dados.senha),
        telefone: dados.telefone || null,
        empresa: dados.empresa || null,
        documento: dados.documento || null,
      },
    });

    const perfil = mapearUsuario(usuario);
    res.status(201).json({
      token: gerarToken({ id: usuario.id, email: usuario.email, role: usuario.role, nome: usuario.nome }),
      usuario: perfil,
    });
  }),
);

rotasAutenticacao.post(
  '/login',
  limitadorLogin,
  assincrono(async (req, res) => {
    const dados = loginSchema.parse(req.body);
    const usuario = await prisma.usuario.findUnique({ where: { email: dados.email } });
    if (!usuario || !(await conferirSenha(dados.senha, usuario.senhaHash))) {
      throw naoAutorizado('E-mail ou senha incorretos');
    }
    if (!usuario.ativo) throw naoAutorizado('Conta desativada. Fale com a central de serviços.');

    res.json({
      token: gerarToken({ id: usuario.id, email: usuario.email, role: usuario.role, nome: usuario.nome }),
      usuario: mapearUsuario(usuario),
    });
  }),
);

rotasAutenticacao.get(
  '/eu',
  exigirAutenticacao,
  assincrono(async (req, res) => {
    const usuario = await prisma.usuario.findUnique({ where: { id: req.usuario!.id } });
    if (!usuario || !usuario.ativo) throw naoAutorizado();
    res.json({ usuario: mapearUsuario(usuario) });
  }),
);

rotasAutenticacao.put(
  '/eu',
  exigirAutenticacao,
  assincrono(async (req, res) => {
    const dados = perfilSchema.parse(req.body);
    const usuario = await prisma.usuario.update({
      where: { id: req.usuario!.id },
      data: {
        nome: dados.nome,
        telefone: dados.telefone || null,
        empresa: dados.empresa || null,
        documento: dados.documento || null,
      },
    });
    res.json({ usuario: mapearUsuario(usuario) });
  }),
);
