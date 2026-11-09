# Elemental Write

Um estúdio local de escrita de roteiros, em português do Brasil. React + TypeScript + Vite, com um único motor de edição (ProseMirror), IndexedDB (Dexie) e arquivos reais. Não utiliza contas externas, serviços de nuvem, IA ou chaves de API.

## Instalar e iniciar

Requer Node.js 22.12+ (validado com Node 24) e npm. Na pasta do projeto:

```sh
npm ci
npm run dev
```

Abra o endereço informado pelo Vite no seu computador. Crie um perfil local com nome e e-mail, sem senha. O projeto **Além do horizonte** é uma demonstração com duas cenas, dois personagens e uma nota. Cada perfil recebe sua própria demonstração uma única vez; excluí-la não a recria.

```sh
npm test          # regras do editor, IndexedDB, conflitos, backup e formatos
npm run build    # verificação TypeScript e build de produção
npm run preview  # servir o build de produção
```

O teste de interface requer o servidor iniciado em outro terminal e Chromium:

```sh
npx playwright install chromium  # se não houver Chromium do sistema
npm run test:browser
npm run test:screenplay  # planos, Insert, números de cena e responsividade
npm run test:production # espelho, capa editável e PDFs de produção
```

O teste usa `/usr/bin/chromium` quando disponível, ou o navegador instalado pelo Playwright. `CHROMIUM_PATH` e `BASE_URL` podem ajustar o executável e o endereço **dos testes**, sem serem necessários à aplicação. Usa um contexto de navegador isolado, com dados fictícios. Registra capturas e arquivos em `artifacts/` (ignorado pelo Git).

O teste específico do autosave usa um relógio simulado no Chromium e IndexedDB real. Com o servidor de desenvolvimento na porta 5174, execute `npm run test:autosave` (ou ajuste `BASE_URL`). Ele verifica digitação contínua até os cinco minutos, ciclos posteriores, ausência de gravações sem alterações e limpeza de temporizadores ao fechar o documento.

## Versão localhost pronta para distribuir

`npm run package:local` gera `releases/Elemental-Write-Local.zip`, com o build, fontes, logo, um servidor Node sem dependências e iniciadores para Windows, macOS e Linux. Extraia o ZIP inteiro, instale Node.js LTS e execute `Iniciar-Windows.bat` no Windows ou `node iniciar.cjs` nos demais sistemas. O iniciador tenta abrir o navegador; o endereço é `http://localhost:5173`. Mantenha o terminal aberto durante o uso. O pacote pronto não precisa de `npm install` nem de internet para executar.

O servidor escuta somente em `127.0.0.1`. Uma porta ocupada gera aviso e não troca a origem silenciosamente. Use sempre o mesmo endereço e navegador para acessar seus dados. Dados da versão na nuvem não são incluídos no ZIP: transfira-os por backup JSON. Os iniciadores estão em `localhost/` e o empacotador em `scripts/package-local.mjs`.

## Publicação no Vercel

O arquivo `vercel.json` configura o framework Vite, a instalação com `npm ci`, o build com `npm run build` e a saída `dist`. No projeto Vercel conectado a este repositório, use a branch de produção `main` e a raiz do repositório como Root Directory. Não são necessárias variáveis de ambiente. Use Node.js 22.12+ (o build foi validado com Node.js 24).

Um push para `main` aciona o deploy quando a integração Git do projeto está habilitada. A hospedagem serve a aplicação, mas o armazenamento continua no navegador: não há sincronização de projetos entre dispositivos. Para transferir textos do localhost ao domínio publicado, exporte e restaure um backup JSON.

## Fluxo disponível

- Perfis locais separados, perfil ativo restaurado e preferência de tema por perfil.
- Projetos com título, descrição e datas; criação, edição e exclusão confirmada.
- Vários roteiros e notas por projeto; abrir, renomear, duplicar e excluir documentos.
- Oito tipos reais de bloco, incluindo Plano e Insert, estilos monoespaçados de 12 pt, papel Carta ou A4, navegação por cenas, lista e sugestões de personagens.
- Negrito, itálico, sublinhado, marca-texto amarelo, busca, zoom, palavras, contador de páginas visível no canto inferior direito, numeração, título e autor, capa automática no PDF, folha de rosto opcional no DOCX e modo foco.
- Salvamento automático a cada 5 minutos enquanto o documento estiver aberto, inclusive durante digitação contínua. Também salva depois de 650 ms sem digitação, na troca de documento, ao ocultar a página e manualmente. Sem alterações pendentes, não faz gravações desnecessárias. O indicador só diz “Salvo neste navegador” após concluir a transação. Abas em segundo plano podem ter seus temporizadores limitados pelo navegador; ao ocultar a página, o aplicativo também tenta salvar imediatamente.
- Exportação de PDF, DOCX, Fountain, FDX e JSON. Notas também podem ser exportadas como TXT. Backup completo de projetos com roteiros e notas.
- Importação Fountain/TXT, FDX, DOCX e PDF com texto selecionável, sempre com prévia e revisão dos tipos antes de criar um novo roteiro. Restauração JSON cria um novo projeto.
- Interface responsiva, temas claro e escuro, diálogos com foco contido e suporte ao teclado.

### Interface Foco essencial

A área de escrita usa tons de carvão e papel, sem barras laterais fixas. O contador no canto inferior direito mostra o total de páginas do roteiro, sem folha de rosto, e acompanha as edições e o tamanho de papel selecionado. Ele permanece visível no celular e no modo foco. Clique na marca **Elemental Write** no canto superior esquerdo para abrir projetos, roteiros, notas e perfil. **Cenas**, no canto inferior esquerdo, abre o índice e a lista de personagens. Os painéis podem ser fechados com Escape e devolvem o foco ao controle que os abriu.

A barra flutuante reúne tipos de bloco, formatação, histórico, busca, salvamento, zoom e modo foco. Selecione um trecho no roteiro e use **Grifar texto** para aplicar ou remover o marca-texto amarelo; ele combina com negrito, itálico e sublinhado e participa do desfazer/refazer. Sem seleção, o botão ativa o grifo para a próxima digitação. O grifo é salvo no navegador e preservado no backup JSON, no PDF exportado e no DOCX (inclusive na reimportação de DOCX). Fountain e FDX exportam o texto sem marca-texto; a importação assistida de PDF também não reconstrói esse destaque. O menu de três pontos ao lado de **Exportar** reúne importação, configurações de página, tema e ajuda. No celular, a barra usa duas linhas e a escrita se adapta à largura da tela; PDF e DOCX continuam usando as medidas reais da página. A aparência do editor não altera seus textos nem a estrutura dos documentos salvos.

Os cabeçalhos de cena exibem um número no canto superior direito da primeira linha, inclusive quando o texto ocupa várias linhas ou começa após uma quebra de página. A sequência é recalculada ao editar, excluir ou trocar o tipo dos blocos, começando em 1 em cada roteiro. Esses números são indicadores do editor, separados do texto salvo e das exportações.

Escolher **Plano** abre uma lista ilustrada com grande plano geral, plano geral, plano de conjunto, plano americano, plano médio, primeiro plano, primeiríssimo plano, plano detalhe e **Voice Over (VO)**. A escolha insere o nome seguido de `—`, pronto para a descrição; Voice Over começa com `VOICE OVER (VO) —` para escrever a narração sobre a imagem. O ícone de câmera abre o guia visual de contornos minimalistas e permite aplicar ou trocar uma opção sem perder a descrição. VO usa um símbolo de microfone e áudio. Escape cancela sem alterar o bloco. **Insert** começa automaticamente com `INSERT `, sem repetir o prefixo. Enter após Plano ou Insert abre um bloco de ação.

### Espelho de cinco colunas

No menu de três pontinhos de um roteiro, escolha **Espelho**. A mesma opção está em **Mais opções** no editor. A tabela usa Cena, Texto falado, Indicação da fala, Lettering e Descrição de cena. Cada bloco de diálogo gera uma linha, com o número da cena repetido em todas as suas falas; cenas sem fala mantêm uma linha para suas ações. Personagens, parênteses, indicações de VO/off, planos e ações são distribuídos automaticamente. Voice Over escrito como bloco de Plano vira texto falado com indicação Off (VO). Todo bloco **Insert** alimenta automaticamente **Lettering**, removendo o prefixo `INSERT` e preservando o texto e suas quebras de linha. Marcadores opcionais como `LETTERING:` ou `TEXTO NA TELA:` também são removidos; outros tipos de bloco continuam reconhecendo esses marcadores explícitos. Espelhos criados com a regra anterior são atualizados ao serem abertos, mantendo os ajustes manuais.

Todas as células e os campos de produção são editáveis. O roteirista vem da autoria, o status inicial é Rascunho e a versão inicial é 1. Revisão, aprovação e anotações ficam disponíveis para preenchimento. O tempo automático considera 150 palavras faladas por minuto: é uma referência de locução, sem calcular pausas e duração das ações, e pode ser substituído manualmente.

Os ajustes são salvos junto ao documento pelo mesmo autosave, sem modificar o texto do roteiro. **Atualizar do roteiro** traz mudanças nas ações, falas e numeração, preservando os campos ajustados e as linhas manuais. Se uma fala/cena alterada não permitir associar um ajuste com segurança, a linha antiga é mantida e sinalizada para revisão. Linhas removidas manualmente não reaparecem enquanto a fala de origem permanecer a mesma. A tabela pode ser exportada em PDF ou CSV; o PDF repete cabeçalhos e o número da cena quando uma linha muito longa continua em outra página. Capa do projeto e ajustes dos espelhos fazem parte do backup JSON.

### Capa automática do roteiro

O PDF sempre começa com uma capa sem número, inspirada no modelo de roteiro do PDF de referência. O modelo inicial mostra nome do projeto, nome do roteiro e autoria em fonte monoespaçada centralizada. O texto do roteiro começa na página 1 depois da capa, e o contador do editor continua contando apenas as páginas do roteiro.

Nos três pontinhos de um projeto, no painel de navegação ou na lista de projetos, escolha **Editar capa**. O editor permite criar, remover e arrastar blocos de texto, editar sua posição e largura em porcentagem, mudar tamanho da fonte, alinhamento, negrito e itálico e acrescentar contato ou qualquer texto livre. As variáveis `{projeto}`, `{roteiro}` e `{autor}` são preenchidas a cada exportação. Uma única capa atende aos diferentes roteiros do projeto; o seletor de prévia permite conferir cada um antes de salvar. Use **Salvar capa** para confirmar a edição. Textos que ultrapassem a página são sinalizados, e edições concorrentes em outra aba são rejeitadas para evitar sobrescrita.

### Teclado

| Bloco preenchido | Enter cria |
| ---------------- | ---------- |
| Cabeçalho        | Ação       |
| Ação             | Ação       |
| Personagem       | Diálogo    |
| Diálogo          | Personagem |
| Parênteses       | Diálogo    |
| Transição        | Cabeçalho  |
| Plano            | Ação       |
| Insert           | Ação       |

- **Shift+Enter**: quebra de linha no mesmo bloco.
- **Enter** em personagem vazio: muda para ação, sem acumular blocos.
- **Backspace** no início de bloco vazio: retorna a ação; outro Backspace pode unir blocos pelo comportamento do motor.
- **Tab / Shift+Tab**: percorre tipos; o seletor da barra também permite trocar o tipo.
- Ao escolher **Parênteses**, o editor insere `()` e posiciona o cursor dentro. Se o bloco já tiver texto, ele é envolvido pelos parênteses sem perder a formatação. Enter ao final da indicação abre a fala seguinte, mantendo o fechamento no bloco de parênteses.
- **INT.**, **EXT.** ou **INT./EXT.** seguidos de espaço em ação: reconhece cabeçalho.
- Sugestões de personagens: **↑/↓** escolhem, **Enter ou Tab** aceita sem criar outro bloco; o Enter seguinte abre a fala. **Esc** fecha. Clique também aceita.
- **Ctrl/⌘+B, I, U**: marcas de texto; **Ctrl/⌘+Z** desfaz; **Ctrl/⌘+Shift+Z** refaz.
- **Ctrl/⌘+S**: salva imediatamente.

Texto colado simples é separado por linhas: a primeira mantém o tipo atual; as demais viram ação, com reconhecimento posterior de cabeçalhos. Texto rico do clipboard é normalizado para o esquema aceito. Enter no meio do texto preserva os dois lados e o histórico é gerenciado pelo ProseMirror. Atalhos respeitam a composição do teclado.

### Dados, segurança local e backup

Os perfis **não são autenticação segura**. Seus dados pertencem ao navegador e à origem utilizada (protocolo, domínio e porta). Abrir em outro navegador ou outra origem não transfere o conteúdo. Não há limite artificial de projetos ou documentos; vale a cota disponível de IndexedDB.

**Limpar os dados do site, usar navegação privada ou perder o perfil do navegador pode apagar tudo.** No menu Exportar, escolha **Backup do projeto inteiro** e guarde o JSON fora do navegador. Na tela de projetos use **Restaurar backup**, ou importe o JSON dentro de um projeto. A restauração mantém textos, marcas, títulos, autoria, preferências da página e notas, criando IDs novos no perfil atual. O backup é de projeto; não é um backup das preferências e de todos os perfis.

Cada documento tem revisão. A comparação e a gravação acontecem na mesma transação IndexedDB: uma segunda aba com revisão antiga recebe conflito em vez de sobrescrever silenciosamente. O editor mantém seu texto e oferece **Exportar texto atual**. Exporte essa cópia antes de recarregar e reconciliar as versões. Não há colaboração nem mesclagem automática. Falhas de armazenamento também preservam o texto e permitem tentar de novo. Alterações feitas menos de 650 ms antes de encerrar abruptamente o navegador podem não ter sido gravadas; salve manualmente ao terminar.

### Corretor ortográfico

Editor e notas usam `spellcheck=true` e `lang=pt-BR`, sem interceptar o menu de contexto. Ative o corretor e instale/ative o dicionário de português (Brasil) no navegador. Os sublinhados e as sugestões dependem do navegador e do sistema. Não há correção gramatical ou serviço externo.

## Formatos e limites reais

- **PDF**: gerado em fundo branco com DejaVu Sans Mono incorporada, variantes de estilo, acentos, Carta/A4, capa automática do projeto e páginas do roteiro numeradas. Editor e exportação compartilham as regras de medidas, recuos e paginação; a visualização do editor depende do layout do navegador. Blocos muito longos são divididos em linhas/páginas. O planejador reserva espaço para personagem, parênteses e início da fala, evitando personagem isolado. Ao reimportar PDFs identificados como gerados pelo Elemental Write, o importador ignora a capa para não transformá-la em texto de cena.
- **DOCX**: texto editável e estilos nomeados de roteiro, recuos em medidas reais, marcas de texto, paginação e folha de rosto opcional. A fonte precisa estar instalada na máquina que abrir o Word; os arquivos TTF e a licença estão em `public/fonts`. O Word pode substituir a fonte ou repaginar; não há promessa de páginas idênticas ao PDF. A importação lê estilos e trechos de texto, inclusive quebras e marcas; estilos desconhecidos recebem classificação aproximada. Tabelas são linearizadas; imagens, comentários, campos e layout complexo não são reconstruídos. Uma folha de rosto importada pode aparecer como blocos a revisar.
- **Fountain**: suporta elementos principais, cabeçalhos forçados, ações forçadas, personagens forçados, parênteses, transições e marcas básicas. Exporta blocos com marcadores explícitos. Recursos avançados como diálogos duplos, omissões, metadados multilinha e notas de produção não são interpretados integralmente; texto não reconhecido permanece como ação na prévia. Use JSON para preservação integral do modelo, especialmente blocos vazios ou sequências não convencionais.
- **Plano e Insert nos arquivos**: PDF mantém o texto e a apresentação em caixa alta; DOCX usa estilos próprios; FDX usa o elemento padrão `Shot`, diferenciando Insert pelo prefixo ao reimportar. Fountain representa ambos como ações forçadas e o importador reconhece os prefixos dos enquadramentos e `INSERT`. JSON preserva os tipos e marcas integralmente.
- **FDX**: intercâmbio dos tipos de roteiro e das marcas básicas de texto, título e autor. Não implementa revisões coloridas, produção, diálogos duplos ou todos os metadados específicos do Final Draft. XML inválido ou com entidades externas é rejeitado.
- **Importação PDF**: extrai texto por posição, com classificação aproximada; quebras de linhas, cabeçalhos/rodapés e recuos podem exigir revisão. PDFs sem texto recebem uma mensagem de **OCR não incluído**. Não reconstrói páginas escaneadas nem promete fidelidade perfeita.
- **JSON versão 1**: formato de backup validado antes de qualquer gravação; restauração transacional e sem sobrescrever projetos existentes. Backups de versões desconhecidas são rejeitados.

Os testes geram e leem PDFs/DOCX com suas bibliotecas e fazem downloads e importações pelo navegador. Não foi executado Microsoft Word ou Final Draft para validar suas interfaces nativas. O build inclui um worker PDF e bibliotecas de arquivos; o bundle de exportação é maior que o de um editor só de texto.

## Organização

- `src/model.ts`: contratos do domínio e regras puras.
- `src/editor/schema.ts`: esquema ProseMirror, comandos e reconhecimento.
- `src/editor/layout.ts`: página, recuos, quebra de linhas e planejamento compartilhados.
- `src/editor/Editor.tsx`: integração do motor, sugestões, busca e separadores de páginas.
- `src/data/repository.ts`: interface `Repository` e implementação IndexedDB substituível.
- `src/data/useDocument.ts`: fila serial de autosave, debounce, estado e recuperação de falhas.
- `src/mirror/`: geração por fala, ajustes do espelho e exportações da tabela.
- `src/cover/`: capa do projeto, editor de blocos e layout compartilhado da prévia/PDF.
- `src/io/`: arquivos, validação e backup, separados da interface.
- `src/App.tsx` e `src/ui.tsx`: telas, diálogos e controles em português.
- `tests/`: regras, armazenamento, arquivos e fluxo real no Chromium.

A substituição futura por armazenamento remoto deve implementar `Repository`, incluindo o contrato de revisões, e trocar o fluxo de perfis. Não há conexão Supabase implementada.

## Licenças e identidade

O editor usa bibliotecas abertas declaradas em `package.json`, com versões resolvidas em `package-lock.json`. Não foi copiado código dos três projetos sugeridos. A fonte DejaVu inclui sua licença em `public/fonts/LICENSE-DejaVu.txt`. A logo em `public/logo.png` foi preparada a partir da imagem fornecida, com fundo transparente para uso nos dois temas.

As ilustrações de enquadramento em `public/shot-guide.png` foram geradas para o guia de planos do aplicativo.
