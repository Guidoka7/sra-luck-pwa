# Fluxo de desenvolvimento — Sra. Luck PWA

## Branches

- `develop`: desenvolvimento, integração e homologação/preview.
- `main`: produção.
- `feature/*`: opcionalmente usadas para desenvolver funcionalidades isoladas antes de integrar em `develop`.

## Fluxo obrigatório

```text
feature/*
    ↓
develop
    ↓
Teste local (Next.js + Hot Reload)
    ↓
Preview / Homologação
    ↓
Aprovação
    ↓
Pull Request develop → main
    ↓
Produção
```

## Desenvolvimento local

```bash
npm install
npm run dev
```

O Next.js fornece Hot Reload durante o desenvolvimento.

## Validação antes da aprovação

```bash
npx tsc --noEmit
npm run build
```

O GitHub Actions também executa essas validações automaticamente em pushes para `develop` e em Pull Requests direcionados para `main`.

## Netlify

O `netlify.toml` define contextos separados para `develop`, `deploy-preview` e `production`.

No painel da Netlify, mantenha:

- `main` como **Production branch**;
- variáveis de ambiente de produção separadas das de preview/homologação;
- variáveis de banco de homologação separadas quando o banco de testes for criado.

A configuração no repositório não substitui essas configurações de conta da Netlify.

## Banco de dados

Atualmente não foi feita nenhuma migração nem alteração de banco nesta etapa. Antes de usar homologação com dados reais, criar um projeto Supabase separado para desenvolvimento/homologação e manter o projeto de produção isolado.

## Segredos

Nunca faça commit de `.env.local`, `service_role`, chaves VAPID privadas ou outros segredos. Use as variáveis de ambiente locais e as variáveis protegidas da plataforma de hospedagem.

## Produção

A promoção para `main` deve ocorrer somente após aprovação explícita. Nenhum deploy de produção faz parte desta etapa.
