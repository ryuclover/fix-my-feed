# Fix My Feed

Extensão para o YouTube no computador com controles em português. Reúne os comportamentos úteis do Fresh Recs e do YouTube Fresh Home em uma implementação própria. Veja [ORIGINS.md](ORIGINS.md) para os clones, commits e limites de acesso ao código original.

## Instalar no Chrome, Edge ou Brave

Baixe o ZIP do código pelo botão **Code → Download ZIP** do GitHub e extraia, ou clone:

```powershell
git clone https://github.com/ryuclover/fix-my-feed.git
```

Para instalar direto do código, use a pasta `extension`, que já contém o manifesto do Chrome/Edge. As pastas `dist/` são geradas localmente pelo comando de build abaixo e não fazem parte do repositório.

1. Abra `chrome://extensions` (Edge: `edge://extensions`; Brave: `brave://extensions`).
2. Ative **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação** e selecione a pasta `dist/chrome` dentro deste projeto. A pasta `extension` também pode ser carregada diretamente.
4. Recarregue as abas abertas do YouTube.
5. Abra o popup da extensão para ajustar os filtros.

Não carregue os clones de `upstream/`: a versão unificada está em `extension/` e nos pacotes de `dist/`. Mantenha a pasta instalada no disco. Ao atualizar o código, rode `npm run build`, recarregue a extensão na página de extensões e recarregue o YouTube.

## Experimentar no Firefox

Gere a pasta `dist/firefox` seguindo os comandos de **Desenvolvimento** abaixo.

Abra `about:debugging#/runtime/this-firefox`, clique em **Carregar extensão temporária** e selecione `dist/firefox/manifest.json`. A instalação temporária termina quando o Firefox fecha. Para instalação permanente no Firefox comum, o pacote precisa passar por assinatura da Mozilla; o ZIP gerado não é assinado.

## O que vem junto

- Oculta uma recomendação após três visitas em que ela ficou pelo menos 50% visível por 800 ms. O limite é configurável. Ela permanece até o fim da visita em que atingiu o limite.
- Contagens expiram após sete dias sem nova aparição; assistidos são lembrados por até 180 dias, respeitando o limite de memória.
- Assistido significa reprodução detectada no player ou barra de progresso que o YouTube exibe. Não é uma importação completa do seu histórico e não mede conclusão do vídeo.
- × para bloquear um vídeo, com **Desfazer** por sete segundos e opção de restaurar todos no popup.
- Modos ocultar/esmaecer, controles independentes para Home, lateral de vídeos e Shorts nos feeds. Busca, inscrições e canais não são filtrados.
- Home: tenta carregar até haver 24 cartões disponíveis, com no máximo seis tentativas e espera de 1,5 s por tentativa. São cartões carregados, não necessariamente todos dentro da tela.
- **Renovar feed** remove, só na visita atual, os cartões já vistos nessa visita e tenta completar com outras sugestões. Recarregar a página usa a regra normal de contagem.
- Limite padrão de 10 mil registros automáticos. Bloqueios explícitos ficam até você restaurar e não são apagados pelo limite automático.
- Escritas de todas as abas passam por uma fila no background. Sem servidor, chamadas externas próprias ou telemetria. Os dados ficam no armazenamento local da extensão, separados por perfil e navegador.

## Limitações

A reposição usa a continuação normal do YouTube: rola temporariamente até o marcador de carregamento e depois restaura a posição. Interação do usuário durante a tentativa interrompe as próximas tentativas e evita sobrescrever a posição escolhida por ele. No modo esmaecido, a reposição fica inativa.

Não é possível garantir vídeos inéditos nem alterar o algoritmo do servidor. Se o YouTube não fornecer alternativas, a página pode continuar curta. O YouTube muda o HTML com frequência; os seletores no início de `content.js` podem precisar de manutenção. O aplicativo móvel não é coberto.

O funcionamento foi verificado por testes automatizados com páginas simuladas, não em uma conta real do YouTube. A primeira instalação deve confirmar o comportamento no layout recebido pela sua conta.

## Desenvolvimento

Requer Node.js 22.12 ou superior e Python 3 para empacotar os ZIPs.

```powershell
npm ci --ignore-scripts
npm test
npm run build
```

Os arquivos prontos ficam em `dist/chrome`, `dist/firefox`, `dist/fix-my-feed-chrome.zip` e `dist/fix-my-feed-firefox.zip`. Para Chrome, carregue a pasta descompactada. Nenhum pacote inclui os clones, testes ou dependências de desenvolvimento.

Esta extensão não tem vínculo com o YouTube, Google ou os projetos de referência.
