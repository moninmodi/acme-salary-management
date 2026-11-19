FROM node:22-alpine AS ui
WORKDIR /ui
COPY package*.json ./
RUN npm ci
COPY index.html vite.config.js ./
COPY src ./src
RUN npm run build

FROM python:3.11-slim-bookworm
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends mariadb-server && rm -rf /var/lib/apt/lists/*
WORKDIR /home/jovyan
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt notebook jupyterlab jupyterhub jupyter-server-proxy
RUN useradd --uid 1000 --home-dir /home/jovyan jovyan && chown jovyan:jovyan /home/jovyan
COPY --chown=jovyan backend ./backend
COPY --from=ui --chown=jovyan /ui/dist ./dist
COPY --chmod=755 binder/start-demo /usr/local/bin/start-demo
USER jovyan
ENV HOME=/home/jovyan USER=jovyan
ENTRYPOINT ["start-demo"]
CMD ["uvicorn", "backend.demo:app", "--host", "0.0.0.0", "--port", "8000"]
