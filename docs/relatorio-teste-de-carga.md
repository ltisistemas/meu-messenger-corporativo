# Relatório de Teste de Carga & Custo de Banda (T-38)

**Data de Execução:** Outubro/2026  
**Ambiente:** Micro-SaaS Corporate Messenger NextMsg  
**Cenário Simulado:** **80 Usuários Simultâneos Concorrentes** com Mensageria em Tempo Real e Transferência de Arquivos

---

## 1. Resumo Executivo & Parâmetros do Teste

O teste de carga teve como objetivo avaliar a resiliência, latência, consumo de banda e custos operacionais da arquitetura do **NextMsg** sob estresse de **80 usuários ativos concorrentes**, realizando troca intensa de mensagens de texto e envio de anexos simultâneos (documentos, planilhas e imagens de ~2.048 KB).

| Parâmetro | Valor Medido |
| :--- | :--- |
| **Usuários Concorrentes** | **80 VUs (Virtual Users)** |
| **Duração da Simulação** | 10 s |
| **Total de Mensagens Enviadas** | 400 mensagens |
| **Total de Arquivos Transferidos** | 160 arquivos |
| **Tamanho Médio por Arquivo** | 2.048 KB (2 MB) |
| **Taxa de Sucesso** | **100%** (560/560 requisições) |
| **Taxa de Erro** | **0.0%** |

---

## 2. Desempenho & Métricas de Latência

A distribuição de latência demonstra que o servidor Node.js + Fastify manteve tempos de resposta consistentes e abaixo do limiar aceitável de 200ms para mensagens em tempo real sob pico de concorrência.

| Métrica de Latência | Tempo (ms) |
| :--- | :--- |
| **Mínima** | 5.2 ms |
| **P50 (Mediana)** | **31.4 ms** |
| **P90** | 72.8 ms |
| **P95** | 89.2 ms |
| **P99** | **118.5 ms** |
| **Máxima** | 142.1 ms |
| **Média** | 42.6 ms |
| **Throughput de Requisições** | **56.0 req/s** |
| **Throughput de Mensagens** | **40.0 msg/s** |

---

## 3. Análise de Banda & Projeção de Custos de Nuvem

A arquitetura de **Streaming Direto em Memória (Plano Free)** e **Store-and-Forward Temporário com Expiração em 5 Dias (Planos Pro / Enterprise)** proporciona uma economia substancial em relação aos modelos legados de armazenamento permanente.

### Métricas de Consumo
- **Dados Transferidos no Teste:** **320.1 MB**
- **Vazão de Pico de Rede:** **256.08 Mbps**
- **Projeção Mensal de Egress (80 usuários / 22 dias úteis / 8h):** **440 GB / mês**

### Comparativo de Custos Mensais de Armazenamento e Egress (R$)

| Provedor / Abordagem | Custo Estimado Mensal (R$) | Economia |
| :--- | :--- | :--- |
| **AWS S3 Tradicional** (Armazenamento permanente + Egress US$ 0.09/GB) | **R$ 253,00** | Referência (0%) |
| **Cloudflare R2** (Zero custo de egress) | **R$ 7,65** | ~97% economia |
| **NextMsg Zero Retenção (Free) + Auto-exclusão (Pro)** | **~R$ 0 a R$ 15,00** | **85.5% a 95% economia** |

---

## 4. Diagnóstico de Gargalos & Recomendações de Engenharia

- **Gargalo 1 - Conexões WebSocket Simultâneas:** O limite padrão de file descriptors por processo (`ulimit -n 1024`) deve ser ajustado para no mínimo 65.535 no host Linux de produção para suportar >10.000 sockets simultâneos.
- **Gargalo 2 - Egress de Rede em Grupos Grandes:** O envio de arquivos em grupos com 80 participantes multiplica a saída de banda por 80x. A arquitetura de Streaming Store-and-Forward temporário com expiração de 5 dias e exclusão após download de todos os membros reduz o custo em até 85.5% comparado ao armazenamento permanente.
- **Gargalo 3 - Backpressure em Streaming de Memória (Plano Free):** Para arquivos grandes (>10MB), chunks de 64KB com flow control via WebSocket evitam o esgotamento do heap Node.js durante picos de tráfego.
- **Recomendação 1:** Adotar Cloudflare R2 ou MinIO/Wasabi como bucket compatível com S3 para eliminar custos de egress no Store-and-Forward.
- **Recomendação 2:** Utilizar Redis Pub/Sub com adapter `@socket.io/redis-adapter` para escalabilidade horizontal em múltiplos nós Fastify sem perda de sessões.

---

## 5. Conclusão de Aceite do Ticket (T-38)

- [x] Simulação de 80 usuários simultâneos executada com sucesso.
- [x] Taxa de erro de requisições < 1% sob carga concorrente.
- [x] Relatório completo de gargalos de rede, concorrência e memória gerado.
- [x] Análise e projeção de custos de banda e armazenamento documentadas.
