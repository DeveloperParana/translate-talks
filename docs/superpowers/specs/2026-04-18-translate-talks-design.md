# Translate Talks — Design Spec

## Problema

O DevParaná precisa de uma ferramenta de transcrição em tempo real para palestras, voltada para acessibilidade de pessoas com deficiência auditiva. A transcrição deve ser projetada em um telão/monitor secundário no evento.

## Abordagem

Aplicação web estática single-page (HTML + CSS + JS vanilla) que usa a Web Speech API nativa do Chrome para transcrição em tempo real. Sem backend, sem framework, sem build tools. O áudio é capturado pelo microfone do dispositivo conectado ao palco.

## Arquitetura

```
translate-talks/
├── index.html          # Página principal
├── css/
│   └── styles.css      # Estilos + temas claro/escuro
├── js/
│   ├── app.js          # Inicialização e orquestração
│   ├── speech.js       # Módulo de reconhecimento de voz
│   └── ui.js           # Controles de UI (tema, fonte, etc.)
└── assets/
    └── devparana.svg    # Logo DevParaná
```

### Módulos

**`speech.js`** — Encapsula a Web Speech API:
- Cria e gerencia a instância de `SpeechRecognition`
- Configuração: `lang = 'pt-BR'`, `continuous = true`, `interimResults = true`
- Expõe callbacks: `onInterim(text)`, `onFinal(text)`, `onError(error)`, `onStatusChange(status)`
- Implementa auto-restart transparente: ao receber `onend`, reinicia automaticamente se o usuário não solicitou parada
- Tratamento de erros: em `no-speech` ou `audio-capture`, tenta reconectar após 2 segundos
- Expõe métodos `start()` e `stop()`

**`ui.js`** — Gerencia a interface:
- Toggle de tema claro/escuro (persiste no `localStorage`)
- Controle de tamanho da fonte (A- / A+), com limites min/max (persiste no `localStorage`)
- Auto-hide da barra de controles: desaparece após 3 segundos sem movimento do mouse, reaparece ao mover
- Indicador de status (gravando / parado)
- Gerencia a exibição do texto na área de transcrição

**`app.js`** — Orquestração:
- Inicializa `speech.js` e `ui.js`
- Conecta os callbacks do speech aos métodos de exibição do ui
- Gerencia o estado geral (gravando / parado)
- Bind dos botões de controle

## Interface

### Área de Transcrição (90% da tela)

- Fundo ocupa tela inteira
- Texto centralizado verticalmente
- Últimas 3 frases finalizadas exibidas em cor principal (branco no tema escuro, preto no claro)
- Frase atual (interim) exibida em verde DevParaná (`#15a04b`) para diferenciar do texto final
- Auto-scroll suave conforme novas frases chegam
- Frases antigas saem por cima — estilo legendas de TV
- Frases descartadas do DOM após sair da área visível (performance)

### Barra de Controles (fixa no topo)

- Semi-transparente com backdrop blur
- Auto-hide após 3 segundos sem mouse; reaparece ao mover
- Conteúdo da esquerda para a direita:
  - Logo DevParaná (pequena, ~32px)
  - Botão Iniciar/Parar (ícone play/stop)
  - Botão de tema (ícone sol/lua)
  - Controle de fonte (A- / A+)
  - Indicador de status (🔴 gravando / ⚪ parado)

## Temas

### Tema Escuro (padrão)
- Fundo: `#1a1a2e` (azul escuro profundo)
- Texto final: `#ffffff`
- Texto interim: `#15a04b` (verde DevParaná)
- Controles: fundo semi-transparente `rgba(0, 0, 0, 0.6)` com blur

### Tema Claro
- Fundo: `#f5f5f5`
- Texto final: `#1a1a2e`
- Texto interim: `#15a04b` (verde DevParaná)
- Controles: fundo semi-transparente `rgba(255, 255, 255, 0.8)` com blur

## Comportamento do Speech Recognition

- **Idioma:** `pt-BR` (fixo)
- **Modo:** Contínuo com resultados intermediários
- **Auto-restart:** Ao receber evento `onend`, reinicia automaticamente se não houve comando de parada do usuário. Isso contorna o timeout de ~60s de silêncio do Chrome.
- **Erros tratados:**
  - `no-speech`: Silencioso, tenta reconectar após 2s
  - `audio-capture`: Exibe mensagem na tela ("Microfone não detectado"), tenta reconectar após 2s
  - `not-allowed`: Exibe mensagem ("Permissão de microfone negada")
  - `network`: Exibe mensagem ("Sem conexão com serviço de transcrição")
- **Sem persistência:** Nada é salvo. Recarregar a página limpa tudo.
- **Gestão de memória para palestras longas:** Tanto o DOM quanto o array JavaScript de frases são limitados às últimas 3 frases finalizadas + 1 interim. Frases antigas são removidas do array e do DOM imediatamente ao ultrapassar o limite. Isso garante consumo de memória constante independente da duração da palestra (mesmo palestras de 2h+ não acumulam dados).

## Tecnologias

- HTML5, CSS3, JavaScript ES Modules (vanilla)
- Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`)
- Nenhum framework, bundler, ou dependência externa
- Compatibilidade: Chrome (desktop) — único navegador com suporte sólido à Web Speech API contínua

## Considerações

- A Web Speech API do Chrome envia áudio para os servidores do Google para processamento. Requer conexão com a internet.
- A qualidade da transcrição depende da qualidade do microfone e do ambiente sonoro.
- Para palestras longas (>1h), o auto-restart garante continuidade sem intervenção manual.
- O operador do telão pode ajustar fonte e tema conforme as condições de iluminação do evento.
