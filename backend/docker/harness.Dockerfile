# Image for running coding harnesses in Docker (coder sandbox "docker" or "auto").
# Build once, from the backend folder:  docker build -t loopmates-harness -f docker/harness.Dockerfile .
# The job workspace is mounted at /w and a per-job COPY of your harness login at /home/coder; nothing else is shared.
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates python3 python3-pip \
 && rm -rf /var/lib/apt/lists/*
RUN npm install -g @anthropic-ai/claude-code @openai/codex opencode-ai && npm cache clean --force
RUN useradd -m -d /home/coder coder && mkdir -p /w && chown coder /w
USER coder
ENV HOME=/home/coder CI=1
WORKDIR /w
