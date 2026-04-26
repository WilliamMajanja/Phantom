
# Use a Debian Trixie-based Node.js runtime to match Raspberry Pi OS Trixie.
FROM node:22-trixie

# Set the working directory
WORKDIR /app

# Install system dependencies for Raspberry Pi GPIO and Audio
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    libgpiod-dev \
    python3-gpiozero \
    pipewire \
    pipewire-audio-client-libraries \
    alsa-utils \
    curl \
    sudo \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js dependencies
COPY package*.json ./
RUN npm ci

# Copy the rest of the application code
COPY . .

# Build the React application
RUN npm run build
RUN npm prune --omit=dev

# Expose the port the app runs on
EXPOSE 3000

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

CMD ["npm", "run", "start"]
