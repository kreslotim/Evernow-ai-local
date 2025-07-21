FROM node:20-slim AS builder

WORKDIR /app

COPY package.json yarn.lock ./

# Install system dependencies for image processing and fonts
RUN apt-get update -y && apt-get install -y \
    openssl \
    fontconfig \
    fonts-dejavu \
    fonts-dejavu-core \
    fonts-dejavu-extra \
    libvips-dev \
    libvips42 \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Install custom fonts before rebuilding font cache
COPY src/fonts/ /tmp/fonts/
RUN mkdir -p /usr/share/fonts/truetype/custom && \
    find /tmp/fonts -name "*.ttf" -o -name "*.otf" | xargs -I {} cp {} /usr/share/fonts/truetype/custom/ 2>/dev/null || true && \
    chmod 644 /usr/share/fonts/truetype/custom/* 2>/dev/null || true && \
    fc-cache -f -v && \
    rm -rf /tmp/fonts

RUN yarn install --frozen-lockfile --production=false

COPY . .

RUN yarn prisma generate --schema=./prisma/schema.prisma && yarn build

CMD ["sh", "-c", "yarn prisma migrate deploy --schema=./prisma/schema.prisma && yarn start:prod"]