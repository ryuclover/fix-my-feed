# Origem e decisões de implementação

Na preparação local, os dois projetos foram clonados integralmente em `upstream/`, preservando seus históricos Git. Esses clones ficam apenas no computador de desenvolvimento e não fazem parte deste repositório público:

| Projeto | Repositório | Commit consultado |
| --- | --- | --- |
| YouTube Fresh Home | https://github.com/rhMaeda/youtube-fresh-home | 2b5103cedd0555cdf7f09c65d892a457e5c216d3 |
| Fresh Recs for YouTube | https://github.com/CIGIBWARIN/fresh-recs | 193b22401c01d21bf6076a0a86ba45388c146354 |

O primeiro repositório disponibiliza somente `privacy-policy.html`, sem código da extensão ou licença de software. Por isso não foi possível mesclar seu código. A reposição automática, limite de tentativas, espera e limite de memória foram implementados aqui a partir das funcionalidades publicamente descritas, sem extrair código do pacote da loja.

O Fresh Recs publica o código e sua página no Mozilla Add-ons informa licença MIT, mas o commit consultado não inclui um arquivo LICENSE. Ele foi lido como referência de comportamento: contagem por visita, escopos de filtragem, bloqueio/desfazer, expiração, modo esmaecido e identificação de cartões do YouTube.

Para não depender dessa lacuna de licenciamento, os arquivos de `extension/` são uma implementação própria. Nenhum arquivo JavaScript, CSS, HTML ou ícone dos projetos foi copiado para os pacotes. A licença da raiz se aplica somente à implementação nova; os clones continuam sujeitos aos direitos de seus autores.

Melhorias locais: persistência serializada pelo background entre abas; validação de configurações; tempo mínimo de exposição; registro de assistido por reprodução real em vez de simplesmente abrir a URL; reposição limitada que tenta restaurar a posição; interface em português.

Páginas usadas para conferir a distribuição e as funcionalidades:

- https://chromewebstore.google.com/detail/youtube-fresh-home/kpgnkknidcphhipaljkpldpceojiecic
- https://addons.mozilla.org/en-US/firefox/addon/fresh-recs-for-youtube/

Verificação: 17 de novembro de 2026.
