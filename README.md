# 🪨📄✂️ Pedra, Papel e Tesoura — Webcam AI Game

Um jogo de **Pedra, Papel e Tesoura** que usa a webcam e um modelo de **Machine Learning** (Teachable Machine) para detectar os gestos da mão em tempo real. Desafie o computador mostrando seu gesto na câmera!

---

## 📸 Screenshots

<!-- Substitua os caminhos abaixo por prints reais do projeto rodando -->

| Tela inicial | Countdown | Resultado |
|:---:|:---:|:---:|
| ![Tela inicial](screenshots/01-idle.png) | ![Countdown](screenshots/02-countdown.png) | ![Resultado](screenshots/03-result.png) |

> **Dica:** Salve seus prints na pasta `screenshots/` do repositório.

---

## 🎯 Motivação

Este projeto foi criado para **colocar à prova um modelo de classificação de imagens** treinado com o [Google Teachable Machine](https://teachablemachine.withgoogle.com/). O objetivo é ter um ambiente divertido e interativo — um joguinho web estático — para testar se o modelo consegue distinguir corretamente entre os gestos de **pedra**, **papel**, **tesoura** e o estado **idle** (mão parada / sem gesto).

Por ser um site 100% estático (sem backend), pode ser hospedado gratuitamente em qualquer provedor como **Netlify**, **Vercel**, **GitHub Pages**, **Cloudflare Pages**, etc.

---

## 🕹️ Como funciona

1. O usuário permite acesso à **webcam**
2. O modelo TensorFlow.js é carregado a partir de um arquivo `.zip` (extraído em memória via JSZip)
3. A detecção roda em **tempo real** — um badge mostra o gesto detectado ao vivo
4. Ao clicar em **JOGAR**, inicia um **countdown de 3 segundos**
5. No fim do countdown, o modelo captura o gesto e o computador escolhe aleatoriamente
6. O **resultado** (vitória, derrota ou empate) é exibido com animações
7. O placar acumula os pontos da sessão

---

## 🧠 O Modelo

O modelo foi treinado no **Teachable Machine** (Google) com 4 classes:

| Classe | Descrição |
|--------|-----------|
| `idle` | Sem gesto / mão parada |
| `rock` | Pedra (punho fechado) |
| `paper` | Papel (mão aberta) |
| `scisors` | Tesoura (dois dedos) |

O modelo é um **MobileNet** fine-tuned, exportado no formato TensorFlow.js. Os arquivos (`model.json`, `metadata.json`, `weights.bin`) estão empacotados em `public/model.zip` e são extraídos no browser usando **JSZip**, depois carregados diretamente na memória com `tf.io.fromMemory()`.

---

## 🏗️ Arquitetura do Código

```
src/
├── components/
│   ├── GameArena.tsx        # Componente principal do jogo (UI + lógica de rodada)
│   └── WebcamView.tsx       # Componente de webcam com ref imperativa
├── hooks/
│   ├── useTeachableModel.ts # Carregamento do modelo TM e inferência
│   └── useGameLogic.ts      # Lógica do jogo (fases, placar, resultado)
├── pages/
│   └── Index.tsx            # Página raiz que renderiza o GameArena
└── index.css                # Design system (tokens, animações, utilitários)
```

### Principais decisões técnicas

- **`useTeachableModel.ts`** — Carrega o `.zip` do modelo, extrai os arquivos com JSZip, concatena os buffers de peso e usa `tf.io.fromMemory()` para evitar requests HTTP adicionais para os pesos (que causavam problemas com blob URLs aninhadas).

- **`useGameLogic.ts`** — Máquina de estados com 4 fases: `waiting` → `countdown` → `capture` → `result`. Gerencia placar, escolha do computador e lógica de vitória.

- **`GameArena.tsx`** — Loop de predição contínuo via `requestAnimationFrame` para feedback em tempo real. Na captura, faz 5 leituras consecutivas e usa votação majoritária para aumentar a confiabilidade.

- **`WebcamView.tsx`** — Componente com `forwardRef` + `useImperativeHandle` para expor o elemento `<video>` ao componente pai.

---

## 🛠️ Tecnologias

| Tecnologia | Uso |
|-----------|-----|
| **React + TypeScript** | Framework UI |
| **Vite** | Build tool e dev server |
| **Tailwind CSS** | Estilização com design tokens |
| **TensorFlow.js** | Inferência do modelo no browser |
| **JSZip** | Extração do modelo empacotado |
| **shadcn/ui** | Componentes base |

---

## 🚀 Como rodar localmente

```sh
# Clone o repositório
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>

# Instale as dependências
npm install

# Rode o servidor de desenvolvimento
npm run dev
```

Acesse `http://localhost:5173` e permita o acesso à câmera.

---

## 📦 Deploy estático

Faça o build e hospede a pasta `dist/` em qualquer provedor:

```sh
npm run build
```

A pasta `dist/` contém tudo necessário, incluindo o `model.zip`. Compatível com:
- [Netlify](https://netlify.com) (arraste a pasta `dist/`)
- [Vercel](https://vercel.com)
- [GitHub Pages](https://pages.github.com)
- [Cloudflare Pages](https://pages.cloudflare.com)

---

## 📄 Licença

Projeto de uso pessoal/educacional. Sinta-se livre para adaptar e usar como quiser.
