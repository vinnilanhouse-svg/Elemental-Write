# Privacidade: operação e limites da implementação

Responsável informado pelo proprietário: **Elemental Corp**. Contato público: **coradi.maddaloni@gmail.com**. Revisão técnica: **9 de novembro de 2026**.

## O que o aplicativo implementa

- Aviso de armazenamento necessário no primeiro acesso, com links permanentes para Privacidade e Termos. “Entendi” registra versão e data de leitura, sem registrar consentimento para publicidade, marketing ou análise.
- E-mail opcional e possibilidade de usar apelido. Não há conta externa nem autenticação por e-mail.
- Consulta e correção do perfil, ZIP com dados pessoais e backups de todos os projetos do perfil e exclusão transacional do perfil e de seu conteúdo. Outros perfis são preservados. A exclusão é comunicada às outras abas da mesma origem; gravações e restaurações para perfis/projetos removidos são rejeitadas.
- Exportação não inclui dados de outros perfis. Os JSON de projetos podem ser restaurados pelo importador; perfil.json é uma cópia para consulta.
- Dados do editor em IndexedDB; identificador do perfil ativo e leitura do aviso em LocalStorage. Fontes e bibliotecas são servidas pela própria origem. A aplicação não integra anúncios, pixels, SDKs de analytics ou serviços de IA para tratar os roteiros.
- Páginas públicas em /privacidade.html e /termos.html, disponíveis sem JavaScript e também na distribuição localhost.
- Cabeçalhos de CSP, redução de referência enviada a terceiros, bloqueio de permissões desnecessárias e proteção de tipo de conteúdo no Vercel e no servidor localhost. O pacote compilado é testado com os cabeçalhos aplicados, incluindo PDF e worker de importação.

## Responsabilidades que dependem da Elemental Corp

A entrega de código não certifica conformidade integral com a LGPD. Antes de divulgar o serviço como juridicamente regularizado, o responsável precisa conferir a identificação jurídica utilizada, o enquadramento da operação, as bases legais e os documentos com assessoria habilitada.

O responsável também precisa manter o contato público atendido, definir um procedimento proporcional de identificação e resposta a titulares, observar os prazos legais aplicáveis e definir retenção e exclusão das mensagens recebidas. O aplicativo não envia respostas jurídicas automaticamente.

A configuração da hospedagem Vercel e da caixa de e-mail precisa ser conferida pelo responsável: contratos e papéis dos provedores, acesso administrativo, autenticação e recuperação, registros de acesso, prazos de retenção, localização do tratamento, pedidos de eliminação e mecanismos aplicáveis a transferências internacionais. Essas configurações e contratos não estão no repositório e não foram auditados nesta entrega. HTTPS e mecanismos de segurança do domínio publicado dependem da plataforma e da configuração real de produção.

A política informa que registros técnicos podem ser tratados pela hospedagem e que os prazos dependem da configuração do provedor. Não foram inventados prazos, um CNPJ, nome de encarregado, certificações, garantias de residência de dados no Brasil ou contratos inexistentes. A condição de agente de pequeno porte ou eventual dispensa de encarregado precisa ser avaliada pelo responsável; o contato publicado funciona como canal para os titulares, sem afirmar essa dispensa.

Os perfis locais são uma organização de conteúdo, sem senha, criptografia adicional ou separação segura entre pessoas que compartilham o mesmo navegador. Para uso com dados sensíveis, de crianças/adolescentes ou em uma organização, o responsável deve avaliar medidas, bases legais e regras adicionais apropriadas. Arquivos exportados, e-mails e cópias fora desta origem não são apagados pelo botão de exclusão do aplicativo.

## Mudanças futuras

Se forem acrescentados anúncios, métricas, integrações externas, login remoto, colaboração, serviços de IA ou armazenamento em servidor, é necessário revisar o inventário e os avisos antes de ativar o novo tratamento. Cookies e tecnologias opcionais que dependam de consentimento devem ficar bloqueados até uma escolha válida, com recusa e retirada acessíveis, sem opções previamente marcadas. Não reutilizar “Entendi” como consentimento para uma finalidade nova.

Os dados do contato estão em src/privacy/config.ts, privacidade.html e termos.html. Os testes verificam a consistência. Atualize a versão do aviso quando houver uma mudança material que deva ser apresentada novamente.

## Referências e verificação

- LGPD: https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm
- ANPD: https://www.gov.br/anpd/pt-br
- Política do provedor: https://vercel.com/legal/privacy-policy

A consulta direta aos portais oficiais foi bloqueada pelo proxy de rede deste ambiente (HTTP 403 em 9 de novembro de 2026). Por isso, esta entrega não afirma ter confirmado a versão mais recente de normas, guias ou contratos externos. As referências devem ser conferidas pelo responsável na revisão jurídica.
