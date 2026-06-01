# VagaWin - TODO

## Schema e Banco de Dados
- [x] Criar tabela de vagas (garagem_vagas)
- [x] Criar tabela de apartamentos (garagem_apartamentos)
- [x] Criar tabela de sorteios (garagem_sorteios)
- [x] Criar tabela de resultados de sorteio (garagem_sorteio_resultados - embutido em sorteios.resultado JSON)
- [x] Executar migrations

## Backend (tRPC Routers)
- [x] Router de vagas: listar, criar, editar, excluir, alternar status
- [x] Router de apartamentos: listar, criar, editar, excluir, alternar status
- [x] Router de sorteio: executar sorteio criptograficamente seguro
- [x] Router de histórico: listar sorteios, buscar resultado por ID
- [x] Router de dashboard: estatísticas gerais

## Layout e Design
- [x] Configurar tema claro corporativo elegante no index.css
- [x] Configurar fontes (Inter)
- [x] Criar DashboardLayout com sidebar para VagaWin
- [x] Criar componente de header com usuário logado
- [x] Registrar todas as rotas no App.tsx

## Páginas
- [x] Dashboard (Home) com cards e gráficos
- [x] Página de Cadastro de Vagas (listagem + modal criar/editar)
- [x] Página de Cadastro de Apartamentos (listagem + modal criar/editar)
- [x] Página de Sorteio com animação profissional
- [x] Página de Resultado do Sorteio com exportações
- [x] Página de Histórico de Sorteios

## Funcionalidades Especiais
- [x] Animação de sorteio: embaralhamento visual, barra de progresso, mensagens
- [x] Algoritmo de sorteio criptograficamente seguro (Fisher-Yates + Web Crypto API)
- [x] Exportação de resultado em PDF (jsPDF + autoTable)
- [x] Exportação de resultado em Excel (xlsx)
- [x] Impressão do resultado
- [x] Registro do responsável pelo sorteio

## Testes
- [x] Testes do router de vagas
- [x] Testes do router de apartamentos
- [x] Testes do algoritmo de sorteio
- [x] Testes do router de histórico
