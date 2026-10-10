<h1 align="center">SpokeMemo</h1>

<p align="center">
  <strong>Transcrição de reuniões com identificação de falantes e resumo por IA</strong>
</p>

<p align="center">
  <a href="#o-que-faz">O que faz</a> •
  <a href="#requisitos">Requisitos</a> •
  <a href="#rodar-nesta-máquina">Rodar nesta máquina</a> •
  <a href="#rodar-em-uma-vps">Rodar em uma VPS</a> •
  <a href="#configuração">Configuração</a> •
  <a href="#operação">Operação</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/FastAPI-009688?style=flat&logo=fastapi&logoColor=white" alt="FastAPI"/>
  <img src="https://img.shields.io/badge/React-61DAFB?style=flat&logo=react&logoColor=black" alt="React"/>
  <img src="https://img.shields.io/badge/PyTorch-EE4C2C?style=flat&logo=pytorch&logoColor=white" alt="PyTorch"/>
  <img src="https://img.shields.io/badge/PostgreSQL-4169E1?style=flat&logo=postgresql&logoColor=white" alt="PostgreSQL"/>
  <img src="https://img.shields.io/badge/NVIDIA-CUDA-76B900?style=flat&logo=nvidia&logoColor=white" alt="CUDA"/>
  <img src="https://img.shields.io/badge/licença-MIT-blue" alt="Licença MIT"/>
</p>

O SpokeMemo converte áudio de reuniões em texto, separa quem falou e gera um resumo com pontos principais e ações. A transcrição roda no seu servidor. O resumo usa um modelo de linguagem com API compatível com a da OpenAI, como Ollama, LM Studio ou vLLM.

## O que faz

| Recurso | Descrição |
|---------|-----------|
| Gravação e envio | Grava no navegador ou envia MP3, WAV, M4A, FLAC, WebM e OGG (até 100 MB) |
| Transcrição | faster-whisper, com detecção de idioma |
| Falantes | PyAnnote identifica e rotula cada participante |
| Áudio sincronizado | O trecho em reprodução acompanha o texto; um clique no trecho salta o áudio |
| Resumo | Pontos principais, decisões e ações, via LLM |
| Exportação | PDF e Markdown da transcrição e do resumo |
| Perfil de hardware | Escolhe modelo e precisão conforme a VRAM, com teto opcional de memória da GPU |

## Requisitos

| Item | Local (esta máquina) | VPS |
|------|----------------------|-----|
| Runtime | Podman e o plugin `docker-compose` | Docker Engine e Docker Compose |
| GPU | NVIDIA opcional. Sem GPU, use o perfil `cpu` | NVIDIA opcional, com [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html) |
| LLM | Opcional. Sem ele, a transcrição funciona e o resumo não | Igual |
| Disco | Cerca de 10 GB para imagens e modelos | Igual |
| Memória | 8 GB de RAM; 16 GB deixam o sistema mais folgado | Igual |

A primeira subida baixa imagens e modelos. Pode levar vários minutos.

## Rodar nesta máquina

O script `up.sh` sobe o Podman com as imagens no disco do projeto, não no disco do sistema.

```bash
cd /run/media/system/DadosBazzite/projetos/SpokeMemo
./up.sh up -d
```

Abra **https://localhost:8443**. O certificado é local. Aceite o aviso do navegador para continuar. A gravação pelo microfone exige HTTPS.

O resumo usa o Ollama em `http://host.containers.internal:11434`, modelo `qwen3.5:9b`. A transcrição não depende dele.

Nesta instalação a GPU é a RTX 3000 Ada, no perfil `balanced`, com uso limitado a 70% da VRAM. No Fedora e no Bazzite, o contêiner só enxerga a placa se o SELinux permitir dispositivos:

```bash
sudo setsebool -P container_use_devices 1
./up.sh up -d --no-deps --force-recreate spokememo-backend
```

## Rodar em uma VPS

### 1. Preparar o servidor

Em Ubuntu ou Debian:

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl
# Docker Engine: https://docs.docker.com/engine/install/ubuntu/
sudo usermod -aG docker "$USER"
```

Saia e entre de novo na sessão para o grupo `docker` valer. Com GPU NVIDIA, instale o driver e o NVIDIA Container Toolkit antes de subir o backend.

### 2. Configurar

```bash
git clone <url-deste-repositório> SpokeMemo
cd SpokeMemo
cp example.env .env
```

Edite o `.env`. O mínimo para a transcrição com falantes é o `HF_TOKEN`. O mínimo para o resumo é a URL e o nome do modelo.

```env
HF_TOKEN=hf_seu_token
LLM_API_URL=http://host.docker.internal:11434
LLM_MODEL_NAME=qwen3.5:9b
LLM_API_KEY=
POSTGRES_PASSWORD=troque-esta-senha
TIMEZONE_OFFSET=-4
HTTP_PORT=80
HTTPS_PORT=443
HARDWARE_PROFILE=auto
```

Aceite as licenças dos modelos e crie um token com permissão de leitura:

- [pyannote/speaker-diarization-3.1](https://huggingface.co/pyannote/speaker-diarization-3.1)
- [pyannote/segmentation-3.0](https://huggingface.co/pyannote/segmentation-3.0)
- [tokens Hugging Face](https://huggingface.co/settings/tokens)

O perfil `high` ainda exige a licença de [speaker-diarization-community-1](https://huggingface.co/pyannote/speaker-diarization-community-1).

`localhost` dentro do contêiner é o próprio contêiner. No Docker, aponte o LLM do host para `http://host.docker.internal:11434`. No Podman, use `http://host.containers.internal:11434`.

Sem GPU, defina `HARDWARE_PROFILE=cpu` e comente o bloco `devices` do serviço `spokememo-backend` no `docker-compose.yml`.

### 3. Subir

```bash
docker compose up -d --build
```

Abra **https://IP-da-VPS**. Com as portas padrão, HTTP fica em `80` e HTTPS em `443`. Se a porta 443 já estiver em uso, defina `HTTPS_PORT` no `.env` e suba de novo.

Libere no firewall só o que for publicar:

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

O certificado inicial é autoassinado. Para um domínio público, troque pelos arquivos do Let's Encrypt montando-os no serviço `nginx`:

```yaml
nginx:
  volumes:
    - /etc/letsencrypt/live/seu.dominio/fullchain.pem:/etc/ssl/certs/cert.pem:ro
    - /etc/letsencrypt/live/seu.dominio/privkey.pem:/etc/ssl/private/key.pem:ro
```

Depois: `docker compose up -d`. Detalhes adicionais estão em [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Configuração

| Variável | Função |
|----------|--------|
| `HF_TOKEN` | Acesso aos modelos de diarização no Hugging Face |
| `LLM_API_URL` | Base da API do modelo, sem `/v1/chat/completions` |
| `LLM_MODEL_NAME` | Nome do modelo no servidor |
| `LLM_API_KEY` | Chave, se o servidor exigir |
| `POSTGRES_PASSWORD` | Senha do Postgres. Troque em produção |
| `TIMEZONE_OFFSET` | Fuso dos horários exportados, por exemplo `-4` |
| `HTTP_PORT` / `HTTPS_PORT` | Portas publicadas no host. Aqui: `8080` e `8443` |
| `HARDWARE_PROFILE` | `auto`, `cpu`, `low`, `balanced`, `high` ou `custom` |
| `GPU_MEMORY_FRACTION` | Fração da VRAM deste processo, de `0` a `1`. Ex.: `0.7` |
| `NVIDIA_VISIBLE_DEVICES` | Quais GPUs o contêiner vê. `all` ou `0` |

Um valor explícito de `WHISPER_MODEL_NAME`, `COMPUTE_TYPE`, `PYANNOTE_MODEL_NAME` ou `DEVICE` prevalece sobre o perfil.

| Perfil | VRAM | Whisper | Precisão | Diarização |
|--------|------|---------|----------|------------|
| `cpu` | nenhuma | base | int8 | speaker-diarization-3.1 |
| `low` | cerca de 4 GB | small | int8_float16 | speaker-diarization-3.1 |
| `balanced` | cerca de 8 GB | turbo | float16 | speaker-diarization-3.1 |
| `high` | 12 GB ou mais | large-v3 | float16 | speaker-diarization-community-1 |
| `custom` | — | só o que estiver no `.env` | | |

Com `auto`, menos de 8 GB cai em `low`, de 8 a 12 GB em `balanced`, e 12 GB ou mais em `high`. O perfil em uso aparece no log do backend e em `GET /api/v1/system`.

`GPU_MEMORY_FRACTION=0.7` impede que o PyTorch ocupe a placa inteira. Útil quando a mesma GPU também desenha a área de trabalho.

## Uso

1. Envie um áudio ou grave no navegador.
2. Inicie a transcrição.
3. Revise o texto, os falantes e os horários.
4. Acompanhe pelo player: o trecho ativo fica marcado, e um clique nele move o áudio.
5. Renomeie os falantes se quiser.
6. Gere o resumo.
7. Exporte em PDF ou Markdown.

## Operação

Nesta máquina, prefixe os comandos com `./up.sh`. Na VPS, use `docker compose`.

```bash
./up.sh ps
./up.sh logs -f spokememo-backend
./up.sh restart spokememo-backend
./up.sh down
```

Mudou o `.env` ou o código do backend? Recrie o serviço para a alteração valer:

```bash
./up.sh up -d --no-deps --build --force-recreate spokememo-backend
```

Cópia do banco, nesta máquina:

```bash
./up.sh exec spokememo-postgres pg_dump -U meetmemo meetmemo > backup.sql
```

Na VPS, o equivalente é `docker compose exec spokememo-postgres pg_dump -U meetmemo meetmemo > backup.sql`.

Console do banco:

```bash
./up.sh exec spokememo-postgres psql -U meetmemo meetmemo
```

## Segurança

A transcrição permanece no servidor. O áudio segue para fora apenas se o resumo chamar um LLM externo. O Postgres não é publicado na rede do host. A interface não tem login: em VPS compartilhada, coloque autenticação ou restrinja o acesso por firewall ou VPN.

## Documentação técnica

Os guias em [`docs/`](docs/) continuam em inglês: arquitetura, API, configuração, banco, deploy e desenvolvimento.

## Licença

MIT. Veja [LICENSE](LICENSE).
