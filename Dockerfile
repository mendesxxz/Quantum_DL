FROM node:18-slim

RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    curl \
    && ln -s /usr/bin/python3 /usr/bin/python \
    && pip install --no-cache-dir --upgrade --break-system-packages yt-dlp \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000
CMD ["npm", "start"]
