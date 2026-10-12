# NextMsg

Plataforma corporativa de mensageria multi-tenant com foco em privacidade radical, produtividade e conformidade total com a LGPD para pequenas e médias equipes.

## Language

**Organização**:
A entidade corporativa (tenant) que contrata a plataforma e possui isolamento estrito de dados, membros e configurações.
_Avoid_: Empresa, cliente, conta de usuário

**Colaborador**:
Usuário associado a uma organização com um papel de acesso atribuído (`owner`, `admin` ou `member`).
_Avoid_: Operador, funcionário avulso, usuário genérico

**Plano Free**:
Modalidade de entrada para até 12 colaboradores, caracterizada por transferência de arquivos via streaming em memória sem gravação em disco ou bucket.
_Avoid_: Versão grátis, plano básico

**Plano Pro**:
Modalidade para equipes de até 80 colaboradores com store-and-forward temporário em bucket S3/R2 por até 5 dias, canais de transmissão e enquetes.
_Avoid_: Plano intermediário, plano premium

**Plano Enterprise**:
Modalidade corporativa para organizações com colaboradores ilimitados e assinaturas eletrônicas com certificado de evidências SHA-256.
_Avoid_: Plano ilimitado, plano customizado

**Trial de 14 dias**:
Período de avaliação integral do Plano Pro concedido a novas organizações sem exigência de cartão de crédito no momento do cadastro.
_Avoid_: Degustação, teste temporário

**Canal Comunicados (Lista de Transmissão)**:
Canal oficial exclusivo da organização no qual administradores publicam mensagens institucionais sem respostas públicas desordenadas.
_Avoid_: Grupo de avisos, lista de transmissão comum

**Grupo Temporário**:
Conversa coletiva com data e hora de expiração programadas na criação, transicionando automaticamente para arquivamento e somente leitura ao expirar.
_Avoid_: Chat efêmero, grupo autodestrutivo

**Limiar de Cobertura (Coverage Threshold)**:
Metas numéricas mínimas e inegociáveis de execução de testes automatizados (95% em linhas, declarações e funções; 90% em ramos) aplicadas por pacote do monorepo, cujo descumprimento bloqueia a compilação e a integração contínua.
_Avoid_: Meta de testes, porcentagem de código

**Superfície Testável (Testable Surface)**:
Conjunto de módulos, serviços, rotas, componentes, hooks, stores e utilitários que contêm lógica de negócio ativa da aplicação, excluindo arquivos de configuração de ferramentas, tipos puros declarativos e migrações geradas por ORM.
_Avoid_: Código testável, escopo de teste
